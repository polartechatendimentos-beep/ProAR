import assert from "node:assert/strict";
import test from "node:test";
import { applyOperationalCommand, independentOperationalRows, prepareOperationalState } from "../lib/operational-ledger.ts";
import { convertedNfseOriginError, convertedServiceFiscalValue, makeCommercialSnapshot } from "../lib/commercial-conversion.ts";
import { projectOperationalState } from "../lib/state-access.ts";

const actor = { username:"conversao.teste", can:()=>true };
const now = "2026-11-27T12:00:00.000Z";
const source = id => ({
  id,
  name:"Orçamento • Cliente sintético", client:"Cliente sintético", customerId:"CLI-1", unitId:"UN-1", unit:"Sede",
  date:"2026-11-25", status:"Enviado",
  value: 420, subtotal: 435, discount:20, surcharge:5,
  purchaseItems:[
    { id:"L-1", productId:"PROD-1", description:"Filtro", kind:"Produto", quantity:3, unitOfMeasure:"UN", unitValue:50, discountPercent:10 },
    { id:"L-2", productId:"SERV-1", description:"Manutenção", kind:"Serviço", quantity:2, unitOfMeasure:"SV", unitValue:140, discountPercent:0 },
    { id:"L-3", description:"Deslocamento", kind:"Custo adicional", quantity:1, unitOfMeasure:"SV", unitValue:20 },
  ],
});
const state = (budget = source("ORC-1")) => ({
  customers:[{id:"CLI-1",name:"Cliente sintético",address:"Rua de exemplo, 1"}],
  serviceOrders:[],
  moduleRecords:{
    Orçamentos:[budget], Vendas:[], Compras:[],
    "Unidades e setores":[{id:"UN-1",name:"Sede",client:"Cliente sintético",customerId:"CLI-1",address:"Local de exemplo"}],
    Produtos:[{id:"PROD-1",name:"Filtro de cadastro",kind:"Produto",unitOfMeasure:"Unidade",stockCurrent:10,value:60}],
    Serviços:[{id:"SERV-1",name:"Manutenção de cadastro",kind:"Serviço",unitOfMeasure:"serviço",value:160}],
  },
});
const command = (data, target, key = "quote-attempt-01", overrides = {}) => ({
  action:"budget-convert", idempotencyKey:key, recordId:data.moduleRecords.Orçamentos[0].id,
  expectedRecord:structuredClone(data.moduleRecords.Orçamentos[0]), data:{target}, ...overrides,
});
const run = (data, cmd, user = actor) => applyOperationalCommand(data,cmd,user,now);

test("orçamento → pedido preserva valores e descrição aprovados; estoque só movimenta quantidade real, não emite nota", () => {
  const initial = state(), cmd = command(initial,"Pedido");
  const { state: converted, replay } = run(initial,cmd);
  const sale = converted.moduleRecords.Vendas[0], budget = converted.moduleRecords.Orçamentos[0];
  assert.equal(replay,false);
  assert.equal(budget.budgetConversion.destinationId,sale.id);
  assert.equal(budget.convertedSaleId,sale.id);
  assert.equal(sale.sourceBudgetId,"ORC-1");
  assert.equal(sale.purchaseItems[0].unitOfMeasure,"UN");
  assert.equal(sale.purchaseItems[0].unitValue,50);
  assert.equal(sale.purchaseItems[0].discountPercent,10);
  assert.equal(sale.purchaseItems[2].kind,"Custo adicional");
  assert.equal(sale.value,420);
  assert.equal(sale.discount,20);
  assert.equal(sale.surcharge,5);
  assert.equal(sale.address,"Local de exemplo");
  assert.equal(sale.financeReviewRequired,true);
  assert.equal(converted.moduleRecords.Produtos[0].stockCurrent,7);
  assert.equal(converted.moduleRecords["Central Fiscal"]?.length ?? 0,0);
  assert.equal(converted.moduleRecords.Financeiro?.length ?? 0,0);
  assert.equal(initial.moduleRecords.Produtos[0].stockCurrent,10);
  assert.equal(run(converted,cmd).replay,true);
  assert.equal(run(converted,cmd).state.moduleRecords.Produtos[0].stockCurrent,7);
  assert.ok(independentOperationalRows("tenant-1",converted,initial).some(row=>row.id.endsWith("Vendas:"+sale.id)));
  assert.ok(independentOperationalRows("tenant-1",converted,initial).some(row=>row.id.endsWith(":Orçamentos:ORC-1")));
});

