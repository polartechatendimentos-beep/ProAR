import {describe,it,expect} from "vitest";
import {buildDre,profitabilityBySource} from "../lib/management-dre";
import {summarizeCostCenters} from "../lib/cost-centers";
import {evaluateGoals} from "../lib/management-goals";
import {companyHealth} from "../lib/company-health";
describe("ProAR management intelligence",()=>{
 it("builds DRE without projected entries",()=>expect(buildDre([{id:"r",date:"2026-10-01",kind:"revenue",category:"Serviço",amount:1000},{id:"c",date:"2026-10-01",kind:"cost",category:"Material",amount:400},{id:"p",date:"2026-10-02",kind:"revenue",category:"Previsto",amount:500,status:"projected"}]).result).toBe(600));
 it("calculates profitability by source",()=>expect(profitabilityBySource([{id:"r",date:"2026-10-01",kind:"revenue",category:"Serviço",amount:1000,sourceType:"OS",sourceId:"1"},{id:"c",date:"2026-10-01",kind:"cost",category:"Material",amount:200,sourceType:"OS",sourceId:"1"}])[0].result).toBe(800));
 it("summarizes cost centers",()=>expect(summarizeCostCenters([{id:"v",name:"Veículo",type:"vehicle",active:true}],[{costCenterId:"v",amount:120}])[0].total).toBe(120));
 it("tracks goals against projection",()=>expect(evaluateGoals([{id:"g",name:"Faturamento",target:100,actual:50,projected:110}])[0].status).toBe("on-track"));
 it("explains company health",()=>{const h=companyHealth({cashCoverage:1,overdueRatio:0.1,margin:30,stockRisk:0.1,lateOsRatio:0.1,fiscalIssues:0,contractRisk:0,reworkRatio:0,integrationIssues:0});expect(h.factors.length).toBe(9);expect(h.score).toBeGreaterThan(0);});
});
