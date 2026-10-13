import test from 'node:test';
import assert from 'node:assert/strict';
import {improveFieldOrder,fieldEquipmentHistory} from '../lib/mobile-order-improvements.ts';
import {applyFieldOrder,fieldOrderFingerprint} from '../lib/mobile-workday.ts';
const tech={username:'tech',role:'Técnico'},manager={username:'manager',role:'Administrador'},now='2026-10-13T23:00:00.000Z',image='data:image/png;base64,AAAA';
const order=()=>({id:'OS-1',tech:'tech',customerId:'CLI-1',client:'Cliente',unitId:'UNIT-1',status:'Em andamento',checkInAt:now,fieldVersion:0});
const cmd=(item,action,data={})=>({requestId:'request-12345678',orderId:item.id,expectedVersion:item.fieldVersion,expectedToken:fieldOrderFingerprint(item),action,...data});
test('equipment registration inherits client/location and validates photo and serial',()=>{
  const item=order();
  const result=improveFieldOrder(item,[],cmd(item,'register-equipment',{equipment:{name:'Split recepção',serialNumber:'SN-1',photo:image,customerId:'foreign'}}),tech,false,now);
  assert.equal(result.equipment[0].customerId,'CLI-1');assert.equal(result.equipment[0].unitId,'UNIT-1');assert.equal(result.order.equipmentIds[0],result.equipment[0].id);
  assert.throws(()=>improveFieldOrder(item,result.equipment,cmd(item,'register-equipment',{equipment:{name:'Outro',serialNumber:'SN-1',photo:image}}),tech,false,now),/já cadastrado/);
  assert.throws(()=>improveFieldOrder(item,[],cmd(item,'register-equipment',{equipment:{name:'Sem foto'}}),tech,false,now),/Fotografe/);
});
test('exceptions need a manager decision and never dispense report/photos/checkin',()=>{
  let item=order();
  item=improveFieldOrder(item,[],cmd(item,'request-exception',{kind:'signature',reason:'Cliente ausente no encerramento'}),tech,false,now).order;
  assert.throws(()=>improveFieldOrder(item,[],cmd(item,'decide-exception',{exceptionId:'request-12345678',decision:'Aprovado',reason:'Motivo confirmado pelo gestor'}),tech,true,now),/Somente o gestor/);
  item=improveFieldOrder(item,[],cmd(item,'decide-exception',{exceptionId:'request-12345678',decision:'Aprovado',reason:'Motivo confirmado pelo gestor'}),manager,true,now).order;
  assert.equal(item.fieldExceptions[0].decidedBy,'manager');
  assert.throws(()=>improveFieldOrder(item,[],cmd(item,'decide-exception',{exceptionId:'request-12345678',decision:'Rejeitado',reason:'Outra decisão posterior'}),manager,true,now),/já decidida/);
  item=improveFieldOrder(item,[],{...cmd(item,'request-exception',{kind:'equipment',reason:'Serviço de inspeção sem aparelho'}),requestId:'request-equip-12345'},tech,false,now).order;
  item=improveFieldOrder(item,[],cmd(item,'decide-exception',{exceptionId:'request-equip-12345',decision:'Aprovado',reason:'Serviço sem equipamento confirmado'}),manager,true,now).order;
  const finish=cmd(item,'finish',{diagnosis:'Inspeção realizada',report:'Orientação técnica prestada',beforePhoto:image,afterPhoto:image,checklist:{checkin:true,beforePhoto:true,afterPhoto:true,executedService:true}});
  const complete=applyFieldOrder(item,finish,tech,now);assert.equal(complete.status,'Concluída');assert.equal(complete.customerSignature,undefined);
  assert.throws(()=>applyFieldOrder(item,{...finish,beforePhoto:undefined},tech,now),/Conclusão exige/);
});
test('history excludes unrelated clients, canceled orders and financial/private fields',()=>{
  const current=order(),equipment=[{id:'EQ-1',customerId:'CLI-1',unitId:'UNIT-1'}];
  const prior={id:'OS-old',customerId:'CLI-1',status:'Concluída',equipmentIds:['EQ-1'],executedService:'Reparo anterior',photos:{before:[image]},total:900,privateNote:'secret'};
  const history=fieldEquipmentHistory(current,'EQ-1',equipment,[prior,{...prior,id:'foreign',customerId:'CLI-OTHER'},{...prior,id:'cancel',status:'Cancelada'}]);
  assert.equal(history.length,1);assert.equal(history[0].report,'Reparo anterior');assert.equal(history[0].before,image);assert.equal(history[0].total,undefined);assert.ok(!JSON.stringify(history).includes('secret'));
  assert.throws(()=>fieldEquipmentHistory(current,'EQ-other',equipment,[prior]),/não disponível/);
});
