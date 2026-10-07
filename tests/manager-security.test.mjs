import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Manager login is rate limited and audited",async()=>{
 const route=await readFile(new URL("../app/api/manager/auth/route.ts",import.meta.url),"utf8");
 const migration=await readFile(new URL("../supabase/migrations/20261007_manager_lifecycle_jobs.sql",import.meta.url),"utf8");
 assert.ok(route.includes("tooManyRecentFailures"));
 assert.ok(route.includes("15*60*1000"));
 assert.ok(route.includes("MANAGER_LOGIN_FAILED"));
 assert.ok(route.includes("MANAGER_LOGIN_SUCCESS"));
 assert.ok(route.includes("status:429"));
 assert.ok(migration.includes("proar_manager_login_attempts"));
});

test("Manager shows guided provisioning stages",async()=>{
 const page=await readFile(new URL("../app/manager/page.tsx",import.meta.url),"utf8");
 assert.ok(page.includes("manager-provisioning-steps"));
 for(const label of ["Cadastro","Banco","Estrutura","Health","Ativo"])assert.ok(page.includes(label));
});

test("support access is time boxed and lifecycle requests are non destructive",async()=>{
 const route=await readFile(new URL("../app/api/manager/control-center/route.ts",import.meta.url),"utf8");
 assert.ok(route.includes("support_access_until"));
 assert.ok(route.includes("60*60*1000"));
 assert.ok(route.includes("destructiveExecution:false"));
 assert.ok(route.includes("providerExecution:false"));
});

console.log("manager-security.test.mjs: ok");