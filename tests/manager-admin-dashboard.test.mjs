import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateManagerCredentials } from "../lib/manager-auth.ts";

test("Manager accepts the requested bootstrap administrator credentials when env credentials are absent",()=>{
  const oldUser=process.env.PROAR_MANAGER_USER;
  const oldPass=process.env.PROAR_MANAGER_PASSWORD;
  delete process.env.PROAR_MANAGER_USER;
  delete process.env.PROAR_MANAGER_PASSWORD;
  try {
    assert.equal(validateManagerCredentials("admin","232325"),true);
    assert.equal(validateManagerCredentials("admin","232326"),false);
  } finally {
    if(oldUser===undefined) delete process.env.PROAR_MANAGER_USER; else process.env.PROAR_MANAGER_USER=oldUser;
    if(oldPass===undefined) delete process.env.PROAR_MANAGER_PASSWORD; else process.env.PROAR_MANAGER_PASSWORD=oldPass;
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