test("orçamento → OS preserva materiais, quantidades e descontos, não duplica pedido nem movimenta estoque na abertura", () => {
  const initial = state();
  const { state: converted } = run(initial,command(initial,"Ordem de serviço"));
  const order = converted.serviceOrders[0], budget = converted.moduleRecords.Orçamentos[0];
  assert.equal(order.id,"#OS-15500");
  assert.equal(budget.convertedOrderId,order.id);
  assert.equal(order.unitId,"UN-1");
  assert.equal(order.total,420);
  assert.equal(order.productsTotal,135);
  assert.equal(order.servicesTotal,280);
  assert.equal(order.catalogItems[0].quantity,3);
  assert.equal(order.catalogItems[0].unitOfMeasure,"UN");
  assert.equal(order.catalogItems[0].unitValue,50);
  assert.equal(order.catalogItems[0].discountPercent,10);
  assert.equal(order.commercialSnapshot.lines.length,3);
  assert.equal(order.commercialSnapshot.additionalCostsTotal,20);
  assert.equal(converted.moduleRecords.Produtos[0].stockCurrent,10);
  assert.equal(converted.moduleRecords["Central Fiscal"]?.length ?? 0,0);
  assert.throws(()=>run(converted,command(converted,"Pedido","retry-quote-02")),error=>error.status===409 && /já convertido/.test(error.message));
  const completed = structuredClone(converted);
  completed.serviceOrders[0].status="Concluída";
  const settled = prepareOperationalState(converted,completed,actor,now);
  assert.equal(settled.moduleRecords.Produtos[0].stockCurrent,7);
  assert.equal(settled.moduleRecords.Financeiro.filter(item=>item.serviceOrderId===order.id).length,1);
  assert.equal(settled.moduleRecords["Central Fiscal"]?.length ?? 0,0);
});

test("mistura fiscal exige revisão; serviços puros dão o total líquido para NFS-e", () => {
  const initial=state();
  assert.throws(()=>convertedServiceFiscalValue(makeCommercialSnapshot(initial.moduleRecords.Orçamentos[0],initial.moduleRecords)),/separação no Fiscal/);
  const pure=source("ORC-S");
  pure.purchaseItems=[pure.purchaseItems[1]];
  pure.value=265;
  pure.subtotal=280;
  const current=state(pure);
  const {state:converted}=run(current,command(current,"Ordem de serviço"));
  assert.equal(convertedServiceFiscalValue(converted.serviceOrders[0].commercialSnapshot),265);
  assert.equal(converted.serviceOrders[0].financeReviewRequired,false);
  assert.equal(convertedServiceFiscalValue(),undefined);
});

test("bloqueia revisão concorrente, conversão histórica, orçamento cancelado e alçada não autorizada", () => {
  const initial=state(), sent=command(initial,"Pedido");
  const updated=state();updated.moduleRecords.Orçamentos[0].description="alterou no outro terminal";
  assert.throws(()=>run(updated,sent),error=>error.status===409 && /alterado/.test(error.message));
  for (const status of ["Convertido em pedido","Convertido em OS","Cancelado","Rejeitado"]) {
    const current=state();current.moduleRecords.Orçamentos[0].status=status;
    assert.throws(()=>run(current,command(current,"Pedido")),error=>error.status===409);
  }
  const approval=state();approval.moduleRecords.Orçamentos[0].approvalRequired=true;
  assert.throws(()=>run(approval,command(approval,"Pedido")),/aprovação por alçada/);
  const large=state();Object.assign(large.moduleRecords.Orçamentos[0],{discount:50,value:390});
  assert.throws(()=>run(large,command(large,"Pedido")),/aprovação por alçada/);
});

