import test from "node:test";
import assert from "node:assert/strict";
import { createCertameMovement, validateEmpenhoAllocations, CertameBalanceError } from "../lib/public-contracts.ts";
const allocation={id:"a",empenhoId:"e",serviceOrderId:"os",amount:10};
test("empenho rejects invalid optional unit values",()=>{
 for(const unitValue of [-1,NaN,Infinity,-Infinity,"10",null]) assert.throws(()=>validateEmpenhoAllocations(100,[{...allocation,unitValue}]),CertameBalanceError);
});
test("empenho preserves absent, zero and decimal unit values",()=>{
 for(const unitValue of [undefined,0,1.25]) assert.deepEqual(validateEmpenhoAllocations(100,[{...allocation,unitValue}]),{allocated:10,remaining:90});
});
test("empenho rejects numeric overflow instead of returning nonfinite totals",()=>{
 assert.throws(()=>validateEmpenhoAllocations(Number.MAX_VALUE,[{...allocation,amount:Number.MAX_VALUE}]),/faixa numérica/);
});
const item={id:"i",certameId:"c",description:"Serviço",unit:"un",contractedQuantity:20,unitValue:10};
const movement=(id,serviceOrderId,reservedDelta,executedDelta=0)=>({id,certameId:"c",itemId:"i",serviceOrderId,reservedDelta,executedDelta,cancelledDelta:0});
const command={id:"new",item,quantity:3,userId:"u",origin:"OS",serviceOrderId:"os-A"};
test("execution and release cannot consume another order's reservation",()=>{
 for(const type of ["Execução","Liberação"]) assert.throws(()=>createCertameMovement({...command,type,existingMovements:[movement("r","os-B",10)]}),CertameBalanceError);
});
test("reversal cannot consume another order's executed quantity",()=>{
 assert.throws(()=>createCertameMovement({...command,type:"Estorno",existingMovements:[movement("x","os-B",0,10)]}),CertameBalanceError);
});
test("own reservation supports execution and release with unrelated reservations present",()=>{
 const existingMovements=[movement("a","os-A",4),movement("b","os-B",10)];
 assert.equal(createCertameMovement({...command,type:"Execução",existingMovements}).executedDelta,3);
 assert.equal(createCertameMovement({...command,type:"Liberação",existingMovements}).reservedDelta,-3);
});
test("reservation still checks the global contracted balance",()=>{
 assert.throws(()=>createCertameMovement({...command,type:"Reserva",existingMovements:[movement("a","os-A",10),movement("b","os-B",8)]}),/Saldo/);
});
test("legacy unscoped movements remain supported",()=>{
 assert.equal(createCertameMovement({...command,serviceOrderId:undefined,type:"Execução",existingMovements:[movement("a",undefined,4)]}).executedDelta,3);
});
