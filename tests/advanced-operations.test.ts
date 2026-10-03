import { describe,it,expect } from "vitest";
import { buildUniversalTimeline } from "../lib/universal-timeline";
import { buildExceptionCenter } from "../lib/exception-center";
import { calculateRealProfitability } from "../lib/real-profitability";
import { buildEquipmentPassport } from "../lib/equipment-passport";

describe("ProAR advanced operations",()=>{
 it("orders a universal timeline newest first",()=>{const r=buildUniversalTimeline([{id:"1",at:"2026-10-01",module:"OS",entityType:"os",entityId:"1",action:"created",summary:"a"},{id:"2",at:"2026-10-02",module:"Fiscal",entityType:"nf",entityId:"2",action:"issued",summary:"b",correlationId:"c"}],{});expect(r[0].id).toBe("2");});
 it("centralizes operational exceptions",()=>expect(buildExceptionCenter({integrity:[],negativeStock:["P1"]})[0].severity).toBe("critical"));
 it("calculates real margin including payment fees and rework",()=>{const r=calculateRealProfitability({revenue:1000,materials:300,laborHours:2,laborHourlyCost:50,paymentFees:30,rework:70});expect(r.profit).toBe(500);expect(r.margin).toBe(50);});
 it("creates equipment passport QR target",()=>{const p=buildEquipmentPassport({baseUrl:"https://proar.example",equipmentId:"EQ 1",serviceOrderIds:[],maintenanceEvents:[],parts:[]});expect(p.qrPayload).toContain("EQ%201/passaporte");});
});
