import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";
const safeCompany = (value: unknown) => String(value || "polartech-principal").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "polartech-principal";
const stateId = (company: string, dedicated: boolean) => dedicated ? "workprojects" : `workprojects-${safeCompany(company)}`;
export async function GET(request: NextRequest) {
  const session=readSession(request.cookies.get("proar_session")?.value); if(!session)return NextResponse.json({error:"Sessão inválida."},{status:401});
  const company=session.companyId||safeCompany(request.nextUrl.searchParams.get("company")); const db=await resolveTenantDb(session.companyId); if(!db.url||!db.key)return NextResponse.json({error:"Base de dados indisponível."},{status:503});
  const response=await fetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId(company,db.dedicated))}&select=payload`,{headers:tenantHeaders(db.key),cache:"no-store"}); if(!response.ok)return NextResponse.json({error:"Não foi possível carregar as obras."},{status:502});
  const rows=await response.json() as {payload?:Record<string,unknown>}[]; return NextResponse.json({state:rows[0]?.payload??null,dedicatedDatabase:db.dedicated});
}
export async function PUT(request: NextRequest) {
  const session=readSession(request.cookies.get("proar_session")?.value); if(!session)return NextResponse.json({error:"Sessão inválida."},{status:401}); const body=await request.json(); const company=session.companyId||safeCompany(body.companyId); const db=await resolveTenantDb(session.companyId); if(!db.url||!db.key)return NextResponse.json({error:"Base de dados indisponível."},{status:503});
  const id=stateId(company,db.dedicated), h=tenantHeaders(db.key); const currentResponse=await fetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`,{headers:h,cache:"no-store"}); const currentRows=currentResponse.ok?await currentResponse.json() as {payload?:{revision?:number;projects?:unknown[]}}[]:[]; const current=currentRows[0]?.payload; const currentRevision=Number(current?.revision||0); const baseRevision=Number(body.baseRevision||0);
  if(current&&baseRevision!==currentRevision)return NextResponse.json({error:"A lista de obras possui uma versão mais recente.",conflict:true,state:current},{status:409}); const payload={companyId:company,projects:Array.isArray(body.projects)?body.projects:[],revision:currentRevision+1,updatedAt:new Date().toISOString()};
  const saveResponse=await fetch(`${db.url}/rest/v1/proar_state?on_conflict=id`,{method:"POST",headers:{...h,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id,payload,updated_at:new Date().toISOString()})}); return saveResponse.ok?NextResponse.json({saved:true,state:payload,dedicatedDatabase:db.dedicated}):NextResponse.json({error:"Não foi possível salvar as obras."},{status:502});
}
