import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";
import { databaseFetch } from "../../../lib/supabase-rest";
import { runProarTestLab, summarizeTestLab, type TestLabState } from "../../../lib/test-lab";

export async function GET(request:NextRequest){
  const access=requirePermission(request,"integridade.visualizar");
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
  const scope=sessionCompany(access.session);
  if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status});
  const db=await resolveTenantDb(scope.companyId);
  if(!db.url||!db.key)return NextResponse.json({error:"Banco do tenant indisponível."},{status:503});
  const stateId=db.dedicated?"main":scope.companyId;
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId)}&select=payload`,{headers:tenantHeaders(db.key),cache:"no-store"});
  if(!response.ok)return NextResponse.json({error:"Não foi possível executar o Test Lab."},{status:503});
  const rows=await response.json() as {payload?:TestLabState}[];
  const state=rows[0]?.payload||{};
  const scenarios=runProarTestLab(state);
  return NextResponse.json({checkedAt:new Date().toISOString(),companyId:scope.companyId,scenarios,totals:summarizeTestLab(scenarios),readOnly:true});
}