import test from "node:test";
import assert from "node:assert/strict";
import { buildGuidedSteps, calculateDeltaT, diagnosticConfidence, summarizeRecurrence } from "../lib/diagnostic-workflow.ts";
import { calculateSubcooling, calculateSuperheat, validatePtDataset } from "../lib/refrigerant-tools.ts";

test("guided diagnostic includes outdoor checks for condenser symptoms",()=>{
  const steps=buildGuidedSteps({symptom:"condensadora não parte e desarma",blinkPattern:"5 piscadas",equipmentType:"Piso Teto"});
  assert.equal(steps.some(step=>step.id==="outdoor"),true);
  assert.equal(steps.some(step=>step.id==="reference"),true);
});

test("delta T uses return minus supply",()=>{
  assert.equal(calculateDeltaT({returnTemperature:26,supplyTemperature:14}),12);
});

test("confidence grows with model reference sources measurements and executed tests",()=>{
  const result=diagnosticConfidence({
    model:"PTFI60B2NA",code:"E5",referenceConfidence:"confirmada",sourceUrls:["https://example.com/manual"],
    measurements:{voltage:220,current:8,returnTemperature:26,supplyTemperature:14},
    guidedSteps:[{id:"1",title:"t",instruction:"i",status:"ok"},{id:"2",title:"t",instruction:"i",status:"abnormal"},{id:"3",title:"t",instruction:"i",status:"ok"}],
  });
  assert.equal(result.score>=85,true);
  assert.equal(result.level,"Confirmado por manual");
});

test("recurrence alerts after three occurrences in 180 days",()=>{
  const now=new Date("2026-10-02T12:00:00-03:00");
  const history=[
    {createdAt:"2026-09-01T10:00:00-03:00",code:"E5",symptoms:"não gela"},
    {createdAt:"2026-08-01T10:00:00-03:00",code:"E5",symptoms:"não gela"},
    {createdAt:"2026-07-01T10:00:00-03:00",code:"E5",symptoms:"não gela"},
  ];
  const summary=summarizeRecurrence(history,{code:"E5",symptom:"não gela"},now);
  assert.equal(summary.within180Days,3);
  assert.ok(summary.warning);
});

test("refrigerant field calculations are deterministic",()=>{
  assert.equal(calculateSuperheat(12,5),7);
  assert.equal(calculateSubcooling(40,32),8);
});

test("P x T dataset requires traceable verified source",()=>{
  const invalid=validatePtDataset({refrigerant:"R-32",source:"",sourceUrl:"",verified:false,points:[]});
  assert.equal(invalid.ok,false);
});
