import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {applyFieldOrder,technicianRole,fieldOrderFingerprint} from '../lib/mobile-workday.ts';
import {improveFieldOrder,mobileMutationActions,fieldEquipmentHistory} from '../lib/mobile-order-improvements.ts';
import {fieldCustomerHistory,fieldOrderReceipt} from '../lib/mobile-order-records.ts';
import {assignedToSession} from '../lib/mobile-field.ts';
import {FieldSupportError} from '../lib/field-support.ts';
import {RouteError,validatePoint} from '../lib/work-routes.ts';
import {OperationError,prepareOperationalState,independentOperationalRows} from '../lib/operational-ledger.ts';
const source=stripTypeScriptTypes(await readFile(new URL('../app/api/mobile/orders/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
const order={id:'OS-1',tech:'tecnico',client:'Cliente',status:'Aberta',fieldVersion:0};
const state=()=>({customers:[],serviceOrders:[structuredClone(order)],moduleRecords:{},_revision:1});
function setup({session={username:'tecnico',role:'Técnico'},journey=true,initialState}={}){
  let saved,journeyActive=journey;const context={company:'empresa',state:initialState || state(),db:{url:'neon://test',key:'test-only'},actor:{employeeId:'FUN-1'}};
  const handlers=runInNewContext(source+'\n({post:POST,get:GET});',{
    NextResponse:{json:(body,{status=200}={})=>({body,status})},createHash,sessionFromRequest:()=>session,hasPermission:()=>true,
    routeContext:async()=>context,activeJourneyContext:async()=>{if(!journeyActive)throw new FieldSupportError('Jornada inativa',403);return context;},
    technicianRole,applyFieldOrder,improveFieldOrder,mobileMutationActions,fieldEquipmentHistory,fieldCustomerHistory,fieldOrderReceipt,assignedToSession,FieldSupportError,RouteError,validatePoint,prepareOperationalState,OperationError,independentOperationalRows,
    supabaseRest:async()=>({ok:true,json:async()=>[{trade_name:"Empresa de teste",cnpj:"documento de teste"}]}),
    PRIMARY_DATABASE_URL:'neon://test',commitNeonOperationalState:async(_id,_revision,payload)=>{saved=payload;context.state=payload;return payload;},
  });
  return {fn:handlers.post,get:handlers.get,setJourney(value){journeyActive=value;},get saved(){return saved;}};
}
function request(body={},origin='https://app.test'){return{headers:new Headers({origin}),nextUrl:{origin:'https://app.test'},text:async()=>JSON.stringify(body)}}
const command=()=>({requestId:'save-order-12345',action:'save',orderId:'OS-1',expectedVersion:0,expectedToken:fieldOrderFingerprint(order),report:'Serviço registrado'});
test('API rejects missing session, cross-origin writes and inactive workdays',async()=>{
  assert.equal((await setup({session:null}).fn(request(command()))).status,401);
  assert.equal((await setup().fn(request(command(),'https://other.test'))).status,403);
  assert.equal((await setup({journey:false}).fn(request(command()))).status,403);
});
test('API commits report without accepting financial fields or exposing the ERP snapshot',async()=>{
  const api=setup(),result=await api.fn(request({...command(),data:{total:9999},total:9999,companyId:'another-tenant'}));
  assert.equal(result.status,200);assert.equal(result.body.saved,true);assert.equal(result.body.state,undefined);
  assert.equal(api.saved.serviceOrders[0].executedService,'Serviço registrado');assert.equal(api.saved.serviceOrders[0].total,undefined);assert.equal(api.saved._companyId,'empresa');
});
test('API retry does not duplicate effects, and stale fingerprints fail',async()=>{
  const api=setup();await api.fn(request(command()));const revision=api.saved._revision;
  const replay=await api.fn(request(command()));assert.equal(replay.body.replay,true);assert.equal(api.saved._revision,revision);
  const fresh=setup();assert.equal((await fresh.fn(request({...command(),expectedToken:'a'.repeat(64)}))).status,409);
});

test('mobile links eligible equipment and completes the OS atomically',async()=>{
  const image='data:image/png;base64,AAAA';
  const initial=state();
  initial.serviceOrders[0]={...order,customerId:'CLI-1',unitId:'UNIT-1',checkInAt:new Date().toISOString()};
  initial.moduleRecords.Equipamentos=[{id:'EQ-1',customerId:'CLI-1',unitId:'UNIT-1',name:'Ar condicionado'}];
  initial.moduleRecords.Funcionários=[{id:'FUN-1',name:'tecnico',status:'Ativo',employeeSignature:image}];
  const current=initial.serviceOrders[0];
  const api=setup({initialState:initial});
  const finish={...command(),action:'finish',expectedToken:fieldOrderFingerprint(current),equipmentIds:['EQ-1'],diagnosis:'Vazamento localizado',report:'Carga de fluido efetuada',beforePhoto:image,afterPhoto:image,signature:image,signerName:'Responsável',checklist:{checkin:true,equipment:true,beforePhoto:true,afterPhoto:true,signature:true,executedService:true},point:{id:'gps-finish-12345',capturedAt:new Date().toISOString(),latitude:-20.8,longitude:-49.5,accuracy:10}};
  const result=await api.fn(request(finish));
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(api.saved.serviceOrders[0].status,'Concluída');
  assert.deepEqual(api.saved.serviceOrders[0].equipmentIds,['EQ-1']);
  assert.ok(api.saved.serviceOrders[0].checkOutAt);
  assert.equal(api.saved.serviceOrders[0].receiptSignatures.client.image,image);
  assert.equal(api.saved.serviceOrders[0].receiptSignatures.technician.image,image);
  assert.equal(api.saved.serviceOrders[0].receiptSignatures.technician.source,'employee-default');
  const revision=api.saved._revision;
  api.setJourney(false);
  const replay=await api.fn(request(finish));
  assert.equal(replay.body.replay,true);
  assert.equal(replay.body.orderId,'OS-1');
  assert.equal(replay.body.status,'Concluída');
  assert.equal(replay.body.completedAt,api.saved.serviceOrders[0].checkOutAt);
  assert.equal(api.saved._revision,revision);
});
test('mobile completes without equipment or managerial exception even with equipment available',async()=>{
  const image='data:image/png;base64,AAAA';
  const initial=state();
  initial.serviceOrders[0]={...order,customerId:'CLI-1',unitId:'UNIT-1',checkInAt:new Date().toISOString()};
  initial.moduleRecords.Equipamentos=[{id:'EQ-1',customerId:'CLI-1',unitId:'UNIT-1',name:'Ar condicionado'}];
  initial.moduleRecords.Funcionários=[{id:'FUN-1',name:'tecnico',status:'Ativo',employeeSignature:image}];
  const current=initial.serviceOrders[0];
  const api=setup({initialState:initial});
  const finish={...command(),action:'finish',expectedToken:fieldOrderFingerprint(current),equipmentIds:[],diagnosis:'Vazamento localizado',report:'Carga de fluido efetuada',beforePhoto:image,afterPhoto:image,signature:image,signerName:'Responsável',checklist:{checkin:true,equipment:false,beforePhoto:true,afterPhoto:true,signature:true,executedService:true},point:{id:'gps-finish-12345',capturedAt:new Date().toISOString(),latitude:-20.8,longitude:-49.5,accuracy:10}};
  const result=await api.fn(request(finish));
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal(api.saved.serviceOrders[0].status,'Concluída');
  assert.deepEqual(api.saved.serviceOrders[0].equipmentIds,[]);
  assert.ok(api.saved.serviceOrders[0].checkOutAt);
  assert.equal(api.saved.serviceOrders[0].receiptSignatures.client.image,image);
  assert.equal(api.saved.serviceOrders[0].receiptSignatures.technician.image,image);
  assert.equal(api.saved.serviceOrders[0].receiptSignatures.technician.source,'employee-default');
  const revision=api.saved._revision;
  api.setJourney(false);
  const replay=await api.fn(request(finish));
  assert.equal(replay.body.replay,true);
  assert.equal(replay.body.orderId,'OS-1');
  assert.equal(replay.body.status,'Concluída');
  assert.equal(replay.body.completedAt,api.saved.serviceOrders[0].checkOutAt);
  assert.equal(api.saved._revision,revision);
});
test('mobile rejects equipment belonging to another customer',async()=>{
  const initial=state();
  initial.serviceOrders[0].customerId='CLI-1';
  initial.moduleRecords.Equipamentos=[{id:'EQ-OTHER',customerId:'CLI-OTHER'}];
  const api=setup({initialState:initial});
  const result=await api.fn(request({...command(),expectedToken:fieldOrderFingerprint(initial.serviceOrders[0]),equipmentIds:['EQ-OTHER']}));
  assert.equal(result.status,403);
  assert.equal(api.saved,undefined);
});

test('GET history and receipt authorize the requested order before projecting client data',async()=>{
  const initial=state();initial.serviceOrders[0].customerId='CLI-1';
  const completed={id:'OS-HISTORY',customerId:'CLI-1',tech:'tecnico',status:'Concluída',checkOutAt:'2026-10-15T15:00:00Z',executedService:'Serviço',privateNote:'secret'};
  initial.serviceOrders.push(completed,{...completed,id:'OS-FOREIGN',customerId:'CLI-2',tech:'outro'});
  const api=setup({initialState:initial});
  const get=(orderId,view)=>api.get({nextUrl:{searchParams:new URLSearchParams({orderId,view})}});
  const history=await get('OS-1','customer-history');assert.equal(history.status,200);assert.equal(history.body.history.length,1);assert.ok(!JSON.stringify(history.body).includes('secret'));
  assert.equal((await get('OS-FOREIGN','receipt')).status,403);
  assert.equal((await get('OS-1','receipt')).status,409);
  const receipt=await get('OS-HISTORY','receipt');assert.equal(receipt.status,200);assert.equal(receipt.body.receipt.report,'Serviço');assert.equal(receipt.body.receipt.company.name,'Empresa de teste');assert.equal(receipt.body.receipt.privateNote,undefined);
});
