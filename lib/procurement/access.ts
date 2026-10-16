import type {NextRequest} from "next/server";
import {requirePermission,sessionCompany} from "../permissions.ts";
export function procurementAccess(request:NextRequest){
  const access=requirePermission(request,"licitacoes.visualizar");if(!access.ok)return access;
  const company=sessionCompany(access.session);if(!company.ok)return company;
  if(Array.isArray(access.session.entitledModules)&&!access.session.entitledModules.includes("Licitações"))return {ok:false as const,status:403,error:"Licitações não disponível no plano."};
  return {ok:true as const,session:access.session,companyId:company.companyId};
}
