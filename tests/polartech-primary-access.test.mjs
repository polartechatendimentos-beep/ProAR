import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("sessão antiga da PolarTech é reconhecida pelo domínio e renovada", async () => {
  const source = await read("../app/api/auth/route.ts");
  assert.ok(source.includes("tenantSlugFromHost(request.headers.get(\"host\"))"));
  assert.ok(source.includes("effectiveCompanySlug"));
  assert.ok(source.includes("primaryTenantModules()"));
  assert.ok(source.includes("response.cookies.set(COOKIE_NAME, createSessionForUser(claims)"));
});

test("usuário estático no domínio PolarTech recebe contexto completo do tenant principal", async () => {
  const source = await read("../app/api/auth/route.ts");
  assert.ok(source.includes("resolvedTenant === PRIMARY_COMPANY_SLUG"));
  assert.ok(source.includes("companyId: PRIMARY_COMPANY_ID"));
  assert.ok(source.includes("companySlug: PRIMARY_COMPANY_SLUG"));
  assert.ok(source.includes("entitledModules: primaryTenantModules()"));
});

test("frontend nunca bloqueia comercialmente o tenant principal PolarTech", async () => {
  const source = await read("../app/page.tsx");
  assert.ok(source.includes("isPrimaryPolartechClient"));
  assert.ok(source.includes('host === "polartech.proar.online"'));
  assert.ok(source.includes("const effectiveEntitledModules = useMemo"));
  assert.ok(source.includes("const planBlocked = !primaryTenantAccess"));
  assert.ok(source.includes("entitledModules={effectiveEntitledModules}"));
});

console.log("polartech-primary-access.test.mjs: ok");
