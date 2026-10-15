import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasPermission, sessionFromRequest, type Permission } from "../../../../lib/permissions";
import { routeContext } from "../../../../lib/work-route-store";
import { activeJourneyContext } from "../../../../lib/journey-gate";
import { technicianRole, applyFieldOrder, type FieldOrderCommand } from "../../../../lib/mobile-workday";
import { FieldSupportError } from "../../../../lib/field-support";
import { RouteError, validatePoint } from "../../../../lib/work-routes";
import { prepareOperationalState, independentOperationalRows, OperationError, type ErpState } from "../../../../lib/operational-ledger";
import { commitNeonOperationalState, PRIMARY_DATABASE_URL, databaseFetch } from "../../../../lib/supabase-rest";
import { tenantHeaders } from "../../../../lib/tenant-rest";
import { improveFieldOrder, mobileMutationActions, fieldEquipmentHistory, type ImprovementCommand } from "../../../../lib/mobile-order-improvements";
import { assignedToSession } from "../../../../lib/mobile-field";

import { fieldCustomerHistory, fieldOrderReceipt } from "../../../../lib/mobile-order-records";

export const runtime="nodejs";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:NextRequest) {
  const session=sessionFromRequest(request);if(!session)return reply({error:"Sessão inválida."},401);
  if(!hasPermission(session,"os.editar"))return reply({error:"Seu perfil não pode editar OS."},403);
  if(request.headers.get("origin")!==request.nextUrl.origin)return reply({error:"Origem não autorizada."},403);
  try{
    const raw=await request.text();if(raw.length>1200000)return reply({error:"Reduza o tamanho das imagens antes de enviar."},413);
    let command:FieldOrderCommand|ImprovementCommand;try{command=JSON.parse(raw);}catch{throw new FieldSupportError("JSON inválido.",400);}
    if(!/^[A-Za-z0-9_-]{8,100}$/.test(command.requestId||"")||!Number.isInteger(command.expectedVersion)||command.expectedVersion<0)throw new FieldSupportError("Operação inválida.");
    if(!/^[a-f0-9]{64}$/.test(command.expectedToken||""))throw new FieldSupportError("Atualize os dados da OS antes de salvar.",409);
    const fingerprint=createHash("sha256").update(JSON.stringify({command,username:session.username})).digest("hex");
    for(let attempt=0;attempt<3;attempt++){
      const c=await routeContext(session);
      const state=c.state as ErpState;
      const replay=state._mobileFieldOps?.[command.requestId];
      if(replay){
        if(replay!==fingerprint)throw new FieldSupportError("Identificador já usado em outra operação.",409);
        const confirmed=(state.serviceOrders||[]).find(item=>item.id===command.orderId);
        if(!confirmed||!assignedToSession(confirmed,{...session,employeeId:c.actor?.employeeId}))throw new FieldSupportError("OS não disponível para este perfil.",403);
        return reply({saved:true,replay:true,orderId:command.orderId,version:confirmed.fieldVersion,status:confirmed.status,equipmentIds:confirmed.equipmentIds||[],completedAt:confirmed.checkOutAt||null});
      }
      if(technicianRole(session.role))await activeJourneyContext(session);
      if(Object.keys(state._mobileFieldOps||{}).length>=10000)throw new FieldSupportError("Limite de auditoria mobile atingido. Solicite arquivamento.",409);
      const order=(state.serviceOrders||[]).find(item=>item.id===command.orderId);if(!order)throw new FieldSupportError("OS não encontrada.",404);
      if(technicianRole(session.role) && ["start","finish"].includes(command.action)){
        if(!("point" in command) || !command.point)throw new FieldSupportError("Localização necessária para check-in/check-out.",403);
        const point=validatePoint(command.point,new Date().toISOString());
        if(!point.reliable || Math.abs(Date.now()-Date.parse(point.capturedAt))>120000)throw new FieldSupportError("Atualize o sinal GPS com precisão de até 100 m.");
      }
      const improvement=mobileMutationActions.includes(command.action)?improveFieldOrder(order,state.moduleRecords?.Equipamentos || [],command as ImprovementCommand,{...session,employeeId:c.actor?.employeeId},hasPermission(session,"aprovacoes.aprovar"),new Date().toISOString()):null;
      const nextOrder=improvement?.order || applyFieldOrder(order,command as FieldOrderCommand,{...session,employeeId:c.actor?.employeeId},new Date().toISOString(),state.moduleRecords?.Equipamentos || []);
      const incoming={...state,serviceOrders:state.serviceOrders!.map(item=>item.id===command.orderId?nextOrder:item),...(improvement?{moduleRecords:{...state.moduleRecords,Equipamentos:improvement.equipment}}:{})};
      // Only the server-built, customer/location-scoped equipment record gets this permission.
      const validated=prepareOperationalState(state,incoming,{username:session.username,displayName:session.displayName,can:permission=>hasPermission(session,permission as Permission)||(command.action==="register-equipment"&&permission==="equipamentos.editar")});
      const revision=Number(state._revision||0),payload={...validated,_mobileFieldOps:{...(state._mobileFieldOps||{}),[command.requestId]:fingerprint},_revision:revision+1,_updatedAt:new Date().toISOString(),_companyId:c.company};
      const id=c.db.dedicated?"main":c.company;
      const result={saved:true,version:nextOrder.fieldVersion,orderId:command.orderId,status:nextOrder.status,equipmentIds:nextOrder.equipmentIds||[],completedAt:nextOrder.checkOutAt||null};
      if(c.db.url===PRIMARY_DATABASE_URL){if(await commitNeonOperationalState(id,revision,payload,independentOperationalRows(c.company,payload,state)))return reply(result);}
      else{const filter=state._revision===undefined?"payload->>_revision=is.null":`payload->>_revision=eq.${revision}`;
        const response=await databaseFetch(`${c.db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&${filter}&select=payload`,{method:"PATCH",headers:{...tenantHeaders(c.db.key),Prefer:"return=representation"},body:JSON.stringify({payload,updated_at:payload._updatedAt})});
        if(!response.ok)throw new FieldSupportError("Falha ao confirmar a OS.",503);if((await response.json()).length)return reply(result);}
    }
    return reply({error:"Outro usuário alterou a OS. Atualize e tente novamente."},409);
  }catch(error){return error instanceof FieldSupportError || error instanceof RouteError || error instanceof OperationError ? reply({error:error.message},error.status) : reply({error:"Não foi possível confirmar a OS no banco."},503);}
}

