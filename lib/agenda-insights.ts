import {schedulingConflicts,unscheduledVisits,type ScheduledVisit} from "./agenda-conflict-guards.ts";
import {technicianProductivity} from "./agenda-technician-metrics.ts";
import {validAgendaDate,closedAgendaOrder,type AgendaOrder} from "./agenda-calendar.ts";
const technicianName=(value:string)=>/^(não definido|nao definido|a definir|sem técnico|técnico a definir)$/i.test(value.trim())?"":value.trim();
export function agendaInsights<T extends AgendaOrder>(companyId:string,orders:T[],startDate:string,endDate:string){
 if(!companyId||orders.some(order=>order.companyId&&order.companyId!==companyId))throw new Error("Não foi possível confirmar a empresa dos agendamentos.");
 const aliases=new Map<string,Set<string>>(),names=new Map<string,string>();
 for(const order of orders){const name=technicianName(order.tech||""),id=order.employeeId||order.techId;if(name&&id){const set=aliases.get(name)||new Set<string>();set.add(id);aliases.set(name,set);names.set(id,name);}}
 const visits:ScheduledVisit[]=orders.map(order=>{const name=technicianName(order.tech||""),known=aliases.get(name);const id=order.employeeId||order.techId||(known?.size===1?[...known][0]:name?`name:${name}`:"");if(id&&!names.has(id))names.set(id,name||id);return{id:order.id,companyId,date:validAgendaDate(order.date)?order.date:"",start:/^([01]\d|2[0-3]):[0-5]\d$/.test(order.time||"")?order.time:"",durationMinutes:Number(order.estimatedDurationMinutes||order.durationMinutes)||0,technicianIds:id?[id]:[],status:/finalizad/i.test(order.status)?"Concluída":order.status};});
 const pending=unscheduledVisits(companyId,visits).map(visit=>orders.find(order=>order.id===visit.id)!).filter(order=>!closedAgendaOrder(order));
 const scheduled=visits.filter(visit=>visit.date>=startDate&&visit.date<=endDate&&visit.start&&visit.technicianIds.length&&Number.isInteger(visit.durationMinutes)&&visit.durationMinutes>0&&visit.durationMinutes<=1440&&!closedAgendaOrder(orders.find(order=>order.id===visit.id)!));
 const pairs=new Map<string,{first:T;second:T}>();
 for(const candidate of scheduled){const [hours,minutes]=candidate.start.split(":").map(Number);if(hours*60+minutes+candidate.durationMinutes>1440)continue;for(const conflict of schedulingConflicts(companyId,candidate,scheduled)){const key=JSON.stringify([candidate.id,conflict.orderId].sort());if(!pairs.has(key))pairs.set(key,{first:orders.find(order=>order.id===candidate.id)!,second:orders.find(order=>order.id===conflict.orderId)!});}}
 const metrics=technicianProductivity(companyId,visits,startDate,endDate).map(row=>({...row,name:names.get(row.technicianId)||row.technicianId})).sort((a,b)=>a.name.localeCompare(b.name));
 const missingDuration=visits.filter(visit=>visit.date>=startDate&&visit.date<=endDate&&!/cancelad|conclu[ií]d|finalizad/i.test(visit.status)&&(!Number.isInteger(visit.durationMinutes)||visit.durationMinutes<=0||visit.durationMinutes>1440)).length;
 return{pending,conflicts:[...pairs.values()],metrics,missingDuration};
}
