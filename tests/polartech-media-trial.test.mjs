import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {stripTypeScriptTypes} from "node:module";
import {runInNewContext} from "node:vm";
import {mediaTrialAttachment,mediaTrialStart,mediaTrialAge} from "../lib/polartech-media-trial.ts";

test("manual file check only accepts explicitly selected fresh authorized pilot media",()=>{
  const now=Date.parse("2026-11-25T23:45:00Z");
  const photo={id:"photo-one",direction:"in",mediaKind:"foto",pilotTurn:true,at:"2026-11-25T23:34:00Z"};
  const chat={stage:"Novo contato",botPaused:true,assistantHandoffAt:photo.at,messages:[photo]};
  assert.equal(mediaTrialAttachment(chat,photo.id,now)?.kind,"foto");
  for(const fields of [{optOut:true},{assignee:"staff"},{stage:"Concluído"},{assistantHandoffAt:undefined},{mediaTrial:{foto:{state:"processing"}}}]) {
    assert.equal(mediaTrialAttachment({...chat,...fields},photo.id,now),null);
  }
  for(const change of [{pilotTurn:false},{direction:"out"},{mediaKind:"documento"},{at:"2026-11-25T23:32:00Z"}]) {
    assert.equal(mediaTrialAttachment({...chat,messages:[{...photo,...change}]},photo.id,now),null);
  }
  assert.equal(mediaTrialAttachment(chat,photo.id,now+mediaTrialAge),null);
});

test("one-shot endpoint doesn't send anything before photo selection, verified own key and reservation",async()=>{
  const path=new URL("../app/api/atendimento/teste-midia/route.ts",import.meta.url);
  const source=stripTypeScriptTypes(await readFile(path,"utf8")).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
  const origin="https://polartech.proar.online", now=Date.parse("2026-11-25T23:45:00Z");
  class TestDate extends Date { static now(){return now;} constructor(arg){super(arg??now);} }
  const internal="5517999990000";
  let admin=true, sourceKind="company", validation="valid", calls=0;
  const photo={id:"photo-one",direction:"in",mediaKind:"foto",pilotTurn:true,at:"2026-11-25T23:34:00Z"};
  const audio={id:"audio-one",direction:"in",mediaKind:"áudio",pilotTurn:true,at:"2026-11-25T23:35:00Z"};
  const photo2={...photo,id:"photo-two"};
  let chat={stage:"Novo contato",messages:[photo,audio,photo2]};
  const handler=runInNewContext(source+"\nPOST",{
    Date:TestDate,process:{env:{PROAR_EVOLUTION_AUTOMATION_ENABLED:"true"}},mediaTrialAttachment,mediaTrialStart,mediaTrialAge,
    createHash:()=>({update:()=>({digest:()=>"6c1ba65ee4375f919f2962c8f5fe9b59c739f4cea2b8383cdf5a99622b6edcfe"})}),
    NextResponse:{json:(body,options)=>({body,status:options.status})},
    chatAccess:()=>({actor:{admin},companyId:"polartech-principal"}),chatSettings:async()=>({botEnabled:true,botTestPhone:internal}),
    readChat:async()=>chat,
    readStoredOpenAiIntegration:async()=>({enabled:true,validation_status:validation,validation_source:"company"}),
    getOpenAiCredential:async()=>({source:sourceKind,apiKey:"fake"}),
    evolutionConnection:async()=>({config:{instance:"fixture"}}),
    changeChat:async(_,p,fn)=>{assert.equal(p,internal); const next=fn(chat);if(next)chat=next;return {changed:Boolean(next),chat};},
    readWhatsAppMediaForReview:async(_,event)=>{calls++;assert.ok(chat.mediaTrial[event.kind]);return {state:"review",source:event.kind,text:"Fixture sem dados pessoais"};},
  });
  const go=(id,confirmSynthetic=true,from=origin)=>handler({headers:new Headers({origin:from,"sec-fetch-site":"same-origin"}),nextUrl:new URL(origin),text:async()=>JSON.stringify({id,confirmSynthetic})});
  assert.equal((await go(photo.id,false)).status,400);
  assert.equal((await go(photo.id,true,"https://outra.example")).status,403);
  admin=false;assert.equal((await go(photo.id)).status,403);admin=true;
  validation="pending";assert.equal((await go(photo.id)).status,412);validation="valid";
  sourceKind="environment";assert.equal((await go(photo.id)).status,412);sourceKind="company";
  assert.equal(calls,0);
  assert.equal((await go(photo.id)).body.state,"review");
  assert.equal((await go(photo.id)).status,409);
  assert.equal((await go(photo2.id)).status,409);
  assert.equal((await go(audio.id)).body.state,"review");
  assert.equal(calls,2);
});
