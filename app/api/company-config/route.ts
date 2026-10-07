import { NextRequest,NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { validateCompanyAccess,validateCompanyAccessBySlug } from "../../../lib/company-access";
import { listCompanyModuleEntitlements } from "../../../lib/manager-billing";
import { buildCompanyConfiguration } from "../../../lib/company-configuration";
import { identityClaims } from "../../../lib/identity-claims";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const PRIMARY_COMPANY_ID=process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal";
const PRIMARY_COMPANY_SLUG=(process.env.PROAR_PRIMARY_COMPANY_SLUG||"polartech").trim().toLowerCase();

export async function GET(request:NextRequest){
  const session=readSession(request.cookies.get("proar_session")?.value);
  if(!session)return NextResponse.json({state:"error",code:"PROAR-AUTH-001",error:"Sessão expirada."},{status:401});

  const companyId=String(session.companyId||PRIMARY_COMPANY_ID);
  const companySlug=String(session.companySlug||PRIMARY_COMPANY_SLUG);
  const access=companySlug
    ?await validateCompanyAccessBySlug(companySlug)
    :await validateCompanyAccess(companyId);

  if(!access.ok){
    if(access.code==="SYSTEM_BLOCKED"||access.code==="TRIAL_EXPIRED"){
      return NextResponse.json({
        state:"blocked",
        code:access.code,
        error:access.reason,
        companyId,
      },{status:403,headers:{"Cache-Control":"no-store"}});
    }
    return NextResponse.json({
      state:"error",
      code:access.code||"MANAGER_UNAVAILABLE",
      error:access.reason||"Não foi possível carregar a configuração da empresa.",
      preserveCachedConfiguration:true,
      companyId,
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }

  if(!access.configurationAvailable||!access.company||!Array.isArray(access.company.modules)){
    return NextResponse.json({
      state:"error",
      code:"COMPANY_CONFIGURATION_UNAVAILABLE",
      error:"A configuração de módulos não pôde ser confirmada pelo ProAR Manager.",
      preserveCachedConfiguration:true,
      companyId,
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }

  const entitlements=await listCompanyModuleEntitlements(String(access.company.id||companyId)).catch(()=>[]);
  const configuration=buildCompanyConfiguration(access.company,entitlements);
  const claims=[...new Set([...(session.claims||[]),...identityClaims({username:session.username,permissions:session.permissions})])];

  return NextResponse.json({
    state:"ready",
    company:{
      id:String(access.company.id||companyId),
      slug:String(access.company.slug||companySlug),
      tradeName:String(access.company.trade_name||""),
      status:String(access.company.status||""),
    },
    plan:{
      code:configuration.planCode,
      expiresAt:configuration.expiresAt,
    },
    modules:{
      contractedIds:configuration.contractedModuleIds,
      contracted:configuration.contractedModules,
      suspendedIds:configuration.suspendedModuleIds,
      suspended:configuration.suspendedModules,
      counts:configuration.moduleCounts,
    },
    configuration:{
      version:configuration.configurationVersion,
      updatedAt:configuration.configurationUpdatedAt,
      source:"proar-manager",
    },
    user:{
      username:session.username,
      displayName:session.displayName,
      role:session.role,
      permissions:session.permissions||[],
      claims,
    },
    checkedAt:new Date().toISOString(),
  },{headers:{"Cache-Control":"no-store"}});
}
