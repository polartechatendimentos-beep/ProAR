import test from 'node:test';
import assert from 'node:assert/strict';
import {saveOrderDraft,loadOrderDraft,clearOrderDraft,listPendingOrderDrafts} from '../lib/mobile-order-drafts.ts';
// Small IDB adapter exercises encryption, transaction completion and scope queries without a browser.
function memoryIdb(){
  const stores=new Map();let initialized=false;
  const db={createObjectStore(name){stores.set(name,new Map());},close(){},transaction(name){
    const map=stores.get(name),tx={};
    const request=run=>{const r={};queueMicrotask(()=>{try{r.result=run();r.onsuccess?.();setImmediate(()=>tx.oncomplete?.());}catch(error){r.error=error;r.onerror?.();tx.error=error;tx.onabort?.();}});return r;};
    tx.objectStore=()=>({get:id=>request(()=>map.get(id)),put:(value,id)=>request(()=>map.set(id??value.id,structuredClone(value))),delete:id=>request(()=>map.delete(id)),getAllKeys:()=>request(()=>[...map.keys()])});return tx;
  }};
  return {stores,open(){const r={result:db};queueMicrotask(()=>{if(!initialized){initialized=true;r.onupgradeneeded?.();}r.onsuccess?.();});return r;}};
}
test('encrypted pending OS survive reload, stay isolated by company/user and clear only after confirmation',async()=>{
  const original=globalThis.indexedDB,idb=memoryIdb();globalThis.indexedDB=idb;
  try{
    const pending={command:{requestId:'request-12345',orderId:'OS-1',action:'finish',expectedVersion:1,expectedToken:'a'.repeat(64),report:'Confidential report'},queuedAt:Date.now()};
    const draft={version:1,report:'Confidential report',diagnosis:'Diagnóstico',checklist:{},equipmentIds:[],before:'',after:'',signature:'',signerName:'',savedAt:Date.now(),pendingSubmission:pending,orderSnapshot:{id:'OS-1'}};
    await Promise.all([saveOrderDraft('empresa:tech','OS-1',draft),saveOrderDraft('outra:tech','OS-1',{...draft,report:'Other tenant'}),saveOrderDraft('empresa:tech:helper','OS-1',{...draft,report:'Other user'})]);
    const row=idb.stores.get('drafts').get('empresa:tech:OS-1');assert.ok(row.cipher instanceof ArrayBuffer);assert.ok(!new TextDecoder().decode(row.cipher).includes('Confidential'));
    const recovered=await loadOrderDraft('empresa:tech','OS-1');assert.deepEqual(recovered.pendingSubmission,pending);
    assert.equal((await listPendingOrderDrafts('empresa:tech')).length,1);assert.equal((await listPendingOrderDrafts('empresa:other-user')).length,0);assert.equal((await listPendingOrderDrafts('empresa:tech'))[0].report,'Confidential report');
    await clearOrderDraft('empresa:tech','OS-1');assert.equal(await loadOrderDraft('empresa:tech','OS-1'),null);assert.equal((await listPendingOrderDrafts('outra:tech')).length,1);
  }finally{globalThis.indexedDB=original;}
});
test('preparações pendentes não desaparecem automaticamente após 30 dias',async()=>{
 const original=globalThis.indexedDB;globalThis.indexedDB=memoryIdb();try{
  const draft={version:1,report:'Relatório não enviado',diagnosis:'',checklist:{},equipmentIds:[],before:'',after:'',signature:'',signerName:'',savedAt:Date.now()-45*86400000,pendingSubmission:{command:{requestId:'pending-old',orderId:'OS-OLD',action:'save'},queuedAt:Date.now()-45*86400000},orderSnapshot:{id:'OS-OLD'}};
  await saveOrderDraft('empresa:tech','OS-OLD',draft);assert.ok(await loadOrderDraft('empresa:tech','OS-OLD'));assert.equal((await listPendingOrderDrafts('empresa:tech')).length,1);
  await saveOrderDraft('empresa:tech','OS-EMPTY',{...draft,pendingSubmission:undefined});assert.equal(await loadOrderDraft('empresa:tech','OS-EMPTY'),null);
 }finally{globalThis.indexedDB=original;}
});
