import test from "node:test";
import assert from "node:assert/strict";
import {idempotencyKey} from "../lib/transaction-engine.ts";
import {recoveryPlan,nextRecoveryStep} from "../lib/recovery-center.ts";
import {evaluatePreClose} from "../lib/pre-close.ts";

test("recovery resumes only the first unfinished step",()=>{
 const incident={id:"I1",rootId:"PED1",tenantId:"T1",reason:"falha intermediária",steps:[{kind:"stock",action:"deduct",sourceId:"OS1",label:"Baixar estoque"},{kind:"finance",action:"create",sourceId:"OS1",label:"Criar financeiro"},{kind:"fiscal",action:"prepare",sourceId:"OS1",label:"Preparar fiscal"}]};
 const key=idempotencyKey({tenantId:"T1",kind:"stock",sourceId:"OS1",action:"deduct"});
 const events=[{id:"E1",aggregateId:"OS1",kind:"stock",action:"deduct",sourceId:"OS1",correlationId:"proar:PED1",idempotencyKey:key,occurredAt:"2026-10-03T10:00:00Z"}];
 const plan=recoveryPlan(incident,events);
 assert.equal(plan[0].status,"completed");assert.equal(nextRecoveryStep(incident,events)?.kind,"finance");
});
test("recovery is finished when all idempotent effects exist",()=>{
 const steps=[{kind:"stock",action:"deduct",sourceId:"OS1",label:"Estoque"},{kind:"finance",action:"create",sourceId:"OS1",label:"Financeiro"}];
 const incident={id:"I2",rootId:"PED1",tenantId:"T1",reason:"retry",steps};
 const events=steps.map((s,i)=>({id:"E"+i,aggregateId:"OS1",...s,correlationId:"proar:PED1",idempotencyKey:idempotencyKey({tenantId:"T1",kind:s.kind,sourceId:s.sourceId,action:s.action}),occurredAt:"2026-10-03T10:00:00Z"}));
 assert.equal(nextRecoveryStep(incident,events),null);
});
test("pre-close blocks integrity and integration failures",()=>{
 const r=evaluatePreClose({openOs:0,paymentsWithoutSettlement:0,fiscalPending:0,stockDivergences:0,refundsPending:0,integrity:{checkedAt:"x",revision:1,updatedAt:null,source:"test",totals:{critical:2,attention:0,ok:1},findings:[],checks:[]},integrationCritical:1});
 assert.equal(r.canClose,false);assert.equal(r.blockers.length,2);
});
console.log("recovery-preclose.test.mjs: ok");
