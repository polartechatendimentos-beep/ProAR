import test from "node:test";
import assert from "node:assert/strict";
import {orderCreationIssue} from "../lib/order-create-validation.ts";
test("new scheduled order needs client and date but not technician, equipment or catalog items",()=>{
 assert.equal(orderCreationIssue({client:"Cliente",date:"2026-10-28",draft:false}),null);
});
test("missing creation fields return actionable errors instead of a silent disabled button",()=>{
 assert.match(orderCreationIssue({client:"",date:"",draft:false}),/Selecione o cliente/);
 assert.match(orderCreationIssue({client:"Cliente",date:"",draft:false}),/data do atendimento/);
});
test("draft may omit schedule but cannot bypass a blocked customer",()=>{
 assert.equal(orderCreationIssue({client:"Cliente",date:"",draft:true}),null);
 for(const draft of [true,false])assert.match(orderCreationIssue({client:"Cliente",date:"2026-10-28",financialStatus:"Bloqueado",draft}),/bloqueado financeiramente/);
});
