import { createHash } from "node:crypto";
import type { EvolutionInboundEvent } from "./chatdesk-events.ts";

export const CHAT_INBOUND_LEASE_MS = 180_000;
const MAX_PENDING = 120, MAX_FAILED = 30;
export type PilotQueueEntry = { key: string; event: EvolutionInboundEvent; activation: string; instance: string; tries: number; notBefore: number };
export type PilotQueue = {
  companyId:string; revision:number; pending:PilotQueueEntry[]; failed:PilotQueueEntry[]; processed:string[];
  lease?:{ owner:string; until:number };
};
export const blankPilotQueue = (companyId:string):PilotQueue => ({companyId,revision:0,pending:[],failed:[],processed:[]});
export const pilotEventKey = (e:EvolutionInboundEvent, instance:string) => createHash("sha256").update(JSON.stringify([instance,e.phone,e.id])).digest("hex");

export function appendPilotEvents(state:PilotQueue, activation:string, instance:string, events:EvolutionInboundEvent[]):PilotQueue|null{
  const keys=new Set([...state.pending.map(e=>e.key),...state.failed.map(e=>e.key),...state.processed]);
  const added:PilotQueueEntry[]=[];
  for(const event of [...events].sort((a,b)=>a.at.localeCompare(b.at))){
    const key=pilotEventKey(event,instance);
    if(keys.has(key))continue;
    keys.add(key);added.push({key,event,activation,instance,tries:0,notBefore:0});
  }
  if(!added.length)return null;
  if(state.pending.length+added.length>MAX_PENDING||state.failed.length>=MAX_FAILED)throw new Error("Fila de atendimento cheia. Os eventos ainda não foram confirmados.");
  return {...state,pending:[...state.pending,...added]};
}
export function claimPilotQueue(state:PilotQueue,owner:string,now:number):PilotQueue|null{
  const head=state.pending[0];
  if(!head||head.notBefore>now || state.lease&&state.lease.until>now)return null;
  return {...state,lease:{owner,until:now+CHAT_INBOUND_LEASE_MS}};
}
export function settlePilotHead(state:PilotQueue,owner:string,key:string,success:boolean,now:number):PilotQueue|null{
  const head=state.pending[0];
  if(state.lease?.owner!==owner||state.lease.until<=now||head?.key!==key)return null;
  const tail=state.pending.slice(1);
  if(success)return {...state,pending:tail,processed:[...state.processed,key].slice(-400)};
  const tried={...head,tries:head.tries+1,notBefore:now+[1_000,3_000,10_000,60_000][Math.min(head.tries,3)]};
  if(tried.tries>=4&&state.failed.length<MAX_FAILED)return {...state,pending:tail,failed:[...state.failed,tried]};
  return {...state,pending:[tried,...tail]};
}
