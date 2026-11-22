import test from "node:test";
import assert from "node:assert/strict";
import {operationalPendencies} from "../lib/proar-operations-pendencies.ts";
test("pending classifier prioritizes overdue and unassigned work without writes",()=>{
 const input=[{companyId:"a",id:"1",kind:"os",status:"aberto",dueAt:"2026-11-12T10:00:00Z"},{companyId:"a",id:"2",kind:"quote",status:"aprovado"},{companyId:"a",id:"3",kind:"chat",status:"aberto",assignee:"ana"}];
 const result=operationalPendencies("a",input,"2026-11-12T11:00:00Z");
 assert.deepEqual(result.map(x=>x.id),["1","3"]);assert.equal(result[0].overdue,true);assert.equal(input.length,3);
});
test("pending classifier rejects mixed-tenant input",()=>{
 assert.throws(()=>operationalPendencies("a",[{companyId:"b",id:"1",kind:"os",status:"aberto"}],"2026-11-12T11:00:00Z"),/outra empresa/);
});
