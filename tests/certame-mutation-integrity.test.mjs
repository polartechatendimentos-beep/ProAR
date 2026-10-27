import test from "node:test";
import assert from "node:assert/strict";
import { createCertameMovement,assertUniqueMovement,CertameBalanceError } from "../lib/public-contracts.ts";
const item={id:"i",certameId:"c",description:"Serviço",unit:"un",contractedQuantity:10,unitValue:20};
const command={id:"m",item,type:"Reserva",quantity:1,userId:"u",origin:"OS",existingMovements:[]};
const previous={id:"p",certameId:"c",itemId:"i",type:"Reserva",reservedDelta:2,executedDelta:0,cancelledDelta:0};
test("certame commands reject nonfinite and invalid item numbers",()=>{
 for(const key of ["contractedQuantity","unitValue"]) for(const value of [NaN,Infinity,-Infinity,-1,"10"]) assert.throws(()=>createCertameMovement({...command,item:{...item,[key]:value}}),CertameBalanceError);
});
test("certame quantities that overflow precision are rejected",()=>{
 assert.throws(()=>createCertameMovement({...command,quantity:Number.MAX_VALUE}),CertameBalanceError);
});
test("invalid related deltas cannot bypass balance verification",()=>{
 for(const key of ["reservedDelta","executedDelta","cancelledDelta"]) for(const value of [NaN,Infinity,"2"]) assert.throws(()=>createCertameMovement({...command,existingMovements:[{...previous,[key]:value}]}),CertameBalanceError);
});
test("negative accumulated reservations block new mutations",()=>{
 assert.throws(()=>createCertameMovement({...command,existingMovements:[{...previous,reservedDelta:-2}]}),/inconsistente/);
});
test("unrelated invalid histories do not block another item",()=>{
 assert.equal(createCertameMovement({...command,existingMovements:[{...previous,itemId:"other",reservedDelta:NaN}]}).reservedDelta,1);
});
test("adjustment cannot exceed the global available quantity by default",()=>{
 assert.throws(()=>createCertameMovement({...command,type:"Ajuste autorizado",quantity:9,reason:"Correção autorizada",existingMovements:[previous]}),/saldo disponível/);
 assert.equal(createCertameMovement({...command,type:"Ajuste autorizado",quantity:8,reason:"Correção autorizada",existingMovements:[previous]}).cancelledDelta,8);
});
test("only boolean true preserves the explicit overconsumption override",()=>{
 for(const allowOverConsumption of ["true","false",1]) assert.throws(()=>createCertameMovement({...command,quantity:11,allowOverConsumption}),/Saldo/);
 assert.equal(createCertameMovement({...command,quantity:11,allowOverConsumption:true}).reservedDelta,11);
 assert.equal(createCertameMovement({...command,type:"Ajuste autorizado",quantity:11,reason:"Ajuste excepcional",allowOverConsumption:true}).cancelledDelta,11);
});
test("movement identifiers and optional correlations must be meaningful strings",()=>{
 for(const id of [""," ",null,123]) assert.throws(()=>assertUniqueMovement([],{id}),CertameBalanceError);
 for(const correlationId of [""," ",null,123]) assert.throws(()=>assertUniqueMovement([],{id:"m",correlationId}),CertameBalanceError);
 assert.doesNotThrow(()=>assertUniqueMovement([],{id:"m"}));
});
test("duplicate IDs and correlations remain rejected",()=>{
 assert.throws(()=>assertUniqueMovement([previous],{id:"p"}),/já foi registrada/);
 assert.throws(()=>assertUniqueMovement([{...previous,correlationId:"retry"}],{id:"new",correlationId:"retry"}),/já foi registrada/);
});
