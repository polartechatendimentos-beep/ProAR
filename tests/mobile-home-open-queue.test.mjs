import test from 'node:test';
import assert from 'node:assert/strict';
import {openFieldWorkQueue} from '../lib/mobile-order-display.ts';
test('home includes open orders across dates and prioritizes active then overdue without changing source',()=>{
 const rows=[{id:'future',date:'2026-11-01',status:'Agendada'},{id:'closed',date:'2026-10-26',status:'Concluída'},{id:'today',date:'2026-10-26',status:'Aberta'},{id:'cancel',date:'2026-08-01',status:'Cancelada'},{id:'overdue',date:'2026-08-01',status:'Pendente'},{id:'active',date:'2026-11-02',status:'Em andamento'},{id:'undated',date:'',status:'Não concluída'}].map(o=>({...o,time:'09:00'}));
 const before=JSON.stringify(rows);
 assert.deepEqual(openFieldWorkQueue(rows,'2026-10-26').map(o=>o.id),['active','overdue','today','undated','future']);
 assert.equal(JSON.stringify(rows),before);
 assert.deepEqual(openFieldWorkQueue([],'2026-10-26'),[]);
});
