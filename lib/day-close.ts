export type DayCloseCheck={key:string;label:string;ok:boolean;count:number;amount?:number;module:string;detail?:string};
export function evaluateDayClose(input:{openOs:number;paymentsWithoutSettlement:number;fiscalPending:number;stockDivergences:number;refundsPending:number;cashDifference?:number}){
 const checks:DayCloseCheck[]=[
 {key:"os",label:"OS do dia pendentes",ok:input.openOs===0,count:input.openOs,module:"Ordens de serviço"},
 {key:"payments",label:"Pagamentos sem conciliação",ok:input.paymentsWithoutSettlement===0,count:input.paymentsWithoutSettlement,module:"Financeiro"},
 {key:"fiscal",label:"Documentos fiscais pendentes",ok:input.fiscalPending===0,count:input.fiscalPending,module:"Fiscal"},
 {key:"stock",label:"Divergências de estoque",ok:input.stockDivergences===0,count:input.stockDivergences,module:"Estoque"},
 {key:"refunds",label:"Devoluções/estornos pendentes",ok:input.refundsPending===0,count:input.refundsPending,module:"Financeiro"},
 {key:"cash",label:"Diferença de caixa",ok:Math.abs(input.cashDifference||0)<0.01,count:Math.abs(input.cashDifference||0)>0?1:0,amount:input.cashDifference||0,module:"Financeiro"}];
 return {canClose:checks.every(x=>x.ok),checks,pending:checks.filter(x=>!x.ok).length};
}
