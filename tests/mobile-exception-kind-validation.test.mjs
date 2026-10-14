import test from "node:test";
import assert from "node:assert/strict";
import { mobileFieldOrders } from "../lib/mobile-field.ts";
const session={username:"Tecnico",role:"Técnico"};
const project=(exceptions)=>mobileFieldOrders([{id:"OS-1",tech:"Tecnico",status:"Aberta",fieldExceptions:exceptions}],session)[0].fieldExceptions;
test("keeps only valid field exception kinds",()=>{
 const result=project([{id:"1",kind:"signature"},{id:"2",kind:"equipment"},{id:"3",kind:"other"},{id:"4",kind:null}]);
 assert.deepEqual(result.map(item=>item.kind),["signature","equipment"]);
});
test("malformed exceptions cannot masquerade as signature exceptions",()=>{
 assert.deepEqual(project([null,1,"signature",[],{id:"5"},{id:"6",kind:"SIGNATURE"}]),[]);
});
