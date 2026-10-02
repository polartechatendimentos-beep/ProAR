import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { verifyPassword } from "../lib/password.ts";

test("Manager keeps the requested bootstrap administrator as a hash, never plaintext",async()=>{
  const source=await readFile(new URL("../lib/manager-auth.ts",import.meta.url),"utf8");
  assert.ok(source.includes('BOOTSTRAP_MANAGER_USER = "admin"'));
  const match=source.match(/BOOTSTRAP_MANAGER_PASSWORD_HASH = "([^"]+)"/);
  assert.ok(match?.[1]);
  assert.equal(verifyPassword("232325",match[1]),true);
  assert.equal(verifyPassword("232326",match[1]),false);
  assert.ok(!source.includes('managerPassword = () => "232325"'));
});

test("Manager dashboard exposes health, audit, tenant detail and rollout metadata",async()=>{
  const page=await readFile(new URL("../app/manager/page.tsx",import.meta.url),"utf8");
  assert.ok(page.includes("Health Center"));
  assert.ok(page.includes("Versão e migrations"));
  assert.ok(page.includes("Auditoria recente"));
  assert.ok(page.includes("manager-detail"));
  assert.ok(page.includes("Verificar banco"));
  assert.ok(page.includes("Plano e módulos"));
  assert.ok(page.includes("Segurança"));
  assert.ok(page.includes("Logs"));
});

test("Manager API returns dashboard summary and platform metadata",async()=>{
  const route=await readFile(new URL("../app/api/manager/companies/route.ts",import.meta.url),"utf8");
  assert.ok(route.includes("managerPlatformInfo"));
  assert.ok(route.includes("expiringTrials"));
  assert.ok(route.includes("databaseErrors"));
  assert.ok(route.includes("staleHealth"));
  assert.ok(route.includes("proar_manager_audit"));
  assert.ok(route.includes("MANAGER_PLANS"));
  assert.ok(route.includes("keepCustomModules"));
});

console.log("manager-admin-dashboard.test.mjs: ok");
