import test from "node:test";
import assert from "node:assert/strict";
import { canConfirmOffline } from "../lib/mobile-field-operation.ts";

test("critical operations remain blocked offline despite casing or whitespace",()=>{
 for(const kind of ["fiscal","Fiscal"," FISCAL ","finance"," Finance ","stock-adjustment"," Stock-Adjustment ","payment","PAYMENT"," refund "]){
  assert.equal(canConfirmOffline(kind),false,kind);
 }
});

test("ordinary field updates remain available offline, empty operation does not",()=>{
 assert.equal(canConfirmOffline("field-update"),true);
 assert.equal(canConfirmOffline(" FIELD-UPDATE "),true);
 assert.equal(canConfirmOffline(""),false);
 assert.equal(canConfirmOffline("  "),false);
});
