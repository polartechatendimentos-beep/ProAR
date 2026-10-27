import test from 'node:test';import assert from 'node:assert/strict';import {filterFieldOrders} from '../lib/mobile-order-display.ts';
const rows=[{id:'open',status:'Não concluída',tech:'A definir',date:'2026-10-01',equipmentIds:[]},{id:'active',status:'Em andamento',tech:'João',date:'2026-10-01',equipmentIds:[]},{id:'closed',status:'Concluída',tech:'João',date:'2026-10-01',equipmentIds:[]},{id:'canceled',status:'Cancelada',tech:'',date:'2026-10-01',equipmentIds:[]}];
test('filtros gerenciais distinguem abertas, concluídas, canceladas, atrasadas e sem técnico',()=>{
 const ids=filter=>filterFieldOrders(rows,'',filter,'2026-10-26').map(r=>r.id);
 assert.deepEqual(ids('open'),['open','active']);assert.deepEqual(ids('completed'),['closed']);assert.deepEqual(ids('cancelled'),['canceled']);assert.deepEqual(ids('overdue'),['open','active']);assert.deepEqual(ids('unassigned'),['open','canceled']);assert.deepEqual(ids('active'),['active']);
});

test('sem técnico respeita vínculo por ID mesmo quando nome está vazio',()=>{
 const withId={...rows[0],id:'id-only',tech:'',technicianAssigned:true};
 assert.equal(filterFieldOrders([withId],'','unassigned','2026-10-26').length,0);
});
