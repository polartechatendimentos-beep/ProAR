export type AutomationContext={event:string;entityType:string;entityId:string;status?:string;hoursSinceLastAction?:number;stockBelowMinimum?:boolean;paymentApproved?:boolean};
export type AutomationAction={type:"create_task"|"settle_finance"|"prepare_fiscal"|"request_purchase"|"notify";message:string};
export function evaluateProARAutomations(c:AutomationContext):AutomationAction[]{
 const out:AutomationAction[]=[];
 if(c.entityType==="budget"&&c.event==="viewed"&&(c.hoursSinceLastAction??0)>=48) out.push({type:"create_task",message:"Orçamento visualizado há 48h sem retorno: criar follow-up comercial."});
 if(c.paymentApproved) out.push({type:"settle_finance",message:"Pagamento aprovado: conciliar e baixar o título vinculado uma única vez."});
 if(c.entityType==="service_order"&&c.status==="completed") out.push({type:"prepare_fiscal",message:"OS concluída: preparar documento fiscal conforme natureza dos itens."});
 if(c.stockBelowMinimum) out.push({type:"request_purchase",message:"Estoque abaixo do mínimo: gerar solicitação de compra para aprovação."});
 return out;
}
