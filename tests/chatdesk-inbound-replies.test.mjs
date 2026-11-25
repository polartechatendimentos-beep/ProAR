import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {canReplyToNewInbound, chatWebhookToken, validChatWebhookToken, parseEvolutionInbound, parseEvolutionDelivery} from '../lib/chatdesk-events.ts';
import {applyChatDeliveryReceipt, completeChatSend} from "../lib/chatdesk-delivery.ts";
import {localTriage, eventReplyPlan, pilotReplyPlan, updateServiceIntake, chatQueuePriority, chatQueueSummary} from '../lib/chatdesk-local.ts';
import {tenantSlugFromHost} from "../lib/tenant-host.ts";

test('first-response eligibility excludes old, future, media-only, and courtesy messages', () => {
  const now = Date.parse('2026-11-25T15:10:00Z');
  const input = {
    activatedAt: '2026-11-25T15:00:00Z', eventAt: '2026-11-25T15:09:00Z',
    phone: '5517999990000', text: 'Preciso de orçamento para instalação',
  };
  assert.equal(canReplyToNewInbound(input, now), true);
  for (const change of [
    {eventAt: '2026-11-25T14:59:59Z'}, {eventAt: '2026-11-25T15:00:00Z'},
    {eventAt: '2026-11-25T15:04:59Z'}, {eventAt: '2026-11-25T15:10:01Z'},
    {testPhone:'5517999990001'}, {text:'Muito obrigada!'}, {text:' '},
    {text:'Mensagem sem texto. Consulte o anexo no WhatsApp.'},
  ]) assert.equal(canReplyToNewInbound({...input, ...change}, now), false);
});

