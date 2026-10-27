import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const text=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("production workflow keeps mandatory quality gates",async()=>{
  const workflow=await text(".github/workflows/validate.yml");
  for(const gate of ["npm run typecheck","npm run lint","npm test","npm run build","Runtime smoke"]) assert.ok(workflow.includes(gate),gate);
});

test("database retries are restricted to read-only requests",async()=>{
  const source=await text("lib/database-resilience.ts");
  assert.match(source,/GET.*HEAD.*OPTIONS/s);
  assert.match(source,/enabled:\s*safe/);
});

test("observability migration is additive and RLS protected",async()=>{
  const sql=(await text("supabase/migrations/20261006_proar_observability.sql")).toUpperCase();
  assert.ok(!/\bDROP\s+TABLE\b/.test(sql));
  assert.ok(!/\bTRUNCATE\b/.test(sql));
  assert.ok(!/\bDELETE\s+FROM\b/.test(sql));
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
});

test("rollback endpoint requires Manager authentication and explicit deployment",async()=>{
  const route=await text("app/api/manager/deployment-safety/route.ts");
  assert.match(route,/readManagerSession/);
  assert.match(route,/deploymentId/);
  assert.match(route,/VERCEL_TOKEN/);
  assert.match(route,/rollback/);
});
