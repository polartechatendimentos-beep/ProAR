import test from "node:test";
import assert from "node:assert/strict";
import {technicianProductivity} from "../lib/agenda-technician-metrics.ts";
const orders=[{id:"1",companyId:"a",technicianIds:["t1","t2"],status:"Concluído",date:"2026-11-12",durationMinutes:90},{id:"2",companyId:"a",technicianIds:["t1"],status:"Agendado",date:"2026-11-13",durationMinutes:60},{id:"3",companyId:"a",technicianIds:["t2"],status:"Cancelado",date:"2026-11-14",durationMinutes:30}];
test("aggregate work by technician and status within date range",()=>{
 const stats=technicianProductivity("a",orders,"2026-11-01","2026-11-30");
 assert.deepEqual(stats.map(x=>[x.technicianId,x.completed,x.scheduled,x.cancelled]),[["t1",1,1,0],["t2",1,0,1]]);
 assert.equal(technicianProductivity("a",orders,"2026-12-01","2026-12-31").length,0);
});
test("reject records from another company",()=>{
 assert.throws(()=>technicianProductivity("a",[...orders,{...orders[0],companyId:"b"}],"2026-11-01","2026-11-30"),/outra empresa/);
});
