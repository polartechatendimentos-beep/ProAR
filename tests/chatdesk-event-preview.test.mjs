import test from "node:test";
import assert from "node:assert/strict";
import { previewProarEvent } from "../lib/chatdesk-event-preview.ts";
const base={companyId:"a",customerCompanyId:"a",kind:"os-scheduled",customerName:"Cliente",reference:"OS-01",optOut:false,consent:true};
test("event preview rejects cross-company and opted-out recipients",()=>{
 assert.equal(previewProarEvent({...base,customerCompanyId:"b"}).allowed,false);
 assert.equal(previewProarEvent({...base,optOut:true}).allowed,false);
 assert.equal(previewProarEvent({...base,consent:false}).allowed,false);
});
test("event previews are drafts requiring human approval, not sent events",()=>{
 for(const kind of ["os-scheduled","os-on-the-way","os-completed","quote-ready","pmoc-due"]){
  const result=previewProarEvent({...base,kind});
  assert.equal(result.allowed,true);assert.equal(result.requiresHumanApproval,true);assert.ok(result.text.includes("OS-01"));
 }
});
