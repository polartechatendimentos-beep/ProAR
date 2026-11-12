/** Aggregate authorized company work orders; no cross-tenant or personnel data leakage. */
export type TechnicianWorkOrder={id:string;companyId:string;technicianIds:string[];status:string;date:string;durationMinutes?:number};
export function technicianProductivity(companyId:string,orders:TechnicianWorkOrder[],startDate:string,endDate:string){
 if(!companyId||orders.some(o=>o.companyId!==companyId))throw new Error("Dados de outra empresa.");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate)||endDate<startDate)throw new Error("Período inválido.");
 const stats=new Map<string,{technicianId:string;scheduled:number;completed:number;cancelled:number;estimatedMinutes:number}>();
 for(const order of orders){
  if(order.date<startDate||order.date>endDate)continue;
  for(const id of new Set(order.technicianIds.filter(Boolean))){
   const value=stats.get(id)||{technicianId:id,scheduled:0,completed:0,cancelled:0,estimatedMinutes:0};
   if(/cancelad/i.test(order.status))value.cancelled++;
   else if(/conclu[ií]d/i.test(order.status))value.completed++;
   else value.scheduled++;
   if(Number.isSafeInteger(order.durationMinutes)&&order.durationMinutes!>=0)value.estimatedMinutes+=order.durationMinutes!;
   stats.set(id,value);
  }
 }
 return [...stats.values()].sort((a,b)=>b.completed-a.completed||a.technicianId.localeCompare(b.technicianId));
}
