import { NextRequest,NextResponse } from "next/server";
import { runRestoreDrill } from "../../../../lib/restore-drill";
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
    const result=await runRestoreDrill(companyId);
    await supabaseRest("proar_state?on_conflict=id",{
      method:"POST",
      headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({id:`restore-drill-status:${companyId}`,payload:{executionStatus:"ok",...result},updated_at:new Date().toISOString()}),
    }).catch(()=>null);
    return NextResponse.json({ok:true,result});
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await supabaseRest("proar_state?on_conflict=id",{
      method:"POST",
      headers:{Prefer:"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify({id:`restore-drill-status:${companyId}`,payload:{status:"error",message,checkedAt:new Date().toISOString()},updated_at:new Date().toISOString()}),
    }).catch(()=>null);
    return NextResponse.json({ok:false,error:"Teste de restauração não concluído.",detail:message},{status:503});
  }
}
