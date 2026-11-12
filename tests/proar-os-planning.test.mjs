import test from "node:test";
import assert from "node:assert/strict";
import {checklistFor,checklistCompletion,orderProfit} from "../lib/proar-os-planning.ts";
test("checklist varies by service and requires explicit evidence",()=>{
 const installation=checklistFor("instalacao");
 assert.ok(installation.some(x=>x.id==="vacuum"));
 assert.ok(!checklistFor("higienizacao").some(x=>x.id==="vacuum"));
 assert.equal(checklistCompletion(installation,["identify"]).ready,false);
 assert.equal(checklistCompletion(installation,installation.map(x=>x.id)).ready,true);
 assert.throws(()=>checklistFor("unknown"));
});
test("OS margin is calculated in cents with strict tenant isolation",()=>{
 const data={companyId:"a",orderCompanyId:"a",revenueCents:100000,laborCents:20000,materialCents:10000,travelCents:5000,foodCents:3000,taxCents:10000,otherCents:2000};
 assert.deepEqual(orderProfit(data),{revenueCents:100000,costCents:50000,profitCents:50000,marginPercent:50});
 assert.throws(()=>orderProfit({...data,orderCompanyId:"b"}),/outra empresa/);
 assert.throws(()=>orderProfit({...data,laborCents:-1}),/centavos/);
 assert.equal(orderProfit({...data,revenueCents:0}).marginPercent,null);
});
