import {describe,it,expect} from "vitest";
import {evaluateDayClose} from "../lib/day-close";
import {evaluateProtectedMargin} from "../lib/protected-margin";
import {calculateSla} from "../lib/sla-rework";
import {resolutionPlan} from "../lib/action-resolution";
describe("ProAR command center controls",()=>{
 it("blocks day close while reconciliation is pending",()=>expect(evaluateDayClose({openOs:0,paymentsWithoutSettlement:1,fiscalPending:0,stockDivergences:0,refundsPending:0}).canClose).toBe(false));
 it("requires approval below configured margin",()=>expect(evaluateProtectedMargin({revenue:1000,materials:800},25).requiresApproval).toBe(true));
 it("measures SLA and identifies rework",()=>{const x=calculateSla({requestedAt:"2026-10-01T08:00:00Z",scheduledAt:"2026-10-01T10:00:00Z",originalCompletedAt:"2026-10-01T12:00:00Z",returnedAt:"2026-10-02T12:00:00Z"});expect(x.requestToScheduleHours).toBe(2);expect(x.isRework).toBe(true);});
 it("never silently executes sensitive resolution",()=>expect(resolutionPlan({id:"a",module:"Financeiro",category:"Financeiro",priority:1}).mode).toBe("confirm"));
});
