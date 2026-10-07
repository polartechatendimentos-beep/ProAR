import "server-only";
import { createHash } from "node:crypto";
import { get,list } from "@vercel/blob";
import { createClient } from "@vercel/postgres";
import type { DatabaseBackupArtifact } from "./database-backup";

function safeIdentifier(value:string){
  if(!/^proar_[a-zA-Z0-9_]+$/.test(value))throw new Error("Tabela fora do escopo de restauração.");
  return `"${value}"`;
}

async function latestBackup(companyId:string){
  let cursor:string|undefined;
  const blobs:Array<{pathname:string;url:string;uploadedAt:Date|string}>=[];
  do{
    const page=await list({prefix:`backups/${companyId}/`,limit:1000,cursor});
    blobs.push(...page.blobs);
    cursor=page.hasMore?page.cursor:undefined;
  }while(cursor);
  return blobs.sort((a,b)=>new Date(b.uploadedAt).getTime()-new Date(a.uploadedAt).getTime())[0]||null;
}

async function readArtifact(pathname:string){
  const result=await get(pathname,{access:"private",useCache:false});
  if(!result||result.statusCode!==200)throw new Error("Backup privado não localizado.");
  const raw=await new Response(result.stream).text();
  const artifact=JSON.parse(raw) as DatabaseBackupArtifact & {reason?:string};
  if(artifact.format!=="proar-database-backup-v1")throw new Error("Formato de backup incompatível.");
  const {checksum,...unsigned}=artifact;
  const actual=createHash("sha256").update(JSON.stringify(unsigned)).digest("hex");
  if(actual!==checksum)throw new Error("Checksum do backup não confere.");
  return artifact;
}

export async function runRestoreDrill(companyId:string){
  const blob=await latestBackup(companyId);
  if(!blob)throw new Error("Nenhum backup externo disponível para o teste de restauração.");
  const artifact=await readArtifact(blob.pathname);
  const target=String(process.env.PROAR_RESTORE_DATABASE_URL||"").trim();
  const guard=String(process.env.PROAR_RESTORE_TARGET_GUARD||"").trim();

  const expected=Object.fromEntries(Object.entries(artifact.tables).filter(([,data])=>data.available).map(([name,data])=>[name,data.count]));
  if(!target||guard!=="ALLOW_HOMOLOGATION_RESET"){
    return{
      status:"validated-only" as const,
      backup:blob.pathname,
      backupCreatedAt:artifact.createdAt,
      checksum:artifact.checksum,
      expected,
      restored:null,
      message:"Backup íntegro. Configure um banco exclusivo de homologação e PROAR_RESTORE_TARGET_GUARD=ALLOW_HOMOLOGATION_RESET para executar a restauração real.",
    };
  }

  const client=createClient({connectionString:target});
  await client.connect();
  const restored:Record<string,number>={};
  try{
    await client.query("begin");
    for(const [tableName,table] of Object.entries(artifact.tables)){
      if(!table.available)continue;
      const tableSql=safeIdentifier(tableName);
      const exists=await client.query("select to_regclass($1) as relation",[`public.${tableName}`]);
      if(!exists.rows[0]?.relation)throw new Error(`Tabela ${tableName} não existe no banco de homologação.`);

      const columnsResult=await client.query(
        "select column_name,data_type from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position",
        [tableName],
      );
      const types=new Map(columnsResult.rows.map(row=>[String(row.column_name),String(row.data_type)]));
      await client.query(`delete from ${tableSql}`);

      for(const raw of table.rows){
        if(!raw||typeof raw!=="object")continue;
        const row=raw as Record<string,unknown>;
        const columns=Object.keys(row).filter(column=>types.has(column));
        if(!columns.length)continue;
        const values=columns.map(column=>{
          const value=row[column];
          return ["json","jsonb"].includes(types.get(column)||"") && value!==null ? JSON.stringify(value) : value;
        });
        const placeholders=columns.map((column,index)=>{
          const cast=["json","jsonb"].includes(types.get(column)||"")?"::jsonb":"";
          return `$${index+1}${cast}`;
        });
        const columnSql=columns.map(column=>`"${column.replaceAll('"','""')}"`).join(",");
        await client.query(`insert into ${tableSql} (${columnSql}) values (${placeholders.join(",")})`,values);
      }
      const count=await client.query(`select count(*)::int as count from ${tableSql}`);
      restored[tableName]=Number(count.rows[0]?.count||0);
      if(restored[tableName]!==table.count)throw new Error(`Contagem divergente em ${tableName}: esperado ${table.count}, restaurado ${restored[tableName]}.`);
    }
    await client.query("commit");
  }catch(error){
    await client.query("rollback").catch(()=>null);
    throw error;
  }finally{
    await client.end();
  }

  return{
    status:"restored" as const,
    backup:blob.pathname,
    backupCreatedAt:artifact.createdAt,
    checksum:artifact.checksum,
    expected,
    restored,
    tables:Object.keys(restored).length,
    records:Object.values(restored).reduce((sum,value)=>sum+value,0),
    checkedAt:new Date().toISOString(),
  };
}
