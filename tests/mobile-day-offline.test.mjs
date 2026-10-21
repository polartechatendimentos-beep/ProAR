import test from 'node:test';import assert from 'node:assert/strict';
import {createDayPackage,validDayPackage,mobileCivilDay,rememberOfflineLease,readOfflineLease,clearOfflineLease,draftRecoveryState,OFFLINE_LEASE_KEY} from '../lib/mobile-day-policy.ts';
import {saveDayPackage,loadDayPackage,saveDayHistories,removeDayOrder} from '../lib/mobile-day-cache.ts';
import {expiryOfValidatedSession} from '../lib/mobile-session-expiry.ts';
import {queueFieldCommand,fieldQueueSummary} from '../lib/field-offline-queue.ts';
const data=(now=Date.now(),scope='empresa:tech')=>({connected:true,stateFound:true,mode:'operational',user:{scope,displayName:'Técnico',role:'Técnico',canEdit:true,canApprove:false,manager:false,linkedEmployee:true},orders:[{id:'OS-1',date:mobileCivilDay(now),checkInAt:'',fieldVersion:1},{id:'OS-2',date:'2000-01-01',checkInAt:'',fieldVersion:1},{id:'OS-3',date:'2000-01-01',checkInAt:'entrada',fieldVersion:1}],summary:{today:1,inProgress:1,pending:2},lastReadAt:new Date(now).toISOString(),notice:'',offlineAccessUntil:now+3600000});
test('pacote inclui somente o dia ou atendimentos iniciados e informa limite sem inventar registros',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z'),pack=createDayPackage(data(now),now);assert.deepEqual(pack.data.orders.map(o=>o.id),['OS-1','OS-3']);assert.equal(pack.data.summary.today,1);assert.equal(pack.validUntil,now+3600000);
 const many=data(now);many.orders=Array.from({length:205},(_,i)=>({...many.orders[0],id:`OS-${i}`}));const limited=createDayPackage(many,now);assert.equal(limited.data.orders.length,200);assert.equal(limited.truncated,true);
});
test('cache exige sessão, não passa da meia-noite de Brasília e não amplia acesso por mais de oito horas',()=>{
 const now=Date.parse('2026-10-21T02:30:00Z'),input=data(now);input.offlineAccessUntil=now+24*3600000;const pack=createDayPackage(input,now);assert.equal(pack.day,'2026-10-20');assert.equal(pack.validUntil,Date.parse('2026-10-21T03:00:00Z'));
 assert.throws(()=>createDayPackage({...input,offlineAccessUntil:now},now));assert.throws(()=>createDayPackage({...input,user:{scope:''}},now));
});
test('pacote trocado de empresa, expirado, de outro dia ou com validade além da sessão é recusado',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z'),pack=createDayPackage(data(now),now);assert.equal(validDayPackage(pack,'empresa:tech',now),true);assert.equal(validDayPackage(pack,'outra:tech',now),false);assert.equal(validDayPackage(pack,'empresa:tech',now+86400000),false);assert.equal(validDayPackage({...pack,validUntil:now+7200000},'empresa:tech',now),false);
});
test('identidade de leitura fica na sessão da aba, expira e é removível sem apagar rascunhos',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z'),pack=createDayPackage(data(now),now),map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 rememberOfflineLease(storage,pack);assert.equal(readOfflineLease(storage,now).scope,'empresa:tech');assert.equal(readOfflineLease(storage,now+3600001),null);assert.equal(map.size,1);assert.ok(!map.get(OFFLINE_LEASE_KEY).includes('password'));clearOfflineLease(storage);assert.equal(readOfflineLease(storage,now),null);
});
test('estados de recuperação distinguem rascunho, fila, confirmação pendente e bloqueio',()=>{
 assert.equal(draftRecoveryState({}),'DRAFT');assert.equal(draftRecoveryState({pendingSubmission:{}}),'PENDING');assert.equal(draftRecoveryState({pendingSubmission:{sentAt:123}}),'AWAITING_CONFIRMATION');assert.equal(draftRecoveryState({pendingSubmission:{blocked:true,sentAt:123}}),'BLOCKED');
});
test('prazo offline usa expiração da sessão já validada e não guarda cookie no pacote',()=>{
 const now=Date.parse('2026-10-20T12:00:00Z'),token=`v2.${Buffer.from(JSON.stringify({exp:(now+3600000)/1000})).toString('base64url')}.assinatura`;
 assert.equal(expiryOfValidatedSession(token,now),now+3600000);assert.equal(expiryOfValidatedSession(token,now+3600001),0);assert.equal(expiryOfValidatedSession('invalid',now),0);const trialToken=`v2.${Buffer.from(JSON.stringify({exp:(now+3600000)/1000,trialExpiresAt:new Date(now+60000).toISOString()})).toString('base64url')}.assinatura`;assert.equal(expiryOfValidatedSession(trialToken,now),now+60000);assert.equal(expiryOfValidatedSession(`usuario.${(now+12*3600000)/1000}.assinatura`,now),now+8*3600000);
});
function memoryIdb(){
 const stores=new Map();let initialized=false;const db={createObjectStore(name){stores.set(name,new Map());},close(){},transaction(name){const map=stores.get(name),tx={};const request=run=>{const r={};queueMicrotask(()=>{try{r.result=run();r.onsuccess?.();setImmediate(()=>tx.oncomplete?.());}catch(error){r.error=error;r.onerror?.();tx.error=error;tx.onabort?.();}});return r;};tx.objectStore=()=>({get:id=>request(()=>map.get(id)),put:(value,id)=>request(()=>map.set(id??value.id,structuredClone(value))),delete:id=>request(()=>map.delete(id)),getAll:()=>request(()=>[...map.values()])});return tx;}};
 return {stores,open(){const r={result:db};queueMicrotask(()=>{if(!initialized){initialized=true;r.onupgradeneeded?.();}r.onsuccess?.();});return r;}};
}
test('pacote criptografado isola usuários, preserva históricos ao atualizar e retira OS confirmada',async()=>{
 const original=globalThis.indexedDB,idb=memoryIdb();globalThis.indexedDB=idb;
 try{
  const now=Date.now(),pack=createDayPackage(data(now),now);await saveDayPackage(pack);await saveDayPackage(createDayPackage(data(now,'outra:tech'),now));
  const row=idb.stores.get('packages').get('empresa:tech');assert.ok(row.cipher instanceof ArrayBuffer);assert.ok(!new TextDecoder().decode(row.cipher).includes('OS-1'));
  assert.equal((await loadDayPackage('empresa:tech',now)).data.user.scope,'empresa:tech');assert.equal(await loadDayPackage('empresa:outro',now),null);
  assert.equal(await saveDayHistories(pack.scope,pack.preparedAt,{ 'OS-1':[{id:'ANT-1',date:'2026-10-01',report:'Histórico real autorizado'}],'OS-OUTRA':[{id:'Não permitido'}]}),true);
  assert.equal((await loadDayPackage(pack.scope,now)).histories['OS-OUTRA'],undefined);
  const next=createDayPackage({...data(now),offlineAccessUntil:now+3600000},now+1);await saveDayPackage(next);assert.equal((await loadDayPackage(pack.scope,now+1)).histories['OS-1'].length,1);
  assert.equal(await saveDayHistories(pack.scope,pack.preparedAt,{}),false);
  await removeDayOrder(pack.scope,'OS-1');const recovered=await loadDayPackage(pack.scope,now+1);assert.ok(!recovered.data.orders.some(o=>o.id==='OS-1'));assert.equal(recovered.histories['OS-1'],undefined);assert.equal((await loadDayPackage('outra:tech',now)).data.orders.length,2);
  const damaged=idb.stores.get('packages').get(pack.scope);damaged.cipher=new Uint8Array([1,2,3]).buffer;assert.equal(await loadDayPackage(pack.scope,now),null);await saveDayPackage(pack);assert.equal((await loadDayPackage(pack.scope,now)).data.orders.length,2);
 }finally{globalThis.indexedDB=original;}
});
test('central da fila expõe apenas metadados do escopo atual sem abrir comandos de outros usuários',async()=>{
 const original=globalThis.indexedDB;globalThis.indexedDB=memoryIdb();try{
  await queueFieldCommand('empresa:tech',{requestId:'fuel-local',action:'fuel',data:{note:'conteúdo privado'}});await queueFieldCommand('empresa:outro',{requestId:'fuel-other',action:'fuel',data:{note:'outro usuário'}});
  const rows=await fieldQueueSummary('empresa:tech');assert.equal(rows.length,1);assert.equal(rows[0].state,'PENDING');assert.equal(rows[0].attempts,0);assert.ok(!JSON.stringify(rows).includes('conteúdo privado'));assert.ok(!JSON.stringify(rows).includes('fuel-other'));
 }finally{globalThis.indexedDB=original;}
});
