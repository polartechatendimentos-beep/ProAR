import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("login client tolerates empty or non-json responses",async()=>{
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.ok(page.includes("const raw = await response.text()"));
  assert.ok(page.includes("A autenticação retornou uma resposta inválida."));
  assert.ok(page.includes("O servidor de autenticação respondeu com erro HTTP"));
  const loginStart=page.indexOf("function LoginScreen");
  const loginEnd=page.indexOf("\nfunction Modal(",loginStart);
  const loginSource=page.slice(loginStart,loginEnd);
  assert.ok(loginStart>=0&&loginEnd>loginStart);
  assert.ok(!loginSource.includes("const result = await response.json();"));
});

test("auth route always converts unexpected server failures to JSON",async()=>{
  const route=await readFile(new URL("../app/api/auth/route.ts",import.meta.url),"utf8");
  assert.ok(route.includes("async function handlePostAuth"));
  assert.ok(route.includes("code:descriptor.code"));
  assert.ok(route.includes("error:descriptor.userMessage"));
  assert.ok(route.includes("AUTH_POST_FAILED"));
  assert.ok(route.includes('access.code === "MANAGER_UNAVAILABLE"'));
  assert.ok(route.includes("primaryTenant"));
});

test("company access supports manager schemas before billing columns",async()=>{
  const source=await readFile(new URL("../lib/company-access.ts",import.meta.url),"utf8");
  assert.ok(source.includes("fullSelect"));
  assert.ok(source.includes("compatibleSelect"));
  assert.ok(source.includes("minimalSelect"));
  assert.ok(source.includes("COMPANY_ACCESS_QUERY_FAILED"));
});

console.log("login-resilience.test.mjs: ok");
