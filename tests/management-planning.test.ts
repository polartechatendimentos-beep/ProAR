import {describe,it,expect} from "vitest";
import {cashFlowForecast} from "../lib/cash-flow-forecast";
import {capacityPlan} from "../lib/capacity-planning";
describe("management planning",()=>{
 it("separates confirmed and projected cash",()=>{const x=cashFlowForecast([{id:"1",date:"2026-10-04",amount:1000,direction:"in",status:"confirmed",source:"finance"},{id:"2",date:"2026-10-05",amount:300,direction:"out",status:"projected",source:"purchase"}],"2026-10-03",[7])[0];expect(x.confirmed).toBe(1000);expect(x.projected).toBe(-300);expect(x.total).toBe(700);});
 it("detects overbooked technical capacity",()=>expect(capacityPlan([{technicianId:"T1",availableMinutes:480,scheduledMinutes:420,soldUnscheduledMinutes:120}])[0].status).toBe("overbooked"));
});
