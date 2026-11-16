import {createHash} from 'node:crypto';
import {chatDb,readChat,changeChat} from './chatdesk-store';
import {databaseFetch,commitNeonOperationalState,PRIMARY_DATABASE_URL} from './supabase-rest';
import {tenantHeaders} from './tenant-rest';
import {availableSlots,preferredAfter,offerMessage,bookingChatStillEligible,type SchedulePolicy} from './chatdesk-scheduling';
import {prepareDeskAction,actionPhone,type ActionState} from './chatdesk-actions';
import {prepareOperationalState,independentOperationalRows} from './operational-ledger';
import {dispatchEvolutionJob} from './evolution-jobs';
import {localTriage} from './chatdesk-local';
export async function autoSchedule(companyId:string,event:{id:string;phone:string;text:string;at:string},policy:SchedulePolicy){
 if(!policy.enabled||localTriage(event.text).urgent||Date.now()-Date.parse(event.at)>300000)return false;
 const chat=await readChat(companyId,event.phone);
 if(!chat||chat.assignee||chat.botPaused||chat.optOut)return false;
 const choice=/^AGENDAR\s+([a-f0-9]{8})\s+([123])$/i.exec(event.text.trim()),after=preferredAfter(event.text);
 if(!choice&&!after)return false;
 const db=await chatDb(companyId),headers=tenantHeaders(db.key),id=db.dedicated?'main':companyId;
 const read=async()=>{const r=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`,{headers,cache:'no-store'});if(!r.ok)throw Error('Agenda indisponível.');const state=(await r.json())[0]?.payload as ActionState&{_companyId?:string};if(!state||state._companyId!==companyId)throw Error('Empresa divergente.');return state;};
 const send=async(text:string)=>{
  const messageId=`schedule:${event.id}`;
  const reserved=await changeChat(companyId,event.phone,current=>{if(!current||current.assignee||current.botPaused||current.optOut||current.messages.some(m=>m.id===messageId))return null;const next=structuredClone(current);next.messages.push({id:messageId,direction:'out',text,actor:'schedule-assistant',at:new Date().toISOString(),status:'processing'});return next;});
  if(!reserved.changed)return;
  let status='unknown',providerMessageId:string|undefined;
  try{const result=await dispatchEvolutionJob(companyId,messageId,event.phone,text);status=result.status;if(result.status==='accepted')providerMessageId=result.messageId;}catch{}
  await changeChat(companyId,event.phone,current=>{if(!current)return null;const next=structuredClone(current),message=next.messages.find(m=>m.id===messageId);if(message){message.status=status;message.providerMessageId=providerMessageId;}return next;});
 };
 const state=await read();
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(!choice&&!chat.messages.filter(m=>m.direction==='in').slice(-12).some(m=>normalize(m.text).includes(normalize(policy.service)))){await send('Antes de oferecer horários, preciso que a equipe confirme o serviço solicitado.');return true;}

 const customers=state.customers.filter(c=>[c.phone,c.whatsapp].some(v=>{try{return actionPhone(v)===event.phone;}catch{return false;}}));
 if(customers.length!==1||!String(customers[0].address||'').trim()){await send('Para oferecer horários, precisamos conferir seu cadastro e endereço. Um responsável dará continuidade ao agendamento.');return true;}
 const customer=customers[0];
 const requestId=createHash('sha256').update(`${companyId}:${event.phone}:${event.id}`).digest('hex').slice(0,32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
 if(choice){
  for(let attempt=0;attempt<3;attempt++){
   const current=await readChat(companyId,event.phone);
   if(!current||current.assignee||current.botPaused||current.optOut)return true;
   const latest=await read(),prior=latest.serviceOrders.find(o=>o.id===`OS-CHAT-${requestId}`);
   if(prior){await send(`Seu agendamento está registrado: ${prior.date} às ${prior.time}. OS ${prior.id}.`);return true;}
   const offer=current.scheduleOffer,slot=offer?.slots[Number(choice[2])-1];
   if(!offer||offer.id!==choice[1].toLowerCase()||Date.parse(offer.expiresAt)<Date.now()||!slot||offer.customerId!==customer.id||offer.address!==customer.address||JSON.stringify(offer.policy)!==JSON.stringify(policy)){await send('Estas opções expiraram ou os dados mudaram. Informe novamente o período desejado para consultar a agenda.');return true;}
   if(latest.serviceOrders.some(o=>o.customerId===customer.id&&!/cancelad|conclu[ií]d|finalizad/i.test(String(o.status)))){await send('Você já possui um atendimento aberto. A equipe vai conferir se deseja reagendar ou marcar outro serviço.');return true;}
   if(!availableSlots(latest,policy,String(customer.id),offer.address,slot.time).some(s=>s.date===slot.date&&s.time===slot.time)){await send('O horário escolhido não está mais disponível. Informe novamente seu período preferido para consultar outras opções.');return true;}
   const prepared=prepareDeskAction(latest,{kind:'schedule',fields:[String(customer.id),slot.date,slot.time,String(policy.duration),policy.employeeId,policy.service,offer.address]},requestId);
   // Recheck ownership immediately before the operational commit. Never book
   // from a stale conversation snapshot after an operator takeover.
   if(!bookingChatStillEligible(await readChat(companyId,event.phone),current.revision,offer.id))return true;
   const validated=prepareOperationalState(latest,prepared.next,{username:'schedule-assistant',can:p=>p==='os.editar'}),revision=Number(latest._revision||0),payload={...validated,_revision:revision+1,_updatedAt:new Date().toISOString(),_companyId:companyId};
   let saved=false;
   if(db.url===PRIMARY_DATABASE_URL)saved=Boolean(await commitNeonOperationalState(id,revision,payload,independentOperationalRows(companyId,payload,latest)));
   else{const filter=latest._revision===undefined?'payload->>_revision=is.null':`payload->>_revision=eq.${revision}`;const r=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&${filter}`,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({payload,updated_at:payload._updatedAt})});if(!r.ok)throw Error('Gravação indisponível.');saved=(await r.json()).length>0;}
   if(!saved)continue;
   await changeChat(companyId,event.phone,c=>{if(!c)return null;const next=structuredClone(c);next.orderId=String(prepared.record.id);delete next.scheduleOffer;return next;});
   await send(`Agendamento registrado para ${slot.date.split('-').reverse().join('/')} às ${slot.time}, em ${offer.address}. Serviço: ${policy.service}. OS ${prepared.record.id}. Para alterar, fale com a equipe.`);return true;
  }
  throw Error('Agenda alterada durante a reserva.');
 }
 if(state.serviceOrders.some(o=>o.customerId===customer.id&&!/cancelad|conclu[ií]d|finalizad/i.test(String(o.status)))){await send('Você já possui um atendimento aberto. A equipe vai conferir se deseja reagendar ou marcar outro serviço.');return true;}
 const offer={id:requestId.replace(/-/g,'').slice(0,8),customerId:String(customer.id),address:String(customer.address),policy,expiresAt:new Date(Date.now()+900000).toISOString(),slots:availableSlots(state,policy,String(customer.id),String(customer.address),after!)};
 if(!offer.slots.length){await send('Não encontrei horários nesse período nos próximos 15 dias. Vou deixar o pedido para a equipe conferir outras datas.');return true;}
 const offered=await changeChat(companyId,event.phone,c=>{if(!c||c.assignee||c.botPaused||c.optOut||c.messages.some(m=>m.id===`schedule:${event.id}`))return null;const next=structuredClone(c);next.scheduleOffer=offer;return next;});
 if(offered.changed)await send(offerMessage(offer));return true;
}
