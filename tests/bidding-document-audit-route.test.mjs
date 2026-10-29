import test from "node:test";import assert from "node:assert/strict";import {readFile} from "node:fs/promises";import {stripTypeScriptTypes} from "node:module";import {runInNewContext} from "node:vm";import {createHash} from "node:crypto";
import {buildDocumentAudit,validateExtraction} from "../lib/bidding-document-audit.ts";
const code=stripTypeScriptTypes(await readFile(new URL("../app/api/bidding-documents/route.ts",import.meta.url),"utf8")).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
const previous={id:"00000000-0000-0000-0000-000000000001",companyId:"A",_revision:4,uploaded:true,sha256:"a".repeat(64),category:"CND Federal",validUntil:"2026-12-31",review:"approved",reviewedBy:"human",noExpiry:false,audit:[]};
const body={action:"audit",id:previous.id,sha256:previous.sha256,text:"Certidao de tributos federais. CNPJ 45.823.828/0001-88. Valida ate 30/11/2026.",extraction:{source:"pdf_text",pagesRead:1,totalPages:1,partial:false,warnings:[]}};
function setup(doc=previous,save=true){
 let saved=null;
 const handler=runInNewContext(code+"\nPOST",{NextResponse:{json:(body,init={})=>({body,status:init.status??200})},procurementAccess:()=>({ok:true,session:{username:"operator"}}),hasPermission:()=>true,routeContext:async()=>({db:{},company:"A"}),loadBiddingDocument:async()=>doc,supabaseRest:async()=>({ok:true,json:async()=>[{cnpj:"45823828000188"}]}),buildDocumentAudit,validateExtraction,createHash,saveBiddingDocument:async(db,next,old)=>{assert.equal(old,doc);saved=next;return save;}});
 return {run:input=>handler({headers:new Headers({origin:"https://proar.example"}),nextUrl:new URL("https://proar.example/api/bidding-documents"),text:async()=>JSON.stringify(input)}),saved:()=>saved};
}
test("persisted automatic audit preserves manual decision and binds original hash and operator",async()=>{
 const api=setup(),response=await api.run(body);assert.equal(response.status,200);assert.equal(response.body.audited,true);
 const saved=api.saved();for(const key of ["review","reviewedBy","category","validUntil","noExpiry"])assert.equal(saved[key],previous[key]);
 assert.equal(saved._revision,5);assert.equal(saved.automaticAudit.sha256,previous.sha256);assert.equal(saved.automaticAudit.companyCheck,"matched");assert.equal(saved.audit.at(-1).actor,"operator");
});
test("audit rejects a different file hash or unreceived upload before persisting",async()=>{
 const api=setup();assert.equal((await api.run({...body,sha256:"b".repeat(64)})).status,422);assert.equal(api.saved(),null);
 const missing=setup({...previous,uploaded:false});assert.equal((await missing.run(body)).status,409);assert.equal(missing.saved(),null);
});
test("audit concurrency conflict is visible rather than claiming success",async()=>{
 const api=setup(previous,false),response=await api.run(body);assert.equal(response.status,409);assert.notEqual(response.body.audited,true);
});
