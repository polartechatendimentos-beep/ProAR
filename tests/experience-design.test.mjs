import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTenderView,deadlineIndicator} from '../lib/experience-design.ts';
import {validateTracking,tenderIdentity} from '../lib/tender-pipeline.ts';
test('preferência de visualização é limitada aos três formatos suportados',()=>{
  assert.equal(normalizeTenderView('kanban'),'kanban');assert.equal(normalizeTenderView('table'),'table');assert.equal(normalizeTenderView('bad'),'cards');
});
test('semáforo não inventa prazo e diferencia vencimento e urgência',()=>{
  const now=Date.parse('2026-10-16T12:00:00Z');assert.equal(deadlineIndicator(undefined,now).tone,'unknown');assert.equal(deadlineIndicator('invalid',now).tone,'unknown');assert.equal(deadlineIndicator('2026-10-16T11:59:00Z',now).tone,'closed');assert.equal(deadlineIndicator('2026-10-17T11:59:00Z',now).tone,'urgent');assert.equal(deadlineIndicator('2026-10-18T11:00:00Z',now).tone,'soon');assert.equal(deadlineIndicator('2026-10-21T12:00:00Z',now).tone,'normal');
});
test('mudança de etapa do Kanban continua bloqueando habilitação incompleta e homologação sem evidência',()=>{
  const tracking={tenderKey:'x',tender:{numeroControlePNCP:'x',objetoCompra:'Climatização'},favorite:false,checks:{},pmocRequired:null,stage:'RADAR'};
  tracking.tenderKey=tenderIdentity(tracking.tender);
  assert.doesNotThrow(()=>validateTracking(tracking,[]));
  assert.throws(()=>validateTracking({...tracking,stage:'HABILITACAO'},[]),/Conclua a habilitação/);assert.throws(()=>validateTracking({...tracking,stage:'HOMOLOGADO'},[]),/referência do resultado oficial/);
});
