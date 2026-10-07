import { NextRequest,NextResponse } from "next/server";
import { healthAccess } from "../../../../lib/health-access";
import { probeCnpjApis,probePncp } from "../../../../lib/external-health";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:NextRequest){
  const access=healthAccess(request);
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
  const [pncp,cnpj]=await Promise.all([probePncp(),probeCnpjApis()]);
  const services=[pncp,cnpj];
  const state=services.some(item=>item.state==="error")?"error":services.some(item=>item.state==="degraded")?"degraded":"ok";
  return NextResponse.json({
    integrations:state,
    pncp:pncp.state,
    cnpj:cnpj.state,
    services,
    checkedAt:new Date().toISOString(),
  },{headers:{"Cache-Control":"no-store"}});
}
