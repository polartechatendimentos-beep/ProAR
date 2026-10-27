import {buildExceptionCenter,type ExceptionItem} from "./exception-center.ts";
type R=Record<string,unknown>;
const text=(v:unknown)=>String(v??"").toLowerCase();
const id=(r:R)=>String(r.id??r.code??r.number??"");
export function deriveExceptionCenter(serviceOrders:R[],modules:Record<string,R[]>,integrity:Parameters<typeof buildExceptionCenter>[0]["integrity"]=[]):ExceptionItem[]{
 const completedOsWithoutFiscal=serviceOrders.filter(o=>/conclu|finaliz/.test(text(o.status))&&!o.invoiceNumber&&!o.fiscalDocumentId).map(id).filter(Boolean);
 const approvedBudgetsWithoutOrder=(modules["Orçamentos"]||[]).filter(x=>/aprovad/.test(text(x.status))&&!x.orderId&&!x.serviceOrderId).map(id).filter(Boolean);
 const rejectedFiscal=Object.entries(modules).filter(([k])=>/fiscal|nf-e|nfs-e|nfc-e/i.test(k)).flatMap(([,rows])=>rows).filter(x=>/rejeitad|erro/.test(text(x.status))).map(id).filter(Boolean);
 const negativeStock=(modules["Produtos"]||[]).filter(x=>Number(x.stockCurrent??x.stock??0)<0).map(id).filter(Boolean);
 const base=buildExceptionCenter({integrity,completedOsWithoutFiscal,approvedBudgetsWithoutOrder,rejectedFiscal,negativeStock});
 const overdueFinance=(modules["Financeiro"]||[]).filter(x=>/receber|pagar/.test(text(x.transactionType))&&!/pago|recebido|quitado|cancelado/.test(text(x.status))&&x.dueDate&&String(x.dueDate)<new Date().toISOString().slice(0,10));
 for(const x of overdueFinance)base.push({id:"finance-overdue-"+id(x),severity:"warning",area:"Financeiro",title:"Título vencido",detail:String(x.name??x.description??id(x)),entityId:id(x),recommendedAction:"Abrir Financeiro, conferir recebimento e conciliar ou renegociar."});
 return base.sort((a,b)=>({critical:0,warning:1,info:2}[a.severity]-{critical:0,warning:1,info:2}[b.severity]));
}
