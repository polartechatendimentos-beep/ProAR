import test from "node:test";
import assert from "node:assert/strict";
import {applyOperationalCommand,prepareOperationalState} from "../lib/operational-ledger.ts";
import {PDV_REVIEW_STATUS,newPdvDraftId,pdvDraftCommand,pdvDraftKey,readPdvDrafts,storePdvDraft} from "../lib/pdv-offline.ts";

const now="2026-11-28T16:03:00Z";
const seller={username:"seller",can:()=>true};
const fixture=(stockCurrent=10)=>({customers:[{id:"C-1",name:"Cliente A"}],serviceOrders:[],moduleRecords:{Produtos:[{id:"P-1",name:"Tubo",kind:"Produto",value:30,wholesaleMinimumQuantity:2,wholesalePrice:25,stockCurrent}],Serviços:[{id:"S-1",name:"Limpeza",kind:"Serviço",value:40}]}});
const proposal=()=>({customerId:"C-1",structureId:"",discount:5,paymentMethod:"PIX",items:[{id:"P-1",quantity:2,unitPrice:25},{id:"S-1",quantity:1,unitPrice:40}]});
const run=(s,c,actor=seller)=>applyOperationalCommand(s,c,actor,now);
const draft=()=>({id:newPdvDraftId(),updatedAt:now,form:{payments:[{method:"Dinheiro",amount:33}]},attempted:false,proposal:proposal()});
const fakeStorage=()=>{const mem=new Map();return {getItem:key=>mem.get(key)??null,setItem:(key,value)=>mem.set(key,value)}};
test("local draft is scoped to company+operator and resumes with same ID and cash indication",()=>{
  const a=pdvDraftKey("A","operator"), b=pdvDraftKey("B","operator"), c=pdvDraftKey("A","other");
  const item=draft(), storage=fakeStorage();
  storePdvDraft(storage,a,item,item.id);
  assert.deepEqual(readPdvDrafts(storage,a),[item]);
  assert.deepEqual(readPdvDrafts(storage,b),[]);
  assert.deepEqual(readPdvDrafts(storage,c),[]);
});
test("uncertain browser result locks payload and keeps original idempotency key for recovery",()=>{
  const key=pdvDraftKey("A","sales"),storage=fakeStorage(),row={...draft(),attempted:true};
  storePdvDraft(storage,key,row,row.id);
  assert.throws(()=>storePdvDraft(storage,key,{...row,proposal:{...row.proposal,discount:2}},row.id),/confira/i);
  assert.deepEqual(pdvDraftCommand(readPdvDrafts(storage,key)[0]),pdvDraftCommand(row));
});
test("sync validates live catalog and stores only commercial pending record; no cash, payments, stock or fiscal effects",()=>{
  const cmd=pdvDraftCommand(draft());
  cmd.data.paymentStatus="Pago";cmd.data.invoiceNumber="FAKE";cmd.data.value=1;cmd.data.plannedPayments=[{method:"Dinheiro",amount:12,status:"Pago",token:"remove"},{method:"PIX",amount:73,status:"Pago"}];
  const next=run(fixture(),cmd).state;
  assert.equal(next.moduleRecords.Vendas[0].status,PDV_REVIEW_STATUS);
  assert.equal(next.moduleRecords.Vendas[0].value,85);
  assert.equal(next.moduleRecords.Vendas[0].paymentStatus,undefined);
  assert.deepEqual(next.moduleRecords.Vendas[0].pdvPaymentIntent,[{method:"Dinheiro",amount:12,status:"Não verificado"},{method:"PIX",amount:73,status:"Não verificado"}]);
  assert.equal(next.moduleRecords.Vendas[0].invoiceNumber,undefined);
  assert.equal(next.moduleRecords["Livro de estoque"].filter(r=>r.saleId).length,0);
  assert.equal(next.moduleRecords.Produtos[0].stockCurrent,10);
  assert.equal((next.moduleRecords.Financeiro??[]).length,0);
  assert.equal(run(next,cmd).replay,true);
  assert.throws(()=>run(next,{...cmd,data:{...cmd.data,discount:1}}),/outra operação/);
  assert.throws(()=>run(next,cmd,{username:"viewer",can:()=>false}),/não autorizada/);
});
test("can't mix another tenant's customer, stale prices or unavailable items",()=>{
  const cmd=pdvDraftCommand(draft());
  assert.throws(()=>run(fixture(),{...cmd,data:{...cmd.data,customerId:"OUTRA-EMPRESA"}}),/cadastro atual/);
  assert.throws(()=>run(fixture(),{...cmd,data:{...cmd.data,items:[{id:"P-1",quantity:2,unitPrice:29}]}}),/catálogo mudou/);
  assert.throws(()=>run(fixture(),{...cmd,data:{...cmd.data,items:[{id:"P-999",quantity:2,unitPrice:25}]}}),/não está mais disponível/);
});
test("a separate online confirmation posts stock once while insufficient stock leaves the order pending",()=>{
  const cmd=pdvDraftCommand(draft());
  for(const stock of [1,10]){
    const pending=run(fixture(stock),cmd).state;
    const requested=structuredClone(pending);
    requested.moduleRecords.Vendas[0].status="Pedido confirmado";
    if(stock===1){assert.throws(()=>prepareOperationalState(pending,requested,seller,now),/insuficiente/);continue;}
    const confirmed=prepareOperationalState(pending,requested,seller,now);
    assert.equal(confirmed.moduleRecords.Produtos[0].stockCurrent,8);
    assert.equal(confirmed.moduleRecords["Livro de estoque"].filter(r=>r.saleId===cmd.recordId).length,1);
    const repeat=prepareOperationalState(confirmed,confirmed,seller,now);
    assert.equal(repeat.moduleRecords.Produtos[0].stockCurrent,8);
  }
});
test("if normal online checkout committed but response was lost, same-ID recovery never posts the sale again",()=>{
  const cmd=pdvDraftCommand(draft()),old=fixture(),incoming=structuredClone(old);
  incoming.moduleRecords.Vendas=[{id:cmd.recordId,status:"Pedido confirmado",customerId:"C-1",value:85,paymentMethod:"PIX",purchaseItems:[{id:"P-1",kind:"Produto",quantity:2,unitValue:25},{id:"S-1",kind:"Serviço",quantity:1,unitValue:40}]}];
  const paid=prepareOperationalState(old,incoming,seller,now);
  assert.equal(paid.moduleRecords.Produtos[0].stockCurrent,8);
  const recovered=run(paid,cmd);
  assert.equal(recovered.replay,true);
  assert.equal(recovered.state.moduleRecords.Vendas.length,1);
  assert.equal(recovered.state.moduleRecords.Produtos[0].stockCurrent,8);
});

test("PDV entry uses durable browser recovery before checkout, tenant-scoped sync, and pending-sale fiscal exclusion",async()=>{
  const {readFile}=await import("node:fs/promises");
  const app=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  const fiscal=await readFile(new URL("../components/FiscalWorkspace.tsx",import.meta.url),"utf8");
  const route=await readFile(new URL("../app/api/operations/route.ts",import.meta.url),"utf8");
  const checkout=app.slice(app.indexOf("function SalesPDV"),app.indexOf("const moduleStatuses"));
  assert.ok(checkout.indexOf("makeDraft(saleId,true)")<checkout.indexOf("await onSave(sale)"));
  assert.match(checkout,/Salvar rascunho neste computador/);
  assert.match(checkout,/Conferir envio/);
  assert.match(app,/pdvDraftKey\(activeCompany\.id,authenticatedUser\.username\)/);
  assert.match(route,/command\.data\?\.companyId!==company/);
  assert.match(fiscal,/sales\.filter\(item=>!item\.invoiceNumber&&item\.status!=="Aguardando conferência"/);
});
