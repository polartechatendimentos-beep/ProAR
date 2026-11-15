import test from "node:test";
import assert from "node:assert/strict";
import { quantityPrice, expandTechnicalSheet } from "../lib/catalog-quantity-pricing.ts";
test("quantity price returns retail again when quantity drops below wholesale threshold", () => {
 const rules=[{minimumQuantity:5,unitPrice:80}];
 assert.equal(quantityPrice(100,5,rules).unitPrice,80);
 assert.equal(quantityPrice(100,4,rules).unitPrice,100);
});
test("confirmed consumption replaces estimate and combines materials",()=>{
 const catalog=[{id:"S",technicalSheet:[{productId:"P",quantityPerUnit:3}]}];
 assert.deepEqual(expandTechnicalSheet([{id:"S",quantity:2,materialsConfirmed:true,actualMaterials:[{productId:"P",quantity:4}]},{id:"P",kind:"Produto",quantity:1}],catalog),[{productId:"P",quantity:5}]);
 assert.throws(()=>expandTechnicalSheet([{id:"S",quantity:-1}],catalog),/inválida/);
});