test('authenticated arrival can answer immediately with the reminders switch off', async () => {
  const file = new URL('../app/api/whatsapp/web/events/[companyId]/route.ts', import.meta.url);
  const source = stripTypeScriptTypes(await readFile(file, 'utf8')).replace(/^import .*;$/gm, '').replace(/^export /gm, '');
  const secret = 'fixture-only-secret'.repeat(2);
  const tenant = 'fixture-a', instance = 'fixture-instance';
  const pilotPhone = '5517999990000', otherPhone = '5517999990001';
  const chats = new Map(), jobs = [];
  const now = Math.floor(Date.now() / 1000) - 4;
  let bookingFailure = false, appointmentHandled = false, failReservation = false, failDispatch = false;
  let settings = {botEnabled: true, botActivatedAt: new Date((now-30)*1000).toISOString(), botTestPhone: pilotPhone, companyName:'Empresa de teste'};
  const env = {PROAR_EVOLUTION_AUTOMATION_ENABLED:'true'};
  const handle = runInNewContext(source+'\nPOST', {
    NextResponse:{json:(body, init)=>({body,status:init?.status??200})},
    process:{env}, structuredClone, validChatWebhookToken, parseEvolutionInbound, parseEvolutionDelivery, applyChatDeliveryReceipt, completeChatSend, canReplyToNewInbound, localTriage, eventReplyPlan, pilotReplyPlan, updateServiceIntake,
    requiredSecret:()=>secret, assertActiveWhatsAppCompany:async id=>assert.equal(id,tenant),
    evolutionConnection:async()=>({config:{instance}}), chatSettings:async()=>settings,
    recordAppointmentReply:async()=>{if(bookingFailure)throw new Error("Sem agenda");return appointmentHandled;}, tenantEvolutionAutomationEnabled:async()=>false,
    changeChat:async (_, phone, change)=>{
      const previous=chats.get(phone)??null; const next=change(previous);
      if (next?.messages.at(-1)?.status === "processing" && failReservation) { failReservation=false; throw new Error("Fila indisponível"); }
      if(next) chats.set(phone,next);
      return {changed:!!next,chat:next??previous};
    },
    dispatchEvolutionJob:async (...args)=>{jobs.push(args);if(failDispatch)throw new Error('Envio incerto');return {status:'accepted',messageId:`fixture-accepted-${jobs.length}`};},
  });
  function webhook(body, token=chatWebhookToken(tenant,secret)) {
    return handle({headers:new Headers({'x-proar-webhook-secret':token}), text:async()=>JSON.stringify(body)}, {params:Promise.resolve({companyId:tenant})});
  }
  async function inbound(id, phone, messageTimestamp, text, token=chatWebhookToken(tenant,secret), replyToId) {
    const body = {event:'MESSAGES_UPSERT',instance,data:{
      key:{id,fromMe:false,remoteJid:phone+'@s.whatsapp.net'}, messageTimestamp,
      message:replyToId ? {extendedTextMessage:{text,contextInfo:{stanzaId:replyToId,quotedMessage:{conversation:"Boleto de outra conversa"}}}} : {conversation:text},
    }};
    return webhook(body, token);
  }
  assert.equal((await inbound('unsigned',pilotPhone,now,'Instalação','invalid')).status,401);
  await inbound('old',pilotPhone,now-200,'Orçamento de instalação');
  await inbound('other',otherPhone,now,'Orçamento de instalação');
  assert.equal(jobs.length,0);
  assert.equal(chats.get(pilotPhone).messages.length,1);
  assert.equal(chats.get(otherPhone).messages.length,1);
  await inbound('new',pilotPhone,now,'Orçamento de instalação');
  await inbound('new',pilotPhone,now,'Orçamento de instalação');
  assert.equal(jobs.length,1);
  assert.equal(jobs[0][2],pilotPhone);
  assert.match(jobs[0][3],/preparar seu orçamento/);
  assert.equal(chats.get(pilotPhone).messages.at(-1).status,'accepted');
  const receipt={event:'messages.update',instance,data:{keyId:'fixture-accepted-1',remoteJid:pilotPhone+'@s.whatsapp.net',fromMe:true,status:'DELIVERY_ACK'}};
  assert.equal(chats.get(pilotPhone).messages.at(-1).deliveryStatus,undefined);
  assert.equal((await webhook(receipt, chatWebhookToken("fixture-b",secret))).status,401);
  assert.equal((await webhook({...receipt,instance:"wrong"})).status,403);
  assert.equal((await webhook({...receipt,data:{...receipt.data,fromMe:false}})).body.receipts,0);
  await webhook({...receipt,data:{...receipt.data,remoteJid:otherPhone+'@s.whatsapp.net'}});
  await webhook({...receipt,data:{...receipt.data,status:'SERVER_ACK'}});
  assert.equal(chats.get(pilotPhone).messages.at(-1).deliveryStatus,undefined);
  assert.equal((await webhook(receipt)).body.receipts,1);
  await webhook(receipt);
  await webhook({...receipt,data:{...receipt.data,status:'ERROR'}});
  assert.equal(chats.get(pilotPhone).messages.at(-1).deliveryStatus,'delivered');
  assert.equal(jobs.length,1);

  await inbound('context',pilotPhone,now+1,'22 mil');
  assert.equal(jobs.length,2);
  assert.match(jobs[1][3],/cidade e o bairro/);
  assert.doesNotMatch(jobs[1][3],/BTUs/);
  await inbound('repeated-context',pilotPhone,now+2,'22 mil');
  assert.equal(jobs.length,2);
  settings = {...settings,botTestPhone:''};
  chats.get(otherPhone).assignee = 'tecnico';
  await inbound('claimed',otherPhone,now,'Orçamento de instalação');
  assert.equal(jobs.length,2);
  chats.get(otherPhone).assignee = '';
  env.PROAR_EVOLUTION_AUTOMATION_ENABLED = 'false';
  await inbound('globally-disabled',otherPhone,now,'Orçamento de instalação');
  assert.equal(jobs.length,2);

  env.PROAR_EVOLUTION_AUTOMATION_ENABLED = 'true';
  settings = {...settings,botTestPhone:pilotPhone};
  chats.delete(pilotPhone);
  const instant = () => Math.floor(Date.now()/1000);
  await inbound('greeting',pilotPhone,instant(),'Oi');
  await inbound('leak-report',pilotPhone,instant(),'Ar condicionado pingando');
  await inbound('short-location',pilotPhone,instant(),'Dentro');
  await inbound('short-location',pilotPhone,instant(),'Dentro');
  assert.equal(jobs.length,5);
  assert.match(jobs[3][3],/unidade de dentro ou da unidade de fora/);
  assert.match(jobs[4][3],/pingando pela unidade de dentro/);
  await inbound('town-and-neighborhood',pilotPhone,instant(),'Sou de Bálsamo bairro Centro');
  await inbound('institution',pilotPhone,instant(),'Escola municipal');
  await inbound('institution',pilotPhone,instant(),'Escola municipal');
  await inbound('unit-name',pilotPhone,instant(),'escola modesto de bálsamo');
  await inbound('room-number',pilotPhone,instant(),'3');
  assert.match(jobs[8][3],/Desde quando/);
  await inbound('details',pilotPhone,instant(),'Desde ontem, é um Elgin');
  assert.equal(jobs.length,10);
  assert.match(jobs[2][3],/^Assistente virtual/);
  assert.doesNotMatch(jobs[5][3],/cidade|bairro|Assistente virtual/);
  assert.match(jobs[6][3],/Qual é o nome da escola ou o endereço/);
  assert.equal(jobs[7][3],'Em qual sala ou setor fica o aparelho?');
  assert.match(jobs[9][3],/encaminhei para nossa equipe/);
  const handoff = chats.get(pilotPhone);
  assert.equal(handoff.sector,'Técnico');
  assert.equal(handoff.intake.city,'Bálsamo');
  assert.equal(handoff.intake.district,'Centro');
  assert.equal(handoff.intake.site,'escola modesto de bálsamo');
  assert.equal(handoff.intake.room,'3');
  assert.equal(handoff.intake.since,'Desde ontem');
  assert.equal(handoff.botPaused,true);
  assert.equal(chatQueuePriority(chatQueueSummary(handoff),Date.now()).handoff,true);
  await inbound('on-handoff',pilotPhone,instant(),'Tem como vir amanhã?');
  assert.equal(jobs.length,10);
  assert.equal(chats.get(pilotPhone).messages.at(-1).id,'on-handoff');
  await inbound('nudge-on-handoff',pilotPhone,instant(),'.');
  assert.equal(jobs.length,10);

  // Reproduce the live timeline: the school name was received before the
  // release and not replied to. Only the fresh point may trigger a reply.
  const chat = chats.get(pilotPhone);
  const at = (minutes) => new Date((instant()-60*minutes)*1000).toISOString();
  const row = (id,text,minutes,fields={})=>({id,text,at:at(minutes),direction:"in",...fields});
  Object.assign(chat,{messages:[
    row('symptom','Ar condicionado pingando',37),
    row('old-question','A água está saindo da unidade de dentro ou da unidade de fora?',37,{direction:"out",actor:"local-assistant",status:"accepted",assistantReplyKey:"leak:where"}),
    row('where','Dentro',37),
    row('recent-symptom','Ar condicionado pingando',27),
    row('place','Sou de Bálsamo bairro Centro',27),
    row('school-type','Escola municipal',27),
    row('school-name','Escola modesto de bálsamo',20),
  ],botPaused:false,assistantHandoffAt:undefined,intake:undefined});
  settings = {...settings,botActivatedAt:at(14)};
  await inbound('unmatched-nudge',pilotPhone,instant(),'.',undefined,'elsewhere');
  assert.equal(jobs.length,10);
  await inbound('school-nudge',pilotPhone,instant(),'.',undefined,'school-name');
  await inbound('school-nudge',pilotPhone,instant(),'.',undefined,'school-name');
  await inbound('new-punctuation',pilotPhone,instant(),'…');
  assert.equal(jobs.length,11);
  assert.equal(jobs[10][3],'Em qual sala ou setor fica o aparelho?');
  assert.equal(chats.get(pilotPhone).messages.find(m=>m.id==='school-nudge').replyToId,'school-name');
  await inbound('short-room-after-nudge',pilotPhone,instant(),'3');
  assert.equal(jobs.length,12);
  assert.match(jobs[11][3],/Desde quando/);
  await inbound('details-after-nudge',pilotPhone,instant(),'Não sei a marca');
  assert.equal(jobs.length,13);
  assert.match(jobs[12][3],/encaminhei para nossa equipe/);

  chats.delete(pilotPhone);
  const mediaWebhook={event:'MESSAGES_UPSERT',instance,data:{
    key:{id:'pilot-photo',fromMe:false,remoteJid:pilotPhone+'@s.whatsapp.net'}, messageTimestamp:instant(),
    message:{imageMessage:{mimetype:"image/jpeg"}},
  }};
  await webhook(mediaWebhook);
  await webhook(mediaWebhook);
  assert.equal(jobs.length,14);
  assert.match(jobs[13][3],/se ela mostra a etiqueta ou o problema/);
  assert.equal(chats.get(pilotPhone).intake.media,"foto");
  assert.equal(chats.get(pilotPhone).intake.symptom,undefined);
  await inbound('vague',pilotPhone,instant(),'Isso aí');
  assert.match(jobs[14][3],/contar um pouco mais/);
  await inbound('still-vague',pilotPhone,instant(),'Aquilo lá');
  assert.match(jobs[15][3],/encaminhei para nossa equipe/);

  chats.delete(pilotPhone);
  bookingFailure=true;
  assert.equal((await inbound('booking-failure',pilotPhone,instant(),'CONFIRMAR OS-123')).status,200);
  assert.match(jobs[16][3],/Não consegui concluir a confirmação/);
  assert.equal(chats.get(pilotPhone).botPaused,true);
  bookingFailure=false;
  appointmentHandled=true;
  chats.delete(pilotPhone);
  await inbound('booking-success',pilotPhone,instant(),'CONFIRMAR OS-123');
  assert.match(jobs[17][3],/Registrei sua resposta/);
  assert.doesNotMatch(jobs[17][3],/agendado|reservado/);
  await inbound('booking-success',pilotPhone,instant(),'CONFIRMAR OS-123');
  assert.equal(jobs.length,18);
  appointmentHandled=false;
  await inbound('unknown-price',pilotPhone,instant(),'Quanto custa para instalar?');
  assert.match(jobs[18][3],/confirmar essa informação com a equipe/);
  assert.doesNotMatch(jobs[18][3],/R\$/);
  chats.delete(pilotPhone);
  await inbound('schedule-request',pilotPhone,instant(),'Quero agendar uma visita');
  assert.match(jobs[19][3],/Nenhum horário foi reservado/);
  chats.delete(pilotPhone);
  await inbound('unplug-risk',pilotPhone,instant(),'Tem água perto da tomada');
  assert.match(jobs[20][3],/apenas se puder fazer isso sem contato com água/);
  assert.equal(chatQueuePriority(chatQueueSummary(chats.get(pilotPhone)),Date.now()).handoff,true);

  chats.delete(pilotPhone);
  failReservation=true;
  const stamp=instant();
  assert.equal((await inbound('repairable',pilotPhone,stamp,'Oi')).status,503);
  assert.equal(jobs.length,21);
  assert.equal(chats.get(pilotPhone).messages.length,1);
  assert.equal((await inbound('repairable',pilotPhone,stamp,'Oi')).status,200);
  assert.equal(jobs.length,22);
  assert.match(jobs[21][3],/Como posso ajudar/);

  failDispatch=true;
  assert.equal((await inbound('do-not-retry',pilotPhone,instant(),'Quero instalar um ar')).status,200);
  assert.equal(chats.get(pilotPhone).messages.at(-1).status,'unknown');
  await inbound('do-not-retry',pilotPhone,instant(),'Quero instalar um ar');
  assert.equal(jobs.length,23);
  assert.equal(chatQueuePriority(chatQueueSummary(chats.get(pilotPhone)),Date.now()).deliveryIssue,'uncertain');


});

