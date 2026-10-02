import test from "node:test";
import assert from "node:assert/strict";
import { financialAnalytics } from "../lib/financial-analytics.ts";

test("financeiro calcula realizado projetado e aging",()=>{
  const data=financialAnalytics([
    {id:"R1",name:"Cliente",transactionType:"Receber",value:1000,settledValue:400,dueDate:"2026-09-15",status:"Recebida parcialmente",centerCost:"Serviços"},
    {id:"P1",name:"Fornecedor",transactionType:"Pagar",value:300,settledValue:100,dueDate:"2026-10-10",status:"Paga parcialmente",centerCost:"Compras"},
  ],[
    {id:"L1",titleId:"R1",signedValue:400,kind:"Baixa"},
    {id:"L2",titleId:"P1",signedValue:-100,kind:"Baixa"},
  ],"2026-10-01");
  assert.equal(data.receivable,600);
  assert.equal(data.payable,200);
  assert.equal(data.realizedRevenue,400);
  assert.equal(data.realizedExpense,100);
  assert.equal(data.realizedResult,300);
  assert.equal(data.aging.d1_30,600);
});
