import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("new record modal waits for confirmed state and does not optimistically insert records",async()=>{
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 const start=page.indexOf("const saveRecord = async");
 const end=page.indexOf("\n  useEffect",start);
 const save=page.slice(start,end);
 assert.ok(save.includes("if(!await persistSharedState("));
 assert.equal(save.includes("setServiceOrders(updatedOrders)"),false);
 assert.equal(save.includes("setCustomerRecords(updatedCustomers)"),false);
 assert.equal(save.includes("setModuleRecords(updatedRecords)"),false);
 assert.ok(save.indexOf("if(!await persistSharedState(")<save.indexOf('setModal("")'));
 assert.equal(page.includes("[tiagoEmployee, ...realEmployees]"),false);
 assert.equal(page.includes('employeeRecords={moduleRecords["Funcionários"] ?? [tiagoEmployee]}'),false);
});
