import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Manager fails closed without a configured password",async()=>{
  const { validateManagerCredentials } = await import("../lib/manager-auth.ts");
  const oldUser=process.env.PROAR_MANAGER_USER;
  const oldPassword=process.env.PROAR_MANAGER_PASSWORD;
  try {
    process.env.PROAR_MANAGER_USER="audit-admin";
    delete process.env.PROAR_MANAGER_PASSWORD;
    assert.equal(validateManagerCredentials("audit-admin",""),false);
    process.env.PROAR_MANAGER_PASSWORD="test-only-unique-password";
    assert.equal(validateManagerCredentials("audit-admin","test-only-unique-password"),true);
    assert.equal(validateManagerCredentials("other-admin","test-only-unique-password"),false);
    assert.equal(validateManagerCredentials("audit-admin","wrong-password"),false);
  } finally {
    if(oldUser===undefined) delete process.env.PROAR_MANAGER_USER; else process.env.PROAR_MANAGER_USER=oldUser;
    if(oldPassword===undefined) delete process.env.PROAR_MANAGER_PASSWORD; else process.env.PROAR_MANAGER_PASSWORD=oldPassword;
  }
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
