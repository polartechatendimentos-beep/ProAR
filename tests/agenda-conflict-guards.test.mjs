import test from "node:test";
import assert from "node:assert/strict";
import {schedulingConflicts,unscheduledVisits} from "../lib/agenda-conflict-guards.ts";
const visit={id:"1",companyId:"a",date:"2026-11-13",start:"09:00",durationMinutes:90,technicianIds:["t1","t2"],status:"Agendado"};
test("detect overlap for any shared technician, but not adjacent slots",()=>{
 assert.deepEqual(schedulingConflicts("a",{...visit,id:"2",start:"10:00",technicianIds:["t2"]},[visit]),[{orderId:"1",technicianIds:["t2"]}]);
 assert.deepEqual(schedulingConflicts("a",{...visit,id:"2",start:"10:30"},[visit]),[]);
 assert.deepEqual(schedulingConflicts("a",{...visit,id:"2",technicianIds:["t3"]},[visit]),[]);
});
test("reject cross-company input and malformed schedule",()=>{
 assert.throws(()=>schedulingConflicts("b",visit,[]),/outra empresa/);
 assert.throws(()=>schedulingConflicts("a",visit,[{...visit,companyId:"b"}]),/outra empresa/);
 assert.throws(()=>schedulingConflicts("a",{...visit,start:"25:00"},[]),/inválido/);
 assert.equal(unscheduledVisits("a",[{...visit,start:""}]).length,1);
});
