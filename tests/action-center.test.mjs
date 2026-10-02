import assert from "node:assert/strict";
import { deriveOperationalActions, summarizeOperationalActions } from "../lib/action-center.ts";

const actions = deriveOperationalActions(
  [
    { id: "OS-1", client: "Cliente A", service: "Corretiva", status: "Aberta", date: "2026-10-01", time: "09:00" },
    { id: "OS-2", client: "Cliente B", service: "Preventiva", status: "Agendada", date: "2026-10-02", time: "10:30" },
    { id: "OS-3", client: "Cliente C", service: "Instalação", status: "Concluída", date: "2026-09-30" },
  ],
  {
    Financeiro: [
      { id: "FIN-1", name: "Boleto vencido", client: "Cliente A", status: "Em aberto", value: 1000, settledValue: 200, dueDate: "2026-10-01" },
      { id: "FIN-2", name: "Boleto próximo", client: "Cliente B", status: "Em aberto", value: 500, dueDate: "2026-10-04" },
    ],
    Produtos: [
      { id: "P-1", name: "Tubo cobre", stockCurrent: 0, stockMin: 5 },
      { id: "P-2", name: "Isolamento", stockCurrent: 4, stockMin: 5 },
    ],
    Equipamentos: [
      { id: "EQ-1", name: "Split Sala", client: "Cliente A", nextMaintenanceDate: "2026-10-10" },
    ],
    Orçamentos: [
      { id: "ORC-1", name: "Orçamento 1", client: "Cliente A", status: "Enviado", createdAt: "2026-09-25" },
    ],
    Compras: [
      { id: "COMP-1", name: "Pedido cobre", status: "Aguardando entrega" },
    ],
  },
  new Date("2026-10-02T12:00:00-03:00"),
);

assert.equal(actions[0].priority, 1, "ações críticas devem aparecer primeiro");
assert.ok(actions.some(item => item.id === "os-overdue-OS-1" && item.tone === "red"));
assert.ok(actions.some(item => item.id === "os-today-OS-2" && item.module === "Agenda"));
assert.ok(!actions.some(item => item.recordId === "OS-3"), "OS concluída não deve gerar pendência");
assert.ok(actions.some(item => item.id === "finance-overdue-FIN-1" && item.detail.includes("800,00")));
assert.ok(actions.some(item => item.id === "finance-due-FIN-2"));
assert.ok(actions.some(item => item.id === "stock-P-1" && item.priority === 1));
assert.ok(actions.some(item => item.id === "stock-P-2" && item.priority === 2));
assert.ok(actions.some(item => item.id === "pmoc-upcoming-EQ-1"));
assert.ok(actions.some(item => item.id === "commercial-ORC-1"));
assert.ok(actions.some(item => item.id === "purchase-COMP-1"));

const summary = summarizeOperationalActions(actions);
assert.equal(summary.total, actions.length);
assert.ok(summary.critical > 0);
assert.ok(summary.byCategory.Estoque >= 2);

console.log("action-center.test.mjs: ok");


const approvalActions=deriveOperationalActions([],{Aprovações:[{id:"APR1",name:"Aprovação • Compra 1",sourceModule:"Compras",status:"Pendente",reason:"Alçada",value:6000}]},new Date("2026-10-02T12:00:00Z"));
const approvalItem=approvalActions.find(action=>action.recordId==="APR1");
assert.ok(approvalItem);
assert.equal(approvalItem.category,"Aprovação");
assert.equal(approvalItem.priority,1);
assert.equal(approvalItem.module,"Aprovações");
