import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFieldSupport,visibleFieldSupport,vehicleReleased,fieldSupportKey} from '../lib/field-support.ts';
import {applyFieldOrder,requireActiveJourney,fieldOrderFingerprint} from '../lib/mobile-workday.ts';
import {mobileChecklist} from '../lib/mobile-service-checklists.ts';
import {encryptWorkSelfie,decryptWorkSelfie} from '../lib/work-selfie.ts';
const now='2026-10-13T15:00:00.000Z',manager={employeeId:'FUN-1',name:'Gestor',username:'gestor',manager:true},tech={employeeId:'FUN-2',name:'Técnico',username:'tecnico',manager:false};
const empty=()=>({companyId:'tenant-a',_revision:0,records:[],requests:{}});
const apply=(s,action,data,actor=tech,key=action+'-12345678')=>applyFieldSupport(s,{requestId:key,action,data},actor,now);
const vehicle=()=>apply(empty(),'vehicle',{plate:'ABC1D23',name:'Van',odometer:1000,assignedEmployeeId:'FUN-2'},manager).state;
test('field records isolate identities and idempotent retries',()=>{
  const first=apply(empty(),'sos',{point:{latitude:-20.8,longitude:-49.5,accuracy:10,capturedAt:now}});
  assert.equal(apply(first.state,'sos',{point:{latitude:-20.8,longitude:-49.5,accuracy:10,capturedAt:now}}).replay,true);
  assert.throws(()=>apply(first.state,'sos',{message:'other'}),/outro conteúdo/);
  assert.equal(visibleFieldSupport(first.state,{...tech,employeeId:'someone-else'}).length,0);
  assert.equal(visibleFieldSupport(first.state,tech)[0].point,undefined);
  assert.equal(visibleFieldSupport(first.state,manager)[0].point.latitude,-20.8);
  assert.notEqual(fieldSupportKey('tenant-a'),fieldSupportKey('tenant-b'));
});
test('fleet checklist releases only safe vehicles for assigned employees',()=>{
  let state=vehicle();const id=state.records[0].id;
  assert.equal(vehicleReleased(state,'FUN-2','2026-10-13'),false);
  assert.throws(()=>apply(state,'checklist',{vehicleId:id,odometer:1000,checks:{}},{...tech,employeeId:'other'}),/não atribuído/);
  const checks={pneus:'ok',farois:'ok',oleo:'ok',agua:'ok',lataria:'unsafe'};
  state=apply(state,'checklist',{vehicleId:id,odometer:1000,checks,notes:'Pneu danificado'}).state;
  assert.equal(vehicleReleased(state,'FUN-2','2026-10-13'),false);
  state=apply(state,'checklist',{vehicleId:id,odometer:1000,checks:{...checks,lataria:'ok'}},tech,'checklist-87654321').state;
  assert.equal(vehicleReleased(state,'FUN-2','2026-10-13'),true);
});
test('fuel rejects decreasing mileage and estimates only consecutive full tanks',()=>{
  let state=vehicle(),id=state.records[0].id;
  state=apply(state,'fuel',{vehicleId:id,odometer:1100,liters:20,amount:120,fullTank:true}).state;
  assert.throws(()=>apply(state,'fuel',{vehicleId:id,odometer:1000,liters:20,amount:120},tech,'fuel-decreasing'),/inferior/);
  state=apply(state,'fuel',{vehicleId:id,odometer:1300,liters:20,amount:120,fullTank:true},tech,'fuel-87654321').state;
  assert.equal(state.records.at(-1).kmPerLiter,10);
});
test('point corrections append decisions and never replace originals',()=>{
  let state=apply(empty(),'point-adjustment',{date:'2026-10-13',requestedTime:'08:00',reason:'Erro de marcação'}).state;
  const original=structuredClone(state.records[0]);
  assert.throws(()=>apply(state,'adjustment-decision',{adjustmentId:original.id,decision:'approved',reason:'Conferido'}),/restrita/);
  state=apply(state,'adjustment-decision',{adjustmentId:original.id,decision:'approved',reason:'Conferido'},manager).state;
  assert.deepEqual(state.records[0],original);
  assert.throws(()=>apply(state,'adjustment-decision',{adjustmentId:original.id,decision:'rejected',reason:'Outra'},manager,'decision-87654321'),/já analisada/);
});
test('journey gate rejects pauses, closed and expired shifts',()=>{
  const route={status:'active',startedAt:'2026-10-13T11:00:00Z',expiresAt:'2026-10-13T23:00:00Z'};
  assert.equal(requireActiveJourney([route],now),route);
  for(const status of ['paused','completed'])assert.throws(()=>requireActiveJourney([{...route,status}],now),/jornada/);
  assert.throws(()=>requireActiveJourney([{...route,expiresAt:'2026-10-13T14:00:00Z'}],now),/jornada/);
});
test('OS mutations protect owner, revision, desktop edits and completion evidence',()=>{
  const order={id:'OS-1',tech:'tecnico',status:'Aberta',fieldVersion:0,service:'Manutenção',equipmentIds:['EQ-1']};
  const command={requestId:'order-12345678',action:'save',orderId:'OS-1',expectedVersion:0,report:'Limpeza'};
  const session={username:'tecnico',role:'Técnico'};
  assert.throws(()=>applyFieldOrder({...order,tech:'other'},command,session,now),/não atribuída/);
  assert.throws(()=>applyFieldOrder({...order,fieldVersion:1},command,session,now),/alterada/);
  assert.throws(()=>applyFieldOrder({...order,notes:'desktop edit'},{...command,expectedToken:fieldOrderFingerprint(order)},session,now),/alterada/);
  assert.throws(()=>applyFieldOrder(order,{...command,action:'finish'},session,now),/Conclusão/);
  const image='data:image/png;base64,aGVsbG8=';
  const complete={...order,checkInAt:now,diagnosis:'Defeito constatado',executedService:'Serviço realizado',photos:{before:[image],after:[image]},customerSignature:image};
  const checklist=Object.fromEntries(mobileChecklist(order.service).map(item=>[item.key,true]));
  assert.equal(applyFieldOrder(complete,{...command,action:'finish',checklist},session,now).status,'Concluída');
  assert.throws(()=>applyFieldOrder(complete,{...command,action:'finish',checklist:{}},session,now),/checklist/);
  assert.equal(order.executedService,undefined);
});
test('selfies are encrypted per tenant and altered ciphertext cannot be decoded',()=>{
  const image='data:image/jpeg;base64,aGVsbG8=',encrypted=encryptWorkSelfie(image,'test-only-secret','tenant-a');
  assert.ok(!encrypted.cipher.includes('aGVsbG8'));
  assert.equal(decryptWorkSelfie(encrypted.cipher,'test-only-secret','tenant-a'),image);
  assert.throws(()=>decryptWorkSelfie(encrypted.cipher,'test-only-secret','tenant-b'));
  assert.throws(()=>encryptWorkSelfie('data:image/svg+xml;base64,aGVsbG8=','test-only-secret','tenant-a'));
});
