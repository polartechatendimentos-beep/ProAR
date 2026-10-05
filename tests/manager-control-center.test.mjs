import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { financialAccessState } from "../lib/manager-billing.ts";

test("Manager control center exposes maintenance, rollout, domain, backup, support and incidents",async()=>{
 const component=await readFile(new URL("../components/ManagerControlCenter.tsx",import.meta.url),"utf8");
 const route=await readFile(new URL("../app/api/manager/control-center/route.ts",import.meta.url),"utf8");
 for(const term of ["Modo manutenção","Feature flags","Domínio","Backup","Suporte","Uso e limites","Incidentes"]) assert.ok(component.includes(term));
 assert.ok(route.includes("requestBackup"));
 assert.ok(route.includes("verifyDomain"));
 assert.ok(route.includes("runDiagnostic"));
 assert.ok(route.includes("createIncident"));
});

test("maintenance mode is independent from manual and financial blocking",async()=>{
 const access=await readFile(new URL("../lib/company-access.ts",import.meta.url),"utf8");
 assert.ok(access.includes("MAINTENANCE_MODE"));
 assert.ok(access.includes("FINANCIAL_BLOCKED"));
 assert.ok(access.includes("SYSTEM_BLOCKED"));
 assert.ok(access.includes("maintenance_enabled"));
});

test("tenant admin management never exposes existing password hashes",async()=>{
 const route=await readFile(new URL("../app/api/manager/users/route.ts",import.meta.url),"utf8");
 const component=await readFile(new URL("../components/ManagerTenantUsers.tsx",import.meta.url),"utf8");
 assert.ok(route.includes("temporaryPassword"));
 assert.ok(route.includes("must_change_password"));
 assert.ok(route.includes("TENANT_ADMIN_PASSWORD_RESET"));
 assert.ok(!route.includes("select=*"));
 assert.ok(component.includes("Resetar senha"));
});

test("billing auto-block stays independent and reversible after payment",()=>{
 const overdue=[{company_id:"tenant",amount:299,due_date:"2026-09-01",status:"open"}];
 assert.equal(financialAccessState({billing_auto_block:true,billing_grace_days:5},overdue,new Date("2026-10-05T08:00:00-03:00")).blocked,true);
 const paid=[{...overdue[0],status:"paid"}];
 assert.equal(financialAccessState({billing_auto_block:true,billing_grace_days:5},paid,new Date("2026-10-05T08:00:00-03:00")).blocked,false);
});

test("Manager page integrates SaaS controls, billing and tenant users",async()=>{
 const page=await readFile(new URL("../app/manager/page.tsx",import.meta.url),"utf8");
 assert.ok(page.includes("ManagerReceivables"));
 assert.ok(page.includes("ManagerControlCenter"));
 assert.ok(page.includes("ManagerTenantUsers"));
});

console.log("manager-control-center.test.mjs: ok");