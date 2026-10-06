import test from "node:test";
import assert from "node:assert/strict";
import { applyOperationalCommand } from "../lib/operational-ledger.ts";
import { idempotencyKey, assertSingleEffect } from "../lib/transaction-engine.ts";

const actor={username:"admin",displayName:"Admin",can:()=>true};

test("same operational command is replayed without duplicating stock effect",()=>{
  const state={customers:[],serviceOrders:[],moduleRecords:{Estoque:[],Produtos:[{id:"P1",name:"Filtro",stockCurrent:0}]}};
  const command={idempotencyKey:"idem_stock_0001",action:"stock",data:{movementType:"Entrada",productId:"P1",quantity:2,reason:"Teste"}};
  const first=applyOperationalCommand(state,command,actor,"2026-10-06T15:00:00-03:00");
  const second=applyOperationalCommand(first.state,command,actor,"2026-10-06T15:00:01-03:00");
  assert.equal(first.replay,false);
  assert.equal(second.replay,true);
  assert.equal(second.state.moduleRecords.Estoque.length,1);
});

test("transaction correlation key is stable and duplicate effects are rejected",()=>{
  const key=idempotencyKey({tenantId:"tenant-1",kind:"stock",sourceId:"OS-1",action:"consume"});
  assert.equal(key,"tenant-1:stock:OS-1:consume");
  assert.throws(()=>assertSingleEffect([
    {id:"1",aggregateId:"OS-1",kind:"stock",action:"consume",sourceId:"OS-1",correlationId:"proar:OS-1",idempotencyKey:key,occurredAt:"2026-10-06T15:00:00-03:00"},
    {id:"2",aggregateId:"OS-1",kind:"stock",action:"consume",sourceId:"OS-1",correlationId:"proar:OS-1",idempotencyKey:key,occurredAt:"2026-10-06T15:00:01-03:00"},
  ],key),/duplicado/i);
});
