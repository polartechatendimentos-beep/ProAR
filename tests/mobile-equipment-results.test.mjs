import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentCompletionIssue,equipmentResultsIssue,projectEquipmentResults,updateEquipmentPhotoReferences} from '../lib/mobile-equipment-results.ts';
import {queueOrderSubmission} from '../lib/mobile-order-submission.ts';
import {mobileFieldOrders} from '../lib/mobile-field.ts';

const ids=['EQ-1','EQ-2'];
const completed={equipmentId:ids[0],status:'completed',note:'Revisado',photo:{phase:'before',index:2}};
const pending={equipmentId:ids[1],status:'pending',note:'Peça ainda não disponível'};
test('pendência por aparelho exige motivo e não permite fechar com dados incompletos',()=>{
 assert.equal(equipmentResultsIssue([completed,pending],ids,{before:3}),null);
 assert.match(equipmentResultsIssue([completed,{...pending,note:' '}],ids,{before:3}),/motivo/);
 assert.match(equipmentResultsIssue([completed,completed],ids,{before:3}),/duplicado/);
 assert.match(equipmentResultsIssue([completed],ids,{before:2}),/foto selecionada/);
 assert.match(equipmentCompletionIssue(ids,[completed,pending]),/pendente/);
 assert.match(equipmentCompletionIssue(ids,[completed]),/todos/);
 assert.equal(equipmentCompletionIssue(ids,[completed,{...pending,status:'completed'}]),null);
 assert.equal(equipmentCompletionIssue([ids[0]],[]),null);
});
test('retirar, mover ou marcar uma foto do rascunho não troca a evidência de aparelho',()=>{
 const note={...completed,photo:{phase:'before',index:0}};
 assert.deepEqual(updateEquipmentPhotoReferences([note,completed,pending],'before',1,['a','b','c'],['b','a','c']),[note,{...completed,photo:{phase:'before',index:1}},pending]);
 assert.deepEqual(updateEquipmentPhotoReferences([note,completed,pending],'before',1,['a','b','c'],['a','b marcada','c']),[note,{equipmentId:ids[0],status:'completed',note:'Revisado'},pending]);
});
test('projeção mobile mantém resultado e referência autorizada, não incorpora imagem ao resumo',()=>{
 const projected=projectEquipmentResults([{...completed,privateField:'secret'},pending,{equipmentId:'OTHER',status:'completed',note:'privado'}],ids,{before:3});
 assert.deepEqual(projected,[completed,pending]);
 const [order]=mobileFieldOrders([{id:'OS-1',tech:'T',status:'Aberta',equipmentIds:ids,fieldEquipmentResults:projected,photos:{before:['a','b','c']}}],{username:'T',role:'Técnico'});
 assert.deepEqual(order.equipmentResults,projected);
 assert.equal(order.photos,undefined);
 const command=queueOrderSubmission({requestId:'b16ca79',action:'save',orderId:'OS-1',expectedVersion:2,equipmentIds:ids,equipmentResults:projected},10);
 const restored=JSON.parse(JSON.stringify(command));
 projected[1].note='modified after queue';
 assert.deepEqual(restored.command.equipmentResults,[completed,pending]);
 assert.equal(restored.command.requestId,'b16ca79');
});
