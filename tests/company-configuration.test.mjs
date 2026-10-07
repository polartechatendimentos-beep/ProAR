import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isModuleContracted,isUserAllowed,moduleId } from "../lib/module-catalog.ts";
import { companyConfigurationVersion,buildCompanyConfiguration } from "../lib/company-configuration.ts";

test("module catalog exposes stable IDs independent of labels",()=>{
  assert.equal(moduleId("Ordens de serviço"),"service_orders");
  assert.equal(moduleId("OS"),"service_orders");
  assert.equal(isModuleContracted("Ordens de serviço",["service_orders"]),true);
  assert.equal(isModuleContracted("Financeiro",["service_orders"]),false);
});

test("contract and user permission remain separate decisions",()=>{
  assert.equal(isUserAllowed("Financeiro",["Financeiro"],[]),true);
  assert.equal(isUserAllowed("Financeiro",[],[]),false);
  assert.equal(isUserAllowed("Financeiro",[],["company_owner"]),true);
});

test("configuration version changes when module contract changes",()=>{
  const company={id:"C1",status:"active",plan_code:"profissional",modules:["Clientes","Ordens de serviço"],updated_at:"2026-10-07T12:00:00Z"};
  const a=companyConfigurationVersion(company,[]);
  const b=companyConfigurationVersion({...company,modules:["Clientes"]},[]);
  assert.notEqual(a,b);
  const config=buildCompanyConfiguration(company,[]);
  assert.deepEqual(config.contractedModuleIds.sort(),["customers","service_orders"].sort());
});

test("UI waits for authoritative company configuration before rendering modules",async()=>{
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  assert.ok(page.includes("Carregando módulos da empresa..."));
  assert.ok(page.includes('companyBootstrapStage!=="ready"'));
  assert.ok(page.includes('fetch("/api/company-config"'));
  assert.ok(page.includes("contractedModuleIds={authenticatedUser.moduleIds}"));
});

test("company config endpoint distinguishes blocked error and ready states",async()=>{
  const route=await readFile(new URL("../app/api/company-config/route.ts",import.meta.url),"utf8");
  assert.ok(route.includes('state:"blocked"'));
  assert.ok(route.includes('state:"error"'));
  assert.ok(route.includes('state:"ready"'));
  assert.ok(route.includes("preserveCachedConfiguration:true"));
});
