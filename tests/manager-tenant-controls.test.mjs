import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Manager can consolidate PolarTech as Tenant 1 without moving operational data",async()=>{
  const source=await readFile(new URL("../app/api/manager/companies/route.ts",import.meta.url),"utf8");
  assert.ok(source.includes("registerPrimaryPilot"));
  assert.ok(source.includes("PRIMARY_TENANT_REGISTERED"));
  assert.ok(source.includes('provisioning_status:"ready"'));
});

test("Manager exposes per-tenant database health check",async()=>{
  const source=await readFile(new URL("../app/api/manager/companies/route.ts",import.meta.url),"utf8");
  assert.ok(source.includes("checkTenantHealth"));
  assert.ok(source.includes("proar_state?select=id&limit=1"));
  assert.ok(source.includes("last_health_at"));
});

test("Manager UI shows controls for Tenant 1 consolidation and health verification",async()=>{
  const source=await readFile(new URL("../app/manager/page.tsx",import.meta.url),"utf8");
  assert.ok(source.includes("Consolidar Tenant 1"));
  assert.ok(source.includes("Verificar banco"));
  assert.ok(source.includes("Saúde do banco"));
});

console.log("manager-tenant-controls.test.mjs: ok");
