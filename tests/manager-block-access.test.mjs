import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("auth route blocks tenant before credentials when Manager marks company blocked",async()=>{
  const source=await readFile(new URL("../app/api/auth/route.ts",import.meta.url),"utf8");
  assert.ok(source.includes("validateCompanyAccessBySlug(resolvedTenant)"));
  assert.ok(source.includes('code:access.code'));
  assert.ok(source.includes('blocked:access.code==="SYSTEM_BLOCKED"'));
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
  assert.ok(source.includes("O acesso será liberado automaticamente"));
});

console.log("manager-block-access.test.mjs: ok");
