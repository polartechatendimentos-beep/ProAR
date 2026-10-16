import type {NextRequest} from 'next/server';
import {sessionFromRequest,sessionCompany,hasPermission} from './permissions.ts';
export function technicalBaseAccess(request:NextRequest){
 const session=sessionFromRequest(request);if(!session)return {ok:false as const,status:401,error:'Sessão inválida.'};
 const company=sessionCompany(session);if(!company.ok)return {ok:false as const,status:company.status,error:company.error};
 if(!session.permissions.includes('Base Técnica')&&!hasPermission(session,'equipamentos.visualizar')&&!hasPermission(session,'os.visualizar'))return {ok:false as const,status:403,error:'Sem acesso à consulta técnica.'};
 if(Array.isArray(session.entitledModules)&&!session.entitledModules.includes('Base Técnica')&&!session.entitledModules.includes('Equipamentos')&&!session.entitledModules.includes('Ordens de serviço'))return {ok:false as const,status:403,error:'Consulta técnica não disponível no plano.'};
 return {ok:true as const,session,companyId:company.companyId};
}
