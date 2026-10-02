import test from "node:test";
import assert from "node:assert/strict";
import { runProarTestLab, summarizeTestLab } from "../lib/test-lab.ts";
import { deriveOperationalActions } from "../lib/action-center.ts";

test("E2E sintético: cliente até fiscal fecha sem falhas estruturais",()=>{
  const state={
    customers:[{id:"CLI-E2E",name:"Cliente E2E"}],
    serviceOrders:[{id:"OS-E2E",client:"Cliente E2E",customerId:"CLI-E2E",status:"Concluída",nfseStatus:"Emitida"}],
    moduleRecords:{
      Equipamentos:[{id:"EQ-E2E",name:"Split 12k",customerId:"CLI-E2E"}],
      Orçamentos:[{id:"ORC-E2E",name:"Orçamento E2E",status:"Convertido em OS",customerId:"CLI-E2E"}],
      Compras:[{id:"CMP-E2E",name:"Compra E2E",status:"Recebido",stockMovementId:"MOV-E2E"}],
      Produtos:[{id:"PRD-E2E",name:"Produto E2E",stockCurrent:5}],
      Vendas:[{id:"VEN-E2E",name:"Venda E2E",status:"Pedido confirmado",financialRecordId:"FIN-E2E"}],
      Financeiro:[{id:"FIN-E2E",name:"Recebível E2E",status:"Em aberto"}],
    },
  };
  const before=JSON.stringify(state);
  const scenarios=runProarTestLab(state);
  const totals=summarizeTestLab(scenarios);
  assert.equal(totals.fail,0);
  assert.equal(totals.warning,0);
  assert.equal(JSON.stringify(state),before);
  const actions=deriveOperationalActions(state.serviceOrders,state.moduleRecords,new Date("2026-10-02T12:00:00-03:00"));
  assert.ok(!actions.some(item=>item.id.startsWith("wf-")));
});

test("E2E sintético: quebra de handoff aparece na Central de Pendências",()=>{
  const serviceOrders=[{id:"OS-E2E-2",client:"Cliente E2E",status:"Concluída",nfseStatus:"Não emitida"}];
  const modules={
    Orçamentos:[{id:"ORC-E2E-2",name:"Orçamento pendente",status:"Aprovado"}],
    Compras:[{id:"CMP-E2E-2",name:"Compra pendente",status:"Recebido"}],
    Vendas:[{id:"VEN-E2E-2",name:"Venda pendente",status:"Pedido confirmado"}],
  };
  const actions=deriveOperationalActions(serviceOrders,modules,new Date("2026-10-02T12:00:00-03:00"));
  assert.ok(actions.some(item=>item.id==="wf-budget-ORC-E2E-2"));
  assert.ok(actions.some(item=>item.id==="wf-os-fiscal-OS-E2E-2"));
  assert.ok(actions.some(item=>item.id==="wf-purchase-stock-CMP-E2E-2"));
  assert.ok(actions.some(item=>item.id==="wf-sale-finance-VEN-E2E-2"));
});

console.log("proar-e2e-flow.test.mjs: ok");