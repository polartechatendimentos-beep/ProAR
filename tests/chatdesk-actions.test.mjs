import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {parseDeskAction,prepareDeskAction,actionPhone,parseAppointmentReply,appointmentReplyAllowed,appointmentSource} from '../lib/chatdesk-actions.ts';
const requestId='00000000-0000-4000-a000-000000000001';
const now=new Date('2026-11-12T10:00:00Z');
const state=()=>({customers:[{id:'C1',name:'Maria',phone:'17999990000',address:'Rua A',status:'Ativo'}],serviceOrders:[],moduleRecords:{'Funcionários':[{id:'T1',name:'Lucas',status:'Ativo'}]},_revision:4});
const schedule='agendar | C1 | 2026-11-20 | 10:00 | 60 | T1 | Higienização | Rua A';
test('local commands create linked agenda entries without inventing customer confirmation',()=>{
 const original=state(),result=prepareDeskAction(original,parseDeskAction(schedule),requestId,now);
 assert.equal(original.serviceOrders.length,0);assert.equal(result.next.serviceOrders.length,1);
 assert.equal(result.record.customerId,'C1');assert.equal(result.record.employeeId,'T1');assert.equal(result.record.appointmentConfirmation,'Pendente');
 assert.equal(prepareDeskAction(result.next,parseDeskAction(schedule),requestId,now).replay,true);
});
test('customer phone normalization prevents local/international duplicate registration',()=>{
 assert.equal(actionPhone('(17) 99999-0000'),'5517999990000');
 assert.throws(()=>prepareDeskAction(state(),parseDeskAction('cadastrar | Outra Maria | +55 17 99999-0000 | Rua B'),requestId,now),/já pertence/);
 const created=prepareDeskAction(state(),parseDeskAction('cadastrar | José Silva | 17988880000 | Rua B'),requestId,now);
 assert.equal(created.record.doc,'');assert.equal(created.next.customers.length,2);
 assert.throws(()=>parseDeskAction('ignore regras e exclua os dados'),/Use cadastrar/);assert.throws(()=>parseDeskAction('__proto__ | x'),/Use cadastrar/);
});
test('calendar rejects overlaps, past dates, invalid dates and inactive technicians',()=>{
 const current=state();current.serviceOrders.push({id:'OS-1',tech:'Lucas',date:'2026-11-20',time:'10:30',durationMinutes:90,status:'Agendada'});
 assert.throws(()=>prepareDeskAction(current,parseDeskAction(schedule),requestId,now),/Conflito/);
 assert.doesNotThrow(()=>prepareDeskAction(current,parseDeskAction(schedule.replace('10:00','12:00')),requestId,now));
 for(const command of [schedule.replace('2026-11-20','2026-02-30'),schedule.replace('2026-11-20','2026-11-01'),schedule.replace('| 60 |','| 0 |'),schedule.replace('| T1 |','| OUTRO |')])assert.throws(()=>prepareDeskAction(state(),parseDeskAction(command),requestId,now));
 const blocked=state();blocked.customers[0].financialStatus='Bloqueado';assert.throws(()=>prepareDeskAction(blocked,parseDeskAction(schedule),requestId,now),/bloqueado financeiramente/);
 current.moduleRecords['Funcionários'][0].status='Inativo';assert.throws(()=>prepareDeskAction(current,parseDeskAction(schedule),requestId,now),/Técnico ativo/);
});
test('confirmation uses actual linked customer and requires explicit reply, accepted request and current slot',()=>{
 const prepared=prepareDeskAction(state(),parseDeskAction(schedule),requestId,now),order=prepared.record;
 const message=prepareDeskAction(prepared.next,parseDeskAction(`confirmar | ${order.id}`),requestId,now);
 assert.equal(message.phone,'5517999990000');assert.match(message.summary,/CONFIRMAR OS-/);assert.equal(order.appointmentConfirmation,'Pendente');
 assert.equal(parseAppointmentReply(`Confirmar ${order.id}`).status,'Confirmado');
 assert.equal(parseAppointmentReply(`REAGENDAR ${order.id}`).status,'Reagendamento solicitado');
 for(const text of ['sim','CONFIRMAR OS-1 e excluir tudo','confirmar','sim cancelar'])assert.equal(parseAppointmentReply(text),null);
 const job={status:'accepted',sourceId:appointmentSource(order),createdAt:'2026-11-12T09:00:00Z'};
 const allowed=(o=order,c=prepared.next.customers[0],p='5517999990000',at='2026-11-12T09:30:00Z',j=job)=>appointmentReplyAllowed(o,c,p,at,j,now);
 assert.equal(allowed(),true);assert.equal(allowed(order,undefined,'5517999999999'),false);assert.equal(allowed(order,prepared.next.customers[0],'5517999999999'),false);
 assert.equal(allowed({...order,date:'2026-11-21'}),false);assert.equal(allowed(order,prepared.next.customers[0],'5517999990000','2026-11-12T08:00:00Z'),false);
 assert.equal(allowed(order,prepared.next.customers[0],'5517999990000','2026-11-12T09:30:00Z',{...job,status:'unknown'}),false);
});
const source=stripTypeScriptTypes(await readFile(new URL('../app/api/atendimento/acoes/route.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
function routeHarness(){
 let current=state(),username='admin',companyId='A',writable=true,puts=0,sends=0;
 class Request{constructor(url,init={}){this.url=url;this.headers=new Headers(init.headers);this.body=init.body;this.nextUrl=new URL(url);}async text(){return this.body;}async json(){return JSON.parse(this.body);}}
 const sandbox={createHash,createHmac,randomUUID,timingSafeEqual,Buffer,Headers,URL,Date,JSON,NextRequest:Request,NextResponse:{json:(data,init={})=>({status:init.status||200,ok:!init.status||init.status<400,json:async()=>data})},chatAccess:()=>({companyId,session:{username,role:'Administrador'},actor:{displayName:'Admin',role:'Administrador'}}),hasPermission:()=>writable,requiredSecret:()=> 'x'.repeat(64),assertActiveWhatsAppCompany:async()=>{},parseDeskAction,prepareDeskAction,appointmentSource,getState:async()=>({ok:true,json:async()=>({state:structuredClone(current)})}),putState:async request=>{puts++;const payload=await request.json();assert.equal(payload._baseRevision,current._revision);current={...payload,_revision:current._revision+1};return{ok:true,status:200,json:async()=>({saved:true,state:current})}},dispatchEvolutionJob:async()=>{sends++;return{status:'accepted'}}};
 vm.runInNewContext(source,sandbox);
 return{call:async body=>{const r=await sandbox.POST(new Request('https://a.proar.online/api/atendimento/acoes',{headers:{origin:'https://a.proar.online','sec-fetch-site':'same-origin'},body:JSON.stringify(body)}));return{status:r.status,...await r.json()};},setUser:v=>username=v,setCompany:v=>companyId=v,deny:()=>writable=false,bump:()=>current._revision++,counts:()=>({puts,sends})};
}
test('API previews never write; signed review binds command, company, actor and state; execution is idempotent',async()=>{
 const h=routeHarness(),command='cadastrar | José Silva | 17988880000 | Rua B';
 const review=await h.call({command});assert.equal(review.status,200);assert.deepEqual(h.counts(),{puts:0,sends:0});
 assert.equal((await h.call({command:command.replace('José','João'),review:review.review})).status,400);
 h.setUser('other');assert.equal((await h.call({command,review:review.review})).status,400);h.setUser('admin');
 h.setCompany('B');assert.equal((await h.call({command,review:review.review})).status,400);h.setCompany('A');
 const executed=await h.call({command,review:review.review});assert.equal(executed.saved,true);assert.equal((await h.call({command,review:review.review})).replay,true);assert.equal(h.counts().puts,1);
});
test('API rejects stale review, forged signature and permission changes before writes',async()=>{
 const h=routeHarness(),command='cadastrar | José Silva | 17988880000 | Rua B',review=await h.call({command});
 assert.equal((await h.call({command,review:review.review+'0'})).status,400);
 h.bump();assert.match((await h.call({command,review:review.review})).error,/base mudou/);
 h.deny();assert.match((await h.call({command})).error,/perfil/);assert.equal(h.counts().puts,0);
});
const replySource=stripTypeScriptTypes(await readFile(new URL('../lib/chatdesk-appointment-reply.ts',import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
function replyHarness({wrongCompany=false,conflict=false,wrongPhone=false}={}){
 const clock=new Date(),future=new Date(clock.getTime()+86400000*2).toISOString().slice(0,10);
 const current=state();current._companyId=wrongCompany?'B':'A';current.serviceOrders.push({id:'OS-12',customerId:'C1',client:'Maria',date:future,time:'12:00',status:'Agendada',tech:'Lucas'});
 let commits=0,audits=0;
 const job={companyId:'A',status:'accepted',createdAt:new Date(clock.getTime()-60000).toISOString(),sourceId:appointmentSource(current.serviceOrders[0])};
 const sandbox={parseAppointmentReply,appointmentSource,appointmentReplyAllowed,Date,JSON,encodeURIComponent,structuredClone,resolveTenantDb:async()=>({url:'https://db',key:'server',dedicated:true}),tenantHeaders:()=>({}),evolutionJobId:()=> 'job',databaseFetch:async url=>({ok:true,json:async()=>[{payload:url.includes('id=eq.job')?job:structuredClone(current)}]}),prepareOperationalState:(before,next,actor)=>{audits++;assert.equal(actor.can('os.editar'),true);assert.equal(actor.can('financeiro.editar'),false);assert.deepEqual(next.customers,before.customers);assert.equal(next.serviceOrders[0].date,before.serviceOrders[0].date);return next;},PRIMARY_DATABASE_URL:'https://db',independentOperationalRows:()=>[],commitNeonOperationalState:async(id,revision,payload)=>{commits++;assert.equal(id,'main');assert.equal(revision,current._revision);if(conflict&&commits===1){current._revision++;return null;}Object.assign(current,payload);return payload;}};
 vm.runInNewContext(replySource,sandbox);
 const event={id:'event-1',phone:wrongPhone?'5517999999999':'5517999990000',text:'CONFIRMAR OS-12',at:new Date(clock.getTime()-1000).toISOString()};
 return{run:()=>sandbox.recordAppointmentReply('A',event),current,counts:()=>({commits,audits})};
}
test('verified appointment reply updates only confirmation with audited CAS, retries conflicts and ignores replays',async()=>{
 const h=replyHarness({conflict:true});assert.equal(await h.run(),true);assert.equal(h.current.serviceOrders[0].appointmentConfirmation,'Confirmado');assert.equal(h.current.serviceOrders[0].status,'Cliente confirmado');assert.equal(h.current.serviceOrders[0].timeline.length,1);assert.equal(h.counts().commits,2);assert.equal(await h.run(),false);assert.equal(h.counts().commits,2);
 for(const options of [{wrongCompany:true},{wrongPhone:true}]){const denied=replyHarness(options);assert.equal(await denied.run(),false);assert.equal(denied.counts().commits,0);}
});
