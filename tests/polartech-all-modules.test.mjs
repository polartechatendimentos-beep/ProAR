import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("PolarTech principal recebe todos os módulos no login", async () => {
  const source = await read("../app/api/auth/route.ts");
  assert.ok(source.includes('import { ALL_MANAGER_MODULES } from "../../../lib/manager-plans";'));
  assert.ok(source.includes("primaryTenantModules"));
  assert.ok(source.includes("isPrimaryTenant(user.companyId, effectiveCompanySlug)"));
});

test("Manager normaliza PolarTech como Completo com catálogo integral", async () => {
  const source = await read("../app/api/manager/companies/route.ts");
  assert.ok(source.includes('plan_code:"completo", modules:ALL_MANAGER_MODULES'));
  assert.ok(source.includes('patch.plan_code = "completo";'));
  assert.ok(source.includes('patch.modules = ALL_MANAGER_MODULES;'));
  assert.ok(source.includes('syncPlanEntitlements(companyId,"completo",ALL_MANAGER_MODULES,user.username)'));
});

test("Ciclo do Manager persiste os módulos completos da PolarTech", async () => {
  const source = await read("../app/api/cron/manager-daily-check/route.ts");
  assert.ok(source.includes('plan_code: "completo"'));
  assert.ok(source.includes("modules: ALL_MANAGER_MODULES"));
  assert.ok(source.includes('syncPlanEntitlements(String(company.id),"completo",ALL_MANAGER_MODULES,"system-cron")'));
});
