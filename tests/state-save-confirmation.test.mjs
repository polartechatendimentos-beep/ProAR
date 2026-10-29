import test from "node:test";
import assert from "node:assert/strict";
import {stateSaveOutcome} from "../lib/state-save-confirmation.ts";
const state={customers:[],serviceOrders:[],moduleRecords:{},_revision:8};
test("state save succeeds only with explicit confirmation and a new authoritative revision",()=>{
 assert.equal(stateSaveOutcome(200,{saved:true,state},7).confirmed,true);
 for(const body of [{state},{saved:false,state},{saved:true},{saved:true,state:{...state,_revision:7}},{saved:true,state:{...state,moduleRecords:[]}}])assert.equal(stateSaveOutcome(200,body,7).confirmed,false);
});
test("conflicts and backend failures never report saved even if they contain state",()=>{
 for(const status of [401,403,409,422,500,503])assert.equal(stateSaveOutcome(status,{saved:true,state},7).confirmed,false);
 const result=stateSaveOutcome(409,{error:"Versão alterada",state},7);
 assert.equal(result.conflict,true);assert.equal(result.error,"Versão alterada");
 assert.equal(stateSaveOutcome(200,"HTML",7).confirmed,false);
});
