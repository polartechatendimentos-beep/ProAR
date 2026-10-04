import assert from "node:assert/strict";import {employeeManagementMetrics,expiringEmployeeDocuments} from "../lib/employee-management.ts";import {deriveWorkforceExceptions} from "../lib/workforce-exceptions.ts";
const route={id:"r",employeeId:"e",employeeName:"João",startedAt:"2026-10-01T11:00:00Z",endedAt:"2026-10-01T19:00:00Z",status:"completed",consentAt:"",consentVersion:"1",expiresAt:"",distanceKm:0,points:[],stops:[],events:[]};
const m=employeeManagementMetrics([route],[{tech:"João",status:"Concluída",estimatedDurationMinutes:60,checkInAt:"2026-10-01T12:00:00Z",checkOutAt:"2026-10-01T13:30:00Z"}],"João",8);assert.equal(m.completedOrders,1);assert.equal(m.workedMinutes,480);
assert.equal(expiringEmployeeDocuments([{id:"1",name:"NR35",kind:"NR",expiresAt:"2026-10-20"}],30,new Date("2026-10-03")).length,1);
assert.equal(deriveWorkforceExceptions([{id:"e",name:"João",employeeDocuments:[{id:"1",name:"NR35",expiresAt:"2026-10-02"}]}],[{id:"OS1",tech:"João",estimatedDurationMinutes:60,checkInAt:"2026-10-03T10:00:00Z",checkOutAt:"2026-10-03T12:00:00Z"}],new Date("2026-10-03")).length,2);
console.log("employee management tests passed");
