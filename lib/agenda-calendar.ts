export type AgendaOrder = {id:string;client:string;unit:string;service:string;tech:string;date:string;time:string;address:string;status:string;tone:string;appointmentConfirmation?:string};
export type AgendaMode = "Dia"|"Semana"|"Mês"|"Técnico"|"Lista";
export function agendaToday(now=new Date()) { const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);const part=(type:string)=>parts.find(item=>item.type===type)?.value;return `${part("year")}-${part("month")}-${part("day")}`; }
export function validAgendaDate(day:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const date=new Date(`${day}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day;}
export function shiftAgendaDate(day:string,days:number){const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
export function agendaDates(day:string,mode:AgendaMode){
 if(!validAgendaDate(day))return [];
 if(mode==="Dia"||mode==="Lista")return[day];
 const date=new Date(`${day}T12:00:00Z`);
 if(mode==="Mês"){const first=day.slice(0,7)+"-01";const offset=(new Date(`${first}T12:00:00Z`).getUTCDay()+6)%7;return Array.from({length:42},(_,index)=>shiftAgendaDate(first,index-offset));}
 const offset=(date.getUTCDay()+6)%7;return Array.from({length:7},(_,index)=>shiftAgendaDate(day,index-offset));
}
export function navigateAgenda(day:string,mode:AgendaMode,direction:number){if(mode!=="Mês")return shiftAgendaDate(day,direction*(mode==="Dia"?1:7));const date=new Date(`${day.slice(0,7)}-01T12:00:00Z`);date.setUTCMonth(date.getUTCMonth()+direction);return date.toISOString().slice(0,10);}
export const closedAgendaOrder=(order:AgendaOrder)=>/conclu[ií]d|cancelad|finalizad/i.test(order.status);
export function filterAgendaOrders<T extends AgendaOrder>(orders:T[],input:{status:string;tech:string;query:string;today:string;overdueOnly:boolean}){
 const query=input.query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 return orders.filter(order=>validAgendaDate(order.date)&&(input.status==="Todas"?true:input.status==="Concluídas"?/conclu[ií]d|finalizad/i.test(order.status):input.status==="Canceladas"?/cancelad/i.test(order.status):!closedAgendaOrder(order)))
 .filter(order=>(!input.tech||order.tech===input.tech)&&(!input.overdueOnly||order.date<input.today&&!closedAgendaOrder(order))&&(!query||[order.id,order.client,order.unit,order.service,order.address,order.tech].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(query))).sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}
