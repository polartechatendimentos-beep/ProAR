import {matchesFieldSearch} from "./mobile-workflow-insights.ts";
import {isOpenMobileOrder,type MobileFieldOrder} from "./mobile-field.ts";
export type OrderFilter="all"|"today"|"overdue"|"upcoming"|"open"|"active"|"completed"|"unassigned"|"cancelled";
export type OrderTone="blue"|"green"|"amber"|"violet"|"red";
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function fieldOrderTone(order:Pick<MobileFieldOrder,"status"|"date">,today:string):OrderTone {
  const status=normalize(order.status);
  if(/cancelad/.test(status))return "red";
  if(!isOpenMobileOrder(order.status))return "green";
  if(/aguard|pendent|pausad/.test(status))return "amber";
  if(/^\d{4}-\d{2}-\d{2}$/.test(order.date)&&order.date<today)return "red";
  if(/andamento|execucao|iniciad/.test(status))return "blue";
  return order.date>today?"violet":"blue";
}
export function filterFieldOrders(orders:MobileFieldOrder[],query:string,filter:OrderFilter,today:string) {
  const term=normalize(query.trim());
  return orders.filter(order=>{
    const validDate=/^\d{4}-\d{2}-\d{2}$/.test(order.date);
    const status=normalize(order.status);
    if(filter==="open" && !isOpenMobileOrder(order.status))return false;
    if(filter==="cancelled" && !/cancelad/.test(status))return false;
    if(filter==="active" && !/andamento|execucao|iniciad/.test(status))return false;
    if(filter==="completed" && (isOpenMobileOrder(order.status)||/cancelad/.test(status)))return false;
    if(filter==="unassigned" && (order.technicianAssigned===true || (order.technicianAssigned===undefined && Boolean(order.tech.trim()) && !/^(a definir|nao definido|sem tecnico)$/.test(normalize(order.tech)))))return false;
    if(filter==="today"&&order.date!==today)return false;
    if(filter==="overdue"&&(!isOpenMobileOrder(order.status)||!validDate||order.date>=today))return false;
    if(filter==="upcoming"&&(!validDate||order.date<=today))return false;
    return !term||matchesFieldSearch([order.id,order.client,order.address,order.service,order.unit,order.status,...order.equipmentIds].join(" "),term);
  });
}

/** Home queue includes every authorized open order, independent of its date. */
export function openFieldWorkQueue(orders:MobileFieldOrder[],today:string) {
  const validDate=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date);
  const priority=(order:MobileFieldOrder)=>{
    if(/andamento|execucao|iniciad/.test(normalize(order.status)))return 0;
    if(validDate(order.date)&&order.date<today)return 1;
    if(order.date===today)return 2;
    return validDate(order.date)?4:3;
  };
  return orders.filter(order=>isOpenMobileOrder(order.status)).sort((a,b)=>priority(a)-priority(b)||a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.id.localeCompare(b.id,"pt-BR"));
}
