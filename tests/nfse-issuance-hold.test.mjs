import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {stripTypeScriptTypes} from "node:module";
import {runInNewContext} from "node:vm";
import {createHash} from "node:crypto";
import {convertedNfseOriginError} from "../lib/commercial-conversion.ts";
import {nfseIssuanceHold,nfseProviderOutcome} from "../lib/nfse-issuance-status.ts";

const code=stripTypeScriptTypes(await readFile(new URL("../app/api/nfse/issue/route.ts",import.meta.url),"utf8")).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
const body={serviceOrderId:"OS-1",customer:{document:"00000000000"},service:{value:10,description:"Teste"},nfse:{municipalityCode:"3530300",serviceCode:"123"}};
const response=(ok,value)=>({ok,json:async()=>value});
function setup({order={id:"OS-1"},customers=[],reply=async()=>response(true,{status:"Autorizada",number:"531"}),loseFinalWrite=false}={}){
 let persisted=null,calls=0;
 const handlers=runInNewContext(code+"\n({GET,POST})",{
  createHash,nfseIssuanceHold,nfseProviderOutcome,convertedNfseOriginError,
  NextResponse:{json:(result,init)=>({status:init.status,body:result})},requirePermission:()=>({ok:true,session:{username:"tester",companyId:"test-company"}}),
  validateFiscalPayload:()=>({valid:true}),routeContext:async()=>({state:{serviceOrders:[order],customers},db:{},company:"test-company"}),
  loadNfseAttempt:async()=>persisted?structuredClone(persisted):null,
  writeNfseAttempt:async(_db,next,previous)=>{
   if((persisted?._revision??null)!==(previous?._revision??null)||loseFinalWrite&&next._revision>1)return false;
   persisted=structuredClone(next);return true;
  },
  fetch:async(_url,init)=>{calls++;assert.equal(init.method,"POST");return reply(init);},
  AbortSignal,process:{env:{PROAR_SEFIN_NACIONAL_ADAPTER_URL:"https://adapter.example",PROAR_SEFIN_NACIONAL_ADAPTER_TOKEN:"fixture"}},
 });
 return {post:(patch={})=>handlers.POST({json:async()=>({...body,...patch})}),get:()=>handlers.GET({nextUrl:new URL("https://app.example/api/nfse/issue?serviceOrderId="+encodeURIComponent(order.id)+"")}),calls:()=>calls};
}
test("reserva transacional do mesmo pedido impede POST simultâneo, mesmo com valor diferente",async()=>{
 const api=setup();
 const replies=await Promise.all([api.post(),api.post({service:{...body.service,value:20},idempotencyKey:"ignorar-chave-cliente"})]);
 assert.ok(replies.some(item=>item.body.issued===true));assert.equal(api.calls(),1);
 const post=await api.post();
 assert.ok(post.body.replay); assert.equal(post.body.result.number,"531");assert.equal(api.calls(),1);
 assert.equal((await api.get()).body.attempt.number,"531");
});
test("timeout, resposta vaga e falha após resposta fiscal nunca viram rejeição automática",async()=>{
 for(const options of [{reply:async()=>{throw new Error("timeout");}},{reply:async()=>response(false,{error:"Serviço indisponível"})},{loseFinalWrite:true}]){
  const api=setup(options);
  const result=await api.post();
  assert.equal(result.body.status,"Conferência pendente");
  assert.equal((await api.post()).body.status,"Conferência pendente");
  assert.equal(api.calls(),1);
 }
});
test("rejeição explícita mantém rejeição e torna possível correção, não repete automaticamente",async()=>{
 const api=setup({reply:async()=>response(false,{result:{status:"denied",message:"Recusa do provedor"}})});
 assert.equal((await api.post()).body.status,"Rejeitada");
 assert.equal(api.calls(),1);
 assert.equal((await api.get()).body.attempt.status,"Rejeitada");
});
test("nota existente, tentativa local incerta ou OS fora do cadastro não chegam ao provedor",async()=>{
 for(const order of [{id:"OS-1",nfseStatus:"Conferência pendente"},{id:"OS-1",nfseNumber:"777"},{id:"OS-2"}]){
  const api=setup({order});assert.ok([404,409].includes((await api.post()).status));assert.equal(api.calls(),0);
 }
});
test("autorização sem identificação ou com status contraditório vira conferência",()=>{
 assert.equal(nfseProviderOutcome(true,{status:"Autorizada"}).outcome,"Conferência pendente");
 assert.equal(nfseProviderOutcome(true,{status:"Rejeitada",authorized:true,number:"123"}).outcome,"Conferência pendente");
 assert.equal(nfseProviderOutcome(true,{status:"Processando",protocol:"P1"}).outcome,"Processando");
});

test("OS pública precisa passar pelo saldo de Empenho e mantém consulta e replay da nota já autorizada",async()=>{
 for(const order of [{id:"OS-1",certameId:"CER-1"},{id:"OS-1",contractItems:[{certameItemId:"ITEM-1"}]}]){
  const api=setup({order});
  const denied=await api.post();
  assert.equal(denied.status,409);
  assert.match(denied.body.error,/faturamento pelo Empenho/);
  assert.equal(api.calls(),0);
  assert.equal((await api.get()).status,200);
 }
 const order={id:"OS-1"};
 const api=setup({order});
 assert.equal((await api.post()).body.issued,true);
 order.certameId="CER-1";
 assert.equal((await api.post()).body.replay,true);
 assert.equal(api.calls(),1);
});


test("aceita ID #OS e impede CNPJ, total divergente e orçamento misto antes de reservar ou transmitir",async()=>{
 const order={id:"#OS-15500",sourceBudgetId:"ORC-1",customerId:"CLI-1",commercialSnapshot:{lines:[{kind:"Serviço"}],total:25}};
 const customer={id:"CLI-1",doc:"12.345.678/0001-90"};
 const api=setup({order,customers:[customer]});
 const correct={serviceOrderId:order.id,customer:{document:"12345678000190"},service:{...body.service,value:25}};
 assert.equal((await api.post({...correct,customer:{document:"12345678000100"}})).status,422);
 assert.equal((await api.post({...correct,service:{...correct.service,value:26}})).status,422);
 assert.equal((await api.get()).body.attempt,null);
 const mixed=setup({order:{...order,financeReviewRequired:true},customers:[customer]});
 assert.equal((await mixed.post(correct)).status,422);
 assert.equal(mixed.calls(),0);
 const otherTenant=setup({order:{...order,id:"#OS-99999"},customers:[customer]});
 assert.equal((await otherTenant.post(correct)).status,404);
 assert.equal(otherTenant.calls(),0);
 assert.equal(api.calls(),0);
 assert.equal((await api.post(correct)).body.issued,true);
 assert.equal(api.calls(),1);
 assert.equal((await api.get()).body.attempt.number,"531");
});
