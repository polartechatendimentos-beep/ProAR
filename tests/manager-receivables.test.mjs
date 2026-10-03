import test from "node:test";
import assert from "node:assert/strict";
import { financialAccessState, receivableStatus } from "../lib/manager-billing.ts";
import { readFile } from "node:fs/promises";

test("receivable becomes overdue after due date",()=>{
  assert.equal(receivableStatus({company_id:"c1",amount:100,due_date:"2026-09-20",status:"open"},new Date("2026-10-02T12:00:00-03:00")),"overdue");
});

test("financial block respects grace period",()=>{
  const invoices=[{company_id:"c1",amount:500,due_date:"2026-09-30",status:"open"}];
  const state=financialAccessState({billing_auto_block:true,billing_grace_days:5},invoices,new Date("2026-10-02T12:00:00-03:00"));
  assert.equal(state.blocked,false);
  assert.equal(state.overdueCount,1);
});

test("financial block activates after grace period",()=>{
  const invoices=[{company_id:"c1",amount:500,due_date:"2026-09-20",status:"open"}];
  const state=financialAccessState({billing_auto_block:true,billing_grace_days:5},invoices,new Date("2026-10-02T12:00:00-03:00"));
  assert.equal(state.blocked,true);
  assert.equal(state.overdueAmount,500);
});

test("paid or cancelled receivable never blocks access",()=>{
  const invoices=[{company_id:"c1",amount:500,due_date:"2026-09-01",status:"paid"},{company_id:"c1",amount:200,due_date:"2026-09-01",status:"cancelled"}];
  assert.equal(financialAccessState({billing_auto_block:true,billing_grace_days:0},invoices,new Date("2026-10-02T12:00:00-03:00")).blocked,false);
});

test("automatic financial block can be disabled per company",()=>{
  const invoices=[{company_id:"c1",amount:500,due_date:"2026-09-01",status:"open"}];
  assert.equal(financialAccessState({billing_auto_block:false,billing_grace_days:0},invoices,new Date("2026-10-02T12:00:00-03:00")).blocked,false);
});

test("company access exposes a distinct financial block without replacing manual status",async()=>{
  const source=await readFile(new URL("../lib/company-access.ts",import.meta.url),"utf8");
  assert.ok(source.includes("FINANCIAL_BLOCKED"));
  assert.ok(source.includes("Sistema bloqueado por pendência financeira"));
  assert.ok(source.includes('company.status !== "active"'));
});

test("Manager exposes accounts receivable UI and CRUD route",async()=>{
  const page=await readFile(new URL("../app/manager/page.tsx",import.meta.url),"utf8");
  const component=await readFile(new URL("../components/ManagerReceivables.tsx",import.meta.url),"utf8");
  const route=await readFile(new URL("../app/api/manager/receivables/route.ts",import.meta.url),"utf8");
  assert.ok(page.includes("ManagerReceivables"));
  assert.ok(component.includes("Contas a receber"));
  assert.ok(component.includes("Criar conta"));
  assert.ok(component.includes("Baixar"));
  assert.ok(route.includes("RECEIVABLE_PAID"));
  assert.ok(route.includes("BILLING_SETTINGS_UPDATED"));
});

console.log("manager-receivables.test.mjs: ok");