test('provisioning verifies the tenant origin and leaves other provider instances unchanged', async () => {
  const file = new URL('../app/api/atendimento/recebimento/route.ts', import.meta.url);
  const source = stripTypeScriptTypes(await readFile(file, 'utf8')).replace(/^import .*;$/gm, '').replace(/^export /gm, '');
  let lastWebhook, writeCount=0;
  const handle = runInNewContext(source+'\nPOST', {
    URL, process:{env:{PROAR_WHATSAPP_WEBHOOK_BASE_URL:'https://proar.online'}}, tenantSlugFromHost, chatWebhookToken,
    NextResponse:{json:(body, init)=>({body,status:init?.status??200})},
    chatAccess:()=>({companyId:'fixture-a',actor:{admin:true},session:{companySlug:'empresa-a'}}),
    assertActiveWhatsAppCompany:async id=>assert.equal(id,'fixture-a'),
    evolutionConnection:async id=>({config:{id}}), requiredSecret:()=> 'fixture-secret'.repeat(3),
    evolutionRequestWithConfig:async (config,action,payload)=>{
      assert.equal(config.id,'fixture-a');
      if(action==='webhook/set'){lastWebhook=payload.webhook;writeCount++;}
      return {webhook:lastWebhook};
    },
  });
  function configure(origin) {
    return handle({nextUrl:new URL(origin),headers:new Headers({origin,'sec-fetch-site':'same-origin'})});
  }
  assert.equal((await configure('https://empresa-b.proar.online')).status,403);
  assert.equal(writeCount,0);
  assert.equal((await configure('https://empresa-a.proar.online')).status,200);
  assert.equal(lastWebhook.url,'https://empresa-a.proar.online/api/whatsapp/web/events/fixture-a');
  assert.deepEqual(Array.from(lastWebhook.events),['MESSAGES_UPSERT','MESSAGES_UPDATE']);
  assert.equal((await configure('https://proar.online')).status,200);
  assert.equal(lastWebhook.url,'https://proar.online/api/whatsapp/web/events/fixture-a');
  assert.equal(writeCount,2);
});

