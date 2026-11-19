import {validAgendaDate,type AgendaOrder} from "./agenda-calendar.ts";

type SuggestionOrder=Pick<AgendaOrder,"id"|"date"|"time"|"tech"|"status"|"estimatedDurationMinutes"|"durationMinutes">;
type Input={technicians:string[];orders:SuggestionOrder[];date:string;time:string;durationMinutes:number;excludeOrderId?:string};
type Candidate={name:string;minutes:number;count:number;conflict:boolean};

const validTime=(value:string)=>/^([01]\\d|2[0-3]):[0-5]\\d$/.test(value||"");
const isMissingTechnician=(value:string)=>/^(não definido|nao definido|a definir|sem técnico|tecnico a definir)$/i.test(value.trim());

export function suggestAgendaTechnician(input:Input){
 const date=validAgendaDate(input.date)?input.date:"";
 const duration=Number.isInteger(input.durationMinutes)&&input.durationMinutes>0?input.durationMinutes:120;
 const candidates=[...new Set(input.technicians.map(name=>name.trim()).filter(name=>name&&!isMissingTechnician(name)))];
 const ranked:Candidate[]=candidates.map(name=>{
  const visits=input.orders.filter(order=>order.id!==input.excludeOrderId&&order.date===date&&order.tech.trim()===name&&!/conclu[ií]d|cancelad|finalizad/i.test(order.status));
  const conflict=Boolean(date&&validTime(input.time)&&visits.some(order=>{
   if(!validTime(order.time||""))return false;
   const existingDuration=Number(order.estimatedDurationMinutes||order.durationMinutes)||0;
   if(existingDuration<=0)return false;
   const [startHour,startMinute]=input.time.split(":").map(Number);
   const [otherHour,otherMinute]=order.time.split(":").map(Number);
   const start=startHour*60+startMinute,end=start+duration,otherStart=otherHour*60+otherMinute,otherEnd=otherStart+existingDuration;
   return start<otherEnd&&otherStart<end;
  }));
  const minutes=visits.reduce((sum,order)=>sum+(Number(order.estimatedDurationMinutes||order.durationMinutes)||0),0);
  return{name,minutes,count:visits.length,conflict};
 });
 ranked.sort((a,b)=>Number(a.conflict)-Number(b.conflict)||a.minutes-b.minutes||a.count-b.count||a.name.localeCompare(b.name,"pt-BR"));
 const best=ranked.find(candidate=>!candidate.conflict);
 if(!best)return null;
 const hours=Math.floor(best.minutes/60),minutes=best.minutes%60;
 const workload=hours?minutes?hours+" h "+minutes+" min":hours+" h":minutes+" min";
 const reason=validTime(input.time)
  ? "Sem conflito no horário • "+workload+" estimados no dia"
  : "Menor carga prevista no dia • "+workload+" em "+best.count+" OS";
 return{name:best.name,reason};
}
