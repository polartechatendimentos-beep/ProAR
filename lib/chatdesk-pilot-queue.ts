import { createHash, randomUUID } from "node:crypto";
import { chatDb, chatSettings } from "./chatdesk-store";
import { databaseFetch } from "./supabase-rest";
import { tenantHeaders } from "./tenant-rest";
import { commitJsonState } from "./state-commit";
import { evolutionConnection } from "./evolution-tenant";
import { appendPilotEvents, blankPilotQueue, claimPilotQueue, settlePilotHead, type PilotQueue } from "./chatdesk-queue-core";
import { canReplyToNewInbound, type EvolutionInboundEvent } from "./chatdesk-events";
import { processInboundEvent } from "./chatdesk-inbound-worker";

const idFor = (companyId:string) => "chatdesk-inbound-v1:"+createHash("sha256").update(companyId).digest("hex");
export const durablePilotEnabled = (companyId:string) => Boolean(companyId && process.env.PROAR_WHATSAPP_DURABLE_PILOT_COMPANY_ID === companyId
  && process.env.PROAR_WHATSAPP_DURABLE_PILOT === "true" && process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED === "true");
async function store(companyId:string) {
  const db=await chatDb(companyId),headers=tenantHeaders(db.key),id=idFor(companyId);
  const read=async () => {
    const response=await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${encodeURIComponent(id)}&limit=1`,{headers,cache:"no-store"});
    if(!response.ok)throw new Error("Não foi possível consultar a fila de atendimento.");
    const rows=await response.json() as {payload:PilotQueue}[];
    const state=rows[0]?.payload||null;
    if(state&&state.companyId!==companyId)throw new Error("Fila de outra empresa.");
    return state;
  };
  return {read,async change(transform:(state:PilotQueue)=>PilotQueue|null) {
    for(let attempt=0;attempt<8;attempt++){
      const previous=await read(), next=transform(previous||blankPilotQueue(companyId));
      if(!next)return null;
      next.revision=(previous?.revision||0)+1;
      const result=await commitJsonState(databaseFetch,db.url,headers,id,previous as unknown as Record<string,unknown>|null,next as unknown as Record<string,unknown>);
      if(result.ok)return next;
      if(!result.conflict)throw new Error("Não foi possível salvar a fila de atendimento.");
    }
    throw new Error("Fila de atendimento concorrente. Tente novamente.");
  }};
}
export async function enqueuePilotEvents(companyId:string,activation:string,instance:string,events:EvolutionInboundEvent[]){
  const db=await store(companyId);
  await db.change(state=>appendPilotEvents(state,activation,instance,events));
}

export async function readPilotQueueSummary(companyId:string){
  const queue=await (await store(companyId)).read();
  return {enabled:durablePilotEnabled(companyId),pending:queue?.pending.length||0,failed:queue?.failed.length||0,processing:Boolean(queue?.lease&&queue.lease.until>Date.now())};
}

export async function drainQueuedPilot(companyId:string){
  if(!durablePilotEnabled(companyId))return 0;
  const db=await store(companyId),owner=randomUUID(),started=Date.now();
  let state=await db.change(current=>claimPilotQueue(current,owner,Date.now()));
  if(!state)return 0;
  let processed=0;
  try{
    // Bound the work in a single webhook invocation. Unprocessed work remains
    // durable for the next inbound event or the authenticated recovery cron.
    while(durablePilotEnabled(companyId) && Date.now()-started<18_000 && processed<8){
      const head=state.pending[0];
      if(!head||head.notBefore>Date.now())break;
      let succeeded=false;
      try{
        const settings=await chatSettings(companyId),connection=await evolutionConnection(companyId);
        const eligible=Boolean(durablePilotEnabled(companyId)&&connection?.config.instance===head.instance&&settings.botEnabled&&settings.botTestPhone&&
          settings.botActivatedAt===head.activation&&canReplyToNewInbound({activatedAt:head.activation,testPhone:settings.botTestPhone,eventAt:head.event.at,phone:head.event.phone,text:head.event.text,acceptNewTurns:true},Date.now()));
        await processInboundEvent(companyId,settings,head.event,{ durable:true, historyOnly:!eligible, retryDisconnected:head.tries<2 });
        succeeded=true;
      }catch { /* Fail closed; leave the event durably queued with backoff. */ }
      state=await db.change(current=>settlePilotHead(current,owner,head.key,succeeded,Date.now()));
      if(!state)break;
      if(succeeded){processed++;continue;}
      if(state.pending[0]?.key!==head.key)break;
      const wait=state.pending[0].notBefore-Date.now();
      if(wait>0 && Date.now()-started+wait<12_000)await new Promise(resolve=>setTimeout(resolve,wait));
      else break;
    }
    return processed;
  }finally{
    await db.change(current=>current.lease?.owner===owner?{...current,lease:undefined}:null);
  }
}
