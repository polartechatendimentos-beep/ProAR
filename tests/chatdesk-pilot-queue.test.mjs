import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {stripTypeScriptTypes} from "node:module";
import {runInNewContext} from "node:vm";
import {createHash,randomUUID} from "node:crypto";
import {appendPilotEvents,blankPilotQueue,claimPilotQueue,settlePilotHead,CHAT_INBOUND_LEASE_MS} from "../lib/chatdesk-queue-core.ts";
import {canReplyToNewInbound,chatWebhookToken,validChatWebhookToken,parseEvolutionInbound,parseEvolutionDelivery} from "../lib/chatdesk-events.ts";
import {applyChatDeliveryReceipt,completeChatSend} from "../lib/chatdesk-delivery.ts";
import {localTriage,matchChatAutomation,eventReplyPlan,pilotReplyPlan,handoffSupplementPlan,businessHoursNotice,recordIntakeReply,updateServiceIntake} from "../lib/chatdesk-local.ts";

const id="fixture-pilot", phone="5517999990000", other="5517999990001", instance="test-instance";
const at=Date.parse("2026-11-26T18:30:00Z"), activation=new Date(at-60000).toISOString();
const event=(key,delta=0)=>({id:key,phone,at:new Date(at+delta).toISOString(),text:"Parou de gelar",name:"Teste"});
test("fila ordena o lote, serializa trabalhadores, preserva itens de exceção e ignora duplicados",()=>{
 const start=appendPilotEvents(blankPilotQueue(id),activation,instance,[event("b",1000),event("a"),event("a")]);
 assert.deepEqual(start.pending.map(row=>row.event.id),["a","b"]);
 const locked=claimPilotQueue(start,"owner-a",at);
 assert.equal(claimPilotQueue(locked,"owner-b",at+10),null);
 const resumed=claimPilotQueue(locked,"owner-b",at+CHAT_INBOUND_LEASE_MS+1);
 assert.equal(settlePilotHead(resumed,"owner-a",start.pending[0].key,true,at+CHAT_INBOUND_LEASE_MS+2),null);
 let state=resumed;
 for(let i=0;i<4;i++)state=settlePilotHead(state,"owner-b",start.pending[0].key,false,at+CHAT_INBOUND_LEASE_MS+50_000+i);
 assert.equal(state.failed[0].event.id,"a");
 assert.equal(state.pending[0].event.id,"b");
 assert.equal(appendPilotEvents(state,activation,instance,[event("a")]),null);
 const done=settlePilotHead(state,"owner-b",state.pending[0].key,true,at+CHAT_INBOUND_LEASE_MS+51_000);
 assert.equal(appendPilotEvents(done,activation,instance,[event("b",1000)]),null);
});

const files=["../lib/chatdesk-inbound-worker.ts","../lib/chatdesk-pilot-queue.ts","../app/api/whatsapp/web/events/[companyId]/route.ts"];
const code=stripTypeScriptTypes((await Promise.all(files.map(path=>readFile(new URL(path,import.meta.url),"utf8")))).join("\n")).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
function setup(){
 let now=Date.now(), row=null, enabled=true, queueWriteFails=false, crashOnCompletion=false, uncertain=false, queueConflicts=0, disconnects=0;
 const chats=new Map(), calls=[], work=[], outbox=new Map(), sideEffects=[];
 const settings={botEnabled:true,botActivatedAt:new Date(now-60000).toISOString(),botTestPhone:phone,companyName:"Teste",flows:[]};
 const env={PROAR_WHATSAPP_DURABLE_PILOT:"true",PROAR_WHATSAPP_DURABLE_PILOT_COMPANY_ID:id,PROAR_EVOLUTION_AUTOMATION_ENABLED:"true"};
 const secret="synthetic-key-for-test".repeat(2), token=chatWebhookToken(id,secret);
 class TestDate extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
 const mock=runInNewContext(code+"\n({POST,drainQueuedPilot})",{
  Date:TestDate,structuredClone,createHash,randomUUID,process:{env},
  setTimeout:(callback,ms)=>{now+=ms;callback();},
  NextResponse:{json:(body,init)=>({status:init?.status??200,body})},after:fn=>work.push(fn),
  requiredSecret:()=>secret,validChatWebhookToken,parseEvolutionInbound,parseEvolutionDelivery,applyChatDeliveryReceipt,completeChatSend,canReplyToNewInbound,
  localTriage,matchChatAutomation,eventReplyPlan,pilotReplyPlan,handoffSupplementPlan,businessHoursNotice,recordIntakeReply,updateServiceIntake,
  appendPilotEvents,blankPilotQueue,claimPilotQueue,settlePilotHead,
  assertActiveWhatsAppCompany:async()=>{},evolutionConnection:async()=>({config:{instance}}),tenantEvolutionAutomationEnabled:async()=>false,
  chatDb:async()=>({url:"db",key:"test"}),tenantHeaders:()=>({}),databaseFetch:async()=>({ok:true,json:async()=>row?[{payload:structuredClone(row)}]:[]}),
  commitJsonState:async(_f,_u,_h,_id,previous,payload)=>{
   if(queueWriteFails)return {ok:false,conflict:false};
   if(queueConflicts>0){queueConflicts--;return {ok:false,conflict:true};}
   if(previous?.revision!==row?.revision)return {ok:false,conflict:true};
   row=structuredClone(payload);return {ok:true};
  },
  chatSettings:async()=>({...settings,botEnabled:enabled}),readChat:async(_tenant,address)=>chats.get(address)||null,
  changeChat:async(_tenant,address,fn)=>{
   const previous=chats.get(address)||null,next=fn(previous);
   if(crashOnCompletion&&next?.messages.at(-1)?.status==="accepted"){crashOnCompletion=false;throw new Error("Crash após aceitação do provedor");}
   if(next)chats.set(address,next);
   return {chat:next||previous,changed:Boolean(next)};
  },
  recordAppointmentReply:async(_,e)=>{sideEffects.push(e.id);return false;},
  readEvolutionJobOutcome:async(_,key)=>outbox.get(key)||null,
  dispatchEvolutionJob:async(_,key,address,text,allowed)=>{
   if(allowed&&!await allowed())return {status:"blocked-context"};
   if(outbox.has(key))return {status:"duplicate"};
   if(disconnects>0){disconnects--;return {status:"disconnected"};}
   calls.push({key,address,text});
   if(uncertain){outbox.set(key,{status:"unknown"});throw new Error("Envio sem confirmação");}
   const sent={status:"accepted",messageId:"sent-"+calls.length};
   outbox.set(key,sent);return sent;
  },
 });
 return { env, calls,chats,work,sideEffects,snapshot:()=>structuredClone(row),crash:()=>{crashOnCompletion=true;},uncertain:()=>{uncertain=true;},fail:()=>{queueWriteFails=true;},advance:ms=>{now+=ms;},conflict:()=>{queueConflicts=1;},disable:()=>{enabled=false;},disconnect:()=>{disconnects=1;},
  drain:()=>mock.drainQueuedPilot(id),
  post:(key,address=phone,text="Meu ar condicionado não está gelando",authorized=true)=>mock.POST({headers:new Headers({"x-proar-webhook-secret":authorized?token:"bad"}),text:async()=>JSON.stringify({instance,event:"MESSAGES_UPSERT",data:{key:{id:key,remoteJid:address+"@s.whatsapp.net",fromMe:false},messageTimestamp:Math.floor(now/1000),message:{conversation:text}}})},{params:Promise.resolve({companyId:id})}),
 };
}

