import test from "node:test";import assert from "node:assert/strict";
import {documentFileInput,fileSignatureMatches,reviewDocument,documentStatus,documentChecklist} from "../lib/bidding-documents.ts";
const now=new Date("2026-10-29T15:00:00Z");
const doc={id:"d",companyId:"c",_revision:2,name:"CND",filename:"cnd.pdf",mime:"application/pdf",size:10,category:"CND Federal",tenderId:"T1",pathname:"private",uploaded:true,sha256:"abc",validUntil:"",noExpiry:false,review:"received",reviewNote:"",createdAt:now.toISOString(),createdBy:"user",audit:[]};
test("attachments enforce real supported format, extension and 10 MB size",()=>{
 assert.equal(documentFileInput({filename:"cnd.pdf",mime:"application/pdf",size:10}).extension,"pdf");
 for(const input of [{filename:"cnd.exe",mime:"application/pdf",size:10},{filename:"x.pdf",mime:"text/html",size:10},{filename:"x.pdf",mime:"application/pdf",size:11*1024*1024},{filename:"../x.pdf",mime:"application/pdf",size:10}])assert.throws(()=>documentFileInput(input));
 assert.equal(fileSignatureMatches(new TextEncoder().encode("%PDF-1.7"),"application/pdf"),true);
 assert.equal(fileSignatureMatches(new TextEncoder().encode("<html>"),"application/pdf"),false);
});
test("receipt alone never approves a document and expiration overrides approval",()=>{
 assert.equal(documentStatus(doc,"2026-10-29"),"Recebido • aguardando conferência");
 assert.equal(documentStatus({...doc,uploaded:false},"2026-10-29"),"Pendente");
 assert.equal(documentStatus({...doc,review:"approved",validUntil:"2026-10-28"},"2026-10-29"),"Vencido");
 assert.equal(documentStatus({...doc,review:"rejected"},"2026-10-29"),"Rejeitado");
});
test("manual approval requires file, identity, content, edital, note and validity",()=>{
 const valid={review:"approved",note:"Conferido no emissor oficial",validUntil:"2026-11-30",noExpiry:false,identityChecked:true,contentChecked:true,tenderChecked:true};
 const approved=reviewDocument(doc,valid,"analista",now);
 assert.equal(documentStatus(approved,"2026-10-29"),"Aprovado");assert.equal(approved._revision,3);assert.equal(approved.reviewedBy,"analista");assert.equal(approved.audit.length,1);assert.equal(doc.audit.length,0);
 for(const patch of [{identityChecked:false},{identityChecked:"true"},{contentChecked:false},{tenderChecked:false},{note:""},{validUntil:"2026-10-28"},{validUntil:""},{validUntil:"2026-02-30"}])assert.throws(()=>reviewDocument(doc,{...valid,...patch},"analista",now));
 assert.throws(()=>reviewDocument({...doc,uploaded:false},valid,"analista",now));
});
test("company coffer never automatically qualifies a specific tender",()=>{
 const approved={...doc,tenderId:"",review:"approved",noExpiry:true};
 assert.equal(documentChecklist([approved],"T1","2026-10-29").find(x=>x.category==="CND Federal").approved,false);
 assert.equal(documentChecklist([approved],"","2026-10-29").find(x=>x.category==="CND Federal").approved,true);
 assert.equal(documentChecklist([{...approved,tenderId:"T1"}],"T2","2026-10-29").find(x=>x.category==="CND Federal").approved,false);
});
