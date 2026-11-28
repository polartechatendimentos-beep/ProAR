import test from "node:test";
import assert from "node:assert/strict";
import {applyOperationalCommand,prepareOperationalState} from "../lib/operational-ledger.ts";
import {newPdvDraftId,pdvDraftCommand,PDV_PRICE_PERMISSION,PDV_REVIEW_STATUS,validatePdvProposal,validPdvUnitPrice} from "../lib/pdv-offline.ts";
import {hasPermission} from "../lib/permissions.ts";

const actor=(price)=>({username:"caixa-teste",can:permission=>permission!==PDV_PRICE_PERMISSION||price});
const fixture=()=>({customers:[],serviceOrders:[],moduleRecords:{Produtos:[{id:"P-1",name:"Peça de teste",kind:"Produto",value:100,stockCurrent:4,wholesaleMinimumQuantity:2,wholesalePrice:90}]}});
const payload=()=>({items:[{id:"P-1",quantity:2,unitPrice:75.25,priceOverride:true}],paymentMethod:"PIX",plannedPayments:[{method:"PIX",amount:150.5}],discount:0});
const cmd=()=>pdvDraftCommand({id:newPdvDraftId(),proposal:payload()});
const manualSale=(id)=>({id,category:"Venda PDV",status:"Pedido confirmado",value:150.50,paymentMethod:"PIX",pdvPayments:[{method:"PIX",amount:150.5}],purchaseItems:[{id:"P-1",kind:"Produto",quantity:2,unitValue:75.25,priceOverride:true,catalogUnitValue:1}]});

test("Only the dedicated price permission or administrator can override; generic sales grants do not authorize it",()=>{
  assert.equal(hasPermission({role:"Vendedor",permissions:["Vendas","comercial.editar"]},PDV_PRICE_PERMISSION),false);
  assert.equal(hasPermission({role:"Gerência",permissions:[PDV_PRICE_PERMISSION]},PDV_PRICE_PERMISSION),true);
  assert.equal(hasPermission({role:"Administrador",permissions:[]},PDV_PRICE_PERMISSION),true);
  assert.equal(validPdvUnitPrice(0),false);
  assert.equal(validPdvUnitPrice(75.255),false);
  assert.equal(validPdvUnitPrice(75.25),true);
  const products=fixture().moduleRecords.Produtos;
  assert.throws(()=>validatePdvProposal(payload(),[],products,[],[]),/perfil/);
  assert.throws(()=>validatePdvProposal({...payload(),items:[{id:"P-1",quantity:2,unitPrice:75.25}]},[],products,[],[],true),/catálogo mudou/);
});

test("A fresh online sale keeps both the actual price and server catalog reference without changing the product",()=>{
  const old=fixture(), next=structuredClone(old), request=cmd();
  next.moduleRecords.Vendas=[manualSale(request.recordId)];
  assert.throws(()=>prepareOperationalState(old,next,actor(false)),/perfil/);
  const saved=prepareOperationalState(old,next,actor(true));
  const [item]=saved.moduleRecords.Vendas[0].purchaseItems;
  assert.equal(item.unitValue,75.25);
  assert.equal(item.catalogUnitValue,90);
  assert.equal(saved.moduleRecords.Produtos[0].value,100);
  assert.equal(saved.moduleRecords.Produtos[0].stockCurrent,2);
  assert.equal(applyOperationalCommand(saved,request,actor(true)).replay,true);
  const changed=structuredClone(saved);
  changed.moduleRecords.Vendas[0].purchaseItems[0].unitValue=70;
  assert.throws(()=>prepareOperationalState(saved,changed,actor(true)),/antes de confirmar/);
});

test("Offline price is preserved on the pending order and must be authorized again to confirm",()=>{
  const request=cmd(), old=fixture();
  assert.throws(()=>applyOperationalCommand(old,request,actor(false)),/perfil/);
  const {state}=applyOperationalCommand(old,request,actor(true));
  assert.equal(state.moduleRecords.Vendas[0].status,PDV_REVIEW_STATUS);
  assert.equal(state.moduleRecords.Vendas[0].purchaseItems[0].unitValue,75.25);
  assert.equal(state.moduleRecords.Produtos[0].stockCurrent,4);
  const confirm=structuredClone(state);
  confirm.moduleRecords.Vendas=[manualSale(request.recordId)];
  assert.throws(()=>prepareOperationalState(state,confirm,actor(false)),/perfil/);
  const saved=prepareOperationalState(state,confirm,actor(true));
  assert.equal(saved.moduleRecords.Produtos[0].stockCurrent,2);
  assert.equal(saved.moduleRecords.Vendas[0].purchaseItems[0].catalogUnitValue,90);
});
