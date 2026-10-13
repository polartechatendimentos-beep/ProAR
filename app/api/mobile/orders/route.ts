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

export const runtime="nodejs";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:NextRequest) {
  const session=sessionFromRequest(request);if(!session)return reply({error:"Sessão inválida."},401);
  if(!hasPermission(session,"os.editar"))return reply({error:"Seu perfil não pode editar OS."},403);
  if(request.headers.get("origin")!==request.nextUrl.origin)return reply({error:"Origem não autorizada."},403);
  try{
    const raw=await request.text();if(raw.length>1200000)return reply({error:"Reduza o tamanho das imagens antes de enviar."},413);
    let command:FieldOrderCommand;try{command=JSON.parse(raw);}catch{throw new FieldSupportError("JSON inválido.",400);}
    if(!/^[A-Za-z0-9_-]{8,100}$/.test(command.requestId||"")||!Number.isInteger(command.expectedVersion)||command.expectedVersion<0)throw new FieldSupportError("Operação inválida.");
    if(!/^[a-f0-9]{64}$/.test(command.expectedToken||""))throw new FieldSupportError("Atualize os dados da OS antes de salvar.",409);
    const fingerprint=createHash("sha256").update(JSON.stringify({command,username:session.username})).digest("hex");
    for(let attempt=0;attempt<3;attempt++){
      const c=technicianRole(session.role)?await activeJourneyContext(session):await routeContext(session);
      const state=c.state as ErpState;
      const replay=state._mobileFieldOps?.[command.requestId];
      if(replay){if(replay!==fingerprint)throw new FieldSupportError("Identificador já usado em outra operação.",409);return reply({saved:true,replay:true});}
      if(Object.keys(state._mobileFieldOps||{}).length>=10000)throw new FieldSupportError("Limite de auditoria mobile atingido. Solicite arquivamento.",409);
      const order=(state.serviceOrders||[]).find(item=>item.id===command.orderId);if(!order)throw new FieldSupportError("OS não encontrada.",404);
      if(technicianRole(session.role) && ["start","finish"].includes(command.action)){
        if(!command.point)throw new FieldSupportError("Localização necessária para check-in/check-out.",403);
        const point=validatePoint(command.point,new Date().toISOString());
        if(!point.reliable || Math.abs(Date.now()-Date.parse(point.capturedAt))>120000)throw new FieldSupportError("Atualize o sinal GPS com precisão de até 100 m.");
      }
      const nextOrder=applyFieldOrder(order,command,{...session,employeeId:c.actor?.employeeId},new Date().toISOString(),state.moduleRecords?.Equipamentos || []);
      const incoming={...state,serviceOrders:state.serviceOrders!.map(item=>item.id===command.orderId?nextOrder:item)};
      const validated=prepareOperationalState(state,incoming,{username:session.username,displayName:session.displayName,can:permission=>hasPermission(session,permission as Permission)});
      const revision=Number(state._revision||0),payload={...validated,_mobileFieldOps:{...(state._mobileFieldOps||{}),[command.requestId]:fingerprint},_revision:revision+1,_updatedAt:new Date().toISOString(),_companyId:c.company};
      const id=c.db.dedicated?"main":c.company;
      if(c.db.url===PRIMARY_DATABASE_URL){if(await commitNeonOperationalState(id,revision,payload,independentOperationalRows(c.company,payload,state)))return reply({saved:true,version:nextOrder.fieldVersion});}
      else{const filter=state._revision===undefined?"payload->>_revision=is.null":`payload->>_revision=eq.${revision}`;
        const response=await databaseFetch(`${c.db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&${filter}&select=payload`,{method:"PATCH",headers:{...tenantHeaders(c.db.key),Prefer:"return=representation"},body:JSON.stringify({payload,updated_at:payload._updatedAt})});
        if(!response.ok)throw new FieldSupportError("Falha ao confirmar a OS.",503);if((await response.json()).length)return reply({saved:true,version:nextOrder.fieldVersion});}
    }
    return reply({error:"Outro usuário alterou a OS. Atualize e tente novamente."},409);
  }catch(error){return error instanceof FieldSupportError || error instanceof RouteError || error instanceof OperationError ? reply({error:error.message},error.status) : reply({error:"Não foi possível confirmar a OS no banco."},503);}
}
