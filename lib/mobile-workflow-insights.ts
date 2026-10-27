import {isOpenMobileOrder,type MobileFieldOrder} from './mobile-field.ts';
import type {OrderFilter} from './mobile-order-display.ts';
export const normalizeFieldText=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export type MobilePreferences={version:1;favorite:OrderFilter|null;sort:'date'|'recent'|'client';compact:boolean;group:boolean;textScale:'normal'|'large'};
export const defaultMobilePreferences:MobilePreferences={version:1,favorite:null,sort:'date',compact:true,group:false,textScale:'normal'};
const filters:OrderFilter[]=['all','today','overdue','upcoming','open','active','completed','unassigned','cancelled'];
export function parseMobilePreferences(raw:unknown):MobilePreferences {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {...defaultMobilePreferences};
 const p=raw as Record<string,unknown>;
 if(p.version!==1)return {...defaultMobilePreferences};
 return {version:1,favorite:filters.includes(p.favorite as OrderFilter)?p.favorite as OrderFilter:null,sort:['date','recent','client'].includes(String(p.sort))?p.sort as MobilePreferences['sort']:'date',compact:typeof p.compact==='boolean'?p.compact:true,group:p.group===true,textScale:p.textScale==='large'?'large':'normal'};
}
export function workflowStages(done:Record<string,boolean>,requirements:{key:string;label:string;required:boolean}[]) {
 const groups=[{id:'checkin',label:'Chegada',keys:['checkin']},{id:'diagnosis',label:'Diagnóstico',keys:['diagnosis','beforePhoto']},{id:'executedService',label:'Execução',keys:requirements.filter(r=>!['checkin','diagnosis','beforePhoto','afterPhoto','signature'].includes(r.key)).map(r=>r.key)},{id:'afterPhoto',label:'Evidências',keys:['afterPhoto']},{id:'signature',label:'Aceite',keys:['signature']}];
 return groups.map(g=>{const items=requirements.filter(r=>r.required&&g.keys.includes(r.key));return {...g,total:items.length,done:items.filter(r=>done[r.key]).length,complete:items.every(r=>done[r.key]),next:items.find(r=>!done[r.key])};});
}
export function mobileAttention(orders:MobileFieldOrder[],today:string,now=Date.now()) {
 const open=orders.filter(o=>isOpenMobileOrder(o.status));
 const overdue=open.filter(o=>/^\d{4}-\d{2}-\d{2}$/.test(o.date)&&o.date<today);
 const unassigned=open.filter(o=>!o.technicianAssigned&&(!o.tech.trim()||/^(a definir|sem t[eé]cnico|n[aã]o definido)$/i.test(o.tech.trim())));
 const requests=open.flatMap(o=>(o.requests||[]).filter(r=>r.status==='Pendente').map(r=>({order:o,request:r})));
 const stalled=open.filter(o=>{const times=[o.checkInAt,...(o.events||[]).map(e=>e.createdAt)].map(Date.parse).filter(Number.isFinite);return Boolean(o.checkInAt)&&!o.attendancePaused&&times.length>0&&now-Math.max(...times)>90*60000;});
 const teams=new Map<string,{tech:string;open:number;active:number;overdue:number;minutes:number}>();
 for(const o of open){const tech=o.technicianAssigned===false?'Sem técnico':o.tech.trim()||'Sem técnico';const row=teams.get(tech)||{tech,open:0,active:0,overdue:0,minutes:0};row.open++;row.active+=Number(Boolean(o.checkInAt)&&!o.attendancePaused);row.overdue+=Number(overdue.includes(o));row.minutes+=o.estimatedDurationMinutes||0;teams.set(tech,row);}
 return {open,overdue,unassigned,requests,stalled,teams:[...teams.values()].sort((a,b)=>b.open-a.open||a.tech.localeCompare(b.tech,'pt-BR'))};
}
export function elapsedAttendanceMinutes(order:Pick<MobileFieldOrder,'checkInAt'|'events'|'attendancePaused'>,now=Date.now()) {
 const start=Date.parse(order.checkInAt);if(!Number.isFinite(start)||start>now)return null;
 const events=(order.events||[]).filter(e=>['pause-attendance','resume-attendance'].includes(e.kind)).map(e=>({...e,at:Date.parse(e.createdAt)})).filter(e=>Number.isFinite(e.at)&&e.at>=start&&e.at<=now).sort((a,b)=>a.at-b.at);
 let last=start,paused=false,active=0,wait=0;
 for(const e of events){const span=e.at-last;if(paused)wait+=span;else active+=span;paused=e.kind==='pause-attendance';last=e.at;}
 const span=now-last;if(paused||order.attendancePaused)wait+=span;else active+=span;
 return {elapsed:Math.floor((now-start)/60000),active:Math.floor(active/60000),paused:Math.floor(wait/60000),partial:(order.events?.length||0)>=100||Boolean(order.attendancePaused)&&!paused};
}
export function reportConsistency(input:{report:string;diagnosis:string;beforeCount:number;afterCount:number;materials:number;measurements:Record<string,string>}) {
 const warnings:string[]=[];const s=normalizeFieldText(input.report);
 if(s&&s===normalizeFieldText(input.diagnosis))warnings.push('Diagnóstico e serviço executado estão iguais. Confira se descrevem a identificação e a solução.');
 if(/\b(foto|fotos|fotografia|fotografias)\b/.test(s)&&!input.beforeCount&&!input.afterCount)warnings.push('O relato menciona fotos, mas nenhuma evidência fotográfica foi identificada.');
 if(/\b(trocad|substituid|instalad)[a-z]*\b/.test(s)&&!input.materials)warnings.push('O relato menciona troca ou instalação. Confira se os materiais aplicados foram registrados.');
 if(/\b(medid|medicao|medicoes)[a-z]*\b/.test(s)&&!Object.values(input.measurements).some(v=>v.trim()))warnings.push('O relato menciona medições. Confira se os valores estão descritos ou registrados nos campos técnicos.');
 return warnings;
}
function editDistanceOne(a:string,b:string){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,errors=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue;}if(++errors>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++;}return errors+Number(i<a.length||j<b.length)<=1;}
export function matchesFieldSearch(haystack:string,query:string){
 const source=normalizeFieldText(haystack),terms=normalizeFieldText(query).slice(0,180).split(/\s+/).filter(Boolean).slice(0,12),words=source.split(/[^a-z0-9]+/).filter(Boolean);
 return terms.every(term=>source.includes(term)||term.length>=5&&!/\d/.test(term)&&words.some(word=>editDistanceOne(word,term)));
}
