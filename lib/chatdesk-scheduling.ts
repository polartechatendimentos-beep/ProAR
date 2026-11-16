import {prepareDeskAction,type ActionState} from './chatdesk-actions.ts';
export type SchedulePolicy={enabled:boolean;employeeId:string;service:string;duration:number;buffer:number;days:number[];start:string;end:string};
export type ScheduleOffer={id:string;expiresAt:string;customerId:string;address:string;policy:SchedulePolicy;slots:{date:string;time:string}[]};
export const defaultSchedulePolicy:SchedulePolicy={enabled:false,employeeId:'',service:'',duration:60,buffer:30,days:[1,2,3,4,5],start:'08:00',end:'18:00'};
export function validateSchedulePolicy(value:unknown):SchedulePolicy{
 const p=value as SchedulePolicy;if(!p||typeof p.enabled!=='boolean')throw Error('Configuração de agenda inválida.');
 if(!Number.isInteger(p.duration)||p.duration<15||p.duration>480||!Number.isInteger(p.buffer)||p.buffer<0||p.buffer>180||!Array.isArray(p.days)||!p.days.length||p.days.some(n=>!Number.isInteger(n)||n<0||n>6)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.end)||p.start>=p.end)throw Error('Confira duração, intervalo, dias e expediente.');
 if(p.enabled&&(!String(p.employeeId||'').trim()||!String(p.service||'').trim()))throw Error('Informe o técnico e o serviço autorizado para o agendamento automático.');
 return {enabled:p.enabled,employeeId:String(p.employeeId||'').slice(0,100),service:String(p.service||'').trim().slice(0,200),duration:p.duration,buffer:p.buffer,days:[...new Set(p.days)],start:p.start,end:p.end};
}
export function preferredAfter(text:string){
 const match=/(?:depois\s+d[ae]s?|ap[oó]s\s*(?:[aà]s)?|a partir d[ae]s?)\s*(\d{1,2})(?::|h)?(\d{2})?/i.exec(text);
 if(!match)return null;const h=Number(match[1]),m=Number(match[2]||0);return h<24&&m<60?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`:null;
}
const minute=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
export function availableSlots(state:ActionState,policy:SchedulePolicy,customerId:string,address:string,after:string,now=new Date()){
 const results:{date:string;time:string}[]=[];
 for(let day=0;day<15&&results.length<3;day++){
  const local=new Date(now.getTime()-3*3600000);local.setUTCDate(local.getUTCDate()+day);const date=local.toISOString().slice(0,10);
  if(!policy.days.includes(local.getUTCDay()))continue;
  for(let m=Math.max(minute(policy.start),minute(after));m+policy.duration+policy.buffer<=minute(policy.end)&&results.length<3;m+=30){
   const time=`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
   const padded={...state,serviceOrders:state.serviceOrders.map(o=>({...o,durationMinutes:(Number(o.durationMinutes||o.estimatedDurationMinutes)||60)+policy.buffer,estimatedDurationMinutes:(Number(o.estimatedDurationMinutes||o.durationMinutes)||60)+policy.buffer}))};
   // Pad the candidate duration to respect travel time before the next booking too.
   try{prepareDeskAction(padded,{kind:'schedule',fields:[customerId,date,time,String(policy.duration+policy.buffer),policy.employeeId,policy.service,address]},'00000000-0000-4000-8000-000000000000',now);results.push({date,time});break;}catch{ /* Busy or invalid slot. */ }
  }
 }
 return results;
}
export function offerMessage(offer:ScheduleOffer){return `Encontrei estas opções para ${offer.policy.service}:\n${offer.slots.map((s,i)=>`${i+1} — ${s.date.split('-').reverse().join('/')} às ${s.time}`).join('\n')}\nEndereço: ${offer.address}\nResponda AGENDAR ${offer.id} 1 (ou 2, 3) para escolher. As opções expiram em 15 minutos; o horário será conferido novamente. Para outra data ou endereço, peça ajuda à equipe.`;}

/** Fail-closed guard before persisting a chosen slot.
 * If an operator takes over or the conversation changes, require a new review.
 * This is a defense in depth; it is NOT an atomic cross-store transaction.
 */
export function bookingChatStillEligible(
 chat:{revision:number;assignee?:string;botPaused?:boolean;optOut?:boolean;scheduleOffer?:{id:string}}|null,
 expectedRevision:number,
 offerId:string,
):boolean{
 return !!chat && Number.isSafeInteger(expectedRevision) &&
  chat.revision===expectedRevision && !chat.assignee && !chat.botPaused &&
  !chat.optOut && chat.scheduleOffer?.id===offerId;
}
