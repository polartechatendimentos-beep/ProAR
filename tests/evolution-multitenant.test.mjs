import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {evolutionTenantIdentity} from '../lib/evolution-identity.ts';
const source = async file => stripTypeScriptTypes(await readFile(new URL(file, import.meta.url), 'utf8')).replace(/^import .*;$/gm, '').replace(/^export /gm, '');
const json = (body, init={}) => ({body,status:init.status??200});

test('each company gets a stable distinct instance and credential', () => {
 const a=evolutionTenantIdentity('a','s'.repeat(32)),b=evolutionTenantIdentity('b','s'.repeat(32));
 assert.deepEqual(a,evolutionTenantIdentity('a','s'.repeat(32)));
 assert.notEqual(a.instance,b.instance);assert.notEqual(a.key,b.key);assert.notEqual(a.recordId,b.recordId);
 assert.throws(()=>evolutionTenantIdentity('a','short'));
});
test('connection API rejects anonymous/unauthorized and cross-origin calls before any provider access; company comes only from session', async()=>{
 const code=await source('../app/api/whatsapp/web/route.ts');let calls=[];
 const base={NextResponse:{json},process:{env:{}},readSession:()=>null,assertActiveWhatsAppCompany:async id=>calls.push(id),managedEvolutionAvailable:()=>true,evolutionConnection:async id=>{calls.push(id);return null;}};
 const request={cookies:{get:()=>undefined},headers:new Headers({'sec-fetch-site':'same-origin',origin:'https://proar.test'}),nextUrl:new URL('https://proar.test'),json:async()=>({companyId:'other'})};
 const anonymous=runInNewContext(code+'\n({GET,POST,PUT})',base);
 assert.equal((await anonymous.GET(request)).status,403);assert.equal(calls.length,0);
 const forbidden=runInNewContext(code+'\nGET',{...base,readSession:()=>({companyId:'a',permissions:[]})});
 assert.equal((await forbidden(request)).status,403);assert.equal(calls.length,0);
 const active=runInNewContext(code+'\n({GET,POST,PUT})',{...base,readSession:()=>({companyId:'a',permissions:['*']})});
 assert.equal((await active.POST({...request,headers:new Headers({'sec-fetch-site':'cross-site'})})).status,403);
 assert.equal((await active.PUT({...request,headers:new Headers({'sec-fetch-site':'same-origin',origin:'https://other.test'})})).status,403);
 assert.equal(calls.length,0);
 assert.equal((await active.GET({...request,headers:new Headers({'x-proar-company-id':'b'})})).status,403);assert.equal(calls.length,0);
 const result=await active.GET(request);assert.equal(result.body.needsProvisioning,true);assert.ok(calls.every(id=>id==='a'));
});
test('tenant store refuses foreign decrypted records and never falls back to primary tenant database',async()=>{
 const code=await source('../lib/evolution-tenant.ts');let query='';
 const base={process:{env:{PROAR_EVOLUTION_URL:'https://evolution.test'}},URL,requiredSecret:()=> 's'.repeat(32),evolutionTenantIdentity,resolveTenantDb:async id=>({url:'https://db.test',key:'test',companyId:id}),tenantHeaders:()=>({}),databaseFetch:async url=>{query=url;return Response.json([{payload:{companyId:'b',encrypted:'x'}}]);},decryptTenantSecret:()=>JSON.stringify({companyId:'b'}),evolutionConfig:()=>null};
 const connection=runInNewContext(code+'\nevolutionConnection',base);
 await assert.rejects(connection('a'),/inválida/);
 assert.ok(query.includes(evolutionTenantIdentity('a','s'.repeat(32)).recordId));
 const missing=runInNewContext(code+'\nevolutionConnection',{...base,resolveTenantDb:async()=>({url:'',key:''}),databaseFetch:()=>{throw Error('must not query');}});
 await assert.rejects(missing('b'),/Base da empresa/);
});
test('concurrent jobs send only once and ambiguous sends never automatically retry',async()=>{
 const code=await source('../lib/evolution-jobs.ts');let sends=0;const rows=new Map();let fail=false;
 const context={createHash,Date,JSON,encodeURIComponent,readChat:async()=>null,evolutionConnection:async()=>({config:{}}),evolutionRequestWithConfig:async()=>({instance:{state:'open'}}),resolveTenantDb:async()=>({url:'https://db.test',key:'test'}),tenantHeaders:()=>({}),sendEvolutionTextWithConfig:async()=>{sends++;if(fail)throw Error('timeout');return {messageId:'accepted-id'};},databaseFetch:async(url,options)=>{
 const body=JSON.parse(options.body);
 if(options.method==='POST'){if(rows.has(body.id))return Response.json([]);rows.set(body.id,body);return Response.json([body]);}
 const id=decodeURIComponent(url.split('id=eq.')[1]);rows.set(id,{...rows.get(id),...body});return Response.json([]);
 }};
 const dispatch=runInNewContext(code+'\ndispatchEvolutionJob',context);
 const first=await Promise.all([dispatch('a','reminder:1','5517999990000','Test'),dispatch('a','reminder:1','5517999990000','Test')]);
 assert.equal(sends,1);assert.deepEqual(first.map(x=>x.status).sort(),['accepted','duplicate']);
 await dispatch('b','reminder:1','5517999990000','Test');assert.equal(sends,2);assert.equal(rows.size,2);
 fail=true;assert.equal((await dispatch('a','reminder:2','5517999990000','Test')).status,'unknown');
 assert.equal((await dispatch('a','reminder:2','5517999990000','Test')).status,'duplicate');assert.equal(sends,3);
});
test('scheduled worker resolves each company database and never mixes recipients or signatures',async()=>{
 const code=await source('../app/api/cron/whatsapp/route.ts');const sends=[];const urls=[];
 const handler=runInNewContext(code+'\nGET',{
 NextResponse:{json},process:{env:{CRON_SECRET:'test-only',PROAR_EVOLUTION_AUTOMATION_ENABLED:'true'}},Date,Intl,Set,encodeURIComponent,
 tenantEvolutionAutomationEnabled:async()=>true,resolveTenantDb:async id=>({url:`https://db-${id}.test`,key:id,dedicated:true}),tenantHeaders:key=>({key}),
 evolutionJobPrefix:id=>`jobs-${id}:`,evolutionJobId:(id,source)=>`${id}:${source}`,
 dispatchEvolutionJob:async(company,id,to,text)=>{sends.push({company,id,to,text});return {status:'accepted'};},
 supabaseRest:async(path,options)=>{if(options)return Response.json([]);if(path.startsWith('proar_state'))return Response.json([]);return Response.json([{id:'a',trade_name:'Empresa A'},{id:'b',trade_name:'Empresa B'}]);},
 databaseFetch:async(url,options)=>{urls.push({url,options});if(url.includes('select=id&'))return Response.json([]);const a=url.includes('db-a');return Response.json([{payload:{_companyId:a?'a':'b',moduleRecords:{Lembretes:[{id:'R1',date:'2020-01-01',status:'Agendado',whatsappConsent:true,category:a?'17999990001':'17999990002',client:a?'Cliente A':'Cliente B',reminderMessage:'Lembrete'},{id:'R2',date:'2020-01-01',status:'Agendado',category:'17999990003',whatsappConsent:false},{id:'R3',date:'2020-01-01',status:'Agendado',category:'17999990004',whatsappConsent:true,whatsappOptOut:true}]}}}]);}
 });
 const request={headers:new Headers({authorization:'Bearer test-only'})};
 assert.equal((await handler({headers:new Headers()})).status,401);
 const result=await handler(request);assert.equal(result.body.accepted,2);assert.equal(sends.length,2);
 assert.equal(sends[0].company,'a');assert.equal(sends[0].to,'5517999990001');assert.ok(sends[0].text.endsWith('Empresa A'));
 assert.equal(sends[1].company,'b');assert.equal(sends[1].to,'5517999990002');assert.ok(sends[1].text.endsWith('Empresa B'));
 assert.ok(urls.every(({url,options})=>url.includes(`db-${options.headers.key}.test`)));
});
test('manual test uses the session company and a durable caller request id; no arbitrary message body is accepted',async()=>{
 const code=await source('../app/api/whatsapp/web/test/route.ts');let sent;
 const handler=runInNewContext(code+'\nPOST',{NextResponse:{json},readSession:()=>({companyId:'a',permissions:['*']}),assertActiveWhatsAppCompany:async id=>assert.equal(id,'a'),dispatchEvolutionJob:async(...args)=>{sent=args;return {status:'accepted'};}});
 const request={headers:new Headers({'sec-fetch-site':'same-origin',origin:'https://proar.test','x-proar-company-id':'a'}),nextUrl:new URL('https://proar.test'),cookies:{get:()=>undefined},json:async()=>({to:'17999990000',requestId:'00000000-0000-4000-a000-000000000001',companyId:'b',text:'forged'})};
 const result=await handler(request);assert.equal(result.body.status,'accepted');assert.equal(sent[0],'a');assert.equal(sent[1],'test:00000000-0000-4000-a000-000000000001');assert.equal(sent[2],'5517999990000');assert.ok(!sent[3].includes('forged'));
 sent=null;assert.equal((await handler({...request,headers:new Headers({'sec-fetch-site':'same-origin','x-proar-company-id':'b'})})).status,403);assert.equal(sent,null);
});
