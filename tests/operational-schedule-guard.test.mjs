import test from 'node:test';
import assert from 'node:assert/strict';
import {assertOrderScheduleChanges,OrderScheduleConflict} from '../lib/order-schedule-validation.ts';
import {prepareOperationalState,OperationError} from '../lib/operational-ledger.ts';

const row=(id,changes={})=>({id,date:'2026-11-28',time:'08:00',status:'Agendada',tech:'João Silva',...changes});
const staff=[{id:'TEC-A',name:'João Silva'},{id:'TEC-B',name:'João Silva'}];
const actor={username:'operacao-test',can:()=>true};
const state=(orders=[])=>({customers:[],serviceOrders:orders,moduleRecords:{'Funcionários':staff}});

test('canonical state preparation rejects a new overlapping OS with only canonical tech ID and missing duration',()=>{
 const saved=state([row('OS-A',{tech:'',employeeId:'TEC-A'})]);
 assert.throws(()=>prepareOperationalState(saved,state([...saved.serviceOrders,row('OS-B',{time:'09:00',tech:'Joao  SILVA'})]),actor),
 error=>error instanceof OperationError&&error.status===409&&error.code==='OS_SCHEDULE_CONFLICT');
 assert.doesNotThrow(()=>prepareOperationalState(saved,state([...saved.serviceOrders,row('OS-B',{time:'10:00',tech:'João Silva'})]),actor));
 assert.equal(saved.serviceOrders.length,1);
});

test('canonical IDs distinguish homonyms and same employee ID matches across spelling/name changes',()=>{
 const a=row('OS-A',{employeeId:'TEC-A',estimatedDurationMinutes:90});
 assert.doesNotThrow(()=>assertOrderScheduleChanges([a],[a,row('OS-B',{employeeId:'TEC-B'})],staff));
 assert.throws(()=>assertOrderScheduleChanges([a],[a,row('OS-B',{tech:'Novo nome',techId:'TEC-A'})],staff),OrderScheduleConflict);
});

test('historical overlaps do not prevent unrelated edits; promotion and reopening do book time',()=>{
 const a=row('OS-A'), b=row('OS-B');
 assert.doesNotThrow(()=>assertOrderScheduleChanges([a,b],[{...a,diagnosis:'Observação'},b],staff));
 const draft={...b,status:'Rascunho'};
 assert.doesNotThrow(()=>assertOrderScheduleChanges([a],[a,draft],staff));
 assert.throws(()=>assertOrderScheduleChanges([a,draft],[a,b],staff),OrderScheduleConflict);
 assert.throws(()=>assertOrderScheduleChanges([a,{...b,status:'Cancelada'}],[a,b],staff),OrderScheduleConflict);
 assert.doesNotThrow(()=>assertOrderScheduleChanges([a],[a,{...b,tech:' Técnico a definir '}],staff));
});

test('two proposals against the same snapshot are individually valid but retry after the winning revision is rejected',()=>{
 const start={...state(),_revision:3};
 const attempt=(record,base)=>prepareOperationalState(base,{...base,serviceOrders:[...base.serviceOrders,record]},actor);
 const one=attempt(row('OS-PRIMEIRA'),start);
 assert.doesNotThrow(()=>attempt(row('OS-SEGUNDA'),start));
 // On CAS failure the losing editor must revalidate with the newly committed snapshot, not overwrite it.
 const winner={...one,_revision:4};
 assert.throws(()=>attempt(row('OS-SEGUNDA'),winner),error=>error.code==='OS_SCHEDULE_CONFLICT');
 assert.deepEqual(winner.serviceOrders.map(order=>order.id),['OS-PRIMEIRA']);
});

