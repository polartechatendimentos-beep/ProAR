import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { automaticFieldEvidence, fieldOrderFunctionFor, fieldOrderFunctions, fieldOrderStepFor, fieldOrderSteps } from "../lib/mobile-order-steps.ts";
import { mobileChecklist } from "../lib/mobile-service-checklists.ts";

test("requisitos continuam acessíveis na etapa certa e sem confirmação manual duplicada",()=>{
 const ids=fieldOrderSteps.map(item=>item.id);
 assert.deepEqual(ids,["chegada","execucao","conclusao"]);
 for(const service of ["Instalação","Higienização","Manutenção corretiva","Visita técnica"]){
  for(const item of mobileChecklist(service)){
   const target=fieldOrderStepFor(item.key);
   assert.ok(ids.includes(target));
   if(item.key==="checkin")assert.equal(target,"chegada");
   if(["afterPhoto","signature"].includes(item.key))assert.equal(target,"conclusao");
   if(item.required&&!automaticFieldEvidence.has(item.key))assert.equal(target,"execucao");
  }
 }
 assert.ok(automaticFieldEvidence.has("equipmentLabel"));
 assert.ok(automaticFieldEvidence.has("executedService"));
 assert.ok(!automaticFieldEvidence.has("vacuum"));
 assert.ok(!automaticFieldEvidence.has("measurements"));
});

test("editor mantém um botão de check-in, etapas ocultáveis e a confirmação real da conclusão",()=>{
 const source=readFileSync(new URL("../components/FieldOrderEditor.tsx",import.meta.url),"utf8");
 for(const id of fieldOrderSteps.map(step=>step.id))assert.ok(source.includes('hidden={step!=="'+id+'"||review}'));
 assert.equal((source.match(/execute\("start"\)/g)||[]).length,1);
 assert.equal((source.match(/execute\("finish"\)/g)||[]).length,1);
 assert.match(source,/const targetStep=fieldOrderStepFor\(key\)/);
 assert.match(source,/setWorkFunction\(fieldOrderFunctionFor\(key\)\)/);
 assert.match(source,/await saveOrderDraft\(scope,order\.id/);
 assert.match(source,/orderSubmissionConfirmed\(sent,body\)/);
 assert.match(source,/if\(pendingRequirements\.length\)jumpTo/);
});

test("o editor real renderiza a etapa de chegada ou execução conforme o check-in",async()=>{
 const { createRequire }=await import("node:module");
 const require=createRequire(import.meta.url);
 const ts=require("typescript");
 const React=require("react");
 const {renderToStaticMarkup}=require("react-dom/server");
 const content=readFileSync(new URL("../components/FieldOrderEditor.tsx",import.meta.url),"utf8");
 const output=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 const named={
  "@/lib/mobile-order-steps":{fieldOrderSteps,fieldOrderStepFor,automaticFieldEvidence,fieldOrderFunctions,fieldOrderFunctionFor},
  "@/lib/mobile-service-checklists":{mobileChecklist},
  "@/lib/mobile-experience":{equipmentInspection:()=>[]},
  "@/lib/mobile-report-details":{fieldMeasurements:[],reportTemplates:[]},
 };
 const component=Object.fromEntries(["FieldServicePicker","FieldPhotoComparison","LocalFieldAssistant","FieldPhotoCollection","FieldAttendanceControls","FieldOrderTools"].map(name=>[name,()=>null]));
 let functionShown="relatorio";
 const module={exports:{}};
 runInNewContext(output,{exports:module.exports,module,require:name=>{
  if(name==="react")return {...React,useState(initial){const state=React.useState(initial);return initial==="relatorio"?[functionShown,state[1]]:state;}};
  if(name==="react/jsx-runtime"||name==="lucide-react")return require(name);
  if(name.endsWith(".module.css"))return {__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
  return named[name]||component;
 }});
 const order={id:"OS-demo",service:"Instalação",equipmentIds:[],equipmentOptions:[],evidence:{}};
 const render=checkInAt=>renderToStaticMarkup(React.createElement(module.exports.FieldOrderEditor,{order:{...order,checkInAt},scope:"fixture",requiresJourney:true,canApprove:false,onSaved:async()=>{}}));
 const first=render(undefined);
 assert.match(first,/<section class="osStepPanel" aria-label="Chegada">/);
 assert.match(first,/<section hidden="" class="osStepPanel" aria-label="Execução">/);
 assert.equal((first.match(/>Fazer check-in<\/button>/g)||[]).length,1);
 const begun=render("2026-11-26T19:00:00Z");
 assert.match(begun,/<section class="osStepPanel" aria-label="Execução">/);
 assert.match(begun,/<section hidden="" class="osStepPanel" aria-label="Conclusão">/);
 assert.match(begun,/>Ir para conclusão<\/button>/);
 assert.match(begun,/id="field-OS-demo-funcao-relatorio" class="osFunctionPanel"/);
 for (const [key,label] of [["fotos","Fotos e identificação"],["checklist","Checklist do serviço"]]) {
  functionShown=key;
  const selected=render("2026-11-26T19:00:00Z");
  assert.ok(selected.includes(`id="field-OS-demo-funcao-${key}" class="osFunctionPanel" aria-label="${label}"`));
  assert.match(selected,/id="field-OS-demo-funcao-relatorio" hidden=""/);
  assert.ok(selected.includes(`aria-pressed="true" aria-controls="field-OS-demo-funcao-${key}"`));
 }
});

test("pendências apontam para a função certa sem exigir caça em rolagem",()=>{
 assert.equal(fieldOrderFunctionFor("diagnosis"),"relatorio");
 assert.equal(fieldOrderFunctionFor("executedService"),"relatorio");
 assert.equal(fieldOrderFunctionFor("equipmentLabel"),"fotos");
 assert.equal(fieldOrderFunctionFor("beforePhoto"),"fotos");
 assert.equal(fieldOrderFunctionFor("vacuum"),"checklist");
 assert.equal(fieldOrderStepFor("afterPhoto"),"conclusao");
});
