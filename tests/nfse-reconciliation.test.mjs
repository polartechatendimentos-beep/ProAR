import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {runNfse,nfseLedgerKey} from "../lib/nfse-reconciliation.ts";

function setup(order={}){
  let state=null;
  return {get state(){return state},repo:{load:async()=>state,order:async()=>order,commit:async(next,previous)=>{
    if((state?.revision??null)!==(previous?.revision??null))return false;
    state=structuredClone(next);return true;
  }}};
}
const initial={companyId:"empresa-a",serviceOrderId:"OS-123",value:100};
const response=(data,status=200)=>Response.json(data,{status});
const matched=(attempt,data,status=200)=>response({companyId:attempt.providerCompanyId??attempt.companyId,idempotencyKey:attempt.idempotencyKey,result:data},status);

test("timeout after wire submission reconciles with a read only and never retransmits, even if amount changes",async()=>{
  const mock=setup(); let sends=0; const send=async()=>{sends++;throw Error("connection reset after receipt")};
  assert.equal((await runNfse({...initial,repo:mock.repo,send},"issue")).code,202);
  assert.equal((await runNfse({...initial,value:160,repo:mock.repo,send},"issue")).code,202);
  const result=await runNfse({...initial,repo:mock.repo,send,lookup:attempt=>matched(attempt,{status:"Autorizada",numero:"999",codigoVerificacao:"ABC",cpf:"not echoed"})},"reconcile");
  assert.deepEqual(result,{code:200,body:{issued:true,status:"Autorizada",result:{number:"999",verificationCode:"ABC"},value:100}});
  assert.equal((await runNfse({...initial,repo:mock.repo,send},"issue")).body.status,"Autorizada");
  assert.equal(sends,1);
});
test("concurrent issuance for an OS claims exactly one transmission",async()=>{
  const mock=setup();let sends=0;
  const send=async()=>{sends++;return response({status:"pending"},202)};
  const attempts=await Promise.all([1,2,3].map(()=>runNfse({...initial,repo:mock.repo,send},"issue")));
  assert.deepEqual(attempts.map(x=>x.code),[202,202,202]);assert.equal(sends,1);
});
test("unknown, malformed, wrong tenant/key, protocol only, 404 and unconfigured remain locked",async()=>{
  const mock=setup(),base={...initial,repo:mock.repo};
  assert.equal((await runNfse({...base,send:async()=>new Response("proxy timeout",{status:504})},"issue")).code,202);
  for(const lookup of [undefined, async()=>response({},404), async()=>response({companyId:"empresa-b",idempotencyKey:mock.state.idempotencyKey,status:"Autorizada",number:"999"}), async()=>response({companyId:initial.companyId,idempotencyKey:"old",status:"Rejeitada"},422), async()=>matched(mock.state,{status:"Autorizada",protocol:"receipt-only"}),async()=>matched(mock.state,{status:"Rejeitada"},202)]){
    assert.equal((await runNfse({...base,lookup},"reconcile")).body.status,"Processando");
  }
});
test("only correlated definitive rejection unlocks a new attempt with a different key",async()=>{
  const mock=setup(),base={...initial,repo:mock.repo};
  await runNfse({...base,send:async()=>response({},500)},"issue");
  const first=mock.state.idempotencyKey;
  assert.equal((await runNfse({...base,lookup:attempt=>matched(attempt,{status:"Rejeitada"},422)},"reconcile")).body.status,"Rejeitada");
  assert.equal((await runNfse({...base,send:async attempt=>{assert.notEqual(attempt.idempotencyKey,first);return response({status:"authorized",number:"21"});}},"issue")).body.status,"Autorizada");
});
test("legacy pending uses original amount and key without any new transmission",async()=>{
  const mock=setup({nfseStatus:"Processando",nfseValue:30}),base={...initial,legacyCompanyId:"legacy-company",repo:mock.repo};
  assert.equal((await runNfse({...base,send:async()=>assert.fail("never resend")},"issue")).body.status,"Processando");
  const outcome=await runNfse({...base,lookup:attempt=>{
    assert.equal(attempt.value,30);
    assert.equal(attempt.idempotencyKey,createHash("sha256").update("legacy-company:OS-123:30").digest("hex"));
    return matched(attempt,{status:"authorized",number:"1"});
  }},"reconcile");
  assert.equal(outcome.code,200);
});
test("no storage/OS, no send; keys partition company and order",async()=>{
  const mock=setup(null);
  assert.equal((await runNfse({...initial,repo:mock.repo,send:async()=>assert.fail("orphan") },"issue")).code,404);
  assert.notEqual(nfseLedgerKey("empresa-a","OS-1"),nfseLedgerKey("empresa-b","OS-1"));
  assert.notEqual(nfseLedgerKey("empresa-a","OS-1"),nfseLedgerKey("empresa-a","OS-2"));
  const repo={...mock.repo,order:async()=>({}),commit:async()=>{throw Error("storage unavailable")}};
  await assert.rejects(runNfse({...initial,repo,send:async()=>assert.fail("failed durable lock")},"issue"),/storage unavailable/);
});
test("consult route exposes fiscal permission only and calls the distinct adapter via GET",async()=>{
  const source=await readFile(new URL("../app/api/nfse/reconcile/route.ts",import.meta.url),"utf8");
  assert.match(source,/requirePermission\(request,"fiscal\.consultar"\)/);
  assert.match(source,/requirePermission\(request,"fiscal\.emitir"\)/);
  assert.match(source,/PROAR_SEFIN_NACIONAL_ADAPTER_LOOKUP_URL/);
  assert.match(source,/method:"GET"/);
  assert.doesNotMatch(source,/body\.companyId|ADAPTER_URL;/);
});