test('PUT /api/state accepts only one of two simultaneous overlapping saves against the same revision',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {stripTypeScriptTypes}=await import('node:module');
 const {runInNewContext}=await import('node:vm');
 const {createSaveTiming}=await import('../lib/save-timing.ts');
 const {projectOperationalState,mergeOperationalView}=await import('../lib/state-access.ts');
 const {independentOperationalRows}=await import('../lib/operational-ledger.ts');
 const source=stripTypeScriptTypes(await readFile(new URL('../app/api/state/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
 for(const direct of [false,true]){
  let stored={...state(),_companyId:'polartech-principal',_revision:3,_updatedAt:new Date().toISOString()},reads=0,release;
  const barrier=new Promise(resolve=>{release=resolve;});
  const commit=(expected,payload)=>{if(expected!==stored._revision)return null;stored=structuredClone(payload);return stored;};
  const databaseFetch=async (input,init)=>{
   const url=new URL(input);
   if(init.method==='PATCH'){
    const expected=Number(url.searchParams.get('payload->>_revision')?.replace('eq.',''));
    const confirmed=commit(expected,JSON.parse(init.body).payload);
    return Response.json(confirmed?[{payload:confirmed}]:[]);
   }
   const snapshot=structuredClone(stored);
   if(++reads<=2){if(reads===2)release();await barrier;}
   return Response.json([{payload:snapshot}]);
  };
  const put=runInNewContext(source+'\nPUT;',{
   process:{env:{}},NextResponse:{json:Response.json},createSaveTiming,
   readSession:()=>({companyId:'polartech-principal',username:'teste',role:'Administrador',permissions:['*']}),hasPermission:()=>true,
   resolveTenantDb:async()=>({url:direct?'https://neon.test':'https://rest.test',key:'test-only'}),
   tenantHeaders:()=>({}),databaseFetch,PRIMARY_DATABASE_URL:'https://neon.test',
   commitNeonOperationalState:async(_id,expected,payload)=>commit(expected,payload),
   guardTechnicianOsChanges:async()=>{},prepareOperationalState,independentOperationalRows,OperationError,
   projectOperationalState,mergeOperationalView,FieldSupportError:class extends Error {},
   classifyProarError:error=>{throw error;},
  });
  const submit=(order,revision,orders=[])=>put({cookies:{get:()=>({value:'test'})},json:async()=>({...state([...orders,order]),_baseRevision:revision})});
  const a=row('OS-PRIMEIRA'),b=row('OS-SEGUNDA');
  const result=await Promise.all([submit(a,3),submit(b,3)]);
  assert.deepEqual(result.map(response=>response.status).sort(),[200,409]);
  assert.equal((await result.find(response=>response.status===409).json()).conflict,true);
  assert.equal(stored._revision,4);
  const loser=stored.serviceOrders[0].id===a.id?b:a;
  const retried=await submit(loser,4,stored.serviceOrders);
  assert.equal(retried.status,409);
  assert.equal((await retried.json()).code,'OS_SCHEDULE_CONFLICT');
  assert.equal(stored.serviceOrders.length,1);
 }
});

test('legacy GET consolidation cannot overwrite a newer canonical save',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {stripTypeScriptTypes}=await import('node:module');
 const {runInNewContext}=await import('node:vm');
 const source=stripTypeScriptTypes(await readFile(new URL('../app/api/state/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
 const canonical={...state(),_revision:3}, newer={...state([row('OS-NOVA')]),_revision:4};
 let canonicalReads=0, writes=0;
 const get=runInNewContext(source+'\nGET;',{
  process:{env:{}},NextResponse:{json:Response.json},readSession:()=>({username:'legacy'}),
  resolveTenantDb:async()=>({url:'https://rest.test',key:'test-only'}),tenantHeaders:()=>({}),
  projectOperationalState:value=>value, hasPermission:()=>true, classifyProarError:error=>{throw error;},
  databaseFetch:async(input,init)=>{
   const query=new URL(input).searchParams;
   if(init.method){
    writes++;
    assert.equal(init.method,'PATCH');
    assert.equal(query.get('id'),'eq.polartech-principal');
    assert.equal(query.get('payload->>_revision'),'eq.3');
    return Response.json([]);
   }
   if(query.get('id')==='eq.main')return Response.json([{payload:{...state([row('OS-LEGADA')]),_revision:2}}]);
   return Response.json([{payload:canonicalReads++===0?canonical:newer}]);
  },
 });
 const response=await get({cookies:{get:()=>({value:'test'})}});
 assert.equal(writes,1);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.state._revision,4);
 assert.deepEqual(data.state.serviceOrders.map(item=>item.id),['OS-NOVA']);
});
