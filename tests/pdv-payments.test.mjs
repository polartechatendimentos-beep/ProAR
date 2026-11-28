import test from "node:test";
import assert from "node:assert/strict";
import {summarizePdvPayments} from "../lib/pdv-payments.ts";
import {applyOperationalCommand,prepareOperationalState} from "../lib/operational-ledger.ts";
import {newPdvDraftId,pdvDraftCommand,PDV_REVIEW_STATUS} from "../lib/pdv-offline.ts";

const split=[{method:"PIX",amount:120.25},{method:"Cartão de crédito",amount:179.75}];
const actor={username:"caixa-teste",can:()=>true};
const now="2026-11-28T15:00:00Z";
const fixture=()=>({customers:[],serviceOrders:[],moduleRecords:{Produtos:[{id:"P-1",name:"Peça de teste",kind:"Produto",value:300,stockCurrent:4}]}});
const proposal=()=>pdvDraftCommand({id:newPdvDraftId(),proposal:{items:[{id:"P-1",quantity:1,unitPrice:300}],paymentMethod:"PIX",plannedPayments:split,discount:0}});
const restore=(state,cmd)=>applyOperationalCommand(state,cmd,actor,now);

test("Pix and card close exactly in cents; incomplete, duplicate, precision and excess fail",()=>{
  assert.equal(summarizePdvPayments(split,300).complete,true);
  assert.equal(summarizePdvPayments(split.slice(0,1),300).remaining,179.75);
  assert.equal(summarizePdvPayments([...split,split[0]],300).complete,false);
  assert.equal(summarizePdvPayments([{method:"PIX",amount:300.001}],300).complete,false);
  assert.equal(summarizePdvPayments([{method:"PIX",amount:301},{method:"Dinheiro",amount:10}],300).overpaid,true);
  const cash=summarizePdvPayments([{method:"PIX",amount:120},{method:"Dinheiro",amount:200}],300);
  assert.equal(cash.change,20);
  assert.deepEqual(cash.net,[{method:"PIX",amount:120},{method:"Dinheiro",amount:180}]);
});

test("offline split remains unverified; online confirmation records portions on one order and consumes stock once",()=>{
  const cmd=proposal();
  const {state:pending}=restore(fixture(),cmd);
  const before=pending.moduleRecords.Vendas[0];
  assert.equal(before.status,PDV_REVIEW_STATUS);
  assert.equal(before.pdvPayments,undefined);
  assert.deepEqual(before.pdvPaymentIntent,split.map(row=>({...row,status:"Não verificado"})));
  const incoming=structuredClone(pending);
  const order=incoming.moduleRecords.Vendas[0];
  order.pdvPayments=split;
  assert.throws(()=>prepareOperationalState(pending,incoming,actor,now),/aguarda conferência/);
  order.status="Pedido confirmado";
  order.pdvPayments=split.slice(0,1);
  assert.throws(()=>prepareOperationalState(pending,incoming,actor,now),/soma/);
  order.pdvPayments=split;
  const saved=prepareOperationalState(pending,incoming,actor,now);
  assert.deepEqual(saved.moduleRecords.Vendas[0].pdvPayments,split);
  assert.equal(saved.moduleRecords.Vendas.length,1);
  assert.equal(saved.moduleRecords.Produtos[0].stockCurrent,3);
  assert.equal((saved.moduleRecords.Financeiro??[]).length,0);
  assert.equal(restore(saved,cmd).replay,true);
  const changed={...cmd,data:{...cmd.data,plannedPayments:[{method:"PIX",amount:300}]}};
  assert.throws(()=>restore(saved,changed),/outra operação|dados diferentes/);
  assert.equal(restore(saved,cmd).state.moduleRecords.Produtos[0].stockCurrent,3);
});

test("recording a new online split retains historical sales without touching their data",()=>{
  const cmd=proposal();
  const old=fixture();
  old.moduleRecords.Vendas=[{id:"VEN-LEGADA",value:5,paymentMethod:"PIX",status:"Pedido confirmado"}];
  const incoming=structuredClone(old);
  incoming.moduleRecords.Vendas.push({id:cmd.recordId,status:"Pedido confirmado",value:300,paymentMethod:"PIX",pdvPayments:split,purchaseItems:[{id:"P-1",kind:"Produto",quantity:1,unitValue:300}]});
  const saved=prepareOperationalState(old,incoming,actor,now);
  assert.deepEqual(saved.moduleRecords.Vendas[0],old.moduleRecords.Vendas[0]);
  assert.deepEqual(saved.moduleRecords.Vendas[1].pdvPayments,split);
  assert.equal(restore(saved,cmd).replay,true);
});