test('leak follow-up advances the conversation immediately without repeating the same response', () => {
  const start = Date.parse("2026-11-25T15:00:00Z");
  const now = start + 10_000, since = new Date(start).toISOString();
  const at = n => new Date(start + n*1000).toISOString();
  const incoming = (id,text,n) => ({id,text,direction:"in",at:at(n)});
  const automated = (id,plan,n) => ({id,text:plan.reply,direction:"out",actor:"local-assistant",at:at(n),assistantReplyKey:plan.key});
  const list = [incoming("a","Meu ar está pingando",1)];
  const a = eventReplyPlan(list,"a",since,now);
  assert.equal(localTriage(list[0].text).sector,"Técnico");
  assert.match(a.reply,/unidade de dentro ou da unidade de fora/);
  list.push(automated("reply-a",a,2),incoming("b","Preciso de ajuda, meu ar está pingando",3));
  assert.equal(eventReplyPlan(list,"b",since,now),null);
  list.push(incoming("c","É pela unidade de dentro",4));
  const c = eventReplyPlan(list,"c",since,now);
  assert.equal(c.first,false);
  assert.match(c.reply,/pingando pela unidade de dentro/);
  assert.doesNotMatch(c.reply,/^Olá!|unidade de dentro ou/);
  list.push(automated("reply-c",c,5),incoming("d","É um Elgin, estou em Mirassol no bairro Centro",6));
  const d = eventReplyPlan(list,"d",since,now);
  assert.equal(d.key,"leak:complete");
  assert.doesNotMatch(d.reply,/Elgin|Mirassol|horário/);
  list.push(automated("reply-d",d,7),incoming("e","Tem cheiro de queimado",8));
  assert.match(eventReplyPlan(list,"e",since,now).reply,/interrompa o uso/);
  const chase = incoming("f", "Não esquece de mim! Algum retorno?", 9);
  assert.equal(eventReplyPlan([chase], "f", since, now), null);
});

