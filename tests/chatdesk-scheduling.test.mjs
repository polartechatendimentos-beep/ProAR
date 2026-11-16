import test from 'node:test';
import assert from 'node:assert/strict';
import {preferredAfter,availableSlots,validateSchedulePolicy,defaultSchedulePolicy,bookingChatStillEligible} from '../lib/chatdesk-scheduling.ts';
const policy={...defaultSchedulePolicy,enabled:true,employeeId:'T1',service:'Higienização',duration:60,buffer:30};
const state={customers:[{id:'C1',name:'Cliente',status:'Ativo'}],serviceOrders:[],moduleRecords:{Funcionários:[{id:'T1',name:'Técnico',status:'Ativo'}]}};
test('interpreta preferência após 16h sem aceitar horas inválidas',()=>{
 assert.equal(preferredAfter('Depois das 16hrs'),'16:00');assert.equal(preferredAfter('após as 16:30'),'16:30');assert.equal(preferredAfter('após as 29:90'),null);
});
test('opções respeitam expediente, duração, deslocamento e conflitos de técnico',()=>{
 const busy=structuredClone(state);busy.serviceOrders.push({id:'BUSY',date:'2026-11-16',time:'15:30',durationMinutes:60,tech:'Técnico',status:'Agendada'});
 const slots=availableSlots(busy,policy,'C1','Rua A','16:00',new Date('2026-11-16T12:00:00-03:00'));
 assert.equal(slots.length,3);assert.ok(slots.every(s=>s.time>='16:00'));assert.ok(!slots.some(s=>s.date==='2026-11-16')); // 17h finishes too late once travel allowance is included.
});
test('não oferece técnico inativo e exige regras completas para ativar',()=>{
 const unavailable=structuredClone(state);unavailable.moduleRecords.Funcionários[0].status='Inativo';assert.deepEqual(availableSlots(unavailable,policy,'C1','Rua A','16:00',new Date('2026-11-16T12:00:00-03:00')),[]);
 assert.throws(()=>validateSchedulePolicy({...policy,employeeId:''}));assert.throws(()=>validateSchedulePolicy({...policy,end:'07:00'}));
});

test('handoff cancels stale autonomous reservation before OS persistence',()=>{
 const chat={revision:7,assignee:'',botPaused:false,optOut:false,scheduleOffer:{id:'abcdef12'}};
 assert.equal(bookingChatStillEligible(chat,7,'abcdef12'),true);
 assert.equal(bookingChatStillEligible({...chat,assignee:'operador'},7,'abcdef12'),false);
 assert.equal(bookingChatStillEligible({...chat,botPaused:true},7,'abcdef12'),false);
 assert.equal(bookingChatStillEligible({...chat,optOut:true},7,'abcdef12'),false);
 assert.equal(bookingChatStillEligible({...chat,revision:8},7,'abcdef12'),false);
 assert.equal(bookingChatStillEligible({...chat,scheduleOffer:{id:'nova1234'}},7,'abcdef12'),false);
 assert.equal(bookingChatStillEligible(null,7,'abcdef12'),false);
});
