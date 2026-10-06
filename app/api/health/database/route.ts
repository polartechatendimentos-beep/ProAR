import { NextResponse } from "next/server";
import { masterDatabaseConfig, neonEnabled, databaseFetch } from "../../../../lib/supabase-rest";
import { probeDatabase } from "../../../../lib/database-resilience";
import { classifyProarError, proarError } from "../../../../lib/system-errors";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(){
  const {url,key}=masterDatabaseConfig();
  const provider=neonEnabled()?"neon":"supabase";
  if(!url||!key){
    return NextResponse.json({
      ok:false,
      provider,
      configured:false,
      code:proarError("PROAR-DB-001").code,
      message:"Banco principal não configurado no ambiente atual.",
      checkedAt:new Date().toISOString(),
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }

  const probe=await probeDatabase(()=>databaseFetch(
    `${url}/rest/v1/proar_state?select=id&limit=1`,
    {cache:"no-store"},
  ));
  const slow=probe.ok&&probe.latencyMs>2500;
  const failure=probe.ok?null:classifyProarError(probe.detail,probe.status);
  return NextResponse.json({
    ok:probe.ok,
    provider,
    configured:true,
    latencyMs:probe.latencyMs,
    attempts:probe.attempts,
    httpStatus:probe.status||null,
    code:probe.ok?(slow?proarError("PROAR-DB-002").code:null):failure?.code,
    message:probe.ok?(slow?"Banco acessível com latência elevada.":"Banco acessível."):(failure?.userMessage||"Banco principal não respondeu após novas tentativas."),
    checkedAt:probe.checkedAt,
  },{status:probe.ok?200:503,headers:{"Cache-Control":"no-store"}});
}
