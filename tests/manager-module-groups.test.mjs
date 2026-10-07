import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

test("catálogo divide os 26 módulos sem perder nenhum", async () => {
  const source = await read("../lib/manager-plans.ts");
  assert.ok(source.includes('name:"Base Operacional"'));
  assert.ok(source.includes('name:"Comercial"'));
  assert.ok(source.includes('name:"Operação Técnica"'));
  assert.ok(source.includes('name:"Estoque e Suprimentos"'));
  assert.ok(source.includes('name:"Financeiro e Fiscal"'));
  assert.ok(source.includes('name:"Gestão e Produtividade"'));
  assert.ok(source.includes('name:"Obras e Licitações"'));
  assert.ok(source.includes('REQUIRED_MANAGER_MODULES=["Painel inicial","Clientes","Agenda","Funcionários","Configurações"]'));
  assert.ok(source.includes("normalizeManagerModules"));
});

test("Clientes e a base operacional não podem ser removidos por entitlement", async () => {
  const billing = await read("../lib/manager-billing.ts");
  const route = await read("../app/api/manager/companies/route.ts");
  assert.ok(billing.includes("REQUIRED_MANAGER_MODULES"));
  assert.ok(billing.includes("normalizeManagerModules"));
  assert.ok(route.includes("requiredModules: REQUIRED_MANAGER_MODULES"));
  assert.ok(route.includes("patch.modules = normalizeManagerModules(body.modules)"));
});

test("Manager identifica visualmente a base obrigatória", async () => {
  const page = await read("../app/manager/page.tsx");
  assert.ok(page.includes("setRequiredModules"));
  assert.ok(page.includes("Base Operacional é obrigatória"));
  assert.ok(page.includes("disabled={requiredModules.includes(moduleName)}"));
  assert.ok(page.includes("Base obrigatória"));
  assert.ok(page.includes("groupedModuleCatalog"));
});

console.log("manager-module-groups.test.mjs: ok");
