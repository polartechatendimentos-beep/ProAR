import { FieldSupportError } from "./field-support.ts";
type Item=Record<string,unknown>;
export type FieldServiceOption={id:string;name:string};
const normalize=(value:unknown)=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase();
export function fieldServiceCatalog(records:Item[],query="",offset=0){
 const term=normalize(query).slice(0,120);
 const unique=new Map<string,FieldServiceOption>();
 for(const record of records){
  if(!record||typeof record!=="object"||Array.isArray(record))continue;
  const id=String(record.id||"").trim(),name=String(record.name||"").trim().slice(0,200);
  if(!id||id.length>120||!name||/inativ|cancelad|arquivad|excluid/.test(normalize(record.status)))continue;
  if(term&&!normalize(id+" "+name).includes(term))continue;
  if(!unique.has(id))unique.set(id,{id,name});
 }
 const all=[...unique.values()].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")||a.id.localeCompare(b.id));
 const start=Number.isSafeInteger(offset)&&offset>=0?offset:0;
 return {services:all.slice(start,start+50),total:all.length,offset:start,hasMore:start+50<all.length};
}
export function addFieldService(order:Item,records:Item[],input:{serviceId?:unknown;quantity?:unknown},username:string,now:string):Item{
 if(typeof input.serviceId!=="string"||input.serviceId.length>120)throw new FieldSupportError("Selecione um serviço cadastrado.");
 if(typeof input.quantity!=="number"||!Number.isFinite(input.quantity)||input.quantity<=0||input.quantity>10000)throw new FieldSupportError("Quantidade inválida: informe um valor maior que zero, até 10000.");
 const source=records.find(record=>record&&String(record.id)===input.serviceId);
 if(!source)throw new FieldSupportError("Serviço não encontrado no catálogo desta empresa.",404);
 const name=String(source.name||"").trim().slice(0,200);
 if(!name||/inativ|cancelad|arquivad|excluid/.test(normalize(source.status)))throw new FieldSupportError("Este serviço está inativo ou indisponível.");
 const items=Array.isArray(order.catalogItems)?order.catalogItems:[];
 if(items.length>=100)throw new FieldSupportError("Limite de 100 itens desta OS atingido.");
 if(items.some(item=>item&&item.kind==="Serviço"&&String(item.id)===input.serviceId))throw new FieldSupportError("Este serviço já está incluído na OS.",409);
 return {...order,catalogItems:[...items,{id:String(source.id),name,kind:"Serviço",quantity:input.quantity}],fieldVersion:Number(order.fieldVersion||0)+1,updatedAt:now,
  timeline:[...(Array.isArray(order.timeline)?order.timeline:[]),{id:crypto.randomUUID(),createdAt:now,status:String(order.status||""),technician:username,internalNote:`Serviço incluído pelo Mobile: ${name} • quantidade ${input.quantity}`,customerVisible:false}]};
}