test('installation follow-up uses a new BTU detail instead of asking for it again', () => {
  const since="2026-11-25T15:00:00Z", now=Date.parse("2026-11-25T15:01:00Z");
  const initial={id:"i",direction:"in",at:"2026-11-25T15:00:05Z",text:"Vocês fazem instalação?"};
  const first=eventReplyPlan([initial],"i",since,now);
  assert.match(first.reply,/capacidade do aparelho em BTUs/);
  const messages=[initial,{id:"out",direction:"out",actor:"local-assistant",text:first.reply,assistantReplyKey:first.key,at:"2026-11-25T15:00:06Z"},{id:"j",direction:"in",text:"22 mil",at:"2026-11-25T15:00:07Z"}];
  const second=eventReplyPlan(messages,"j",since,now);
  assert.match(second.reply,/cidade e o bairro/);
  assert.doesNotMatch(second.reply,/BTUs|^Olá!/);
});

test('short answers are grounded in the immediately preceding accepted assistant question', () => {
  const since="2026-11-25T22:00:00Z", now=Date.parse("2026-11-25T22:30:20Z");
  const at = (n) => new Date(now-8000+n).toISOString();
  const input = (id,text,n) => ({id,text,direction:"in",at:at(n)});
  const prompt = (key,n,props={}) => ({id:"reply"+n,text:"Pergunta",direction:"out",at:at(n),actor:"local-assistant",assistantReplyKey:key,status:"accepted",...props});
  const a = input("start","Ar condicionado pingando",1);
  const where = prompt("leak:where",250);
  const short = input("short","Dentro!",200);
  assert.equal(eventReplyPlan([a,where,short],"short",since,now).key,"leak:inside");
  assert.equal(eventReplyPlan([a,where,{...short,text:"Fora"}],"short",since,now).key,"leak:outside");
  assert.equal(eventReplyPlan([a,where,{...short,text:"Nas duas"}],"short",since,now).key,"leak:both");
  assert.equal(eventReplyPlan([a,where,{...short,text:"Sim"}],"short",since,now).key,"leak:clarify");
  assert.equal(eventReplyPlan([a,where,{...short,at:at(-1001)}],"short",since,now),null);
  assert.equal(eventReplyPlan([a,{...where,deliveryStatus:"failed"},short],"short",since,now),null);
  assert.equal(eventReplyPlan([a,where,input("other","Vocês fazem instalação?",270),short],"short",since,now),null);
  assert.equal(eventReplyPlan([short],"short",since,now),null);
  const done = input("place","É um Elgin, estou em Mirassol no bairro Centro",400);
  assert.equal(eventReplyPlan([a,where,short,prompt("leak:inside",300),done],"place",since,now).key,"leak:complete");
  const outside = {...short,text:"Fora"};
  const on = input("timing","Só ligado",400);
  assert.equal(eventReplyPlan([a,where,outside,prompt("leak:outside",300),on],"timing",since,now).key,"leak:place");
  const install = input("install","Instalação de 12 mil em Mirassol",1);
  const yes = input("yes","Sim",400);
  const plan = eventReplyPlan([install,prompt("installation:110",300),yes],"yes",since,now);
  assert.equal(plan.key,"installation:111");
  assert.doesNotMatch(plan.reply,/preço|horário confirmado/i);
});

