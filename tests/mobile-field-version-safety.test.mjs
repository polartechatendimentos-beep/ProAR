import test from "node:test";
import assert from "node:assert/strict";
import { mobileFieldOrders } from "../lib/mobile-field.ts";
const session={username:"João",displayName:"João",role:"Técnico"};
function revision(value){return mobileFieldOrders([{id:"OS-1",tech:"João",status:"Aberta",fieldVersion:value}],session)[0]?.fieldVersion;}
test("mobile OS revision accepts nonnegative safe integers",()=>{
 assert.equal(revision(0),0);
 assert.equal(revision(7),7);
 assert.equal(revision(Number.MAX_SAFE_INTEGER),Number.MAX_SAFE_INTEGER);
});
test("mobile OS revision rejects negative, unsafe and malformed values",()=>{
 for(const value of [-1,-99,1.5,Number.MAX_SAFE_INTEGER+1,Infinity,NaN,"5",null]) assert.equal(revision(value),0);
});
