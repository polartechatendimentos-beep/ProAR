import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("Manager usa salvamento explícito para alterações da empresa", async () => {
  const page = await read("../app/manager/page.tsx");
  assert.ok(page.includes("Alterações não salvas"));
  assert.ok(page.includes("Salvar alterações"));
  assert.ok(page.includes("Cancelar"));
  assert.ok(page.includes("saveCompanyChanges"));
  assert.ok(page.includes("resetCompanyDraft"));
});

test("troca de plano fica em rascunho até salvar", async () => {
  const page = await read("../app/manager/page.tsx");
  assert.ok(page.includes("setSelectedPlanDraftCode(plan.code)"));
  assert.ok(page.includes("const planDirty"));
  assert.ok(page.includes('body.planCode=effectivePlanDraftCode'));
  assert.ok(!page.includes('if(window.confirm(message))void patch(selectedCompany.id,{planCode:plan.code,status:"active"})'));
});

test("campos de cobrança entram na mesma confirmação da empresa", async () => {
  const page = await read("../app/manager/page.tsx");
  assert.ok(page.includes("const billingDirty"));
  assert.ok(page.includes("body.billingEnabled=billingDraft.enabled"));
  assert.ok(page.includes("body.monthlyFeeCents="));
  assert.ok(!page.includes("saveBilling()"));
});

test("Trial pode ser convertido para Básico via botão Salvar", async () => {
  const page = await read("../app/manager/page.tsx");
  assert.ok(page.includes('selectedCompany?.plan_code==="trial"'));
  assert.ok(page.includes('selectedPlanDraftCode'));
  assert.ok(page.includes('SELECIONADO'));
});

console.log("manager-company-save.test.mjs: ok");
