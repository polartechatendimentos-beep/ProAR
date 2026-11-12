/** Pure scheduling validation; the authenticated API must enforce these checks again on save. */
export type ScheduledVisit={id:string;companyId:string;date:string;start:string;durationMinutes:number;technicianIds:string[];status:string};
const validTime=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
export function schedulingConflicts(companyId:string,candidate:ScheduledVisit,existing:ScheduledVisit[]){
 if(!companyId||candidate.companyId!==companyId||existing.some(x=>x.companyId!==companyId))throw new Error("Dados de outra empresa.");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date)||!validTime(candidate.start)||!Number.isInteger(candidate.durationMinutes)||candidate.durationMinutes<1||candidate.durationMinutes>1440)throw new Error("Agendamento inválido.");
 if(!candidate.technicianIds.length||candidate.technicianIds.some(x=>!x.trim())||new Set(candidate.technicianIds).size!==candidate.technicianIds.length)throw new Error("Equipe inválida.");
 const start=minutes(candidate.start),end=start+candidate.durationMinutes;
 if(end>1440)throw new Error("Agendamento ultrapassa o dia.");
 return existing.filter(item=>{
  if(item.id===candidate.id||item.date!==candidate.date||/cancelad|conclu[ií]d/i.test(item.status)||!validTime(item.start)||!Number.isInteger(item.durationMinutes)||item.durationMinutes<1)return false;
  return item.technicianIds.some(id=>candidate.technicianIds.includes(id))&&start<minutes(item.start)+item.durationMinutes&&minutes(item.start)<end;
 }).map(item=>({orderId:item.id,technicianIds:item.technicianIds.filter(id=>candidate.technicianIds.includes(id))}));
}
export function unscheduledVisits(companyId:string,items:ScheduledVisit[]){
 if(!companyId||items.some(x=>x.companyId!==companyId))throw new Error("Dados de outra empresa.");
 return items.filter(x=>!x.date||!x.start||!x.technicianIds.length).filter(x=>!/cancelad|conclu[ií]d/i.test(x.status));
}
