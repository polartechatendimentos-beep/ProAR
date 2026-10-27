import test from "node:test";
import assert from "node:assert/strict";
import { createCertameMovement, CertameBalanceError } from "../lib/public-contracts.ts";
const base={id:"mov-1",item:{id:"item-1",certameId:"certame-1",description:"Serviço",unit:"un",contractedQuantity:10,unitValue:100},quantity:1,userId:"user-1",origin:"OS",existingMovements:[]};
test("unknown movement type cannot create a zero-delta entry",()=>{
 assert.throws(()=>createCertameMovement({...base,type:"Outro"}),error=>error instanceof CertameBalanceError && /Tipo de movimentação/.test(error.message));
});
test("supported reserve movement still creates valid delta",()=>{
 const result=createCertameMovement({...base,type:"Reserva"});
 assert.equal(result.reservedDelta,1);
 assert.equal(result.executedDelta,0);
});
