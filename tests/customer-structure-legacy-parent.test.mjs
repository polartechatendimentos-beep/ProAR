import test from "node:test";
import assert from "node:assert/strict";
import { prepareCustomerStructureSave } from "../lib/customer-structure.ts";
const customer={id:"cust-1",name:"Prefeitura A",organizationType:"Prefeitura"};
const draft={id:"unit-1",name:"UBS",hierarchyLevel:"Unidade",parentId:"dep-1"};
test("new hierarchy links reject legacy parent without customer ID",()=>{
 const parent={id:"dep-1",name:"Saúde",client:"Prefeitura A",hierarchyLevel:"Secretaria"};
 assert.throws(()=>prepareCustomerStructureSave(customer,draft,[parent]),/vínculo legado/);
});
test("valid hierarchy link keeps explicit customer ID",()=>{
 const parent={id:"dep-1",name:"Saúde",client:"Prefeitura A",customerId:"cust-1",hierarchyLevel:"Secretaria"};
 const saved=prepareCustomerStructureSave(customer,draft,[parent]);
 assert.equal(saved.record.customerId,"cust-1");
 assert.equal(saved.record.parentId,"dep-1");
});
test("cross-customer parent remains forbidden",()=>{
 const parent={id:"dep-1",name:"Saúde",client:"Prefeitura A",customerId:"cust-2",hierarchyLevel:"Secretaria"};
 assert.throws(()=>prepareCustomerStructureSave(customer,draft,[parent]),/outro cliente/);
});
