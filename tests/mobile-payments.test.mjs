import test from "node:test";import assert from "node:assert/strict";import {createMobilePaymentIntent,canFinalizePaidSale,paymentStatusLabel} from "../lib/mobile-payments.ts";
test("PIX remains pending until provider confirmation",()=>{const p=createMobilePaymentIntent("V1",100,"PIX");assert.equal(p.status,"Aguardando pagamento");assert.equal(canFinalizePaidSale(p),false);assert.match(paymentStatusLabel(p.status),/PIX/)});
test("cash can close without external provider",()=>{const p=createMobilePaymentIntent("V2",50,"Dinheiro");assert.equal(canFinalizePaidSale(p),true)});
