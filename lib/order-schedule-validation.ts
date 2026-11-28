import {closedAgendaOrder,validAgendaDate} from "./agenda-calendar.ts";
type Row=Record<string,unknown>;
const text=(value:unknown)=>String(value??"").trim();
const nameKey=(value:unknown)=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/\s+/g," ");
const placeholder=/^(a definir|nao definid[oa]|nao informad[oa]|sem tecnico|tecnico a definir|-)$/;
const active=(row:Row)=>!closedAgendaOrder({status:text(row.status)} as Parameters<typeof closedAgendaOrder>[0])&&!/^rascunho$/i.test(text(row.status));
const timePattern=/^([01]\d|2[0-3]):([0-5]\d)$/;
const legacyMinutes=120; // Same estimate used by the Agenda and the new-OS review.
const scheduleFields=["date","time","tech","employeeId","techId","estimatedDurationMinutes","durationMinutes"] as const;
const durationOf=(row:Row)=>text(row.estimatedDurationMinutes)||text(row.durationMinutes);

export class OrderScheduleConflict extends Error {
 readonly code="OS_SCHEDULE_CONFLICT";
 constructor(){super("Conflito de horário para o técnico selecionado. Escolha outro horário ou responsável.");}
}

/** Validate against the full authorized proposed state, immediately before its revision-checked save. */
export function assertOrderScheduleChanges(previous:Row[],incoming:Row[],staff:Row[]=[]){
 const aliases=new Map<string,Set<string>>();
 for(const employee of staff){
  const key=text(employee.id), name=nameKey(employee.name);
  if(key&&name&&!placeholder.test(name))aliases.set(key,new Set([...(aliases.get(key)||[]),name]));
 }
 const byId=new Map(previous.map(row=>[text(row.id),row]));
 const byDate=new Map<string,Array<{id:string;changed:boolean;ids:string[];names:Set<string>;from:number;to:number}>>();
 for(const row of incoming){
  if(!active(row))continue;
  const id=text(row.id),old=byId.get(id);
  const changed=!old||!active(old)||scheduleFields.some(field=>text(old[field])!==text(row[field]));
  const date=text(row.date),time=text(row.time),tech=nameKey(row.tech);
  const ids=[...new Set([text(row.employeeId),text(row.techId)].filter(Boolean))];
  const names=new Set(ids.flatMap(employee=>[...(aliases.get(employee)||[])]));
  if(tech&&!placeholder.test(tech))names.add(tech);
  // Partial schedules remain saveable and visible as backlog, not firm bookings.
  if(!date||!time||(!ids.length&&!names.size))continue;
  const match=time.match(timePattern);
  if(!match||!validAgendaDate(date)){
   if(changed)throw new Error("Informe uma data e um horário válidos para programar a OS.");
   continue;
  }
  const from=Number(match[1])*60+Number(match[2]), raw=durationOf(row), minutes=Number(raw);
  const validDuration=Number.isInteger(minutes)&&minutes>0&&minutes<=1440;
  if(changed&&raw&&!validDuration)throw new Error("Informe uma duração válida para programar a OS.");
  if(changed&&validDuration&&from+minutes>1440)throw new Error("A duração do atendimento precisa terminar no mesmo dia.");
  const entries=byDate.get(date)||[];
  entries.push({id,changed,ids,names,from,to:Math.min(1440,from+(validDuration?minutes:legacyMinutes))});
  byDate.set(date,entries);
 }
 for(const entries of byDate.values()){
  if(!entries.some(entry=>entry.changed))continue;
  entries.sort((a,b)=>a.from-b.from);
  for(const [index,left] of entries.entries()){
   for(let i=index+1;i<entries.length&&entries[i].from<left.to;i++){
    const right=entries[i];
    if(left.id===right.id||(!left.changed&&!right.changed))continue;
    const sameTech=left.ids.length&&right.ids.length?left.ids.some(id=>right.ids.includes(id)):[...left.names].some(name=>right.names.has(name));
    if(sameTech)throw new OrderScheduleConflict();
   }
  }
 }
}
