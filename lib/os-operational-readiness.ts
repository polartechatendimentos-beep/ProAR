/** Reusable preflight for OS creation, execution and completion.
 * All inputs must be read from a server-authorized, tenant-scoped record.
 * This function does not persist or authorize updates.
 */
type RecordValue=Record<string,unknown>;
export type OsReadinessIssue={code:string;field:string;message:string;severity:"blocking"|"warning"};
export type OsReadinessStage="create"|"execute"|"complete";
const str=(v:unknown)=>typeof v==="string"?v.trim():"";
const positive=(v:unknown)=>Number.isFinite(Number(v))&&Number(v)>0;
const items=(order:RecordValue)=>Array.isArray(order.serviceItems)?order.serviceItems:Array.isArray(order.items)?order.items:[];
export function inspectOsReadiness(order:RecordValue,stage:OsReadinessStage,options:{requireSignatures?:boolean;requirePhotos?:boolean}={}):OsReadinessIssue[]{
 const result:OsReadinessIssue[]=[];
 const add=(code:string,field:string,message:string,severity:"blocking"|"warning"="blocking")=>result.push({code,field,message,severity});
 if(!str(order.client)&&!str(order.customerId))add("client","client","Selecione um cliente.");
 if(!str(order.service)&&!items(order).length)add("service","service","Informe ao menos um serviço.");
 if(!str(order.tech)&&!(Array.isArray(order.technicians)&&order.technicians.length))add("technician","tech","Selecione um técnico ou equipe.");
 if(stage!=="create"&&!str(order.date))add("schedule","date","Informe a data do atendimento.","warning");
 const lines=items(order);
 lines.forEach((entry,index)=>{
  if(!entry||typeof entry!=="object"){add("invalid-item",`items.${index}`,"Item de serviço inválido.");return;}
  const item=entry as RecordValue;
  if(!positive(item.quantity??item.qty??1)||!Number.isInteger(Number(item.quantity??item.qty??1)))add("quantity",`items.${index}.quantity`,"Quantidade deve ser um número inteiro maior que zero.");
  const price=item.unitPrice??item.price;
  if(price!==undefined&&(!Number.isFinite(Number(price))||Number(price)<0))add("price",`items.${index}.price`,"Preço unitário inválido.");
 });
 if(stage==="complete"){
  if(!str(order.diagnosis))add("diagnosis","diagnosis","Registre o diagnóstico.","warning");
  if(!str(order.executedService))add("execution","executedService","Descreva o serviço executado.");
  const signatures=order.signatures as RecordValue|undefined;
  if(options.requireSignatures&&!signatures?.client&&!order.clientSignature)add("client-signature","signatures.client","Colete a assinatura do cliente.");
  const photos=order.photos as RecordValue|undefined;
  if(options.requirePhotos&&!photos?.after&&!order.photoAfter)add("after-photo","photos.after","Anexe uma foto após o serviço.");
 }
 return result;
}
export function osItemTotals(order:RecordValue){
 const entries=items(order);
 const lines=entries.map((entry,index)=>{
  const item=entry&&typeof entry==="object"?entry as RecordValue:{};
  const quantity=Number(item.quantity??item.qty??1),unitPrice=Number(item.unitPrice??item.price??0);
  const valid=Number.isInteger(quantity)&&quantity>0&&Number.isFinite(unitPrice)&&unitPrice>=0;
  return {index,quantity,unitPrice,subtotal:valid?Math.round(quantity*unitPrice*100)/100:null,valid};
 });
 return {lines,valid:lines.every(line=>line.valid),subtotal:lines.every(line=>line.valid)?Math.round(lines.reduce((sum,line)=>sum+(line.subtotal??0),0)*100)/100:null};
}
