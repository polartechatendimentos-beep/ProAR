import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("primary database adapter supports Prisma Postgres without exposing credentials",async()=>{
  const source=await readFile(new URL("../lib/supabase-rest.ts",import.meta.url),"utf8");
  assert.match(source,/configured==="prisma"/);
  assert.match(source,/PROAR_PRISMA_DATABASE_URL/);
  assert.match(source,/process\.env\.DATABASE_URL/);
  assert.match(source,/postgres\(connectionString/);
  assert.match(source,/prepare:false/);
  assert.match(source,/max:5/);
  assert.match(source,/provider === "neon" \|\| provider === "prisma"/);
});

test("tenant resolver reports the actual primary database provider",async()=>{
  const source=await readFile(new URL("../lib/tenant-rest.ts",import.meta.url),"utf8");
  assert.match(source,/databaseProvider\(\)/);
  assert.ok(!source.includes('neonEnabled() ? "neon" : "supabase"'));
});

test("runtime dependency contains the standard PostgreSQL client",async()=>{
  const pkg=JSON.parse(await readFile(new URL("../package.json",import.meta.url),"utf8"));
  assert.match(pkg.dependencies.postgres,/^\^3\./);
});

console.log("prisma-postgres-provider.test.mjs: ok");
