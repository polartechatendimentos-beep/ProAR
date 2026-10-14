import test from "node:test";
import assert from "node:assert/strict";
import { mobileFieldOrders } from "../lib/mobile-field.ts";
const session={username:"tecnico",displayName:"Técnico",role:"Técnico"};
test("mobile projection ignores null and malformed nested field records",()=>{
 const result=mobileFieldOrders([{id:"OS-1",tech:"Técnico",status:"Aberta",fieldExceptions:[null,5,{id:"exc-1",kind:"signature",reason:"sem assinatura"}],fieldRequests:[null,"invalid",{id:"req-1",kind:"material"}],fieldEvents:[null,false,{id:"event-1",kind:"checkin"}],mobileChecklist:["invalid",true]}],session);
 assert.equal(result.length,1);
 assert.deepEqual(result[0].fieldExceptions.map(x=>x.id),["exc-1"]);
 assert.deepEqual(result[0].requests.map(x=>x.id),["req-1"]);
 assert.deepEqual(result[0].events.map(x=>x.id),["event-1"]);
 assert.deepEqual(result[0].mobileChecklist,{});
});
