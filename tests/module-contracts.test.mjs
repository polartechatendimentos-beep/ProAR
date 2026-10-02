import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../components/DashboardWorkspace.tsx", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const modules = [
  "Painel inicial","Central de pendências","Agenda","Clientes","Equipamentos","Orçamentos","Vendas","Licitações",
  "Ordens de serviço","PMOC e conformidade","Obras","Serviços","Produtos","Estoque","Compras","Fornecedores",
  "Financeiro","Funcionários","Relatórios","Integridade do Sistema","Configurações",
];

for (const moduleName of modules) {
  assert.ok(page.includes(`name: "${moduleName}"`) || page.includes(`current === "${moduleName}"`) || page.includes(`"${moduleName}" ?`), `módulo ${moduleName} deve estar ligado à navegação/renderização`);
}
assert.ok(!page.includes('name: "Notificações"'), "Notificações não deve duplicar a Central de Pendências");
assert.ok(page.includes('Ctrl') || page.includes('metaKey'), "busca global deve manter atalho de teclado");
assert.ok(dashboard.includes("roleShortcuts"), "dashboard deve oferecer atalhos por perfil");
assert.ok(dashboard.includes("dashboard-filters"), "dashboard deve possuir filtros operacionais");
assert.ok(packageJson.scripts.lint.includes("app components lib"), "lint deve cobrir toda a interface e biblioteca");

const criticalRoutes = [
  "../app/api/nfe/issue/route.ts",
  "../app/api/nfce/issue/route.ts",
  "../app/api/nfse/issue/route.ts",
  "../app/api/nfe/distribution/route.ts",
  "../app/api/operations/route.ts",
  "../app/api/state/route.ts",
  "../app/api/integrity/route.ts",
  "../app/api/system-health/route.ts",
  "../app/api/public-work-map/route.ts",
];
for (const route of criticalRoutes) await access(new URL(route, import.meta.url));

const nfe = await readFile(new URL("../app/api/nfe/issue/route.ts", import.meta.url), "utf8");
const nfce = await readFile(new URL("../app/api/nfce/issue/route.ts", import.meta.url), "utf8");
const nfse = await readFile(new URL("../app/api/nfse/issue/route.ts", import.meta.url), "utf8");
for (const [name, source] of [["NF-e",nfe],["NFC-e",nfce],["NFS-e",nfse]]) {
  assert.ok(source.includes("validateFiscalPayload"), `${name} deve executar pré-validação fiscal`);
  assert.ok(source.includes("fiscal.emitir"), `${name} deve exigir permissão fiscal de emissão`);
}
assert.ok(page.includes("ncm?: string") && page.includes("cfop?: string") && page.includes("serviceCode?: string"), "Produtos e Serviços devem manter campos fiscais próprios");
assert.ok(page.includes('detailTab === "Fiscal"'), "cadastros especializados devem expor aba Fiscal");
assert.ok(page.includes("profilePresets"), "Funcionários devem oferecer perfis de acesso predefinidos");
assert.ok(!page.includes("moduleKeys = Object.keys(localStorage)"), "login não pode autenticar funcionário por cache local");
const inventory = await readFile(new URL("../components/InventoryOperations.tsx", import.meta.url), "utf8");
assert.ok(inventory.includes("Transferência") && inventory.includes("sourceType"), "Estoque deve suportar transferência rastreável entre destinos");
console.log("module-contracts.test.mjs: ok");
