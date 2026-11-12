import test from "node:test";
import assert from "node:assert/strict";
import {inspectOsReadiness,osItemTotals} from "../lib/os-operational-readiness.ts";
const order={customerId:"c1",client:"Cliente",tech:"Técnico",service:"Instalação",date:"2026-11-12",executedService:"Instalação concluída",serviceItems:[{name:"9k",quantity:2,unitPrice:550},{name:"12k",quantity:2,unitPrice:600},{name:"24k",quantity:2,unitPrice:800}]};
test("six appliances are three lines with accurate subtotals",()=>{
 const total=osItemTotals(order);
 assert.equal(total.lines.length,3);assert.equal(total.subtotal,3900);assert.deepEqual(total.lines.map(x=>x.subtotal),[1100,1200,1600]);
});
test("missing customer, technician and service block creation",()=>{
 const issues=inspectOsReadiness({},"create");
 assert.deepEqual(issues.map(x=>x.code),["client","service","technician"]);
});
test("invalid quantities cannot produce a total",()=>{
 const data={...order,serviceItems:[{quantity:0,price:200}]};
 assert.equal(osItemTotals(data).valid,false);
 assert.equal(osItemTotals(data).subtotal,null);
 assert.equal(inspectOsReadiness(data,"create").some(x=>x.code==="quantity"),true);
});
test("completion requires execution notes and optionally signatures",()=>{
 const data={...order,executedService:""};
 const issues=inspectOsReadiness(data,"complete",{requireSignatures:true});
 assert.equal(issues.some(x=>x.code==="execution"&&x.severity==="blocking"),true);
 assert.equal(issues.some(x=>x.code==="client-signature"),true);
});
