import test from "node:test";
import assert from "node:assert/strict";
import { evaluateChatSla } from "../lib/chatdesk-sla.ts";

const base = { companyId:"company-a",phone:"5517999999999",name:"Cliente",sector:"Técnico",stage:"Novo contato",assignee:"",revision:1,botPaused:true,optOut:false,requests:[],updatedAt:"2026-11-12T10:00:00Z",messages:[{id:"1",direction:"in",text:"Preciso de manutenção",at:"2026-11-12T10:00:00Z"}] };
const config = {companyId:"company-a",rules:{"Técnico":{firstResponseMinutes:30,followUpMinutes:60}}};
test("SLA is tenant scoped and deterministic",()=>{
 assert.throws(()=>evaluateChatSla(base,{...config,companyId:"company-b"},"2026-11-12T10:31:00Z"),/outra empresa/);
 assert.equal(evaluateChatSla(base,config,"2026-11-12T10:10:00Z").state,"on-time");
 assert.equal(evaluateChatSla(base,config,"2026-11-12T10:25:00Z").state,"warning");
 assert.equal(evaluateChatSla(base,config,"2026-11-12T10:30:00Z").state,"overdue");
 assert.equal(evaluateChatSla({...base,messages:[...base.messages,{id:"2",direction:"out",text:"Olá",at:"2026-11-12T10:20:00Z"}]},config,"2026-11-12T10:40:00Z").state,"answered");
 assert.throws(()=>evaluateChatSla(base,{...config,rules:{"Técnico":{firstResponseMinutes:0,followUpMinutes:60}}},"2026-11-12T10:30:00Z"),/inválido/);
});