test("webhook confirma persistência antes de executar e reentrega/concorrência não duplicam a resposta",async()=>{
 const s=setup();s.conflict();
 assert.equal((await s.post("unauthorized",phone,"teste",false)).status,401);
 assert.equal((await s.post("a")).status,200);
 assert.equal(s.snapshot().pending.length,1);
 assert.equal(s.calls.length,0);
 await s.post("a");await s.post("b",phone,"Uma semana");await s.post("other",other);
 assert.equal(s.snapshot().pending.length,2);
 assert.equal(s.calls.length,0);
 await Promise.all([...s.work].map(fn=>fn()));
 assert.deepEqual(s.calls.map(call=>call.key),["chatbot:"+phone+":a","chatbot:"+phone+":b"]);
 assert.match(s.calls[1].text,/cidade/);
 assert.equal(s.snapshot().pending.length,0);
 assert.equal(s.chats.get(phone).messages.at(-1).status,"accepted");
 assert.equal(s.chats.get(phone).messages.at(-1).deliveryStatus,undefined);
});

test("falha ao gravar a fila não confirma; reinício após aceitação reconcilia e não reenvia",async()=>{
 const fail=setup();fail.fail();
 assert.equal((await fail.post("a")).status,503);
 assert.equal(fail.work.length,0);
 assert.equal(fail.calls.length,0);
 const s=setup();await s.post("a");s.crash();
 await s.drain();
 assert.equal(s.calls.length,1);
 assert.equal(s.snapshot().pending.length,0);
 assert.equal(s.chats.get(phone).messages.at(-1).status,"accepted");
 assert.equal(s.chats.get(phone).messages.at(-1).providerMessageId,"sent-1");
});

test("incerteza não reenvia e opt-out bloqueia reservas ainda não iniciadas",async()=>{
 const s=setup();await s.post("a");s.uncertain();await s.drain();await s.post("a");await s.drain();
 assert.equal(s.calls.length,1);
 assert.equal(s.chats.get(phone).messages.at(-1).status,"unknown");
 const stop=setup();await stop.post("a");await stop.post("exit",phone,"Pare de me enviar mensagens");await stop.drain();
 assert.equal(stop.calls.length,0);
 assert.equal(stop.chats.get(phone).optOut,true);
});

test("fila de piloto desativado ou vencido preserva histórico sem disparar ações",async()=>{
 for(const scenario of ["disabled","expired"]){
  const s=setup();await s.post("a");
  if(scenario==="disabled")s.disable();else s.advance(301_000);
  await s.drain();
  assert.equal(s.calls.length,0);
  assert.equal(s.sideEffects.length,0);
  assert.equal(s.chats.get(phone).messages[0].direction,"in");
 }
});

test("retry seguro só quando a instância não iniciou o envio",async()=>{
 const s=setup();s.disconnect();
 await s.post("a");await s.drain();
 assert.equal(s.calls.length,1);
 assert.equal(s.snapshot().pending.length,0);
 assert.equal(s.chats.get(phone).messages.at(-1).status,"accepted");
});
