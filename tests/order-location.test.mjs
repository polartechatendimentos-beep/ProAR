import test from 'node:test';
import assert from 'node:assert/strict';
import {orderLocation,orderCustomerPatch} from '../lib/order-location.ts';
test('room input preserves typed text and deliberate clearing even with a linked structure',()=>{
 const order={customerId:'a',client:'Cliente A',unit:'Matriz',roomId:'room-a'};
 const rooms=[{id:'room-a',customerId:'a',name:'Sala original'}];
 assert.equal(orderLocation(order,rooms).roomValue,'Sala original');
 assert.equal(orderLocation({...order,environment:'Sala corrigida'},rooms).roomValue,'Sala corrigida');
 assert.equal(orderLocation({...order,environment:''},rooms).roomValue,'');
});
test('same unit names and stale IDs never resolve a different customer location',()=>{
 const order={customerId:'a',client:'Cliente A',unit:'Matriz',roomId:'room-b'};
 const result=orderLocation(order,[{id:'room-b',customerId:'b',name:'Matriz',address:'Endereço B'}]);
 assert.equal(result.structure,undefined);assert.equal(result.roomValue,'');
});
test('customer reassignment replaces contact and clears old equipment and location without changing original record',()=>{
 const old={customerId:'a',client:'Cliente A',address:'Endereço A',whatsappPhone:'111',environment:'Sala A',roomId:'ra',equipmentId:'ea',equipmentIds:['ea'],equipmentLabelCode:'old'};
 const next={...old,...orderCustomerPatch(old,'b',{name:'Cliente B',address:'Endereço B',phone:'222'})};
 assert.equal(next.address,'Endereço B');assert.equal(next.whatsappPhone,'222');assert.equal(next.roomId,undefined);assert.equal(next.environment,'');assert.equal(next.equipmentId,undefined);assert.deepEqual(next.equipmentIds,[]);assert.equal(next.equipmentLabelCode,undefined);assert.equal(old.address,'Endereço A');
 assert.deepEqual(orderCustomerPatch(old,'a',{name:'Cliente A'}),{});
 assert.equal(orderCustomerPatch(old,'c',{name:'Cliente C'}).address,'');
});
