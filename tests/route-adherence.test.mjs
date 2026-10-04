import assert from "node:assert/strict";
import {comparePlannedRoute,attendanceSummary} from "../lib/route-adherence.ts";
const route={id:"2026-10-03:abcdefgh",employeeId:"e1",employeeName:"T",startedAt:"2026-10-03T11:00:00Z",endedAt:"2026-10-03T20:00:00Z",status:"completed",consentAt:"2026-10-03T11:00:00Z",consentVersion:"1",expiresAt:"2026-10-03T23:00:00Z",distanceKm:10,points:[],stops:[{id:"s1",osId:"OS1",customer:"A",address:"",arrivedAt:"",latitude:0,longitude:0,accuracy:5},{id:"s2",osId:"OS2",customer:"B",address:"",arrivedAt:"",latitude:0,longitude:0,accuracy:5}],events:[{id:"a",type:"start",at:"2026-10-03T11:00:00Z",actor:"u"},{id:"b",type:"pause",at:"2026-10-03T15:00:00Z",actor:"u"},{id:"c",type:"resume",at:"2026-10-03T16:00:00Z",actor:"u"},{id:"d",type:"finish",at:"2026-10-03T20:00:00Z",actor:"u"}]};
assert.equal(comparePlannedRoute(route,[{id:"OS1",sequence:1},{id:"OS2",sequence:2}]).score,100);
assert.equal(attendanceSummary(route).pauseMinutes,60);
assert.equal(attendanceSummary(route).workedMinutes,480);
console.log("route adherence and attendance tests passed");
