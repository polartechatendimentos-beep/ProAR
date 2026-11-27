import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {stripTypeScriptTypes} from "node:module";
import {runInNewContext} from "node:vm";
import {createHash,randomUUID} from "node:crypto";
import {biddingFinancialApprovalIssue,calculateBiddingFinancialRatios} from "../lib/bidding-financial-audit.ts";

const code=stripTypeScriptTypes(await readFile(new URL("../app/api/bidding-requirements/route.ts",import.meta.url),"utf8")).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
const documentId="00000000-0000-0000-0000-000000000101";
const financial={currentAssets:10,currentLiabilities:10,realizableLongTerm:2,longTermLiabilities:2,totalAssets:12,minimumCurrent:"1,0",minimumGeneral:"1,0",minimumSolvency:"1,0",operatorCurrent:"gt",operatorGeneral:"gt",operatorSolvency:"gt",sourceNote:"Cláusula 16.4.3",documentIds:[documentId]};

function setup({initialAudit,initialApproval,financialDocumentTender}={}){
 let saved=null,actor="editor";
 let record={companyId:"company",tenderId:"Fronteira",_revision:1,requirements:[{category:"Índices econômico-financeiros",description:"LG, LC e SG",sourceQuote:"LG, LC e SG maiores que 1,0",documentId}],approval:initialApproval,financialAudit:initialAudit};
 const handle=runInNewContext(code+"\n({GET,POST})",{
  createHash,randomUUID,NextResponse:{json:(body,opts)=>({body,status:opts.status})},procurementAccess:()=>({ok:true,session:{username:actor}}),hasPermission:()=>true,routeContext:async()=>({db:{url:"test"},company:"company",state:{}}),biddingTenderOptions:()=>[{id:"Fronteira"}],routeRest:async()=>({ok:true,json:async()=>[{payload:record}]}),PRIMARY_DATABASE_URL:"test",commitNeonOperationalState:async(_key,_revision,next)=>{saved=next;record=next;return true;},loadBiddingDocument:async()=>({id:documentId,tenderId:financialDocumentTender??"Fronteira",uploaded:true,review:"approved",category:"DRE"}),brazilDay:()=>"2026-11-28",assessBiddingEvidence:()=>({status:"comprovado"}),biddingFinancialApprovalIssue,calculateBiddingFinancialRatios,
 });
 const endpoint=new URL("https://proar.example/api/bidding-requirements?tenderId=Fronteira");
 const request={headers:new Headers({origin:endpoint.origin}),nextUrl:endpoint};
 return {as:name=>{actor=name;},get:()=>handle.GET(request),post:input=>handle.POST({...request,text:async()=>JSON.stringify({tenderId:"Fronteira",expectedRevision:record._revision,...input})}),saved:()=>saved};
}
test("rota preserva regra de cada índice e permite aprovação apenas após revisão do caso Fronteira",async()=>{
 const api=setup();
 const below=await api.post({action:"financial-audit",financial});
 assert.equal(below.status,200);
 assert.equal(api.saved().financialAudit.operatorCurrent,"gt");
 assert.deepEqual(api.saved().financialAudit.ratios.map(r=>r.status),["below","below","below"]);
 const invalid=await api.post({action:"submit",matrixAcknowledged:true});
 assert.equal(invalid.status,422);assert.match(invalid.body.error,/não atende/);
 const above=await api.post({action:"financial-audit",financial:{...financial,currentAssets:12,totalAssets:13}});
 assert.equal(above.status,200);
 assert.equal((await api.post({action:"submit",matrixAcknowledged:true})).status,200);
 api.as("gerente");
 assert.equal((await api.post({action:"decision",decision:"approved",note:"Dossiê conferido."})).status,200);
 assert.equal(api.saved().approval.status,"approved");
});
test("rota de aprovação recalcula dados legados e bloqueia campos omitidos mesmo com resultado histórico ok",async()=>{
 const {operatorCurrent,operatorGeneral,operatorSolvency,...legacy}=financial;
 const approval={status:"pending",submittedBy:"editor"};
 const api=setup({initialAudit:{...legacy,ratios:[{status:"ok"}]},initialApproval:approval});
 const get=await api.get();
 assert.deepEqual(get.body.financialAudit.ratios.map(r=>r.status),["missing","missing","missing"]);
 api.as("gerente");
 const outcome=await api.post({action:"decision",decision:"approved",note:"Dossiê conferido."});
 assert.equal(outcome.status,422);assert.match(outcome.body.error,/informe o operador/);assert.equal(api.saved(),null);
});
test("rota bloqueia aprovação com documento financeiro de outro edital",async()=>{
 const api=setup({initialAudit:{...financial,currentAssets:12,totalAssets:13},initialApproval:{status:"pending",submittedBy:"editor"},financialDocumentTender:"outro"});
 api.as("gerente");
 const outcome=await api.post({action:"decision",decision:"approved",note:"Dossiê conferido."});
 assert.equal(outcome.status,422);assert.match(outcome.body.error,/outro edital/);assert.equal(api.saved(),null);
});