test('town, neighborhood and site details progress separately in natural service messages', () => {
  const since="2026-11-25T22:00:00Z", now=Date.parse("2026-11-25T22:01:00Z");
  const m = (id,text,offset) => ({id,text,direction:"in",at:new Date(now-30000+offset*1000).toISOString()});
  const a=m("symptom","Está pingando pela unidade interna",1), b=m("town","Bálsamo",2), c=m("district","Centro",3), d=m("school","Escola municipal",4), e=m("room","Sala 12",5);
  const idea = (messages,turn) => eventReplyPlan(messages,turn.id,since,now);
  assert.equal(idea([a,b],b).key,"leak:neighborhood");
  assert.equal(idea([a,c],c).key,"leak:city");
  assert.equal(idea([a,b,c],c).key,"leak:brand");
  assert.equal(idea([a,b,c,d],d).reply,"Qual é o nome da escola?");
  assert.equal(idea([a,b,c,{...d,text:"Escola Municipal Aurora"},e],e).key,"leak:complete");
  assert.equal(idea([d],d).key,"sector:Geral");
});

test('an unknown needed detail or explicit request for a person flags a real handoff, not a repeated question', () => {
  const since="2026-11-25T22:00:00Z", now=Date.parse("2026-11-25T22:01:00Z");
  const a={id:"ask",direction:"out",actor:"local-assistant",assistantReplyKey:"leak:school",status:"accepted",at:"2026-11-25T22:00:02Z",text:"Qual é o nome da escola?"};
  const b={id:"answer",direction:"in",at:"2026-11-25T22:00:04Z",text:"Não lembro o nome"};
  assert.equal(eventReplyPlan([a,b],b.id,since,now).handoff,true);
  assert.equal(eventReplyPlan([{...b,text:"Pode me ligar?"}],b.id,since,now).handoff,true);
  assert.equal(eventReplyPlan([a,{...b,text:"Pode parar de enviar mensagens?"}],b.id,since,now),null);
});

