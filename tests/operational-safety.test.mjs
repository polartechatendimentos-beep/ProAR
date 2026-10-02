import test from "node:test";
import assert from "node:assert/strict";
import { auditOperationalIntegrity } from "../lib/integrity-audit.ts";
import { deriveOperationalActions } from "../lib/action-center.ts";
import { readFile } from "node:fs/promises";

test("integrity audit detects OS linked to nonexistent customer id",()=>{
  const result=auditOperationalIntegrity({
    customers:[{id:"CLI-1",name:"Cliente A"}],
    serviceOrders:[{id:"OS-1",client:"Cliente A",customerId:"CLI-X",status:"Aberta"}],
    moduleRecords:{Equipamentos:[],"Unidades e setores":[]},
  },"2026-10-02T12:00:00-03:00");
  assert.ok(result.findings.some(item=>item.check==="OS com cliente inválido"&&item.recordId==="OS-1"));
});

test("integrity audit warns when legacy OS depends only on customer name",()=>{
  const result=auditOperationalIntegrity({
    customers:[{id:"CLI-1",name:"Cliente A"}],
    serviceOrders:[{id:"OS-2",client:"Cliente A",status:"Aberta"}],
    moduleRecords:{Equipamentos:[],"Unidades e setores":[]},
  },"2026-10-02T12:00:00-03:00");
  assert.ok(result.findings.some(item=>item.check==="OS sem vínculo estável de cliente"&&item.recordId==="OS-2"));
});

test("diagnostic handoffs become actionable central pending items",()=>{
  const actions=deriveOperationalActions([{
    id:"OS-3",client:"Cliente A",service:"Corretiva",status:"Concluída",
    diagnosticQuoteHandoff:{status:"Pendente de revisão"},
    diagnosticPurchaseHandoff:{status:"Rascunho",items:[{name:"Sensor"}]},
  }],{},new Date("2026-10-02T12:00:00-03:00"));
  assert.ok(actions.some(item=>item.id==="diagnostic-quote-OS-3"&&item.module==="Orçamentos"));
  assert.ok(actions.some(item=>item.id==="diagnostic-purchase-OS-3"&&item.module==="Compras"));
});

test("OS workspace keeps recoverable local autosave and clears it after confirmed save",async()=>{
  const source=await readFile(new URL("../components/ServiceOrderWorkspace.tsx",import.meta.url),"utf8");
  assert.ok(source.includes("proar-os-draft:"));
  assert.ok(source.includes("Rascunho local recuperado automaticamente"));
  assert.ok(source.includes("localStorage.removeItem(autosaveKey)"));
});

console.log("operational-safety.test.mjs: ok");
