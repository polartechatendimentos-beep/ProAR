import test from "node:test";
import assert from "node:assert/strict";
import { mobileFieldOrders } from "../lib/mobile-field.ts";
const session={username:"João",displayName:"João",role:"Técnico"};
const orders=Array.from({length:600},(_,i)=>({id:`OS-${i}`,tech:"João",status:"Aberta"}));
test("mobile revision accepts nonnegative safe integers",()=>{
 for(const value of [0,7,Number.MAX_SAFE_INTEGER]) assert.equal(mobileFieldOrders([{...orders[0],fieldVersion:value}],session)[0].fieldVersion,value);
});
test("mobile revision rejects unsafe and malformed values",()=>{
 for(const value of [-1,1.5,Number.MAX_SAFE_INTEGER+1,Infinity,NaN,"5",null]) assert.equal(mobileFieldOrders([{...orders[0],fieldVersion:value}],session)[0].fieldVersion,0);
});
test("invalid mobile limits retain the safe default",()=>{
 for(const value of [NaN,Infinity,-Infinity,"500",null]) assert.equal(mobileFieldOrders(orders,session,value).length,300);
});
test("finite mobile limits are floored and clamped",()=>{
 for(const [limit,expected] of [[2.9,2],[0,1],[-20,1],[900,500]]) assert.equal(mobileFieldOrders(orders,session,limit).length,expected);
});
test("safe projection keeps malformed-record guards and technician segregation",()=>{
 const visible=mobileFieldOrders([{...orders[0],fieldRequests:[null,3,{id:"ok"}],fieldEvents:[null],mobileChecklist:[true]}, {id:"private",tech:"Maria",status:"Aberta"}],session,NaN);
 assert.deepEqual(visible.map(x=>x.id),["OS-0"]);
 assert.deepEqual(visible[0].requests.map(x=>x.id),["ok"]);
 assert.deepEqual(visible[0].events,[]);
 assert.deepEqual(visible[0].mobileChecklist,{});
});
