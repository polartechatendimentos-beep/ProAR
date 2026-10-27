import test from "node:test";
import assert from "node:assert/strict";
import {auditOperationalIntegrity} from "../lib/integrity-audit.ts";
import {integrityDashboard} from "../lib/integrity-dashboard.ts";

test("E2E completo detecta quebra em qualquer handoff crítico",()=>{
 const base={customers:[{id:"C1",name:"Cliente"}],serviceOrders:[{id:"OS1",customerId:"C1",client:"Cliente",status:"Concluída",catalogItems:[{id:"P1",kind:"Produto",name:"Filtro",quantity:1}]}],moduleRecords:{Orçamentos:[{id:"B1",customerId:"C1",status:"Convertido",serviceOrderId:"OS1"}],Compras:[],Produtos:[{id:"P1",name:"Filtro",stockCurrent:4}],Financeiro:[{id:"F1",name:"Recebível",transactionType:"Receber",serviceOrderId:"OS1",value:500,settledValue:500,settlementHistory:[{id:"S1",principal:500,value:500}],reversalHistory:[]}],"Livro de estoque":[],"Razão financeiro":[]}};
 const report=auditOperationalIntegrity(base,"2026-10-03T12:00:00-03:00");
 assert.ok(report.findings.some(x=>x.check==="OS concluídas sem saída de estoque"));
 assert.ok(report.findings.some(x=>x.check==="Baixas sem movimento no razão"));
 assert.equal(integrityDashboard(report).status,"critical");
});
test("devolução/estorno sem compensação permanece crítica",()=>{
 const state={customers:[],serviceOrders:[],moduleRecords:{Financeiro:[{id:"F1",name:"Recebível",transactionType:"Receber",value:100,settledValue:0,_settlementOpening:0,settlementHistory:[{id:"S1",principal:100,value:100}],reversalHistory:[{id:"R1",settlementId:"S1"}]}],"Razão financeiro":[{id:"LED-S1",settlementId:"S1",kind:"Baixa"}]}};
 const report=auditOperationalIntegrity(state,"2026-10-03T12:00:00-03:00");
 assert.ok(report.findings.some(x=>x.check==="Estornos sem compensação no razão"));
});
console.log("transactional-e2e.test.mjs: ok");