test("não confunde unidade de estoque, fraciona peça, troca cliente ou aceita total forjado", () => {
  for(const [mutate,expected] of [
    [budget=>budget.purchaseItems[0].unitOfMeasure="m",/unidade.+difere do estoque/],
    [budget=>budget.purchaseItems[0].quantity=2.4,/não aceita fração/],
    [budget=>budget.customerId="OUTRO",/identidade/],
    [budget=>budget.unitId="OUTRA",/local.+pertencer/],
    [budget=>budget.value=456,/total registrado não confere/],
    [budget=>budget.purchaseItems.push(budget.purchaseItems[0]),/identificador repetido/],
  ]) {
    const current=state();
    mutate(current.moduleRecords.Orçamentos[0]);
    assert.throws(()=>run(current,command(current,"Pedido")),expected);
  }
});

test("permite medidas fracionáveis sem apagar desconto; usa permissão de OS e não aceita campos de origem do cliente", () => {
  const current=state();
  const budget=current.moduleRecords.Orçamentos[0];
  current.moduleRecords.Produtos[0].unitOfMeasure="metro";
  Object.assign(budget.purchaseItems[0],{quantity:1.5,unitOfMeasure:"m"});
  Object.assign(budget,{subtotal:367.5,value:352.5});
  assert.throws(()=>run(current,command(current,"Ordem de serviço"),{username:"comercial",can:p=>p==="comercial.editar"}),/os.editar/);
  assert.throws(()=>run(current,command(current,"Pedido","manual-retry-1",{data:{target:"Pedido",total:0.01}})),/dados persistidos/);
  const {state:converted}=run(current,command(current,"Pedido"));
  assert.equal(converted.moduleRecords.Vendas[0].purchaseItems[0].quantity,1.5);
  assert.equal(converted.moduleRecords.Vendas[0].value,352.5);
  assert.equal(converted.moduleRecords.Produtos[0].stockCurrent,8.5);
});

test("snapshot genérico não reescreve vínculo, quantidade ou valor; técnico não vê snapshot financeiro", () => {
  const initial = state();
  const {state:converted} = run(initial,command(initial,"Ordem de serviço"));
  const mutated=structuredClone(converted);
  mutated.serviceOrders[0].catalogItems[0].quantity=1;
  assert.throws(()=>prepareOperationalState(converted,mutated,actor,now),/itens convertidos/);
  const duplicate=structuredClone(converted);
  duplicate.moduleRecords.Vendas.push({...duplicate.serviceOrders[0],id:"falso-pedido"});
  assert.throws(()=>prepareOperationalState(converted,duplicate,actor,now),/vínculo.+imutável/);
  const support=structuredClone(converted);
  support.serviceOrders[0].tech="tecnico";
  support.moduleRecords.Funcionários=[{id:"T-1",employeeUsername:"tecnico",name:"tecnico"}];
  const visible=projectOperationalState(support,{username:"tecnico",displayName:"tecnico",role:"Técnico",permissions:[]},permission=>permission==="os.visualizar");
  assert.equal(visible.serviceOrders[0].commercialSnapshot,undefined);
  assert.equal(visible.serviceOrders[0].catalogItems[0].unitValue,undefined);
});


test("NFS-e de conversão deve usar o CPF/CNPJ vinculado e o total líquido exato, sem confiar no solicitante", () => {
  const pure=source("ORC-S");
  pure.purchaseItems=[pure.purchaseItems[1]];
  pure.value=265;
  pure.subtotal=280;
  const current=state(pure);
  const {state:converted}=run(current,command(current,"Ordem de serviço"));
  const os=converted.serviceOrders[0], customer={id:"CLI-1",doc:"12.345.678/0001-90"};
  assert.equal(convertedNfseOriginError(os,customer,"12345678000190","265.00"),undefined);
  assert.match(convertedNfseOriginError(os,customer,"12345678000190",260),/valor.+não confere/);
  assert.match(convertedNfseOriginError(os,customer,"12345678000190",265.001),/casas decimais/);
  assert.match(convertedNfseOriginError(os,customer,"12345678000122",265),/CPF\/CNPJ/);
  assert.match(convertedNfseOriginError(os,undefined,"12345678000190",265),/não está vinculado/);
  assert.match(convertedNfseOriginError({...os,financeReviewRequired:true},customer,"12345678000190",265),/revisão/);
});
