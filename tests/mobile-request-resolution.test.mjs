import test from "node:test";
import assert from "node:assert/strict";
import { applyAttendanceAction } from "../lib/mobile-attendance-actions.ts";
const manager={username:"gestor",role:"Administrador"};
const technician={username:"tecnico",role:"Técnico"};
const now="2026-10-14T16:30:00.000Z";
const base={id:"OS",status:"Em andamento",checkInAt:now,fieldVersion:2};
const requests=Array.from({length:50},(_,i)=>({id:`req-${i}`,kind:"request-material",note:"Solicitar peça",status:"Pendente",requestedBy:"tecnico",requestedAt:now}));
test("manager can decide a request when the request capacity is reached",()=>{
 const order={...base,fieldRequests:requests};
 const result=applyAttendanceAction(order,{action:"decide-request",requestId:"decision",targetId:"req-0",decision:"Aprovado",note:"Peça autorizada"},manager,true,now);
 assert.equal(result.fieldRequests.length,50);
 assert.equal(result.fieldRequests[0].status,"Aprovado");
 assert.equal(requests[0].status,"Pendente");
 assert.equal(result.fieldEvents[0].kind,"decide-request");
});
test("full request capacity does not block resuming attendance",()=>{
 const result=applyAttendanceAction({...base,fieldRequests:requests,fieldAttendancePaused:true},{action:"resume-attendance",requestId:"resume"},technician,false,now);
 assert.equal(result.status,"Em andamento");
 assert.equal(result.fieldAttendancePaused,false);
 assert.equal(result.fieldRequests.length,50);
});
test("full capacity continues to block adding any new request",()=>{
 for(const action of ["request-material","request-scope","request-reschedule"]) assert.throws(()=>applyAttendanceAction({...base,fieldRequests:requests},{action,requestId:"new",note:"Nova solicitação",date:"2026-10-20",time:"08:00"},technician,false,now),/Limite de solicitações/);
});
test("full request capacity does not widen manager approval permissions",()=>{
 assert.throws(()=>applyAttendanceAction({...base,fieldRequests:requests},{action:"decide-request",requestId:"decision",targetId:"req-0",decision:"Aprovado",note:"Peça autorizada"},technician,true,now),error=>error.status===403);
});
const reschedule={id:"change",kind:"request-reschedule",status:"Pendente",note:"Trocar atendimento",requestedBy:"tecnico",requestedAt:now};
const decision={action:"decide-request",requestId:"decision",targetId:"change",decision:"Aprovado",note:"Horário aprovado"};
test("legacy invalid reschedules cannot overwrite order schedule",()=>{
 for(const [date,time] of [[undefined,undefined],["2026-02-30","08:00"],["2026-10-20","24:00"],["invalid","08:00"]]) {
  const entry={...reschedule,date,time};const order={...base,date:"2026-10-15",time:"09:00",fieldRequests:[entry]};
  assert.throws(()=>applyAttendanceAction(order,decision,manager,true,now),/data ou horário inválidos/);
  assert.equal(order.date,"2026-10-15");assert.equal(entry.status,"Pendente");
 }
});
test("manager can reject an invalid legacy reschedule for correction",()=>{
 const result=applyAttendanceAction({...base,fieldRequests:[reschedule]},{...decision,decision:"Rejeitado"},manager,true,now);
 assert.equal(result.fieldRequests[0].status,"Rejeitado");
});
test("valid reschedule approval updates schedule and retains audit",()=>{
 const result=applyAttendanceAction({...base,fieldRequests:[{...reschedule,date:"2026-10-20",time:"08:30"}]},decision,manager,true,now);
 assert.equal(result.date,"2026-10-20");assert.equal(result.time,"08:30");
 assert.equal(result.status,"Agendada");assert.equal(result.fieldRequests[0].decidedBy,"gestor");
});
test("event audit capacity remains enforced for decisions",()=>{
 assert.throws(()=>applyAttendanceAction({...base,fieldRequests:requests,fieldEvents:Array.from({length:200},()=>({id:"event"}))},decision,manager,true,now),/Limite de registros/);
});
