import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("Manager expõe somente Básico, Intermediário e Completo comercialmente", async () => {
  const source = await read("../lib/manager-plans.ts");
  assert.ok(source.includes('code:"basico"'));
  assert.ok(source.includes('name:"Básico"'));
  assert.ok(source.includes('code:"intermediario"'));
  assert.ok(source.includes('name:"Intermediário"'));
  assert.ok(source.includes('code:"completo"'));
  assert.ok(source.includes('name:"Completo"'));
  assert.ok(source.includes("COMMERCIAL_MANAGER_PLANS"));
  assert.ok(source.includes("TRIAL_MANAGER_PLAN"));
});

test("limites de usuários são 2, 4 e ilimitado", async () => {
  const source = await read("../lib/manager-plans.ts");
  assert.ok(source.includes("limits:{users:2,serviceOrdersPerMonth:500"));
  assert.ok(source.includes("limits:{users:4,serviceOrdersPerMonth:3000"));
  assert.ok(source.includes("limits:{users:null,serviceOrdersPerMonth:20000"));
  assert.ok(source.includes("limits:{users:2,serviceOrdersPerMonth:100"));
});

test("Clientes permanece presente em todos os planos", async () => {
  const source = await read("../lib/manager-plans.ts");
  assert.ok(source.includes('"Clientes"'));
  assert.ok(source.includes("BASIC_MODULES"));
  assert.ok(source.includes("...BASIC_MODULES"));
  assert.ok(source.includes("COMPLETE_MODULES=[...ALL_MANAGER_MODULES]"));
});

test("Manager cobra por plano e mostra comparação dos três níveis", async () => {
  const page = await read("../app/manager/page.tsx");
  assert.ok(page.includes("manager-plan-grid"));
  assert.ok(page.includes("Valor mensal do plano"));
  assert.ok(page.includes("userLimitLabel"));
  assert.ok(page.includes("Usuários ilimitados"));
  assert.ok(!page.includes("moduleDraft"));
  assert.ok(!page.includes("moduleTotalCents"));
});

test("backend bloqueia downgrade incompatível e novos usuários acima do limite", async () => {
  const managerRoute = await read("../app/api/manager/companies/route.ts");
  const stateRoute = await read("../app/api/state/route.ts");
  assert.ok(managerRoute.includes('code:"PLAN_USER_LIMIT"'));
  assert.ok(managerRoute.includes("activeLicensedUserCount"));
  assert.ok(managerRoute.includes('action:"PLAN_CHANGED"'));
  assert.ok(stateRoute.includes("companyUserLimit"));
  assert.ok(stateRoute.includes("Limite do plano atingido"));
});

console.log("manager-module-groups.test.mjs: ok");
