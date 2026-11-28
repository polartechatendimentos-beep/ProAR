import {quantityPrice} from "./catalog-quantity-pricing.ts";
import {pdvMethods} from "./pdv-payments.ts";
export {pdvMethods} from "./pdv-payments.ts";

export const PDV_REVIEW_STATUS="Aguardando conferência";
export const pdvNeedsReview=(status:unknown)=>status===PDV_REVIEW_STATUS;
export const pdvDraftIdValid=(id:unknown):id is string=>typeof id==="string"&&/^PDV-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id);
export const pdvDraftKey=(companyId:string,username:string)=>`proar:pdv-drafts:v1:${encodeURIComponent(companyId)}:${encodeURIComponent(username)}`;
export const newPdvDraftId=()=>`PDV-${crypto.randomUUID()}`;
type DraftLine={id:string;quantity:number;unitPrice:number};
type DraftPayment={method:string;amount:number};
export type PdvProposal={items:DraftLine[];customerId:string;structureId:string;discount:number;paymentMethod:string;plannedPayments?:DraftPayment[]};
export type PdvDraft<T>={id:string;updatedAt:string;form:T;proposal:PdvProposal;attempted:boolean};

export function readPdvDrafts<T>(storage:Pick<Storage,"getItem">, key:string):PdvDraft<T>[] {
  const raw=storage.getItem(key);
  if(!raw)return [];
  const parsed:unknown=JSON.parse(raw);
  if(!Array.isArray(parsed)||!parsed.every(item=>item&&pdvDraftIdValid(item.id)&&item.proposal&&item.form))throw Error("Não foi possível ler os rascunhos do PDV.");
  return parsed;
}
export function storePdvDraft<T>(storage:Pick<Storage,"getItem"|"setItem">,key:string,draft:PdvDraft<T>|null,id:string) {
  const current=readPdvDrafts<T>(storage,key);
  const previous=current.find(item=>item.id===id);
  if(draft&&previous?.attempted&&JSON.stringify(previous.proposal)!==JSON.stringify(draft.proposal))throw Error("Há um envio pendente. Confira o resultado antes de editar.");
  const next=current.filter(item=>item.id!==id);
  if(draft)next.unshift(draft);
  if(next.length>100)throw Error("Limite de 100 rascunhos neste navegador. Sincronize ou descarte um antes de criar outro.");
  storage.setItem(key,JSON.stringify(next));
  return next;
}
export function pdvDraftCommand(draft:{id:string;proposal:PdvProposal}){
  return {action:"pdv-sync-draft",recordId:draft.id,idempotencyKey:draft.id,data:{...draft.proposal}};
}
type PdvRecord=Record<string,unknown>;
export class PdvDraftValidationError extends Error{readonly code="PDV_DRAFT_REVIEW"}
const identifier=(value:unknown)=>typeof value==="string"&&value.length<=150?value:"";
const money=(value:number)=>Math.round(value*100);
export function validatePdvProposal(data:PdvRecord,customers:PdvRecord[],products:PdvRecord[],services:PdvRecord[],structures:PdvRecord[]){
  const reject=(message:string):never=>{throw new PdvDraftValidationError(message)};
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>100)throw new PdvDraftValidationError("Informe entre 1 e 100 itens no pedido.");
  const customerId=identifier(data.customerId),structureId=identifier(data.structureId);
  const customer=customerId?customers.find(item=>item.id===customerId):undefined;
  if(data.customerId&&(!customer||customer.status==="Inativo"||customer.financialStatus==="Bloqueado"))reject("Confira o cliente no cadastro atual antes de sincronizar.");
  const structure=structureId?structures.find(row=>row.id===structureId):undefined;
  if(data.structureId&&(!customer||!structure||structure.status==="Inativo"||(structure.customerId ? structure.customerId!==customer.id : structure.client!==customer.name)))reject("A unidade não pertence ao cadastro atual do cliente. Confira o local.");
  const items=data.items;
  const seen=new Set<string>();
  const purchaseItems=items.map(raw=>{
    const item=raw as PdvRecord|null;
    const id=identifier(item?.id);
    const quantity=Number(item?.quantity);
    if(!id||seen.has(id)||!Number.isFinite(quantity)||quantity<=0||quantity>1_000_000||Math.abs(Math.round(quantity*1000)-quantity*1000)>1e-6)reject("Item ou quantidade inválida. Confira o pedido.");
    seen.add(id);
    const record=products.find(row=>row.id===id&&row.kind==="Produto")??services.find(row=>row.id===id&&row.kind==="Serviço");
    if(!record||record.status==="Inativo")throw new PdvDraftValidationError("Um item não está mais disponível. Confira o catálogo atualizado.");
    const base=Number(record.value??0);
    if(!Number.isFinite(base)||base<0||base>10_000_000)reject("Preço indisponível no catálogo atual.");
    const minimum=Number(record.wholesaleMinimumQuantity||0);
    const pricing=quantityPrice(base,quantity,record.wholesalePrice!=null&&minimum>0?[{minimumQuantity:minimum,unitPrice:Number(record.wholesalePrice)}]:[]);
    if(typeof item?.unitPrice!=="number"||!Number.isFinite(item.unitPrice)||money(item.unitPrice)!==money(pricing.unitPrice))reject("Preço do catálogo mudou. Recarregue os preços do rascunho e confira o total.");
    return {id,productId:id,description:String(record.name??id),quantity,unitValue:money(pricing.unitPrice)/100,kind:record.kind,priceRule:pricing.minimumQuantity? `Atacado a partir de ${pricing.minimumQuantity}`:"Varejo"};
  });
  const subtotal=purchaseItems.reduce((sum,row)=>sum+money(row.unitValue*row.quantity),0);
  const discount=typeof data.discount==="number"?money(data.discount):-1;
  if(!Number.isSafeInteger(subtotal)||!Number.isSafeInteger(discount)||discount<0||discount>subtotal)reject("O desconto excede o total ou está inválido.");
  const paymentMethod=pdvMethods.some(method=>method===data.paymentMethod)?String(data.paymentMethod):"";
  if(!paymentMethod)reject("Informe a forma de pagamento pretendida.");
  const value=(subtotal-discount)/100;
  const plannedPayments=Array.isArray(data.plannedPayments)?data.plannedPayments.slice(0,pdvMethods.length).flatMap(item=>{
    const method=item&&pdvMethods.some(method=>method===item.method)?String(item.method):"";
    const amount=item&&typeof item.amount==="number"&&Number.isFinite(item.amount)&&item.amount>0&&item.amount<=10_000_000?money(item.amount)/100:0;
    return method&&amount?[{method,amount,status:"Não verificado"}]:[];
  }):[];
  if((paymentMethod==="Boleto"||plannedPayments.some(item=>item.method==="Boleto"))&&customer&&Number(customer.creditLimit||0)>0&&Number(customer.balancePosted||0)+value>Number(customer.creditLimit))reject("Limite de crédito excedido para o pedido.");
  return {client:String(customer?.name||"Consumidor final"),...(customer?{customerId}:{}),...(structure?{structureId,unit:String(structure.name??"")}:{}),purchaseItems,subtotal:subtotal/100,discount:discount/100,paymentMethod,pdvPaymentIntent:plannedPayments,value};
}
export const enteredPdvPayments=(payments:DraftPayment[])=>payments.filter(item=>pdvMethods.some(method=>method===item.method)&&Number.isFinite(item.amount)&&item.amount>=0).map(({method,amount})=>({method,amount}));
