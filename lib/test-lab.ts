export type TestLabState={
  customers?:Record<string,unknown>[];
  serviceOrders?:Record<string,unknown>[];
  moduleRecords?:Record<string,Record<string,unknown>[]>;
};

export type TestLabScenario={
  id:string;
  name:string;
  status:"pass"|"warning"|"fail";
  detail:string;
};

function list(value:unknown){return Array.isArray(value)?value as Record<string,unknown>[]:[];}

export function runProarTestLab(state:TestLabState):TestLabScenario[]{
  const customers=list(state.customers);
  const orders=list(state.serviceOrders);
  const modules=state.moduleRecords||{};
  const budgets=list(modules.Orçamentos);
  const sales=list(modules.Vendas);
  const purchases=list(modules.Compras);
  const finance=list(modules.Financeiro);
  const products=list(modules.Produtos);
  const equipment=list(modules.Equipamentos);

  const customerIds=new Set(customers.map(item=>String(item.id||"")).filter(Boolean));
  const invalidOrderLinks=orders.filter(item=>item.customerId&&!customerIds.has(String(item.customerId)));
  const completedWithoutFiscal=orders.filter(item=>/conclu[ií]d/i.test(String(item.status||""))&&!/autorizada|emitida|cancelada/i.test(String(item.nfseStatus||"")));
  const approvedBudgets=budgets.filter(item=>/aprovad/i.test(String(item.status||""))&&!/convertid/i.test(String(item.status||"")));
  const receivedWithoutStock=purchases.filter(item=>/recebid|conclu[ií]d/i.test(String(item.status||""))&&!item.stockMovementId);
  const confirmedSalesWithoutFinance=sales.filter(item=>/confirmad|conclu[ií]d/i.test(String(item.status||""))&&!item.financialRecordId);
  const negativeStock=products.filter(item=>Number(item.stockCurrent||0)<0);
  const orphanEquipment=equipment.filter(item=>item.customerId&&!customerIds.has(String(item.customerId)));
  const duplicateFinanceIds=finance.length-new Set(finance.map(item=>String(item.id||""))).size;

  return [
    {id:"customer-os-link",name:"Cliente → OS",status:invalidOrderLinks.length?"fail":"pass",detail:invalidOrderLinks.length?`${invalidOrderLinks.length} OS com vínculo de cliente inválido.`:"Vínculos de cliente das OS estão consistentes."},
    {id:"budget-flow",name:"Orçamento → OS/Venda",status:approvedBudgets.length?"warning":"pass",detail:approvedBudgets.length?`${approvedBudgets.length} orçamento(s) aprovado(s) aguardando conversão.`:"Sem orçamento aprovado parado no fluxo."},
    {id:"os-fiscal",name:"OS → Fiscal",status:completedWithoutFiscal.length?"warning":"pass",detail:completedWithoutFiscal.length?`${completedWithoutFiscal.length} OS concluída(s) aguardando etapa fiscal.`:"OS concluídas estão coerentes com o fluxo fiscal."},
    {id:"purchase-stock",name:"Compra → Estoque",status:receivedWithoutStock.length?"fail":"pass",detail:receivedWithoutStock.length?`${receivedWithoutStock.length} compra(s) recebida(s) sem movimento de estoque.`:"Compras recebidas possuem rastreabilidade de estoque."},
    {id:"sale-finance",name:"Venda → Financeiro",status:confirmedSalesWithoutFinance.length?"fail":"pass",detail:confirmedSalesWithoutFinance.length?`${confirmedSalesWithoutFinance.length} venda(s) sem vínculo financeiro.`:"Vendas confirmadas possuem vínculo financeiro."},
    {id:"stock-safety",name:"Estoque",status:negativeStock.length?"fail":"pass",detail:negativeStock.length?`${negativeStock.length} produto(s) com saldo negativo.`:"Nenhum saldo negativo encontrado."},
    {id:"equipment-owner",name:"Equipamento → Cliente",status:orphanEquipment.length?"fail":"pass",detail:orphanEquipment.length?`${orphanEquipment.length} equipamento(s) vinculados a cliente inexistente.`:"Equipamentos possuem cliente válido."},
    {id:"finance-ids",name:"Financeiro",status:duplicateFinanceIds>0?"fail":"pass",detail:duplicateFinanceIds>0?`${duplicateFinanceIds} identificador(es) financeiro(s) duplicado(s).`:"Identificadores financeiros estão únicos."},
  ];
}

export function summarizeTestLab(scenarios:TestLabScenario[]){
  return scenarios.reduce((acc,item)=>{acc[item.status]+=1;return acc;},{pass:0,warning:0,fail:0});
}