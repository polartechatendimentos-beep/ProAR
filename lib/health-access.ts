import { NextRequest } from "next/server";
import { readSession } from "./proar-auth";
import { hasPermission } from "./permissions";

export function healthAccess(request:NextRequest){
  const auth=String(request.headers.get("authorization")||"");
  const cron=String(process.env.CRON_SECRET||"");
  if(cron && auth===`Bearer ${cron}`) {
    return {ok:true as const,companyId:String(process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal"),source:"monitor" as const};
  }
  const session=readSession(request.cookies.get("proar_session")?.value);
  if(!session) return {ok:false as const,status:401,error:"Sessão expirada."};
  if(!hasPermission(session,"integridade.visualizar")) return {ok:false as const,status:403,error:"Você não possui permissão para consultar a saúde do sistema."};
  return {ok:true as const,companyId:String(session.companyId||process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal"),source:"session" as const};
}
