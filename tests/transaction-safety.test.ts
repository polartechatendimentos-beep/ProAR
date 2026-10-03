import { describe,it,expect } from "vitest";
import { correlationId,idempotencyKey,assertSingleEffect,type ProAREvent } from "../lib/transaction-engine";
import { auditTransactionIntegrity } from "../lib/integrity-engine";
import { evaluateProARAutomations } from "../lib/automation-engine";
import { buildOperationalSignals } from "../lib/proar-copilot";

describe("ProAR transaction safety",()=>{
 it("keeps one correlation across the chain",()=>expect(correlationId("ORC-123")).toBe("proar:ORC-123"));
 it("generates deterministic idempotency keys",()=>expect(idempotencyKey({tenantId:"t1",kind:"stock",sourceId:"PED-1",action:"debit"})).toBe("t1:stock:PED-1:debit"));
 it("detects duplicate stock/financial effects",()=>{
  const e={id:"1",aggregateId:"1",kind:"stock",action:"debit",sourceId:"p",correlationId:"proar:o",idempotencyKey:"dup",occurredAt:"2026-10-03T00:00:00Z"} as ProAREvent;
  expect(()=>assertSingleEffect([e,{...e,id:"2"}],"dup")).toThrow();
  expect(auditTransactionIntegrity([e,{...e,id:"2"}])[0]?.code).toBe("DUPLICATE_EFFECT");
 });
 it("flags approved payment without financial settlement",()=>{
  const e={id:"1",aggregateId:"1",kind:"payment",action:"approved",sourceId:"mp",correlationId:"proar:o",idempotencyKey:"pay",occurredAt:"2026-10-03T00:00:00Z"} as ProAREvent;
  expect(auditTransactionIntegrity([e]).some(x=>x.code==="PAYMENT_WITHOUT_SETTLEMENT")).toBe(true);
 });
 it("creates expected operational automations",()=>{
  expect(evaluateProARAutomations({event:"viewed",entityType:"budget",entityId:"1",hoursSinceLastAction:48}).some(x=>x.type==="create_task")).toBe(true);
  expect(evaluateProARAutomations({event:"approved",entityType:"payment",entityId:"1",paymentApproved:true}).some(x=>x.type==="settle_finance")).toBe(true);
 });
 it("builds proactive copilot signals",()=>expect(buildOperationalSignals({completedOsWithoutInvoice:2,overduePmoc:0,viewedBudgetsWithoutFollowup:0,tomorrowStockShortages:0})[0]?.priority).toBe("high"));
});
