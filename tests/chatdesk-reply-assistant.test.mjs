import test from "node:test";
import assert from "node:assert/strict";
import { suggestChatReply } from "../lib/chatdesk-reply-assistant.ts";
const chat={companyId:"a",phone:"5517999999999",name:"Maria",sector:"Geral",stage:"Novo contato",assignee:"",revision:1,botPaused:false,optOut:false,requests:[],updatedAt:"2026-11-12T10:00:00Z",messages:[{id:"m1",direction:"in",text:"Meu ar não gela",at:"2026-11-12T10:00:00Z"}]};
test("assistant generates draft only and enforces tenant",()=>{
 const reply=suggestChatReply(chat,"a");
 assert.equal(reply.mode,"local-rules");assert.match(reply.text,/Maria/);assert.match(reply.text,/marca/);
 assert.throws(()=>suggestChatReply(chat,"b"),/outra empresa/);
});
test("assistant respects opt-out and safety escalations",()=>{
 assert.match(suggestChatReply({...chat,messages:[{...chat.messages[0],text:"parar"}]},"a").text,/não receber/);
 assert.match(suggestChatReply({...chat,messages:[{...chat.messages[0],text:"cheiro de queimado"}]},"a").warning,/risco elétrico/);
});
