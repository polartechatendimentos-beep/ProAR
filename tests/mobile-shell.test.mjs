import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
test('preparo da interface guarda HTML e assets próprios sem solicitar APIs ou sites externos',async()=>{
 const calls=[],saved=[];const prepare=runInNewContext(source+'\nprepareMobileShell;',{self:{addEventListener(){}},caches:{open:async()=>({put:async(key)=>saved.push(key)})},fetch:async url=>{calls.push(url);return new Response(url==='/mobile'?'<script src="/_next/static/app.js"></script><link href="/_next/static/app.css"><a href="/api/mobile/bootstrap"></a><script src="https://external.example/a.js"></script>':'asset',{status:200});}});
 await prepare();assert.deepEqual(calls,['/mobile','/_next/static/app.js','/_next/static/app.css']);assert.ok(saved.includes('/mobile'));assert.equal(saved.length,3);
});
test('asset ausente não pode produzir confirmação falsa de acesso offline',async()=>{
 const prepare=runInNewContext(source+'\nprepareMobileShell;',{self:{addEventListener(){}},caches:{open:async()=>({put:async()=>{}})},fetch:async url=>new Response(url==='/mobile'?'<script src="/_next/static/missing.js"></script>':'missing',{status:url==='/mobile'?200:503})});await assert.rejects(prepare,/incomplete/);
});
test('navegação offline mantém o sistema completo fora de mobile e não transforma API ou JavaScript em HTML',async()=>{
 const handlers={};runInNewContext(source,{self:{addEventListener:(name,handler)=>handlers[name]=handler},URL,Response,Request:function(request){return request;},caches:{match:async key=>key==='/'?new Response('FULL'):key==='/mobile'?new Response('MOBILE'):undefined},fetch:async()=>{throw Error('offline');}});
 async function read(path,mode='navigate'){let response;handlers.fetch({request:{method:'GET',url:`https://polartech.proar.online${path}`,mode},respondWith:value=>{response=value;}});return response;}
 assert.equal(await (await read('/?tab=clientes')).text(),'FULL');assert.equal(await (await read('/mobile?dia=hoje')).text(),'MOBILE');assert.equal((await read('/_next/static/not-cached.js','cors')).type,'error');assert.equal(await read('/api/mobile/bootstrap'),undefined);assert.equal(await read('/mobile/api/state'),undefined);
});
