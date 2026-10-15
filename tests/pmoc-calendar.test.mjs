import test from 'node:test';import assert from 'node:assert/strict';import {nextPmocDate} from '../lib/technical-compliance.ts';
const plan=(startsAt,periodicity='Mensal')=>({id:'P1',client:'Teste',equipmentIds:[],startsAt,periodicity});
test('PMOC: calendário usa meses reais, ano bissexto e não desloca o vencimento ao consultar',()=>{
 assert.equal(nextPmocDate(plan('2026-01-31')),'2026-02-28');assert.equal(nextPmocDate(plan('2024-01-31')),'2024-02-29');assert.equal(nextPmocDate(plan('2024-02-29','Anual')),'2025-02-28');
 assert.equal(nextPmocDate(plan('2026-01-15','Trimestral')),'2026-04-15');assert.equal(nextPmocDate({...plan('2026-01-15'),lastServiceAt:'2026-02-20'}),'2026-03-20');
});
test('PMOC: rejeita datas e intervalos inválidos; periodicidade personalizada usa dias UTC',()=>{
 assert.equal(nextPmocDate(plan('2026-02-30')),undefined);assert.equal(nextPmocDate(plan('')),undefined);assert.equal(nextPmocDate({...plan('2026-01-31','Personalizada'),customDays:15}),'2026-02-15');assert.equal(nextPmocDate({...plan('2026-01-31','Personalizada'),customDays:0}),undefined);
});
import {prepareOperationalState} from '../lib/operational-ledger.ts';
test('PMOC: servidor recusa última manutenção futura e calendário inválido',()=>{
 const base={customers:[],serviceOrders:[],moduleRecords:{}},next=structuredClone(base),actor={username:'rt',can:()=>true};next.moduleRecords.PMOC=[{...plan('2026-01-15'),lastServiceAt:'2026-10-16'}];
 assert.throws(()=>prepareOperationalState(base,next,actor,'2026-10-15T12:00:00Z'),/última manutenção/);
 next.moduleRecords.PMOC=[plan('2026-02-30')];assert.throws(()=>prepareOperationalState(base,next,actor,'2026-10-15T12:00:00Z'),/periodicidade/);
});
