import "server-only";
import { createHash } from "node:crypto";
import { del,list,put } from "@vercel/blob";
import { databaseFetch } from "./supabase-rest";
import { resolveTenantDb,tenantHeaders } from "./tenant-rest";

const TABLES=[
  "proar_state",
  "proar_companies",
  "proar_trial_users",
  "proar_tenant_instances",
  "proar_manager_audit",
  "proar_trial_attempts",
  "proar_manager_receivables",
  "proar_manager_module_entitlements",
  "proar_system_incidents",
  "proar_health_snapshots",
  "proar_state_snapshots",
] as const;

type TableBackup={rows:unknown[];count:number;available:boolean;error?:string};

export type DatabaseBackupArtifact={
  format:"proar-database-backup-v1";
  companyId:string;
  createdAt:string;
  provider:string;
  projectName?:string;
  tables:Record<string,TableBackup>;
  totals:{tables:number;availableTables:number;records:number};
  checksum:string;
};

async function tableRows(db:{url:string;key:string},table:string):Promise<TableBackup>{
  try{
    const response=await databaseFetch(`${db.url}/rest/v1/${table}?select=*&limit=10000`,{headers:tenantHeaders(db.key),cache:"no-store"});
    if(!response.ok)return{rows:[],count:0,available:false,error:`HTTP ${response.status}`};
    const rows=await response.json();
    const listRows=Array.isArray(rows)?rows:[];
    return{rows:listRows,count:listRows.length,available:true};
  }catch(error){
    return{rows:[],count:0,available:false,error:error instanceof Error?error.message:String(error)};
  }
}

export async function createExternalDatabaseBackup(companyId:string,reason="daily"){
  if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error("BLOB_READ_WRITE_TOKEN não configurado.");
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)throw new Error("Banco do tenant não configurado.");

  const entries=await Promise.all(TABLES.map(async table=>[table,await tableRows(db,table)] as const));
  const tables=Object.fromEntries(entries) as Record<string,TableBackup>;
  const totals={
    tables:TABLES.length,
    availableTables:Object.values(tables).filter(item=>item.available).length,
    records:Object.values(tables).reduce((sum,item)=>sum+item.count,0),
  };
  const createdAt=new Date().toISOString();
  const unsigned={
    format:"proar-database-backup-v1" as const,
    companyId,
    createdAt,
    provider:String(db.provider||"unknown"),
    projectName:db.projectName||undefined,
    reason,
    tables,
    totals,
  };
  const serialized=JSON.stringify(unsigned);
  const checksum=createHash("sha256").update(serialized).digest("hex");
  const artifact:DatabaseBackupArtifact={...unsigned,checksum};
  const stamp=createdAt.replace(/[:.]/g,"-");
  const pathname=`backups/${companyId}/${createdAt.slice(0,10)}/proar-${reason}-${stamp}.json`;
  const blob=await put(pathname,JSON.stringify(artifact),{access:"private",contentType:"application/json"});

  await pruneBackups(companyId,30).catch(()=>null);
  return{pathname:blob.pathname,url:blob.url,createdAt,checksum,totals,provider:artifact.provider};
}

export async function pruneBackups(companyId:string,retentionDays=30){
  const cutoff=Date.now()-retentionDays*24*60*60*1000;
  let cursor: string|undefined;
  const stale:string[]=[];
  do{
    const page=await list({prefix:`backups/${companyId}/`,limit:1000,cursor});
    for(const blob of page.blobs){
      const uploaded=new Date(blob.uploadedAt).getTime();
      if(Number.isFinite(uploaded)&&uploaded<cutoff)stale.push(blob.url);
    }
    cursor=page.hasMore?page.cursor:undefined;
  }while(cursor);
  if(stale.length)await del(stale);
  return stale.length;
}

export function summarizeBackupArtifact(artifact:DatabaseBackupArtifact){
  return{
    companyId:artifact.companyId,
    createdAt:artifact.createdAt,
    checksum:artifact.checksum,
    tables:artifact.totals.tables,
    availableTables:artifact.totals.availableTables,
    records:artifact.totals.records,
    tableCounts:Object.fromEntries(Object.entries(artifact.tables).map(([name,value])=>[name,value.count])),
  };
}
