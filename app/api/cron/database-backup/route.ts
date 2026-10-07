import { NextRequest,NextResponse } from "next/server";
import { createExternalDatabaseBackup } from "../../../../lib/database-backup";
import { supabaseRest } from "../../../../lib/supabase-rest";

export const runtime="nodejs";
export const maxDuration=60;

function authorized(request:NextRequest){
  const secret=String(process.env.CRON_SECRET||"");
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({error:"Não autorizado."},{status:401});
  const companyId=String(process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal");
  try{
    const backup=await createExternalDatabaseBackup(companyId,"daily");
    await supabaseRest("proar_state?on_conflict=id",{
      method:"POST",
      headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({
        id:`backup-status:${companyId}`,
        payload:{status:"ok",...backup,retentionDays:30,checkedAt:new Date().toISOString()},
        updated_at:new Date().toISOString(),
      }),
    }).catch(()=>null);
    return NextResponse.json({ok:true,backup});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await supabaseRest("proar_state?on_conflict=id",{
      method:"POST",
      headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({
        id:`backup-status:${companyId}`,
        payload:{status:"error",message,checkedAt:new Date().toISOString()},
        updated_at:new Date().toISOString(),
      }),
    }).catch(()=>null);
    return NextResponse.json({ok:false,error:"Backup externo não concluído.",detail:message},{status:503});
  }
}
