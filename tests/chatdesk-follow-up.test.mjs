import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planPilotFollowUp } from "../lib/chatdesk-follow-up-plan.ts";

const now = Date.parse("2026-11-25T16:00:00Z"); // Wednesday, 13h in Brasília
const input = { id:"provider-in-1", direction:"in", at:"2026-11-25T13:45:00Z", text:"Meu aparelho não está gelando", pilotTurn:true };
const question = { id:`local:${input.id}`, direction:"out", actor:"local-assistant", at:"2026-11-25T13:46:00Z", status:"accepted", deliveryStatus:"read", text:"Qual é a cidade?", assistantReplyKey:"technical:city" };
const fresh = { id:"provider-in-2", direction:"in", at:"2026-11-25T15:59:59Z", text:"Mirassol", pilotTurn:true };
const settings = {
  companyId:"tenant-1", botEnabled:true, botTestPhone:"5517999997798", botActivatedAt:"2026-11-25T12:00:00Z",
  followUp:{ enabled:true, delayMinutes:120, enabledAt:"2026-11-25T13:00:00Z" },
  businessHours:[{ day:3, opens:"13:00", closes:"18:00" }],
};
const chat = { companyId:"tenant-1", phone:settings.botTestPhone, stage:"Novo contato", messages:[input,question] };
const ok = planPilotFollowUp(chat, settings, now);

test("inactivity reminder requires explicit pilot config, valid opt-in and configured business hours", () => {
  assert.deepEqual(ok,{ id:`followup:${input.id}`, questionId:question.id, inputId:input.id });
  for (const changed of [
    { followUp:undefined },
    { followUp:{...settings.followUp, enabled:false} },
    { followUp:{...settings.followUp, enabledAt:"2026-11-25T13:45:01Z"} },
    { followUp:{...settings.followUp, delayMinutes:1381 } },
    { followUp:{...settings.followUp, delayMinutes:135 } },
    { botActivatedAt:"2026-11-25T14:00:00Z" },
    { botEnabled:false },
    { botTestPhone:undefined },
    { botTestPhone:"5517000000000" },
    { companyId:"tenant-2" },
    { businessHours:undefined },
    { businessHours:[{day:2,opens:"12:00",closes:"18:00"}] },
    { businessHours:[{day:3,opens:"12:00",closes:"13:00"}] },
    { businessHours:[{day:3,opens:"00:00",closes:"24:30"}] },
    { businessHours:[settings.businessHours[0], null] },
  ]) assert.equal(planPilotFollowUp(chat,{...settings,...changed},now),null,JSON.stringify(changed));
  assert.equal(planPilotFollowUp({...chat,messages:[{...input,pilotTurn:false},question]},settings,now),null);
  assert.equal(planPilotFollowUp(chat,{...settings,businessHours:[{day:4,opens:"12:00",closes:"18:00"}]},now + 24*60*60_000),null);
});

test("a delivered pending question is required and opt-out, closure, assignment, and inbound stop reminders", () => {
  for (const changed of [
    { stage:"Concluído" },
    { stage:"Em atendimento" },
    { stage:"Orçamento" },
    { assignee:"operador" },
    { optOut:true },
    { botPaused:true },
    { assistantHandoffAt:question.at },
    { messages:[input,question,fresh] },
    { messages:[input,question,{...fresh,text:"ok"}] },
    { messages:[input,{...question,deliveryStatus:undefined}] },
    { messages:[input,{...question,deliveryStatus:"failed"}] },
    { messages:[input,{...question,status:"unknown"}] },
    { messages:[input,{...question,assistantReplyKey:"agenda:detalhes"}] },
    { messages:[input,{...question,text:"Já avisei a equipe."}] },
    { messages:[input,{...question,actor:"atendente"}] },
    { messages:[input,question,{...question,id:"manual",actor:"atendente"}] },
    { messages:[input,question,{...question,id:"note",direction:"note",actor:"atendente"}] },
    { messages:[input,question,{...question,id:"concluded",direction:"event",actor:"atendente",text:"Encerrado"}] },
  ]) assert.equal(planPilotFollowUp({...chat,...changed},settings,now),null,JSON.stringify(changed));
});

test("one attempt per question; after reservation, immediate preflight still refuses a reply arriving meanwhile", () => {
  const reservation = { id:ok.id, direction:"out", actor:"local-assistant", at:new Date(now).toISOString(), status:"processing", text:"Pode me dizer a cidade, se quiser continuar?" };
  const reserved = {...chat,messages:[...chat.messages,reservation]};
  assert.equal(planPilotFollowUp(reserved,settings,now),null);
  assert.equal(planPilotFollowUp(reserved,settings,now,reservation)?.id,reservation.id);
  assert.equal(planPilotFollowUp({...reserved,messages:[...reserved.messages,fresh]},settings,now,reservation),null);
  assert.equal(planPilotFollowUp({...reserved,messages:[...chat.messages,{...reservation,direction:"event"}]},settings,now),null);
  for (const status of ["accepted","unknown","duplicate","disconnected","blocked-optout","blocked-context"]) {
    assert.equal(planPilotFollowUp({...reserved,messages:[...chat.messages,{...reservation,status}]},settings,now,reservation),null);
  }
});

test("cron has authenticated global gate, separate pilot routine, and transport recheck before send", () => {
  const source = path => readFileSync(new URL(path,import.meta.url),"utf8");
  const cron = source("../app/api/cron/whatsapp/route.ts");
  const routine = source("../lib/chatdesk-follow-up.ts");
  const transport = source("../lib/evolution-jobs.ts");
  assert.ok(cron.indexOf("CRON_SECRET") < cron.indexOf("await runPilotFollowUp(company.id)"));
  assert.ok(cron.indexOf("await runPilotFollowUp(company.id)") < cron.indexOf("if (!await tenantEvolutionAutomationEnabled(company.id))"));
  assert.match(routine,/changeChat\(companyId, to/);
  assert.match(routine,/latest\.revision !== settings\.revision/);
  assert.ok(transport.indexOf("!await stillAllowed()") < transport.indexOf("accepted = await sendEvolutionTextWithConfig"));
});
