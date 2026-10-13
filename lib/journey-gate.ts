import { routeContext, loadRouteDay } from "./work-route-store";
import { workDate } from "./work-routes";
import { technicianRole, requireActiveJourney } from "./mobile-workday.ts";
import type { readSession } from "./proar-auth";
import { FieldSupportError } from "./field-support.ts";
import { loadFieldSupport } from "./field-support-store";
import { vehicleReleased } from "./field-support.ts";

type Session=NonNullable<ReturnType<typeof readSession>>;
export async function activeJourneyContext(session:Session) {
  const c=await routeContext(session),now=new Date().toISOString();
  if(!c.actor)throw new FieldSupportError("Vincule seu usuário a um funcionário ativo para executar OS.",403);
  if(c.employee?.mobileAccessEnabled === false)throw new FieldSupportError("Acesso mobile desativado.",403);
  const date=workDate(now),yesterday=workDate(new Date(Date.parse(now)-86400000).toISOString());
  const days=await Promise.all([loadRouteDay(c.db,c.company,c.actor.employeeId,date),loadRouteDay(c.db,c.company,c.actor.employeeId,yesterday)]);
  const journey=requireActiveJourney(days.flatMap(day=>day?.routes||[]),now);
  const support=await loadFieldSupport(c.db,c.company);
  if(!vehicleReleased(support,c.actor.employeeId,date))throw new FieldSupportError("Conclua o checklist diário do veículo atribuído antes de executar OS.",403);
  return {...c,journey};
}
export async function guardTechnicianOsChanges(session:Session,current:Record<string,unknown>[],incoming:Record<string,unknown>[]) {
  if(!technicianRole(session.role))return;
  const changed=incoming.filter(order=>JSON.stringify(order)!==JSON.stringify(current.find(item=>item.id===order.id)));
  if(!changed.length)return;
  const c=await activeJourneyContext(session);
  for(const order of changed){const existing=current.find(item=>item.id===order.id);
    const matches=(item:Record<string,unknown>)=>item.employeeId===c.actor!.employeeId||item.techId===c.actor!.employeeId||[session.username,session.displayName,c.actor!.employeeName].some(name=>name&&String(item.tech||"").trim().toLowerCase()===name.trim().toLowerCase());
    if(!matches(order)||existing&&!matches(existing))throw new FieldSupportError("Você só pode editar OS atribuídas a seu funcionário.",403);
  }
}