export async function GET(request:NextRequest){
  const session=sessionFromRequest(request);if(!session)return reply({error:"Sessão inválida."},401);
  if(!hasPermission(session,"os.visualizar"))return reply({error:"Acesso não autorizado."},403);
  try{
    const c=await routeContext(session),state=c.state as ErpState;
    const order=(state.serviceOrders||[]).find(item=>item.id===request.nextUrl.searchParams.get("orderId"));
    if(!order || !assignedToSession(order,{...session,employeeId:c.actor?.employeeId}))return reply({error:"OS não disponível para este perfil."},403);
    if(request.nextUrl.searchParams.get("view")==="customer-history")return reply({history:fieldCustomerHistory(order,state.serviceOrders||[])});
    if(request.nextUrl.searchParams.get("view")==="receipt"){
      const receipt=fieldOrderReceipt(order);return receipt?reply({receipt}):reply({error:"A OS ainda não possui conclusão confirmada."},409);
    }
    return reply({history:fieldEquipmentHistory(order,request.nextUrl.searchParams.get("equipmentId")||"",state.moduleRecords?.Equipamentos||[],state.serviceOrders||[])});
  }catch(error){return error instanceof FieldSupportError?reply({error:error.message},error.status):reply({error:"Histórico indisponível."},503);}
}
