import test from "node:test";
import assert from "node:assert/strict";
import {calculateOsPricing} from "../lib/os-pricing-controls.ts";
const base={role:"Administrador",lines:[{id:"s1",quantity:2,catalogUnitCents:50000,overrideUnitCents:55000},{id:"s2",quantity:1,catalogUnitCents:20000}],discountCents:10000,surchargeCents:5000,paymentMethod:"Cartão de crédito",cardFeePercent:10};
test("multiple services, quantity, admin override, surcharge, discount and card fee",()=>{
 assert.deepEqual(calculateOsPricing(base),{subtotalCents:130000,discountCents:10000,surchargeCents:5000,cardFeeCents:12500,totalCents:137500});
});
test("reject unauthorized price edits, duplicate lines and invalid card fees",()=>{
 assert.throws(()=>calculateOsPricing({...base,role:"Técnico"}),/administrador/);
 assert.throws(()=>calculateOsPricing({...base,lines:[base.lines[0],base.lines[0]]}),/inválida/);
 assert.throws(()=>calculateOsPricing({...base,paymentMethod:"PIX"}),/cartão/);
 assert.throws(()=>calculateOsPricing({...base,discountCents:9999999}),/excede/);
});
