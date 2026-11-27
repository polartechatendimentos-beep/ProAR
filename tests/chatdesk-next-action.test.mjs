import test from "node:test";
import assert from "node:assert/strict";
import { firstUnansweredChatMessage, nextUnansweredChat, chatWaitingLabel } from "../lib/chatdesk-next-action.ts";
import { chatQueueSummary } from "../lib/chatdesk-local.ts";
const stamp = minute => `2026-11-27T01:${String(minute).padStart(2,"0")}:00.000Z`;
const message = (direction,minute,more={})=>({id:`m-${minute}`, direction, text:"Teste", at:stamp(minute), ...more});
const chat = (phone,messages,more={})=>({ phone, companyId:"test", name:"Teste", stage:"Em atendimento", messages, ...more });
test("lembretes, avisos de expediente e falhas não removem a espera; respostas registradas removem",()=>{
  const base=[message("in",1),message("note",2),message("out",3,{assistantNudge:true}),message("in",5),message("out",8,{deliveryStatus:"failed",status:"accepted"}),message("out",9,{hoursNoticeFor:"m-1"}),message("out",10,{status:"unknown"})];
  assert.equal(firstUnansweredChatMessage(base),stamp(1));
  assert.equal(firstUnansweredChatMessage([...base,message("out",12,{status:"accepted"})]),null);
  assert.equal(firstUnansweredChatMessage([...base,message("out",12,{status:"unknown",deliveryStatus:"read"}),message("in",15)]),stamp(15));
});
test("a lista parcial preserva a primeira mensagem sem resposta, exclui encerrados e opt-outs",()=>{
  const old=chatQueueSummary(chat("002",[message("in",2),message("in",12)]));
  const modern=chatQueueSummary(chat("001",[message("in",5)]));
  const answered=chatQueueSummary(chat("003",[message("in",0),message("out",4)]));
  const ended=chatQueueSummary(chat("004",[message("in",0)],{stage:"Concluído"}));
  const blocked=chatQueueSummary(chat("005",[message("in",0)],{optOut:true}));
  assert.equal(old.messages.length,1);
  const next=nextUnansweredChat([modern,answered,ended,blocked,old],Date.parse(stamp(20)));
  assert.equal(next.chat.phone,"002");
  assert.equal(next.elapsedMinutes,18);
  assert.equal(nextUnansweredChat([answered,ended,blocked],Date.parse(stamp(20))),null);
  assert.equal(chatWaitingLabel(1500),"há 1 dia");
});
