import type { AccessState } from "./state-access.ts";
import type { ChatConversation } from "./chatdesk-local.ts";
import { agendaToday, validAgendaDate } from "./agenda-calendar.ts";
import { auditOperationalIntegrity } from "./integrity-audit.ts";
import { integrityPendings } from "./integrity-pendings.ts";

type Row=Record<string,unknown>;
export type OperationalPending = { id:string; reference:string; title:string; detail:string; owner:string; priority:"urgent"|"normal" };
export type OperationalSection = { total:number; items:OperationalPending[] };
export type OperationalPendingSummary = { scheduling:OperationalSection; tracking:OperationalSection; delivery:OperationalSection; integrity:OperationalSection; trackingComplete:boolean };
const text=(x:unknown,max=120)=>typeof x==="string"?x.trim().slice(0,max):"";
const normal=(x:unknown)=>text(x).toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const section=(items:OperationalPending[]):OperationalSection=>({total:items.length,items:items.slice(0,25)});
const closed=(x:unknown)=>/cancelad|concluid|finaliz|encerrad/.test(normal(x));

export function operationalPendingCenter(input:{state:AccessState; chats:ChatConversation[]; pilotPhone?:string; outdatedTracking:Row[]; trackingComplete:boolean},now=new Date()):OperationalPendingSummary {
 const today=agendaToday(now);
 const scheduling=(input.state.serviceOrders||[]).flatMap(order=>{
  const id=text(order.id),date=text(order.date);
  if(!id||closed(order.status))return [];
  const owner=text(order.tech);
  const hasTechnician=Boolean(text(order.techId||order.employeeId)||owner&&!/a definir|nao definid|sem tecnico/.test(normal(owner)));
  const duration=Number(order.estimatedDurationMinutes||order.durationMinutes);
  const fields=[!validAgendaDate(date)&&"data",!/^([01]\d|2[0-3]):[0-5]\d$/.test(text(order.time))&&"horário",!hasTechnician&&"técnico",(!Number.isInteger(duration)||duration<1||duration>1440)&&"duração"];
  const missing=fields.filter(Boolean);
  if(!missing.length)return [];
  return [{id:"schedule:"+id,reference:id,title:text(order.service)||"Programar OS",detail:"Falta "+missing.join(", ")+".",owner:hasTechnician&&owner?owner:"Agenda",priority:date&&date<=today?"urgent" as const:"normal" as const}];
 }).sort((a,b)=>Number(b.priority==="urgent")-Number(a.priority==="urgent")||a.reference.localeCompare(b.reference));
 const tracking=input.outdatedTracking.map(order=>{
  const id=text(order.id);
  return {id:"tracking:"+id,reference:id,title:text(order.service)||"Acompanhamento da OS",detail:"A OS foi salva, mas o link está ausente ou diferente da versão atual.",owner:"Operações",priority:"normal" as const};
 });
 const delivery=input.chats.flatMap(chat=>{
  if(chat.phone===input.pilotPhone||chat.optOut||chat.stage==="Concluído")return [];
  const last=chat.messages.findLast(message=>message.direction==="out");
  const sentAt=Date.parse(last?.at||"");
  if(!last||!Number.isFinite(sentAt)||sentAt>now.getTime()||last.deliveryStatus==="delivered"||last.deliveryStatus==="read")return [];
  const problem=last.deliveryStatus==="failed"||["disconnected","failed","unknown"].includes(last.status||"");
  const awaitingReceipt=last.status==="accepted"&&now.getTime()-sentAt>=30*60_000;
  if(!problem&&!awaitingReceipt)return [];
  const suffix=chat.phone.slice(-4);
  return [{id:"delivery:"+suffix+":"+last.id,reference:"Final "+suffix,title:text(chat.name).replace(/^\+?\d{10,15}$/, "")||"Contato",detail:problem?"Envio falhou ou está sem confirmação. Confira o WhatsApp antes de reenviar.":"Aceita pelo provedor, sem confirmação de entrega há pelo menos 30 min.",owner:text(chat.assignee)||text(chat.sector)||"Atendimento",priority:problem?"urgent" as const:"normal" as const}];
 });
 const integrity=integrityPendings(auditOperationalIntegrity(input.state,now.toISOString())).map(item=>({id:item.id,reference:item.recordId,title:item.title,detail:item.recommendedAction,owner:"Integridade",priority:item.severity==="critical"?"urgent" as const:"normal" as const}));
 return {scheduling:section(scheduling),tracking:section(tracking),delivery:section(delivery),integrity:section(integrity),trackingComplete:input.trackingComplete};
}
