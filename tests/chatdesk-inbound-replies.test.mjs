import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {canReplyToNewInbound, chatWebhookToken, validChatWebhookToken, parseEvolutionInbound, parseEvolutionDelivery} from '../lib/chatdesk-events.ts';
import {applyChatDeliveryReceipt, completeChatSend} from "../lib/chatdesk-delivery.ts";
import {localTriage, eventReplyPlan} from '../lib/chatdesk-local.ts';
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
  let settings = {botEnabled: true, botActivatedAt: new Date((now-30)*1000).toISOString(), botTestPhone: pilotPhone, companyName:'Empresa de teste'};
  const env = {PROAR_EVOLUTION_AUTOMATION_ENABLED:'true'};
  const handle = runInNewContext(source+'\nPOST', {
    NextResponse:{json:(body, init)=>({body,status:init?.status??200})},
    process:{env}, structuredClone, validChatWebhookToken, parseEvolutionInbound, parseEvolutionDelivery, applyChatDeliveryReceipt, completeChatSend, canReplyToNewInbound, localTriage, eventReplyPlan,
    requiredSecret:()=>secret, assertActiveWhatsAppCompany:async id=>assert.equal(id,tenant),
    evolutionConnection:async()=>({config:{instance}}), chatSettings:async()=>settings,
    recordAppointmentReply:async()=>false, tenantEvolutionAutomationEnabled:async()=>false,
    changeChat:async (_, phone, change)=>{
      const previous=chats.get(phone)??null; const next=change(previous);
      if(next) chats.set(phone,next);
      return {changed:!!next,chat:next??previous};
    },
    dispatchEvolutionJob:async (...args)=>{jobs.push(args);return {status:'accepted',messageId:`fixture-accepted-${jobs.length}`};},
  });
  function webhook(body, token=chatWebhookToken(tenant,secret)) {
    return handle({headers:new Headers({'x-proar-webhook-secret':token}), text:async()=>JSON.stringify(body)}, {params:Promise.resolve({companyId:tenant})});
  }
  async function inbound(id, phone, messageTimestamp, text, token=chatWebhookToken(tenant,secret)) {
    const body = {event:'MESSAGES_UPSERT',instance,data:{
      key:{id,fromMe:false,remoteJid:phone+'@s.whatsapp.net'}, messageTimestamp,
      message:{conversation:text},
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
  assert.match(c.reply,/saindo da unidade de dentro/);
  assert.doesNotMatch(c.reply,/^Olá!|unidade de dentro ou/);
  list.push(automated("reply-c",c,5),incoming("d","É um Elgin, estou em Mirassol",6));
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
