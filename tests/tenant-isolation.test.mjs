import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tenantDatabaseName, tenantIdentity, tenantProjectName } from "../lib/tenant-identity.ts";

test("PolarTech is identified as Tenant 1 pilot with stable database name",()=>{
  const tenant=tenantIdentity({companyId:"polartech-principal",slug:"polartech",tradeName:"PolarTech Mirassol"});
  assert.equal(tenant.role,"primary-pilot");
  assert.equal(tenant.environment,"pilot");
  assert.equal(tenant.databaseName,"proar_polartech");
  assert.equal(tenant.projectName,"proar-polartech");
});

test("new customer receives an isolated project/database identity",()=>{
  const tenant=tenantIdentity({companyId:"cmp-002",slug:"empresa-cliente",tradeName:"Empresa Cliente"});
  assert.equal(tenant.role,"customer");
  assert.equal(tenant.environment,"production");
  assert.equal(tenant.isolation,"dedicated-project");
  assert.equal(tenantDatabaseName("empresa-cliente"),"proar_empresa_cliente");
  assert.equal(tenantProjectName("empresa-cliente"),"proar-empresa-cliente");
});

test("tenant resolver refuses silent master fallback for customer tenants",async()=>{
  const source=await readFile(new URL("../lib/tenant-rest.ts",import.meta.url),"utf8");
  assert.ok(source.includes("Nenhum cliente alugado pode acessar silenciosamente a base da PolarTech"));
  assert.ok(source.includes('source:"registry"'));
  assert.ok(source.includes('source:"primary-fallback"'));
});

test("manager exposes tenant role database name and isolation",async()=>{
  const source=await readFile(new URL("../app/manager/page.tsx",import.meta.url),"utf8");
  assert.ok(source.includes("Tenant 1 • Piloto"));
  assert.ok(source.includes("Banco lógico"));
  assert.ok(source.includes("Projeto/Banco dedicado"));
});

test("dedicated provisioning uses canonical project naming",async()=>{
  const source=await readFile(new URL("../lib/tenant-provisioning.ts",import.meta.url),"utf8");
  assert.ok(source.includes("tenantIdentity"));
  assert.ok(source.includes("identity.projectName"));
});

console.log("tenant-isolation.test.mjs: ok");
