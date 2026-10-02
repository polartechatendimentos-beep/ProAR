import { calculateFiscalTotals } from "../lib/fiscal-domain.ts";
import { splitMixedFiscalOperation } from "../lib/fiscal-split.ts";
import { translateFiscalRejection } from "../lib/fiscal-rejections.ts";
import { reconcileFiscalDocuments } from "../lib/fiscal-reconciliation.ts";

const equal = (actual, expected, message) => {
  if (actual !== expected) throw new Error(`${message}: esperado ${expected}, recebido ${actual}`);
};
const ok = (value, message) => { if (!value) throw new Error(message); };

{
  const totals = calculateFiscalTotals({
    items: [{ kind:"Produto", quantity:2, unitValue:100, discount:10, taxes:{ icms:{ base:190, rate:10 } } }],
    payments:[{ method:"17", amount:209 }],
  });
  equal(totals.products,200,"total de produtos");
  equal(totals.discounts,10,"desconto");
  equal(totals.taxes.icms,19,"ICMS matemático");
  equal(totals.net,209,"total líquido");
}

{
  const split = splitMixedFiscalOperation([
    { id:"P1",kind:"Produto",description:"Ar-condicionado",quantity:1,unitValue:2000 },
    { id:"S1",kind:"Serviço",description:"Instalação",quantity:1,unitValue:600 },
  ]);
  ok(split.mixed,"operação mista deve ser detectada");
  equal(split.merchandiseTotal,2000,"total mercadoria");
  equal(split.serviceTotal,600,"total serviço");
}

{
  const hint = translateFiscalRejection("999","NCM ausente no item");
  equal(hint.field,"items.ncm","rejeição NCM deve apontar para o produto");
}

{
  const reconciliation = reconcileFiscalDocuments({
    documents:[{ id:"NF1",status:"Autorizada",value:100,fiscalKey:"K",fiscalXmlUrl:"xml",fiscalSourceType:"Venda",fiscalSourceId:"V1" }],
    sales:[{ id:"V1",value:100 }],
    serviceOrders:[],
    financeRecords:[{ id:"F1",value:100,fiscalDocumentKey:"K" }],
  });
  equal(reconciliation.errors,0,"conciliação não deve ter erro");
  equal(reconciliation.warnings,0,"conciliação não deve ter aviso");
}
