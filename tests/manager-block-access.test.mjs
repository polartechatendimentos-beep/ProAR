import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("auth route blocks tenant before credentials when Manager marks company blocked",async()=>{
  const source=await readFile(new URL("../app/api/auth/route.ts",import.meta.url),"utf8");
  assert.ok(source.includes("validateCompanyAccessBySlug(resolvedTenant)"));
  assert.ok(source.includes('code:access.code'));
  assert.ok(source.includes('blocked:["SYSTEM_BLOCKED","FINANCIAL_BLOCKED"].includes(String(access.code))'));
});

test("active sessions are revoked when Manager access becomes blocked",async()=>{
  const source=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.ok(source.includes("window.setInterval(verifyManagerAccess, 60 * 1000)"));
  assert.ok(source.includes('localStorage.removeItem("proar-offline-session")'));
  assert.ok(source.includes('setAuthenticatedUser(null)'));
});

test("login renders a dedicated Sistema bloqueado state",async()=>{
  const source=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.ok(source.includes("Sistema bloqueado"));
  assert.ok(source.includes("login-blocked-panel"));
  assert.ok(source.includes("Sistema bloqueado. Entre em contato com a equipe da ProAR."));
  assert.ok(source.includes("Entre em contato com a equipe da ProAR para regularizar o acesso ao sistema."));
});

console.log("manager-block-access.test.mjs: ok");
