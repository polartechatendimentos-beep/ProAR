import test from "node:test";
import assert from "node:assert/strict";
import {cloudDraftKey,cloudDraftPrefix,cloudDraftText,sealCloudDraft,openCloudDraft,CLOUD_DRAFT_TTL} from "../lib/cloud-order-drafts.ts";
const now=Date.parse("2026-10-29T00:00:00Z");
const draft={version:1,report:"Serviço em revisão",diagnosis:"Diagnóstico em revisão",savedAt:now,measurements:{pressure:"100"},checklist:{checkin:true},equipmentIds:["EQ1"],before:"image",signature:"signature"};
test("cloud draft identity includes company, user and order while normalizing username case",()=>{
 const key=cloudDraftKey("C1","Marin","OS1");
 assert.equal(key,cloudDraftKey("C1","marin","OS1"));
 for(const args of [["C2","marin","OS1"],["C1","outro","OS1"],["C1","marin","OS2"]])assert.notEqual(key,cloudDraftKey(...args));
 assert.ok(key.startsWith(cloudDraftPrefix("C1","marin")));
});
test("encrypted copy is authenticated to its identity and key",()=>{
 const key="fixture-secret-only-for-tests",context=cloudDraftKey("C1","marin","OS1"),value=JSON.stringify(draft);
 const cipher=sealCloudDraft(value,context,key);
 assert.equal(cipher.includes("Diagnóstico"),false);
 assert.equal(openCloudDraft(cipher,context,key),value);
 assert.throws(()=>openCloudDraft(cipher,cloudDraftKey("C2","marin","OS1"),key));
 assert.throws(()=>openCloudDraft(cipher,context,"different-fixture-key"));
 assert.throws(()=>openCloudDraft(cipher.slice(0,-6)+"ABCDEF",context,key));
});
test("text copy excludes media, signature, snapshot and transaction commands",()=>{
 const copy=cloudDraftText({...draft,orderSnapshot:{id:"OS1"},password:"never-copy"},now);
 assert.equal(copy.report,draft.report);assert.equal(copy.before,undefined);assert.equal(copy.signature,undefined);assert.equal(copy.orderSnapshot,undefined);assert.equal(copy.password,undefined);
 assert.throws(()=>cloudDraftText({...draft,pendingSubmission:{command:{action:"finish"}}},now),/pendente/);
});
test("oversized, malformed and expired copies are rejected",()=>{
 for(const value of [null,[],{...draft,version:-1},{...draft,savedAt:now-CLOUD_DRAFT_TTL-1},{...draft,savedAt:now+600000},{...draft,report:"x".repeat(8001)},{...draft,checklist:{checkin:"true"}},{...draft,measurements:{pressure:100}}])assert.throws(()=>cloudDraftText(value,now));
});
