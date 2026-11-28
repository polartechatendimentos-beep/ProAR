import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { operationalVisitIssue, isQuoteApproved, validOperationalRecordId } from "../lib/operational-follow-through.ts";
import { deriveOperationalActions } from "../lib/action-center.ts";

const now = new Date("2026-11-28T01:30:00Z"); // dates are still November 27 in Mirassol

test("only current real visits and open parts delays become priority records", () => {
  const order={date:"2026-11-27",status:"Agendada",tech:"Não definido",id:"#OS-15501"};
  assert.equal(operationalVisitIssue(order,now),"unassigned");
  assert.equal(operationalVisitIssue({...order,date:"2026-11-28"},now),null);
  assert.equal(operationalVisitIssue({...order,status:"Rascunho"},now),null);
  assert.equal(operationalVisitIssue({...order,status:"Aguardando peça",date:"2026-11-26"},now),"parts");
  assert.equal(operationalVisitIssue({...order,status:"Cancelada • aguardando peça"},now),null);
  const actions=deriveOperationalActions([order,{...order,id:"#OS-15502",status:"Aguardando material",date:"2026-11-26"}],{},now);
  assert.ok(actions.some(a=>a.id==="os-unassigned-#OS-15501" && a.recordId===order.id && a.priority===1));
  assert.ok(actions.some(a=>a.id==="os-parts-#OS-15502"));
  assert.equal(actions.filter(a=>a.recordId==="#OS-15502").length,1);
});

test("OS conversion respects commercial approval and approval limits", () => {
  assert.equal(isQuoteApproved({status:"Enviado"}),false);
  assert.equal(isQuoteApproved({status:"Aprovado"}),true);
  assert.equal(isQuoteApproved({status:"Aprovado",approvalRequired:true}),false);
  assert.equal(isQuoteApproved({status:"Enviado",approvalRequired:true,approvalStatus:"Aprovado"}),true);
  assert.equal(isQuoteApproved({status:"Convertido em OS",approvalStatus:"Aprovado"}),false);
  assert.equal(validOperationalRecordId("#OS-15506"),"#OS-15506");
  assert.equal(validOperationalRecordId("https://example.com"),"");
});

test("form keeps a stable draft identity and clears only after database confirmation", () => {
  const app=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf-8");
  const budget=app.slice(app.indexOf("function BudgetPDV"),app.indexOf("function BudgetPDV")+15000);
  assert.ok(budget.indexOf("newBudgetId.current ??=")>0);
  assert.ok(budget.indexOf("if(!await onSave(record))")<budget.indexOf("clearDraft();"));
  assert.ok(app.includes("order.creationRequestId===data.creationRequestId"));
  assert.ok(app.includes("serviceCode:nfseConfig.serviceCode"));
  assert.ok(app.includes("window.confirm(`O cliente confirmou o aceite"));
});
