import test from "node:test";
import assert from "node:assert/strict";
import { auditOperationalIntegrity } from "../lib/integrity-audit.ts";

const state = (overrides = {}) => ({ _revision: 7, _updatedAt: "2026-09-30T10:00:00.000Z", customers: [], serviceOrders: [], moduleRecords: {}, ...overrides });
const findings = (input) => auditOperationalIntegrity(input, "2026-09-30T12:00:00.000Z").findings;

test("integrity diagnostic returns clean result without mutating the state", () => {
  const input = state({ customers: [{ id: "C1", name: "Cliente", doc: "12.345.678/0001-90", street:"Rua A", city:"Mirassol", state:"SP", zipCode:"15130-000" }], moduleRecords: { Produtos: [{ id: "P1", name: "Tubo", stockCurrent: 4 }], "Livro de estoque": [{ id: "OPEN-STOCK-P1", productId: "P1", kind: "Abertura", quantity: 4 }] } });
  const before = structuredClone(input);
  const report = auditOperationalIntegrity(input, "2026-09-30T12:00:00.000Z");
  assert.deepEqual(input, before);
  assert.equal(report.revision, 7);
  assert.equal(report.findings.length, 0);
  assert.equal(report.totals.ok, report.checks.length);
});

test("duplicate financial origins and installments are critical findings", () => {
  const issues = findings(state({ moduleRecords: { Financeiro: [{ id: "F1", name: "Compra", transactionType: "Pagar", purchaseId: "C1", installmentNumber: 1 }, { id: "F2", name: "Compra repetida", transactionType: "Pagar", purchaseId: "C1", installmentNumber: 1 }] } }));
  assert.equal(issues.filter(item => item.check === "Títulos financeiros duplicados").length, 2);
  assert.ok(issues.every(item => item.severity === "Crítico"));
});

test("separate purchase installments are not considered duplicates", () => {
  const issues = findings(state({ moduleRecords: { Financeiro: [{ id: "F1", purchaseId: "C1", transactionType: "Pagar", installmentNumber: 1 }, { id: "F2", purchaseId: "C1", transactionType: "Pagar", installmentNumber: 2 }] } }));
  assert.equal(issues.some(item => item.check === "Títulos financeiros duplicados"), false);
});

test("deferred purchase without a linked title and title without an origin are identified", () => {
  const issues = findings(state({ moduleRecords: { Compras: [{ id: "C1", name: "Compra", paymentType: "A prazo" }], Financeiro: [{ id: "F1", name: "Título avulso", transactionType: "Pagar" }] } }));
  assert.ok(issues.some(item => item.check === "Compras a prazo sem título" && item.recordId === "C1"));
  assert.ok(issues.some(item => item.check === "Títulos sem origem" && item.recordId === "F1"));
});

test("stock balance divergence and negative balance are separate findings", () => {
  const issues = findings(state({ moduleRecords: { Produtos: [{ id: "P1", name: "Tubo", stockCurrent: -1 }], "Livro de estoque": [{ id: "M1", productId: "P1", quantity: 3 }] } }));
  assert.ok(issues.some(item => item.check === "Produtos com saldo negativo" && item.recordId === "P1"));
  assert.ok(issues.some(item => item.check === "Estoque divergente do livro" && item.recordId === "P1"));
});

test("completed service order with product consumption but no movement is flagged", () => {
  const issues = findings(state({ serviceOrders: [{ id: "OS1", status: "Concluída", catalogItems: [{ id: "P1", name: "Filtro", kind: "Produto", quantity: 1 }] }] }));
  assert.ok(issues.some(item => item.check === "OS concluídas sem saída de estoque" && item.recordId === "OS1"));
});

test("customer duplicates, invalid equipment relations and orphan structures are found", () => {
  const issues = findings(state({ customers: [{ id: "C1", name: "A", doc: "12345678000190" }, { id: "C2", name: "B", doc: "12.345.678/0001-90" }], moduleRecords: { Equipamentos: [{ id: "E1", client: "Cliente inexistente", roomId: "ROOM-404" }], "Unidades e setores": [{ id: "U1", name: "Unidade órfã", parentId: "MISSING" }] } }));
  assert.ok(issues.some(item => item.check === "CPF/CNPJ duplicados"));
  assert.ok(issues.some(item => item.check === "Equipamentos sem cliente válido"));
  assert.ok(issues.some(item => item.check === "Equipamentos com estrutura inválida"));
  assert.ok(issues.some(item => item.check === "Estruturas órfãs"));
});

test("equipment assigned to a valid but different customer's structure is identified", () => {
  const issues = findings(state({ customers: [{ id: "C1", name: "Cliente A", doc: "111" }, { id: "C2", name: "Cliente B", doc: "222" }], moduleRecords: { Equipamentos: [{ id: "E1", customerId: "C1", structureId: "U2" }], "Unidades e setores": [{ id: "U2", customerId: "C2", name: "Unidade B" }] } }));
  assert.ok(issues.some(item => item.check === "Equipamentos em estrutura de outro cliente" && item.recordId === "E1"));
});

test("converted budget without service order is reported", () => {
  const issues = findings(state({ moduleRecords: { Orçamentos: [{ id: "B1", name: "Proposta 1", status: "Convertido" }] } }));
  assert.ok(issues.some(item => item.check === "Orçamentos convertidos sem OS" && item.recordId === "B1"));
});

test("settlement mismatch and missing ledger movements are surfaced", () => {
  const issues = findings(state({ moduleRecords: { Financeiro: [{ id: "F1", name: "Serviço", value: 100, settledValue: 50, transactionType: "Receber", _settlementOpening: 0, settlementHistory: [{ id: "SET1", principal: 100, value: 100 }], reversalHistory: [] }], "Razão financeiro": [] } }));
  assert.ok(issues.some(item => item.check === "Saldo financeiro divergente das baixas"));
  assert.ok(issues.some(item => item.check === "Baixas sem movimento no razão"));
});

test("a historical settled title without detailed settlements is disclosed as attention, not silently treated as clean", () => {
  const issues = findings(state({ moduleRecords: { Financeiro: [{ id: "F1", name: "Legado", status: "Recebida", value: 500, settledValue: 500 }] } }));
  assert.ok(issues.some(item => item.check === "Saldo legado sem baixas detalhadas" && item.severity === "Atenção"));
});

test("commercial and fiscal source chain divergences are surfaced",()=>{const issues=findings(state({serviceOrders:[{id:"OS1",status:"Concluída",sourceBudgetId:"B404",fiscalRequired:true}],moduleRecords:{Vendas:[{id:"V1",serviceOrderId:"OS404"}],Fiscal:[{id:"NF1",serviceOrderId:"OS404",status:"Autorizada"}]}}));assert.ok(issues.some(item=>item.check==="OS com orçamento de origem inválido"));assert.ok(issues.some(item=>item.check==="Vendas com OS de origem inválida"));assert.ok(issues.some(item=>item.check==="Documentos fiscais com origem inválida"));assert.ok(issues.some(item=>item.check==="OS concluídas com fiscal pendente"))});
test("multiple authorized fiscal documents for the same source are critical",()=>{const issues=findings(state({serviceOrders:[{id:"OS1",status:"Concluída"}],moduleRecords:{Fiscal:[{id:"NF1",serviceOrderId:"OS1",status:"Autorizada"},{id:"NF2",serviceOrderId:"OS1",status:"Emitida"}]}}));assert.equal(issues.filter(item=>item.check==="Documentos fiscais autorizados duplicados").length,2);assert.ok(issues.filter(item=>item.check==="Documentos fiscais autorizados duplicados").every(item=>item.severity==="Crítico"))});
