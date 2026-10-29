import test from "node:test";
import assert from "node:assert/strict";
import {tenderSearchMatches,pncpProposalQuery,withinTenderWindow} from "../lib/procurement/search-relevance.ts";
import {parseOlimpiaDetail,olimpiaDetailLinks,fetchOlimpiaTenders} from "../lib/procurement/olimpia-connector.ts";
import {municipalTenderDate} from "../lib/tender-date.ts";
test("HVAC search includes mixed refrigeration lots and climatizadores without literal phrase match",()=>{
 const object="MANUTENÇÃO DE EQUIPAMENTOS (BEBEDOUROS; FREEZERS; CLIMATIZADORES) EM UNIDADES ESCOLARES";
 for(const q of ["ar condicionado","climatização","", "13609/2026","São José do Rio Preto"])assert.equal(tenderSearchMatches(object,object+" São José do Rio Preto 13609/2026",q),true);
 assert.equal(tenderSearchMatches("Compra de mobiliário","Compra de mobiliário",""),false);
 assert.equal(tenderSearchMatches(object,object+" Rio Preto","Olímpia"),false);
 assert.equal(tenderSearchMatches("Manutenção ar-condicionado","Manutenção ar-condicionado","ar condicionado"),true);
});
test("PNCP open-proposal query supplies modality and optional municipality without publication start",()=>{
 const q=pncpProposalQuery("20271029","SP",12,2,"3533908");
 assert.equal(q.get("codigoModalidadeContratacao"),"12");assert.equal(q.get("dataFinal"),"20271029");assert.equal(q.get("codigoMunicipioIbge"),"3533908");assert.equal(q.get("pagina"),"2");assert.equal(q.has("dataInicial"),false);
});
test("long-lived enrollment survives old publication date while expired deadlines do not",()=>{
 const start=Date.parse("2026-10-29T00:00:00-03:00"),end=start+366*86400000;
 assert.equal(withinTenderWindow("2027-06-16T09:00:00-03:00","2026-06-16",start,end),true);
 assert.equal(withinTenderWindow("2026-06-16T09:00:00-03:00","2026-06-16",start,end),false);
 assert.equal(withinTenderWindow(undefined,undefined,start,end,false),false);
});
const html="<h1>Licitação</h1><div>Situação Aberto Modalidade Credenciamento Nº da Licitação 7/2026 Nº do Processo 163499/2026 Publicado em 16/06/2026 às 09h00 Realização em 16/06/2026 às 09h00</div><section>Aviso de Licitação Chamamento Público – Edital de Credenciamento nº 07/2026 Objeto: Prestação de serviços de instalação, manutenção e higienização em ar-condicionado. Início do recebimento: 16/06/2026 às 09h. Encerramento: 16/06/2027 às 09h. Edital completo no portal. Secretarias Vinculadas</section>";
test("official municipal detail uses enrollment end, exact origin and process identity",()=>{
 const item=parseOlimpiaDetail(html,"https://www.olimpia.sp.gov.br/portal/editais/0/1/5114/");
 assert.equal(item.numeroCompra,"7/2026");assert.equal(item.modalidadeNome,"Credenciamento");
 assert.equal(item.dataEncerramentoProposta,"2027-06-16T12:00:00.000Z");
 assert.equal(item.sequencialCompra,undefined);assert.equal(item.numeroControlePNCP,undefined);
 assert.equal(parseOlimpiaDetail(html,"https://evil.example/portal/editais/0/1/5114/"),null);
 assert.equal(parseOlimpiaDetail("<h1>Indisponível</h1>","https://www.olimpia.sp.gov.br/portal/editais/0/1/5114/"),null);
 assert.deepEqual(olimpiaDetailLinks('<a href="/portal/editais/0/1/5114/">Manutenção de ar-condicionado</a><a href="https://evil.example/portal/editais/0/1/1/">ar condicionado</a>'),["https://www.olimpia.sp.gov.br/portal/editais/0/1/5114/"]);
});
test("municipal deadline prioritizes explicit closing and validates calendar",()=>{
 assert.equal(municipalTenderDate("Realização em 16/06/2026 às 09h00 Encerramento: 16/06/2027 às 09h."),"2027-06-16T12:00:00.000Z");
 assert.equal(municipalTenderDate("Encerramento: 31/02/2027 às 09h"),undefined);
 assert.equal(municipalTenderDate("Encerramento: 16/06/2027"),undefined);
});
test("connector never invents records when official pages fail",async()=>{
 const result=await fetchOlimpiaTenders(async()=>{throw new Error("offline");});
 assert.deepEqual(result.items,[]);assert.equal(result.diagnostic.status,"error");
});
