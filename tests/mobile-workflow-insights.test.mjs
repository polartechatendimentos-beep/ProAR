import test from 'node:test';import assert from 'node:assert/strict';
import {parseMobilePreferences,workflowStages,mobileAttention,elapsedAttendanceMinutes,reportConsistency,matchesFieldSearch} from '../lib/mobile-workflow-insights.ts';
import {createDayPackage,mobileCivilDay} from '../lib/mobile-day-policy.ts';
test('preferences accept only known version, filters, sort, and accessibility fields',()=>{
 assert.equal(parseMobilePreferences({version:99,group:true}).group,false);
 assert.deepEqual(parseMobilePreferences({version:1,favorite:'secret',sort:'eval',compact:false,group:true,textScale:'large',privateData:'x'}),{version:1,favorite:null,sort:'date',compact:false,group:true,textScale:'large'});
});
test('next workflow action tracks real required items without making equipment compulsory',()=>{
 const req=[{key:'checkin',label:'Chegada',required:true},{key:'equipment',label:'Equipamento',required:false},{key:'diagnosis',label:'Diagnóstico',required:true},{key:'vacuum',label:'Vácuo',required:true},{key:'signature',label:'Aceite',required:true}];
 const rows=workflowStages({checkin:true,diagnosis:true,vacuum:false},req);
 assert.equal(rows.find(r=>!r.complete).next.key,'vacuum');assert.equal(rows[2].total,1);
});
test('attention separates closed orders, actual requests and manager workload',()=>{
 const now=Date.parse('2026-10-27T15:00:00Z');
 const base={date:'2026-10-26',time:'09:00',status:'Aberta',tech:'',technicianAssigned:false,checkInAt:'',events:[],requests:[]};
 const rows=[{...base,id:'a'},{...base,id:'b',tech:'João',technicianAssigned:true,checkInAt:'2026-10-27T12:00:00Z',requests:[{id:'r',status:'Pendente'}],estimatedDurationMinutes:50},{...base,id:'c',status:'Concluída'}];
 const stats=mobileAttention(rows,'2026-10-27',now);assert.equal(stats.open.length,2);assert.equal(stats.overdue.length,2);assert.equal(stats.unassigned.length,1);assert.equal(stats.requests.length,1);assert.equal(stats.stalled[0].id,'b');assert.equal(stats.teams.find(t=>t.tech==='João').minutes,50);
});
test('attendance clock subtracts recorded pauses and flags incomplete histories',()=>{
 const o={checkInAt:'2026-10-27T12:00:00Z',attendancePaused:false,events:[{kind:'pause-attendance',createdAt:'2026-10-27T12:30:00Z'},{kind:'resume-attendance',createdAt:'2026-10-27T12:45:00Z'}]};
 assert.deepEqual(elapsedAttendanceMinutes(o,Date.parse('2026-10-27T13:00:00Z')),{elapsed:60,active:45,paused:15,partial:false});assert.equal(elapsedAttendanceMinutes({...o,checkInAt:''}),null);
});
test('search tolerates one typo in words, preserves exact numeric matching and splits terms',()=>{
 assert.equal(matchesFieldSearch('OS-123 Prefeitura Bálsamo manutenção','balsamo prefeitura'),true);
 assert.equal(matchesFieldSearch('Prefeitura Balsamo','balsamoo'),true);
 assert.equal(matchesFieldSearch('OS-123','124'),false);
 assert.equal(matchesFieldSearch('Cliente Hospital','farmacia'),false);
});
test('consistency flags missing supporting data without blocking or inventing a diagnosis',()=>{
 assert.equal(reportConsistency({diagnosis:'teste',report:'teste',beforeCount:0,afterCount:0,materials:0,measurements:{}}).length,1);
 assert.equal(reportConsistency({diagnosis:'x',report:'Fotos anexadas; peça substituída e medições realizadas.',beforeCount:0,afterCount:0,materials:0,measurements:{}}).length,3);
});
test('manual offline selection remains limited to authorized open records and session expiry',()=>{
 const now=Date.parse('2026-10-27T12:00:00Z');const data={user:{scope:'a:u'},mode:'operational',orders:[{id:'old',date:'2020-01-01',status:'Aberta'},{id:'closed',date:mobileCivilDay(now),status:'Concluída'}],offlineAccessUntil:now+3600000};
 const pack=createDayPackage(data,now,['old','closed','other-tenant']);assert.deepEqual(pack.selectedOrderIds,['old']);assert.equal(pack.data.orders.length,1);assert.equal(pack.validUntil,now+3600000);assert.throws(()=>createDayPackage(data,now,Array(201).fill('old')));
});
