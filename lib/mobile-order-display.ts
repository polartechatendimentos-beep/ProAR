import type {MobileFieldOrder} from "./mobile-field";
export type OrderFilter="all"|"today"|"overdue"|"upcoming"|"open"|"active"|"completed"|"unassigned";
export type OrderTone="blue"|"green"|"amber"|"violet"|"red";
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export function fieldOrderTone(order:Pick<MobileFieldOrder,"status"|"date">,today:string):OrderTone {
  const status=normalize(order.status);
  if(/cancelad/.test(status))return "red";
  if(/concluid|finalizad|encerrad/.test(status))return "green";
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
    if(filter==="open" && /concluid|finalizad|encerrad|cancelad/.test(status))return false;
    if(filter==="active" && !/andamento|execucao|iniciad/.test(status))return false;
    if(filter==="completed" && !/concluid|finalizad|encerrad/.test(status))return false;
    if(filter==="unassigned" && Boolean(order.tech.trim()) && !/^(a definir|nao definido|sem tecnico)$/.test(normalize(order.tech)))return false;
    if(filter==="today"&&order.date!==today)return false;
    if(filter==="overdue"&&(!validDate||order.date>=today))return false;
    if(filter==="upcoming"&&(!validDate||order.date<=today))return false;
    return !term||normalize([order.id,order.client,order.address,order.service,order.unit,order.status,...order.equipmentIds].join(" ")).includes(term);
  });
}
