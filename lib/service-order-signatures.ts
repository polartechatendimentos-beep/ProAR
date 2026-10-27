type Item=Record<string,unknown>;
const normalize=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
export function safeSignatureImage(value:unknown):string {
  return typeof value==="string"&&value.length<=350000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)?value:"";
}
export function assignedSignatureEmployee(order:Item,employees:Item[]):Item|undefined {
  const active=employees.filter(item=>item.id&&!/inativ|cancelad/i.test(String(item.status||"")));
  const explicit=order.employeeId||order.techId;
  if(explicit)return active.find(item=>String(item.id)===String(explicit));
  const name=normalize(order.tech);
  if(!name)return;
  const matches=active.filter(item=>normalize(item.name)===name||normalize(item.employeeUsername)===name);
  return matches.length===1?matches[0]:undefined;
}
export type OrderSignatureSnapshot={client:{image:string;name:string;at:string};technician:{image:string;name:string;employeeId:string;at:string;source:"employee-default"|"order"|"missing"};capturedAt:string};
export function readOrderSignatures(order:Item):OrderSignatureSnapshot {
  const stored=order.receiptSignatures as OrderSignatureSnapshot|undefined;
  if(stored?.client&&stored?.technician)return {capturedAt:String(stored.capturedAt||""),client:{image:safeSignatureImage(stored.client.image),name:String(stored.client.name||""),at:String(stored.client.at||"")},technician:{image:safeSignatureImage(stored.technician.image),name:String(stored.technician.name||"").slice(0,120),employeeId:String(stored.technician.employeeId||"").slice(0,100),at:String(stored.technician.at||"").slice(0,40),source:stored.technician.source==="employee-default"?"employee-default":stored.technician.source==="order"?"order":"missing"}};
  return {capturedAt:"",client:{image:safeSignatureImage(order.customerSignature)||safeSignatureImage(order.clientSignature),name:String(order.customerSignatureName||order.client||""),at:String(order.customerSignatureAt||"")},technician:{image:safeSignatureImage(order.technicianSignature),name:String(order.tech||""),employeeId:String(order.employeeId||order.techId||""),at:String(order.technicianSignatureAt||""),source:safeSignatureImage(order.technicianSignature)?"order":"missing"}};
}
const completed=(order:Item)=>/^(concluid[ao]s?|finalizad[ao]s?|encerrad[ao]s?)(?:$|\s|[(:-])/.test(normalize(order.status));
/** Server only: inputs cannot replace historical receipt snapshots or select another employee's template. */
export function prepareOrderSignatures(previous:Item|undefined,incoming:Item,employees:Item[],now:string):Item {
  const next={...incoming};
  if(previous?.receiptSignatures){next.receiptSignatures=structuredClone(previous.receiptSignatures);return next;}
  delete next.receiptSignatures;
  const legacyChanged=next.clientSignature!==previous?.clientSignature;
  const mobileChanged=next.customerSignature!==previous?.customerSignature;
  if(legacyChanged&&!mobileChanged){next.customerSignature=next.clientSignature;next.customerSignatureName=String(next.customerSignatureName||next.client||"");if(next.clientSignature)next.customerSignatureAt=now;}
  else if(mobileChanged&&!legacyChanged)next.clientSignature=next.customerSignature;
  if(!completed(next)||previous&&completed(previous))return next;
  const signatures=readOrderSignatures(next),employee=assignedSignatureEmployee(next,employees);
  const manual=signatures.technician.image,standard=safeSignatureImage(employee?.employeeSignature);
  const image=manual||standard;
  const snapshot:OrderSignatureSnapshot={client:{...signatures.client,at:signatures.client.image?signatures.client.at||now:""},technician:{image,name:String(employee?.name||next.tech||""),employeeId:String(employee?.id||next.employeeId||next.techId||""),at:image?now:"",source:manual?"order":standard?"employee-default":"missing"},capturedAt:now};
  next.receiptSignatures=snapshot;
  if(image){next.technicianSignature=image;next.technicianSignatureAt=now;}
  if(!next.checkOutAt)next.checkOutAt=now;
  return next;
}
