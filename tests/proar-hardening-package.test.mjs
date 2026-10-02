import test from "node:test";
import assert from "node:assert/strict";
import { classifyProarError, proarError } from "../lib/system-errors.ts";
import { rolePermissionPreset } from "../lib/role-permissions.ts";
import { deriveWorkflowSuggestions } from "../lib/workflow-automation.ts";
import { runProarTestLab, summarizeTestLab } from "../lib/test-lab.ts";
import { buildStructuredAuditEntry } from "../lib/audit-utils.ts";

test("system errors expose stable ProAR codes",()=>{
  assert.equal(classifyProarError("Sistema bloqueado").code,"PROAR-AUTH-002");
  assert.equal(classifyProarError("timeout",504).code,"PROAR-DB-002");
  assert.equal(proarError("PROAR-PERM-001").userMessage,"Você não possui permissão para realizar esta operação.");
});

test("role presets are granular and avoid wildcard access",()=>{
  const seller=rolePermissionPreset("Vendedor");
  assert.ok(seller.includes("comercial.editar"));
  assert.ok(!seller.includes("financeiro.editar"));
  assert.ok(!seller.includes("*"));
});

test("workflow suggestions connect approved budgets, completed OS, purchases and sales",()=>{
  const suggestions=deriveWorkflowSuggestions(
    [{id:"OS-1",client:"Cliente",status:"Concluída",nfseStatus:"Não emitida"}],
    {Orçamentos:[{id:"ORC-1",name:"Orçamento",status:"Aprovado"}],Compras:[{id:"CMP-1",name:"Compra",status:"Recebido"}],Vendas:[{id:"VEN-1",name:"Venda",status:"Pedido confirmado"}]},
  );
  assert.ok(suggestions.some(item=>item.id==="wf-budget-ORC-1"));
  assert.ok(suggestions.some(item=>item.id==="wf-os-fiscal-OS-1"));
  assert.ok(suggestions.some(item=>item.id==="wf-purchase-stock-CMP-1"));
  assert.ok(suggestions.some(item=>item.id==="wf-sale-finance-VEN-1"));
});

test("Test Lab reports cross-module failures without mutating state",()=>{
  const state={customers:[{id:"CLI-1"}],serviceOrders:[{id:"OS-1",customerId:"CLI-X",status:"Concluída"}],moduleRecords:{Compras:[{id:"CMP-1",status:"Recebido"}],Produtos:[{id:"P-1",stockCurrent:-1}]}};
  const before=JSON.stringify(state);
  const scenarios=runProarTestLab(state);
  assert.ok(scenarios.some(item=>item.id==="customer-os-link"&&item.status==="fail"));
  assert.ok(scenarios.some(item=>item.id==="stock-safety"&&item.status==="fail"));
  assert.ok(summarizeTestLab(scenarios).fail>=2);
  assert.equal(JSON.stringify(state),before);
});

test("structured audit records before and after without secrets",()=>{
  const entry=buildStructuredAuditEntry({action:"Cliente alterado",moduleName:"Clientes",recordId:"CLI-1",actor:"Admin",before:{name:"A",password:"segredo"},after:{name:"B",password:"novo"}});
  assert.equal(entry.changes.length,1);
  assert.equal(entry.changes[0].field,"Nome");
});

console.log("proar-hardening-package.test.mjs: ok");