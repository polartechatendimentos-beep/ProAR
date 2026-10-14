import test from "node:test";
import assert from "node:assert/strict";
import { mobileFieldOrders } from "../lib/mobile-field.ts";
const session={username:"tecnico",role:"Técnico"};
function project(value){return mobileFieldOrders([{id:"OS",tech:"tecnico",status:"Aberta",estimatedDurationMinutes:value,fieldDelay:{minutes:value,note:"atraso"},fieldWarranty:{days:value,terms:"condições"}}],session)[0];}
test("mobile duration delay and warranty reject malformed numeric values",()=>{
 for(const value of [NaN,Infinity,-Infinity,-1,1.5,"abc",true,[],{},null]) {
  const result=project(value);
  assert.equal(result.estimatedDurationMinutes,0);
  assert.equal(result.delay.minutes,0);
  assert.equal(result.warranty.days,0);
 }
});
test("mobile numeric projection preserves valid numbers and legacy numeric strings",()=>{
 for(const value of [0,30,"30"," 30 "]) {
  const result=project(value);
  assert.equal(result.estimatedDurationMinutes,Number(value));
  assert.equal(result.delay.minutes,Number(value));
  assert.equal(result.warranty.days,Number(value));
 }
});
test("mobile limits match the mutation bounds for minutes and warranty days",()=>{
 assert.equal(project(1440).delay.minutes,1440);
 assert.equal(project(1441).delay.minutes,0);
 assert.equal(project(3650).warranty.days,3650);
 assert.equal(project(3651).warranty.days,0);
});
test("mobile rejects array-shaped delay and warranty records",()=>{
 const result=mobileFieldOrders([{id:"OS",tech:"tecnico",status:"Aberta",fieldDelay:[],fieldWarranty:[]}],session)[0];
 assert.equal(result.delay,undefined);
 assert.equal(result.warranty,undefined);
});
