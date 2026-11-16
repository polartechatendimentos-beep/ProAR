import test from "node:test";
import assert from "node:assert/strict";
import { inspectOperationalIntegrity } from "../lib/operational-integrity.ts";

test("base íntegra não produz alertas", () => {
  const result = inspectOperationalIntegrity({
    customers:[{id:"C1",name:"Cliente"}],
    serviceOrders:[{id:"OS1",customerId:"C1"}],
    moduleRecords:{Produtos:[{id:"P1",stockCurrent:0}],Financeiro:[{id:"F1",settlementHistory:[{id:"B1"}]}]},
  });
  assert.deepEqual(result,[]);
});
test("detecta duplicidade de IDs apenas no próprio módulo", () => {
  const result=inspectOperationalIntegrity({customers:[{id:"1"},{id:"1"}],serviceOrders:[{id:"1"}]});
  assert.equal(result.filter(item=>item.code==="DUPLICATE_RECORD_ID").length,1);
  assert.equal(result[0].module,"Clientes");
});
test("avisa OS com cliente inexistente sem apagar registro legado", () => {
  const result=inspectOperationalIntegrity({customers:[{id:"C1"}],serviceOrders:[{id:"O1",customerId:"C2"},{id:"O2",client:"Cliente antigo"}]});
  assert.deepEqual(result.map(item=>item.code),["ORPHAN_CUSTOMER"]);
});
test("identifica baixa duplicada em mesmo título, sem acusar títulos diferentes", () => {
  const result=inspectOperationalIntegrity({moduleRecords:{Financeiro:[
    {id:"F1",settlementHistory:[{id:"B1"},{id:"B1"}]},
    {id:"F2",settlementHistory:[{id:"B1"}]},
  ]}});
  assert.deepEqual(result.map(item=>item.code),["DUPLICATE_SETTLEMENT_ID"]);
});
test("estoque negativo e IDs vazios são reportados sem modificar os dados", () => {
  const state={moduleRecords:{Produtos:[{id:"P1",stockCurrent:-2},{id:"",stockCurrent:"abc"}]}};
  const before=structuredClone(state);
  const result=inspectOperationalIntegrity(state);
  assert.equal(result.filter(item=>item.code==="INVALID_STOCK_QUANTITY").length,2);
  assert.equal(result.filter(item=>item.code==="MISSING_RECORD_ID").length,1);
  assert.deepEqual(state,before);
});
test("coleções ausentes e arrays malformados não interrompem a auditoria", () => {
  assert.deepEqual(inspectOperationalIntegrity({}),[]);
  assert.deepEqual(inspectOperationalIntegrity({customers:[null,{},false]}),[
    {code:"MISSING_RECORD_ID",severity:"critical",module:"Clientes",recordId:"",message:"Registro na posição 1 sem identificador."},
  ]);
});
