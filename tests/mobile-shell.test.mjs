import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";

const source=await readFile(new URL("../public/sw.js",import.meta.url),"utf8");
const origin="https://polartech.proar.online";
const cacheName="proar-shell-offline-day-v8";
const keyOf=key=>new URL(typeof key==="string"?key:key.url,origin).href;
function fixture(fetch,initial={}){
  const handlers={},data=new Map(Object.entries(initial).map(([k,v])=>[keyOf(k),new Response(v)])),deleted=[];
  let claimed=false;
  const cache={
    match:async key=>data.get(keyOf(key))?.clone(),
    put:async (key,response)=>{data.set(keyOf(key),response.clone());},
    keys:async()=>[...data.keys()].map(url=>({url})),
    delete:async key=>data.delete(keyOf(key)),
  };
  const self={location:{origin},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{claimed=true;}},skipWaiting:async()=>{}};
  const prepare=runInNewContext(source+"\nprepareShell;",{self,URL,Response,AbortController,setTimeout,clearTimeout,caches:{
    open:async()=>cache,keys:async()=>["proar-shell-interface-v6",cacheName,"manuais-offline"],delete:async key=>deleted.push(key)
  },fetch});
  const navigate=async (path,mode="navigate",method="GET")=>{
    let result;handlers.fetch({request:{method,url:keyOf(path),mode},respondWith:value=>{result=value;}});return result;
  };
  const message=async type=>{
    let result,work;
    handlers.message({data:{type},ports:[{postMessage:m=>{result=m;}}],waitUntil:p=>{work=p;}});
    await work;return result;
  };
  return {prepare,navigate,message,activate:async()=>{let work;handlers.activate({waitUntil:p=>{work=p;}});await work;},data,deleted,claimed:()=>claimed};
}
const html=body=>new Response(body,{headers:{"content-type":"text/html; charset=utf-8"}});
test("prepara a tela do PDV e da OS pelo mesmo shell e a interface separada do técnico",async()=>{
  const calls=[];
  const f=fixture(async url=>{
    calls.push(url);
    return ["/","/mobile"].includes(url)
      ?html('<script src="/_next/static/app.js"></script><link href="/_next/static/app.css"><a href="/api/mobile/bootstrap"></a><script src="https://external.example/_next/static/a.js"></script>')
      :new Response("asset");
  });
  assert.equal((await f.message("PREPARE_SYSTEM_SHELL")).ok,true);
  assert.equal((await f.message("PREPARE_MOBILE_SHELL")).ok,true);
  assert.deepEqual(calls,["/",origin+"/_next/static/app.js",origin+"/_next/static/app.css","/mobile"]);
  assert.ok(f.data.has(origin+"/")&&f.data.has(origin+"/mobile"));
});
test("asset ausente não substitui a última tela preparada com uma versão incompleta",async()=>{
  const f=fixture(async url=>url==="/"
    ?html('<script src="/_next/static/missing.js"></script>')
    :new Response("missing",{status:503}),{"/":"VERSÃO ANTERIOR"});
  await assert.rejects(f.prepare("/"),/incomplete/);
  assert.equal(await f.data.get(origin+"/").text(),"VERSÃO ANTERIOR");
  assert.equal((await f.message("PREPARE_SYSTEM_SHELL")).ok,false);
});
test("sem rede, abas do sistema e Mobile reabrem; APIs, documentos e outros sites não são interceptados",async()=>{
  const f=fixture(async()=>{throw Error("offline");},{"/":"FULL","/mobile":"MOBILE"});
  assert.equal(await (await f.navigate("/?tab=vendas")).text(),"FULL");
  assert.equal(await (await f.navigate("/?tab=os")).text(),"FULL");
  assert.equal(await (await f.navigate("/mobile?dia=hoje")).text(),"MOBILE");
  assert.equal((await f.navigate("/_next/static/not-cached.js","cors")).type,"error");
  for(const path of ["/api/state","/mobile/api/state","/atendimento","/documentos/cliente","/login","https://outro.example/_next/static/a.js"]){
    assert.equal(await f.navigate(path),undefined,path);
  }
  assert.equal(await f.navigate("/","navigate","POST"),undefined);
});
test("reserva a cópia para falta de rede ou 5xx; nunca encobre 401, 403 ou 404",async()=>{
  for(const status of [401,403,404,502,503]){
    const f=fixture(async()=>new Response("servidor",{status}),{"/":"FULL"});
    const response=await f.navigate("/");
    assert.equal(response.status,status<500?status:200);
    assert.equal(await response.text(),status<500?"servidor":"FULL");
  }
});
test("ativação não guarda páginas privadas e preserva caches de outros recursos",async()=>{
  const f=fixture(async()=>html("ok"),{"/":"FULL","/?tab=clientes":"OLD","/mobile":"MOBILE","/atendimento":"privado","/api/state":"privado","/_next/static/app.js":"publico"});
  await f.activate();
  assert.deepEqual(f.deleted,["proar-shell-interface-v6"]);
  assert.deepEqual([...f.data.keys()],[origin+"/",origin+"/mobile",origin+"/_next/static/app.js"]);
  assert.equal(f.claimed(),true);
});
