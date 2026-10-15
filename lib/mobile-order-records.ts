import { isOpenMobileOrder } from "./mobile-field.ts";
type Item=Record<string,unknown>;
const text=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const safeImage=(value:unknown):value is string=>typeof value==="string"&&value.length<=350000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
/** Called only after the route authorizes the current order in the tenant state. */
export function fieldCustomerHistory(order:Item,orders:Item[]) {
  if(typeof order.customerId!=="string"||!order.customerId.trim())return [];
  return orders.filter(item=>item.id!==order.id&&item.customerId===order.customerId&&!isOpenMobileOrder(item.status)&&!/cancelad/i.test(String(item.status))).sort((a,b)=>String(b.checkOutAt||b.date||"").localeCompare(String(a.checkOutAt||a.date||""))).slice(0,10).map(item=>({id:text(item.id,100),date:text(item.checkOutAt||item.date,40),service:text(item.service,300),diagnosis:text(item.diagnosis,4000),report:text(item.executedService,8000),unit:text(item.unit,120)}));
}
export function fieldOrderReceipt(order:Item) {
  if(isOpenMobileOrder(order.status)||/cancelad/i.test(String(order.status))||!order.checkOutAt)return null;
  const photos=order.photos as Record<string,unknown>|undefined;
  return {id:text(order.id,100),client:text(order.client,150),unit:text(order.unit,120),service:text(order.service,300),completedAt:text(order.checkOutAt,40),diagnosis:text(order.diagnosis,4000),report:text(order.executedService,8000),signer:text(order.customerSignatureName,120),photos:[...(["before","after"] as const).flatMap(stage=>(Array.isArray(photos?.[stage])?photos[stage] as unknown[]:[]).filter(safeImage).slice(0,10).map((src,index)=>({id:`${stage}-${index}`,label:`${stage==="before"?"Antes":"Depois"} ${index+1}`,src})))]};
}
export type FieldOrderReceipt=NonNullable<ReturnType<typeof fieldOrderReceipt>>;
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
export function receiptDocument(receipt:FieldOrderReceipt,selected:string[]) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Comprovante ${escape(receipt.id)}</title><style>body{font:16px Arial;color:#102944;max-width:800px;margin:32px auto;padding:20px}h1{border-bottom:4px solid #1674bd;padding-bottom:18px}p{white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:100%;max-height:500px}figure{break-inside:avoid}small{color:#455b70}@media print{body{margin:0}}</style><h1>ProAR · Comprovante de atendimento</h1><h2>${escape(receipt.id)} · ${escape(receipt.client)}</h2><p>${escape(receipt.unit)}\n${escape(receipt.service)}</p><small>Conclusão confirmada no servidor: ${escape(receipt.completedAt)}</small><h3>Diagnóstico</h3><p>${escape(receipt.diagnosis)}</p><h3>Serviço executado</h3><p>${escape(receipt.report)}</p><p>Aceite: ${escape(receipt.signer||"Consultar registro da OS")}</p>${receipt.photos.filter(photo=>selected.includes(photo.id)&&safeImage(photo.src)).map(photo=>`<figure><figcaption>${escape(photo.label)}</figcaption><img alt="${escape(photo.label)}" src="${photo.src}"></figure>`).join("")}<small>Documento de atendimento · não substitui documento fiscal.</small></html>`;
}
