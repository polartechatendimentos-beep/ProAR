/** Pure month-grid logic, timezone-independent; no mutations or bookings. */
export type CalendarOrder={id:string;date:string;time?:string;status:string;client:string;tech?:string};
export function monthAgendaGrid<T extends CalendarOrder>(orders:T[],year:number,month:number,visibility="Em aberto"){
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(month)||month<1||month>12)throw new Error("Mês inválido.");
 const first=new Date(Date.UTC(year,month-1,1,12));
 const days=new Date(Date.UTC(year,month,0,12)).getUTCDate();
 const slots=Math.ceil((first.getUTCDay()+days)/7)*7;
 const closed=(status:string)=>/conclu[ií]d|cancelad/i.test(status);
 const visible=(order:T)=>visibility==="Todas"||visibility==="Concluídas"&&/conclu[ií]d/i.test(order.status)||visibility==="Canceladas"&&/cancelad/i.test(order.status)||visibility==="Em aberto"&&!closed(order.status);
 return Array.from({length:slots},(_,index)=>{
  const day=index-first.getUTCDay()+1;
  if(day<1||day>days)return {date:null,orders:[] as T[]};
  const date=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  return {date,orders:orders.filter(o=>o.date===date&&visible(o)).sort((a,b)=>(a.time||"").localeCompare(b.time||""))};
 });
}
export function unscheduledOrders<T extends CalendarOrder>(orders:T[]){
 return orders.filter(o=>!/^\d{4}-\d{2}-\d{2}$/.test(o.date||"")&&!/conclu[ií]d|cancelad/i.test(o.status));
}
