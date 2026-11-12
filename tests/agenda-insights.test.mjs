import test from 'node:test';import assert from 'node:assert/strict';
import {agendaInsights} from '../lib/agenda-insights.ts';
const order=(id,extra={})=>({id,client:'Cliente A',unit:'Matriz',service:'Preventiva',tech:'Lucas',date:'2026-11-13',time:'09:00',status:'Agendada',tone:'blue',address:'Rua A',estimatedDurationMinutes:60,...extra});
test('agenda insights connect legacy names and employee identities, deduplicate conflicts and never mutate orders',()=>{
 const orders=[order('1',{employeeId:'E1'}),order('2',{time:'09:30'}),order('3',{time:'10:30'}),order('4',{time:'09:10',status:'Cancelada'})];const before=JSON.stringify(orders);
 const result=agendaInsights('A',orders,'2026-11-09','2026-11-15');assert.equal(result.conflicts.length,1);assert.equal(result.metrics.length,1);assert.equal(result.metrics[0].scheduled,3);assert.equal(result.metrics[0].cancelled,1);assert.equal(result.metrics[0].name,'Lucas');assert.equal(JSON.stringify(orders),before);
});
test('agenda distinguishes pending scheduling and unknown duration, excludes closed orders and bounds metrics by period',()=>{
 const rows=[order('1',{date:'',time:''}),order('2',{tech:'Não definido'}),order('3',{estimatedDurationMinutes:undefined}),order('4',{status:'Finalizada',date:'',time:''}),order('5',{date:'2027-01-01',status:'Concluída'})];
 const result=agendaInsights('A',rows,'2026-11-09','2026-11-15');assert.deepEqual(result.pending.map(row=>row.id),['1','2']);assert.equal(result.missingDuration,1);assert.equal(result.conflicts.length,0);assert.equal(result.metrics[0].scheduled,1);assert.equal(result.metrics[0].completed,0);
});
test('agenda insights reject mixed company payloads and keep duplicate technician names with different IDs separate',()=>{
 assert.throws(()=>agendaInsights('A',[order('1',{companyId:'B'})],'2026-11-01','2026-11-30'),/empresa/);
 const result=agendaInsights('A',[order('1',{employeeId:'E1'}),order('2',{employeeId:'E2'})],'2026-11-01','2026-11-30');assert.equal(result.conflicts.length,0);assert.equal(result.metrics.length,2);
});
