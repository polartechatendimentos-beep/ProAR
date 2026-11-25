import { test } from "node:test";
import assert from "node:assert/strict";
import { readWhatsAppMediaForReview } from "../lib/whatsapp-media-analysis.ts";

const now = Date.parse("2026-11-26T12:00:00Z");
const phone = "5511900000000";
const config = { base: new URL("https://evolution.example/"), key: "fixture-evolution", instance: "internal-pilot" };
const gate = { companyId: "fixture-company", pilotPhone: phone, activatedAt: "2026-11-26T11:59:00Z", mediaProcessingEnabled: true };
const event = { id: "synthetic-media", kind: "foto", phone, instance: "internal-pilot", at: "2026-11-26T11:59:30Z" };
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(8)]).toString("base64");
const ogg = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(12)]).toString("base64");
const credential = { apiKey: "fixture-model", source: "company" };
const out = (text, legivel = true) => ({
  status: "completed",
  output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ legivel, resumo: text }) }] }],
});
function harness(args = {}) {
  const calls = [];
  return { calls, fetch: async (url, init) => {
    calls.push([url.toString(), init]);
    return calls.length === 1 ? (args.rawProvider || Response.json(args.provider || { mimetype: "image/png", base64: png }))
      : Response.json(args.ai || out("Capacidade legível: 12000 BTU."));
  }, getCredential: async id => {
    assert.equal(id, "fixture-company");
    return Object.hasOwn(args,"key") ? args.key : credential;
  } };
}

test("default/invalid settings, stale messages and outside-pilot attachments never resolve credentials or call networks", async () => {
  const fail = () => assert.fail("side effect on a rejected event");
  for (const [selected, received, expected] of [
    [{ mediaProcessingEnabled: undefined }, {}, "disabled"],
    [{ mediaProcessingEnabled: "true" }, {}, "disabled"],
    [{ pilotPhone: undefined }, {}, "not-pilot"],
    [{}, { phone: "5511900000001" }, "not-pilot"],
    [{}, { at: "2026-11-26T11:59:00Z" }, "stale"],
    [{}, { at: "2026-11-26T12:00:01Z" }, "stale"],
    [{}, { instance: "other-tenant" }, "invalid-event"],
    [{}, { id: "../synthetic" }, "invalid-event"],
  ]) {
    assert.deepEqual(await readWhatsAppMediaForReview({ ...gate, ...selected }, { ...event, ...received }, config, { fetch: fail, getCredential: fail }, now), { state: "skipped", reason: expected });
  }
});

test("shared OpenAI environment keys cannot read or transmit any attachment", async () => {
  const env = harness({ key: { apiKey: "fixture-shared", source: "environment" } });
  assert.deepEqual(await readWhatsAppMediaForReview(gate,event,config,env,now), { state:"unavailable",reason:"tenant-credential" });
  assert.equal(env.calls.length,0);
});

test("approved synthetic image uses fixed tenant/provider endpoints and only returns human review evidence", async () => {
  const dep = harness();
  const result = await readWhatsAppMediaForReview(gate, { ...event, url: "https://untrusted.example/private" }, config, dep, now);
  assert.deepEqual(result,{ state:"review",source:"foto",text:"Capacidade legível: 12000 BTU." });
  const [provider, model] = dep.calls;
  assert.equal(provider[0],"https://evolution.example/chat/getBase64FromMediaMessage/internal-pilot");
  assert.deepEqual(JSON.parse(provider[1].body),{ message:{key:{id:event.id,remoteJid:phone+"@s.whatsapp.net",fromMe:false}},convertToMp4:false });
  assert.equal(model[0],"https://api.openai.com/v1/responses");
  for (const call of [provider,model]) assert.equal(call[1].redirect,"error");
  const request = JSON.parse(model[1].body);
  assert.equal(request.store,false);
  assert.equal(request.input[0].content[0].image_url,"data:image/png;base64,"+png);
  assert.doesNotMatch(model[1].body,/fixture-company|5511900000000|synthetic-media/);
});

test("audio note uses only its allowlisted bytes and temporary generic filename", async () => {
  const dep = harness({provider:{mimetype:"audio/ogg; codecs=opus",base64:ogg}, ai:{text:"  O ar está pingando.  "}});
  const result = await readWhatsAppMediaForReview(gate,{...event,kind:"áudio"},config,dep,now);
  assert.deepEqual(result,{state:"review",source:"áudio",text:"O ar está pingando."});
  const [url, init] = dep.calls[1];
  assert.equal(url,"https://api.openai.com/v1/audio/transcriptions");
  assert.equal(init.body.get("file").name,"voice.ogg");
  assert.equal(init.body.get("file").type,"audio/ogg");
  assert.equal(init.body.get("model"),"gpt-transcribe");
  assert.equal(Buffer.from(await init.body.get("file").arrayBuffer()).toString("base64"),ogg);
});

test("oversized, substituted, mismatched, or malformed media never reaches the model", async () => {
  for (const args of [
    {provider:{mimetype:"image/png",base64:png,key:{id:"other-message"}}},
    {provider:{mimetype:"image/png",base64:ogg}},
    {provider:{mimetype:"audio/ogg",base64:ogg}},
    {provider:{mimetype:"image/png",base64:png+"%%%%"}},
    {rawProvider:new Response("fixture",{headers:{"content-length":"8000000"}})},
  ]) {
    const dep = harness(args);
    assert.notEqual((await readWhatsAppMediaForReview(gate,event,config,dep,now)).state,"review");
    assert.equal(dep.calls.length,1);
  }
});

test("unclear image and unavailable provider never become customer-facing claims", async () => {
  const unclear = harness({ai:out("talvez",false)});
  assert.deepEqual(await readWhatsAppMediaForReview(gate,event,config,unclear,now),{state:"unreliable",reason:"unclear"});
  const disconnected = harness({rawProvider:new Response("provider private error text",{status:403})});
  assert.deepEqual(await readWhatsAppMediaForReview(gate,event,config,disconnected,now),{state:"unavailable",reason:"provider"});
});