test('a plain point uses the latest pending service but does not start an unrelated or handled chat', () => {
  const since="2026-11-25T22:22:00Z", now=Date.parse("2026-11-25T22:36:00Z");
  const m=(id,text,minute,fields={})=>({id,text,direction:"in",at:new Date(now-minute*60000).toISOString(),...fields});
  const point=m("p",".",0);
  const details=[m("report","Está pingando pela unidade de dentro",27),m("location","Sou de Bálsamo bairro Centro",27),m("school","Escola Modesto de Bálsamo",20)];
  const plan=(rows,event=point)=>eventReplyPlan([...rows,event],event.id,since,now);
  assert.equal(plan(details).key,"leak:site-room");
  assert.equal(plan([]),null);
  assert.equal(plan([m("note","Oi",3)]),null);
  assert.equal(plan([m("old","Ar condicionado pingando",46)]),null);
  assert.equal(plan([...details,m("human","Qual a sala?",1,{direction:"out",actor:"atendente"})]),null);
  const answered=m("asked","Em qual sala ou setor fica o aparelho?",2,{direction:"out",actor:"local-assistant",assistantReplyKey:"leak:site-room",providerMessageId:"wa-asked",status:"accepted"});
  assert.equal(plan([...details,answered],{...point,replyToId:"wa-asked"}).key,"leak:site-room");
  assert.equal(plan([...details,{...answered,assistantNudge:true}]),null);
  assert.equal(plan([...details,m("unrelated","Preciso instalar um ar de 12 mil",1)],{...point,replyToId:"school"}),null);
});

test('technical intake advances terse turns without repeating collected location data', () => {
  const now = Date.parse("2026-11-25T22:55:00Z"), since="2026-11-25T22:50:00Z";
  const messages=[];
  let intake;
  const step=(id,text,mediaKind)=>{
    const at=new Date(now-30_000+messages.length*1000).toISOString();
    messages.push({id,text,mediaKind,at,direction:"in"});
    intake=updateServiceIntake(intake,messages,id);
    const plan=pilotReplyPlan(messages,id,since,now,false,false,intake);
    if(plan) messages.push({id:"r"+id,text:plan.reply,at,direction:"out",actor:"local-assistant",status:"accepted",assistantReplyKey:plan.key});
    return plan;
  };
  assert.match(step("1","Meu ar não gela").reply,/Desde quando/);
  assert.match(step("2","Desde ontem").reply,/cidade e bairro/);
  assert.match(step("3","Sou de Bálsamo, bairro Centro").reply,/endereço ou o nome da unidade/);
  assert.match(step("4","Rua Central, 171").reply,/marca ou o modelo/);
  assert.equal(step("5","É Elgin").handoff,true);
  assert.equal(intake.appliance,"elgin");
  assert.equal(intake.city,"Bálsamo");
  assert.equal(intake.district,"Centro");
  assert.deepEqual(intake.pending,[]);
});
