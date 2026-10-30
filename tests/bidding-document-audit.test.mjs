import test from "node:test";import assert from "node:assert/strict";
import {buildDocumentAudit,extractedCnpjs,expiryDates,suggestedDocumentCategory,validateExtraction,validNumericCnpj} from "../lib/bidding-document-audit.ts";
const cnpj="45823828000188",now=new Date("2026-10-29T15:00:00Z"),extraction={source:"pdf_text",pagesRead:1,totalPages:1,partial:false,warnings:[]};
const make=text=>buildDocumentAudit({text,expectedCnpj:cnpj,sha256:"a".repeat(64),textHash:"b".repeat(64),extraction,now});
test("audit reads mixed batch document categories separately from content",()=>{
 for(const [text,type] of [
  ["Certidão de débitos de tributos federais e dívida ativa da União","CND Federal"],
  ["Certificado de Regularidade do FGTS - CRF","FGTS"],
  ["Certidão Negativa de Débitos Trabalhistas - CNDT","Trabalhista"],
  ["Certidão negativa de débitos municipais","CND Municipal"],
  ["Certidão de débitos estaduais","CND Estadual"],
  ["Conselho Regional de Engenharia e Agronomia","CREA / CFT"],
  ["Anotação de Responsabilidade Técnica","ART"],
  ["Atestado de capacidade técnica","Atestado técnico"]
 ])assert.equal(suggestedDocumentCategory(text).category,type);
 assert.equal(suggestedDocumentCategory("documento.pdf").category,"Outros");
 assert.equal(suggestedDocumentCategory("Certificado de Regularidade do FGTS. Certidão de tributos federais").category,"Outros");
});
test("CNPJ audit validates check digits and keeps identity unconfirmed when absent",()=>{
 assert.equal(validNumericCnpj(cnpj),true);assert.equal(validNumericCnpj("11111111111111"),false);
 assert.deepEqual(extractedCnpjs("CNPJ 45.823.828/0001-88 "+cnpj+" 45823828000189"),[cnpj]);
 assert.equal(make("Certidão de tributos federais. CNPJ 45.823.828/0001-88").companyCheck,"matched");
 assert.equal(make("Certidão sem identificação legível").companyCheck,"not_identified");
});
test("audit never assumes validity from emission or arbitrary dates",()=>{
 assert.deepEqual(expiryDates("Emitida em 01/01/2026; nascimento 01/02/1990","2026-10-29"),[]);
 assert.deepEqual(expiryDates("Validade: 31/02/2026","2026-10-29"),[]);
 const dates=expiryDates("Válida até 28/10/2026. Validade: 30/11/2026.","2026-10-29");
 assert.equal(dates.length,2);assert.equal(dates[0].expired,true);assert.equal(dates[1].expired,false);
});
test("automatic report keeps human authenticity, signature and edital checks pending",()=>{
 const report=make("Certidão de tributos federais. CNPJ 45.823.828/0001-88. Válida até 30/11/2026.");
 assert.equal(report.requiresHumanReview,true);assert.equal(report.suggestedCategory,"CND Federal");
 assert.equal(report.checks.find(x=>x.label==="Autenticidade e assinatura").status,"pending");
 assert.equal(report.checks.find(x=>x.label==="Exigências do edital").status,"pending");
 assert.equal("approved" in report,false);
});
test("partial/low confidence reading and positive terms are flagged, never rejected automatically",()=>{
 const report=buildDocumentAudit({text:"Certidão positiva com efeitos de negativa - tributos federais.",expectedCnpj:cnpj,sha256:"a".repeat(64),textHash:"b".repeat(64),extraction:{source:"ocr",pagesRead:1,totalPages:3,partial:true,confidence:50,warnings:["Parcial"]},now});
 assert.equal(report.checks.find(x=>x.label==="Leitura do arquivo").status,"attention");
 assert.equal(report.checks.find(x=>x.label==="Qualidade de OCR").status,"attention");
 assert.equal(report.checks.find(x=>x.label==="Termos que exigem leitura").status,"attention");
 assert.equal(report.requiresHumanReview,true);
});
test("extract evidence enforces bounded pages and confidence without trusting client completeness",()=>{
 assert.equal(validateExtraction({...extraction,pagesRead:1,totalPages:2,partial:false}).partial,true);
 for(const patch of [{pagesRead:41,totalPages:41},{confidence:101},{pagesRead:-1},{source:"approved"}])assert.throws(()=>validateExtraction({...extraction,...patch}));
 assert.throws(()=>make("x".repeat(250001)));
});
