import test from "node:test";
import assert from "node:assert/strict";
import {monthAgendaGrid,unscheduledOrders} from "../lib/agenda-month-grid.ts";
const orders=[{id:"1",date:"2026-11-12",time:"14:00",status:"Agendado",client:"A"},{id:"2",date:"2026-11-12",time:"09:00",status:"Agendado",client:"B"},{id:"3",date:"2026-11-12",time:"10:00",status:"Concluído",client:"C"},{id:"4",date:"",status:"Aberto",client:"D"}];
test("month grid shows full weeks, sorted appointments and open orders",()=>{
 const grid=monthAgendaGrid(orders,2026,11);
 assert.equal(grid.length,35);
 assert.deepEqual(grid.find(x=>x.date==="2026-11-12").orders.map(x=>x.id),["2","1"]);
 assert.deepEqual(unscheduledOrders(orders).map(x=>x.id),["4"]);
 assert.equal(monthAgendaGrid(orders,2026,11,"Todas").find(x=>x.date==="2026-11-12").orders.length,3);
});
test("calendar rejects invalid month",()=>assert.throws(()=>monthAgendaGrid([],2026,13),/inválido/));
