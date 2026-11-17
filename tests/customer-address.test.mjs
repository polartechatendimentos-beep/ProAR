import test from 'node:test';
import assert from 'node:assert/strict';
import {updateCustomerAddress} from '../lib/customer-address.ts';
test('preserva endereço antigo ao editar apenas cidade ou CEP sem rua cadastrada',()=>{
 const old={id:'C1',address:'Rua Antiga, 12, Centro',city:'Mirassol'};
 const next=updateCustomerAddress(old,{zipCode:'15130-000',city:'Mirassol'});
 assert.equal(next.address,old.address);assert.equal(next.id,'C1');assert.equal(old.zipCode,undefined);
});
test('rua, número e complemento compõem endereço que acompanha a seleção da OS',()=>{
 const next=updateCustomerAddress({address:'',name:'Cliente',city:'Mirassol',state:'SP'},{street:'Rua Luiz Trabuco',addressNumber:'4166',complement:'Casa 2',neighborhood:'Centro',zipCode:'15133-854'});
 assert.equal(next.street,'Rua Luiz Trabuco');assert.equal(next.addressNumber,'4166');assert.equal(next.address,'Rua Luiz Trabuco, 4166 • Casa 2 • Centro • Mirassol/SP • CEP 15133-854');
 assert.equal(updateCustomerAddress(next,{addressNumber:'S/N'}).address.includes('S/N'),true);
});
test('ajuste manual no endereço completo permanece disponível',()=>{
 assert.equal(updateCustomerAddress({street:'Estrada Rural',address:'Estrada Rural'},{address:'Estrada Rural, km 12, portão azul'}).address,'Estrada Rural, km 12, portão azul');
});
