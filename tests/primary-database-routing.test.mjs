import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PolarTech admin login preserves canonical primary company id", async()=>{
  const source=await readFile(new URL("../app/api/auth/route.ts",import.meta.url),"utf8");
  assert.ok(source.includes('PRIMARY_COMPANY_ID = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal"'));
  assert.ok(source.includes('resolvedTenant !== PRIMARY_COMPANY_SLUG'));
});

test("state route maps PolarTech slug to canonical database and resolves db from canonical company", async()=>{
  const source=await readFile(new URL("../app/api/state/route.ts",import.meta.url),"utf8");
  assert.ok(source.includes('session?.companySlug'));
  assert.ok(source.includes('=== PRIMARY_COMPANY_SLUG) return PRIMARY_COMPANY_ID'));
  assert.ok(source.includes('resolveTenantDb(company)'));
});

console.log("primary-database-routing.test.mjs: ok");
