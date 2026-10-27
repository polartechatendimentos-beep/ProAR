export type WorkflowSuggestion={
  id:string;
  title:string;
  detail:string;
  module:string;
  priority:1|2|3;
  sourceModule:string;
  sourceId:string;
  nextAction:string;
};

type RecordLike=Record<string,unknown>;

export function deriveWorkflowSuggestions(serviceOrders:RecordLike[],modules:Record<string,RecordLike[]>):WorkflowSuggestion[]{
  const items:WorkflowSuggestion[]=[];
  for(const budget of modules.Orçamentos||[]){
    const status=String(budget.status||"");
    if(/aprovad/i.test(status)&&!/convertid/i.test(status)) items.push({id:`wf-budget-${budget.id}`,title:`Orçamento aprovado aguardando conversão • ${budget.name||budget.id}`,detail:"Converta para venda ou ordem de serviço para continuar o fluxo.",module:"Orçamentos",priority:2,sourceModule:"Orçamentos",sourceId:String(budget.id||""),nextAction:"Converter orçamento"});
  }
  for(const order of serviceOrders||[]){
    const status=String(order.status||"");
    if(/conclu[ií]d/i.test(status)&&!/^(autorizada|emitida|cancelada)$/i.test(String(order.nfseStatus||"").trim())){
      items.push({id:`wf-os-fiscal-${order.id}`,title:`OS concluída aguardando faturamento • ${order.id}`,detail:[order.client,"Preparar documento fiscal e financeiro"].filter(Boolean).join(" • "),module:"Fiscal",priority:2,sourceModule:"Ordens de serviço",sourceId:String(order.id||""),nextAction:"Preparar faturamento"});
    }
  }
  for(const purchase of modules.Compras||[]){
    const status=String(purchase.status||"");
    if(/recebid|conclu[ií]d/i.test(status)&&!purchase.stockMovementId){
      items.push({id:`wf-purchase-stock-${purchase.id}`,title:`Compra recebida sem entrada de estoque • ${purchase.name||purchase.id}`,detail:"Confirme a entrada física para atualizar estoque e rastreabilidade.",module:"Estoque",priority:1,sourceModule:"Compras",sourceId:String(purchase.id||""),nextAction:"Registrar entrada de estoque"});
    }
  }
  for(const sale of modules.Vendas||[]){
    if(/confirmad|conclu[ií]d/i.test(String(sale.status||""))&&!sale.financialRecordId){
      items.push({id:`wf-sale-finance-${sale.id}`,title:`Venda sem vínculo financeiro • ${sale.name||sale.id}`,detail:"Gerar ou vincular o título financeiro da venda.",module:"Financeiro",priority:1,sourceModule:"Vendas",sourceId:String(sale.id||""),nextAction:"Gerar financeiro"});
    }
  }
  return items;
}
