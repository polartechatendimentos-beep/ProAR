import test from "node:test";
import assert from "node:assert/strict";
import {paginationOffset} from "../lib/rest-pagination.ts";
import {cloudDraftOwner} from "../lib/cloud-order-drafts.ts";
test("REST pagination accepts bounded integer offsets and rejects SQL fragments",()=>{
 assert.equal(paginationOffset(null),null);assert.equal(paginationOffset("0"),0);assert.equal(paginationOffset("50"),50);assert.equal(paginationOffset("10000"),10000);
 for(const value of ["-1","1.5","NaN","Infinity","10001","9007199254740993","0;DROP TABLE proar_state","", " 50"])assert.throws(()=>paginationOffset(value));
});
test("draft ownership survives login rename and separates reused usernames",()=>{
 assert.equal(cloudDraftOwner("F1","marin"),cloudDraftOwner("F1","novo.usuario"));
 assert.notEqual(cloudDraftOwner("F1","marin"),cloudDraftOwner("F2","marin"));
});
