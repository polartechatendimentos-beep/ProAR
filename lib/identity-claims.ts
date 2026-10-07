export type IdentityClaim="platform_admin"|"company_owner";

function configuredUsers(name:string,defaults:string[]=[]){
  const configured=String(process.env[name]||"").split(",").map(item=>item.trim().toLocaleLowerCase("pt-BR")).filter(Boolean);
  return new Set(configured.length?configured:defaults);
}

export function identityClaims(input:{
  username:unknown;
  permissions?:unknown;
  managerAuthenticated?:boolean;
}):IdentityClaim[]{
  const username=String(input.username||"").trim().toLocaleLowerCase("pt-BR");
  const permissions=Array.isArray(input.permissions)?input.permissions.map(String):[];
  const claims=new Set<IdentityClaim>();
  const platformAdmins=configuredUsers("PROAR_PLATFORM_ADMIN_USERS",["tiago.viana"]);
  const companyOwners=configuredUsers("PROAR_COMPANY_OWNER_USERS",["tiago.viana"]);

  if(input.managerAuthenticated||platformAdmins.has(username)||permissions.includes("platform_admin"))claims.add("platform_admin");
  if(companyOwners.has(username)||permissions.includes("company_owner"))claims.add("company_owner");
  return [...claims];
}

export function hasAdministrativeClaim(claims:unknown){
  return Array.isArray(claims)&&claims.some(claim=>claim==="platform_admin"||claim==="company_owner");
}
