import test from 'node:test';
import assert from 'node:assert/strict';
import {localTriage,chatQueuePriority,chatQueueSummary,sortChatQueue,validateChatQuickReplies,defaultChatQuickReplies} from '../lib/chatdesk-local.ts';
import {chatCustomerContext} from '../lib/chatdesk-actions.ts';
const chat=(phone,messages,stage='Novo contato')=>({companyId:'A',phone,name:phone,sector:'Técnico',stage,assignee:'',revision:1,botPaused:false,optOut:false,messages,requests:['private-request'],updatedAt:messages.at(-1)?.at||'2026-11-12T10:00:00Z'});
const incoming=(text,at='2026-11-12T10:00:00Z')=>({id:'in',direction:'in',text,at});
const clock=Date.parse('2026-11-12T12:00:00Z');
test('queue summary preserves waiting/urgency across notes, events and bot replies without exposing notes in previews',()=>{
 const full=chat('5517999990000',[incoming('A tomada está derretendo'),{id:'note',direction:'note',text:'Nota sigilosa da equipe',at:'2026-11-12T10:10:00Z'},{id:'bot',direction:'out',actor:'local-assistant',text:'Aguarde um profissional',at:'2026-11-12T10:12:00Z'}]);
 const summary=chatQueueSummary(full);
 assert.equal(chatQueuePriority(summary,clock).urgent,true);assert.equal(chatQueuePriority(summary,clock).waitingMinutes,120);
 assert.equal(JSON.stringify(summary).includes('Nota sigilosa'),false);assert.deepEqual(summary.requests,[]);
 const answered=chatQueueSummary({...full,messages:[...full.messages,{id:'human',direction:'out',actor:'maria',text:'Vamos verificar',at:'2026-11-12T10:15:00Z'},{id:'note2',direction:'note',text:'Nota nova',at:'2026-11-12T10:20:00Z'}]});
 assert.equal(chatQueuePriority(answered,clock).waiting,false);
 const failed=chatQueueSummary({...full,messages:[...full.messages,{id:'failed',direction:'out',actor:'maria',text:'Sem aceite',status:'unknown',at:'2026-11-12T10:15:00Z'}]});assert.equal(chatQueuePriority(failed,clock).waiting,true);
 const closed={...summary,phone:'5517999990001',stage:'Concluído'};
 assert.equal(chatQueuePriority(closed,clock).urgent,false);
 assert.deepEqual(sortChatQueue([closed,answered,summary],clock).map(item=>item.phone),[summary.phone,answered.phone,closed.phone]);
});
test('queue does not invent waiting time from invalid or future timestamps',()=>{
 assert.equal(chatQueuePriority(chat('5517999990000',[incoming('Oi','invalid')]),clock).waiting,false);
 assert.equal(chatQueuePriority(chat('5517999990000',[incoming('Oi','2026-11-13T10:00:00Z')]),clock).waitingMinutes,0);
});
test('quick replies validate unique shortcuts, sectors and bounded texts and retain safe defaults',()=>{
 assert.equal(validateChatQuickReplies(defaultChatQuickReplies).length,4);
 const item={shortcut:'/agenda',sector:'Todos',text:'Vou consultar os horários.'};
 for(const value of [[item,item],[{...item,shortcut:'bad'}],[{...item,sector:'Outro'}],[{...item,text:'x'}],Array(31).fill(item)])assert.throws(()=>validateChatQuickReplies(value));
 assert.deepEqual(validateChatQuickReplies([]),[]);
 assert.equal(validateChatQuickReplies([{...item,shortcut:' /AGENDA '}])[0].shortcut,'/agenda');
});
test('extended opt-out and electrical risk recognition preserves service cancellation intent',()=>{
 for(const text of ['Não me mande mais mensagens','Retire meu número da lista','Pare de mandar mensagens'])assert.equal(localTriage(text).optOut,true);
 for(const text of ['A tomada está derretendo','Disjuntor desarmando quando ligo o ar','Fios estão derretendo'])assert.equal(localTriage(text).urgent,true);
 assert.equal(localTriage('Quero cancelar a visita').optOut,false);
 assert.equal(localTriage('Higienização do ar').sector,'Técnico');
});
test('customer context matches canonical phone, excludes other customers and refuses ambiguous links',()=>{
 const state={customers:[{id:'C1',name:'Maria',phone:'(17) 99999-0000',address:'Rua A'},{id:'C2',name:'José',phone:'17988880000'}],serviceOrders:[{id:'OS-1',customerId:'C1',date:'2026-12-01',service:'Preventiva'},{id:'OS-2',customerId:'C2',date:'2026-12-02',service:'Privado'}],moduleRecords:{Equipamentos:[{id:'E1',customerId:'C1',name:'Split',brand:'Elgin',serialNumber:'123'},{id:'E2',customerId:'C2',name:'Outro'}]}};
 const context=chatCustomerContext(state,'5517999990000');assert.equal(context.customer.id,'C1');assert.equal(context.orderCount,1);assert.equal(context.equipmentCount,1);assert.equal(JSON.stringify(context).includes('Privado'),false);
 assert.equal(chatCustomerContext(state,'5517997770000').customer,null);
 state.customers.push({id:'C3',name:'Outra pessoa',phone:'5517999990000'});
 const ambiguous=chatCustomerContext(state,'5517999990000');assert.equal(ambiguous.ambiguous,true);assert.deepEqual(ambiguous.orders,[]);assert.deepEqual(ambiguous.equipment,[]);
});
