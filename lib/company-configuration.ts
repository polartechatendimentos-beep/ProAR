import "server-only";
import { createHash } from "node:crypto";
import { normalizeContractedModules,moduleNamesFromIds } from "./module-catalog";

type CompanyRecord=Record<string,unknown>;
type EntitlementRecord=Record<string,unknown>;

export function companyConfigurationVersion(company:CompanyRecord,entitlements:EntitlementRecord[]=[]){
  const normalized={
    id:String(company.id||""),
    status:String(company.status||""),
    plan:String(company.plan_code||"trial"),
    modules:normalizeContractedModules(company.modules).sort(),
    trialExpiresAt:company.trial_expires_at||null,
    updatedAt:company.updated_at||null,
    entitlements:entitlements.map(item=>({
      module:String(item.module_name||""),
      enabled:Boolean(item.enabled),
      updatedAt:item.updated_at||null,
      plan:item.plan_code||null,
    })).sort((a,b)=>a.module.localeCompare(b.module)),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0,16);
}

export function buildCompanyConfiguration(company:CompanyRecord,entitlements:EntitlementRecord[]=[]){
  const entitlementById=new Map<string,EntitlementRecord>();
  for(const item of entitlements){
    const ids=normalizeContractedModules([item.module_name]);
    if(ids[0])entitlementById.set(ids[0],item);
  }
  const fromCompany=normalizeContractedModules(company.modules);
  const knownIds=[...new Set([...fromCompany,...entitlementById.keys()])];
  const activeIds=knownIds.filter(id=>{
    const entitlement=entitlementById.get(id);
    return entitlement?Boolean(entitlement.enabled):fromCompany.includes(id);
  });
  const suspendedIds=knownIds.filter(id=>!activeIds.includes(id));
  const version=companyConfigurationVersion(company,entitlements);
  return{
    planCode:String(company.plan_code||"trial"),
    companyStatus:String(company.status||""),
    configurationVersion:version,
    configurationUpdatedAt:company.updated_at?String(company.updated_at):null,
    contractedModuleIds:activeIds,
    contractedModules:moduleNamesFromIds(activeIds),
    suspendedModuleIds:suspendedIds,
    suspendedModules:moduleNamesFromIds(suspendedIds),
    moduleCounts:{active:activeIds.length,blocked:suspendedIds.length,total:knownIds.length},
    expiresAt:company.trial_expires_at?String(company.trial_expires_at):null,
  };
}
