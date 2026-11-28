import test from 'node:test';
import assert from 'node:assert/strict';
import {desktopQueuePrefix,readDesktopOperations} from '../lib/desktop-offline-operations.ts';
import {desktopOsQueuePrefix,readDesktopOsDrafts,reviseDesktopOsDraft,saveDesktopOsDraft,syncDesktopOsDraft} from '../lib/desktop-os-offline.ts';
const storage=(map=new Map())=>({get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
const scope=desktopQueuePrefix('tenant','operator'),prefix=desktopOsQueuePrefix(scope);
const intent={id:'#OS-15500',creationRequestId:'local-order-12345',client:'Cliente teste',customerId:'C1',status:'Agendada',tech:'Técnico A',date:'2026-11-30',time:'09:00',service:'Instalação',whatsappUpdatesEnabled:true};
const snapshot={_revision:3,customers:[{id:'C1',name:intent.client}],serviceOrders:[],moduleRecords:{Funcionários:[{id:'T1',name:intent.tech}]}};
const testClock=()=>new Date('2026-11-29T16:00:00Z');
const staged=(store,snapshot,write)=>({store,prefix,id:intent.creationRequestId,read:async()=>snapshot,write,now:testClock});
test('offline OS survives a reload with stable key and never leaks into generic queue or another tenant/operator',()=>{
 const map=new Map(), store=storage(map);
 saveDesktopOsDraft(store,prefix,{...intent,forbiddenSecret:'blocked'});
 const [draft]=readDesktopOsDrafts(storage(map),prefix);
 assert.equal(draft.intent.creationRequestId,intent.creationRequestId);
 assert.equal(draft.intent.id,undefined);
 assert.equal(draft.intent.forbiddenSecret,undefined);
 assert.deepEqual(readDesktopOperations(store,scope),[]);
 for(const foreign of [desktopQueuePrefix('other','operator'),desktopQueuePrefix('tenant','other')])assert.deepEqual(readDesktopOsDrafts(store,desktopOsQueuePrefix(foreign)),[]);
});
test('lost receipt never creates another OS: retry reconciles by token against fresh revision',async()=>{
 const store=storage();
 saveDesktopOsDraft(store,prefix,intent);
 let authoritative=snapshot,writes=0;
 let result=await syncDesktopOsDraft(staged(store,authoritative,async next=>{
  writes++;assert.equal(next._revision,3);assert.equal(next.serviceOrders[0].whatsappUpdatesEnabled,false);
  authoritative={...next,_revision:4};throw new Error('conexão caiu após gravar');
 }));
 assert.equal(result,null);assert.equal(readDesktopOsDrafts(store,prefix).length,1);
 result=await syncDesktopOsDraft(staged(store,authoritative,async()=>{writes++;throw Error('duplicata');}));
 assert.equal(result.id,'#OS-15500');assert.equal(writes,1);assert.deepEqual(readDesktopOsDrafts(store,prefix),[]);
});
test('unavailable/expired slot stays local; adjusted time uses same token and newer official sequence',async()=>{
 const store=storage();saveDesktopOsDraft(store,prefix,intent);
 const latest={...snapshot,_revision:4,serviceOrders:[{id:'#OS-15500',client:'Outro cliente'}]};
 let writes=0;
 const reject=staged(store,latest,async()=>{writes++;return {status:409,body:{code:'OS_SCHEDULE_CONFLICT',error:'Horário ocupado'}}});
 assert.equal(await syncDesktopOsDraft(reject),null); assert.equal(writes,1);
 assert.match(readDesktopOsDrafts(store,prefix)[0].review,/Horário ocupado/);
 reviseDesktopOsDraft(store,prefix,intent.creationRequestId,{date:'2026-11-29',time:'08:00',tech:intent.tech});
 assert.equal(await syncDesktopOsDraft(reject),null); assert.equal(writes,1);
 assert.match(readDesktopOsDrafts(store,prefix)[0].review,/passou/);
 reviseDesktopOsDraft(store,prefix,intent.creationRequestId,{date:intent.date,time:'11:00',tech:intent.tech});
 const accepted=await syncDesktopOsDraft(staged(store,latest,async next=>{
  writes++;
  assert.equal(next._revision,4); assert.equal(next.serviceOrders[0].time,'11:00');assert.equal(next.serviceOrders[0].creationRequestId,intent.creationRequestId);
  assert.equal(next.serviceOrders[1].client,'Outro cliente');
  return {status:200,body:{saved:true,state:{...next,_revision:5}}};
 }));
 assert.equal(writes,2);assert.equal(accepted.id,'#OS-15501');assert.deepEqual(readDesktopOsDrafts(store,prefix),[]);
});
test('logout during send does not consume queued draft',async()=>{
 const store=storage();saveDesktopOsDraft(store,prefix,intent);let active=true;
 const result=await syncDesktopOsDraft({...staged(store,snapshot,async next=>{active=false;return {status:200,body:{saved:true,state:{...next,_revision:4}}};}),active:()=>active});
 assert.equal(result,null);assert.equal(readDesktopOsDrafts(store,prefix).length,1);
});
