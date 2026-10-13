import { NextRequest, NextResponse } from "next/server";
import { hasPermission, sessionFromRequest } from "../../../../lib/permissions";
import { routeContext } from "../../../../lib/work-route-store";
import { RouteError } from "../../../../lib/work-routes";
import { applyFieldSupport, visibleFieldSupport, FieldSupportError, type FieldSupportCommand } from "../../../../lib/field-support";
import { loadFieldSupport, commitFieldSupport } from "../../../../lib/field-support-store";

export const runtime="nodejs";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const failure=(error:unknown)=>error instanceof FieldSupportError || error instanceof RouteError ? reply({error:error.message},error.status) : reply({error:"Central operacional indisponível. Tente novamente."},503);
async function context(request:NextRequest) {
  const session=sessionFromRequest(request);if(!session)throw new FieldSupportError("Sessão inválida.",401);
  if(!hasPermission(session,"os.visualizar"))throw new FieldSupportError("Sem permissão para operação mobile.",403);
  const result=await routeContext(session);
  const manager=hasPermission(session,"rotas.visualizar");
  if(result.employee?.mobileAccessEnabled === false && !manager)throw new FieldSupportError("Acesso mobile desativado.",403);
  if(!result.actor && !manager)throw new FieldSupportError("Vincule seu usuário ao cadastro de funcionário.",403);
  return {...result,manager,actor:{employeeId:result.actor?.employeeId||"",name:result.actor?.employeeName||session.displayName||session.username,username:session.username,manager}};
}
export async function GET(request:NextRequest) {
  try{const c=await context(request);const state=await loadFieldSupport(c.db,c.company);
    return reply({records:visibleFieldSupport(state,c.actor),manager:c.manager,employee:c.actor.employeeId?c.actor:null,employees:c.manager?c.employees.map(e=>({id:e.id,name:e.name})):[],scope:`${c.company}:${c.actor.username}`,serverTime:new Date().toISOString()});
  }catch(error){return failure(error);}
}
export async function POST(request:NextRequest) {
  if(request.headers.get("origin") !== request.nextUrl.origin)return reply({error:"Origem não autorizada."},403);
  try{
    const c=await context(request);
    const raw=await request.text();if(raw.length>16000)return reply({error:"Registro muito grande."},413);
    let command:FieldSupportCommand;try{command=JSON.parse(raw);}catch{throw new FieldSupportError("JSON inválido.",400);}
    if(command.action === "vehicle" && command.data?.assignedEmployeeId && !c.employees.some(e=>e.id === command.data.assignedEmployeeId))throw new FieldSupportError("Funcionário não pertence à empresa.",403);
    for(let attempt=0;attempt<4;attempt++){
      const previous=await loadFieldSupport(c.db,c.company),result=applyFieldSupport(previous,command,c.actor,new Date().toISOString());
      if(result.replay || await commitFieldSupport(c.db,result.state,previous))return reply({saved:true,recordId:result.recordId,replay:result.replay});
    }
    return reply({error:"Outro dispositivo alterou os registros. Atualize e tente novamente."},409);
  }catch(error){return failure(error);}
}
