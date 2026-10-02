import test from "node:test";
import assert from "node:assert/strict";
import { deriveProarActions } from "../lib/proar-insights.ts";

test("Hoje no ProAR prioriza OS atrasada e título vencido",()=>{
  const actions=deriveProarActions(
    [{id:"OS1",client:"Cliente",date:"2026-09-28",status:"Agendada"}],
    {Financeiro:[{id:"F1",name:"Cobrança",transactionType:"Receber",value:500,settledValue:0,dueDate:"2026-09-20",status:"Em aberto"}]},
    "2026-10-01"
  );
  assert.ok(actions.some(item=>item.id==="os-overdue-OS1"&&item.tone==="red"));
  assert.ok(actions.some(item=>item.id==="finance-F1"&&item.tone==="red"));
  assert.ok(actions[0].priority>=actions.at(-1).priority);
});
test("Hoje no ProAR identifica estoque crítico",()=>{
  const actions=deriveProarActions([], {Produtos:[{id:"P1",name:"Cobre",stockCurrent:2,stockMin:3}]}, "2026-10-01");
  assert.equal(actions[0].module,"Estoque");
});
