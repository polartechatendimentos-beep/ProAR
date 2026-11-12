import test from "node:test";
import assert from "node:assert/strict";
import {editSaveTransition,tenantEditAllowed} from "../lib/unified-edit-guards.ts";
test("save cannot show success before server confirmation",()=>{
 assert.equal(editSaveTransition("dirty","confirmed"),"dirty");
 assert.equal(editSaveTransition("dirty","submit"),"dirty");
 assert.equal(editSaveTransition("saving","confirmed"),"saved");
 assert.equal(editSaveTransition("saving","failed"),"error");
});
test("tenant and permission checks deny cross-company editing",()=>{
 assert.equal(tenantEditAllowed("a","b",true),false);
 assert.equal(tenantEditAllowed("a","a",false),false);
 assert.equal(tenantEditAllowed("a","a",true),true);
});
