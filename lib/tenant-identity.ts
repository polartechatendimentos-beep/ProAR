export type TenantRole = "primary-pilot" | "customer";
export type TenantEnvironment = "pilot" | "production";
export type TenantIsolation = "dedicated-project" | "dedicated-database";

const slugify=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40);

export function tenantDatabaseName(slug:string){
  const normalized=slugify(slug)||"tenant";
  return `proar_${normalized.replace(/-/g,"_")}`.slice(0,63);
}

export function tenantProjectName(slug:string){
  const normalized=slugify(slug)||"tenant";
  return `proar-${normalized}`.slice(0,48);
}

export function tenantIdentity(input:{companyId:string;slug?:string;tradeName?:string;primaryCompanyId?:string;primarySlug?:string}){
  const primaryCompanyId=input.primaryCompanyId||"polartech-principal";
  const primarySlug=(input.primarySlug||"polartech").toLowerCase();
  const slug=slugify(input.slug||input.tradeName||input.companyId);
  const primary=input.companyId===primaryCompanyId||slug===primarySlug;
  return {
    companyId:input.companyId,
    slug,
    role:(primary?"primary-pilot":"customer") as TenantRole,
    environment:(primary?"pilot":"production") as TenantEnvironment,
    isolation:"dedicated-project" as TenantIsolation,
    databaseName:tenantDatabaseName(slug),
    projectName:tenantProjectName(slug),
  };
}
