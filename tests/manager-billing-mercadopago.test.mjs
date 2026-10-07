import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("Manager billing migration is additive and supports card plus module entitlements",async()=>{
  const source=await read("../supabase/migrations/20261005_manager_billing_mercado_pago.sql");
  assert.ok(source.includes("proar_manager_receivables"));
  assert.ok(source.includes("proar_manager_module_entitlements"));
  assert.ok(source.includes("'pix','boleto','card'"));
  assert.ok(source.includes("public_token uuid"));
  assert.ok(!/\\b(drop table|truncate table)\\b/i.test(source));
});

test("Mercado Pago integration uses Orders API and idempotency",async()=>{
  const source=await read("../lib/mercado-pago.ts");
  assert.ok(source.includes("/v1/orders"));
  assert.ok(source.includes('"X-Idempotency-Key"'));
  assert.ok(source.includes('type:"credit_card"'));
  assert.ok(source.includes('id:"boleto"'));
  assert.ok(source.includes('id:"pix"'));
});

test("Manager derives monthly fee from enabled module prices",async()=>{
  const source=await read("../lib/manager-billing.ts");
  assert.ok(source.includes("proar_manager_module_entitlements"));
  assert.ok(source.includes("monthlyFeeCents=enabled.reduce"));
  assert.ok(source.includes("MODULE_ENTITLEMENTS_UPDATED"));
  assert.ok(source.includes("safeExternalReference"));
  assert.ok(source.includes('payment_method==="card"'));
});

test("Tenant auth and UI enforce contracted modules",async()=>{
  const auth=await read("../app/api/auth/route.ts");
  const session=await read("../lib/proar-auth.ts");
  const page=await read("../app/page.tsx");
  assert.ok(auth.includes("entitledModules"));
  assert.ok(session.includes("entitledModules?: string[]"));
  assert.ok(page.includes("Módulo não contratado"));
  assert.ok(page.includes("contractedModuleIds={authenticatedUser.moduleIds}"));
  assert.ok(page.includes("isModuleContracted(current,authenticatedUser.moduleIds)"));
  assert.ok(page.includes("const planBlocked"));
});

test("Public card checkout sends only tokenized card data to ProAR backend",async()=>{
  const page=await read("../app/pagamento/[token]/page.tsx");
  const route=await read("../app/api/billing/public/[token]/route.ts");
  assert.ok(page.includes("https://sdk.mercadopago.com/js/v2"));
  assert.ok(page.includes("cardToken:String(form.token"));
  assert.ok(!page.includes("cardNumber:String("));
  assert.ok(route.includes("payReceivableByCard"));
  assert.ok(route.includes("processar o cartão"));
});

console.log("manager-billing-mercadopago.test.mjs: ok");
