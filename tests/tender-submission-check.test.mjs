import test from "node:test";
import assert from "node:assert/strict";
import { disputeDestination, extractSubmissionCheck, radarDeadlineKey, submissionDifferences } from "../lib/tender-submission-check.ts";

test("Fronteira: prazo de envio, não abertura da sessão, com evidência e pendências", () => {
  const doc = extractSubmissionCheck(
    `[Página 1] PARTICIPAÇÃO EXCLUSIVA DE MEI, ME, EPP
     CADASTRO DAS PROPOSTAS INICIAIS ATÉ ÀS 08H29MIN DO DIA 01 DE DEZEMBRO DE 2026, NA PLATAFORMA DE LICITAÇÕES WWW.LICITANET.COM.BR.
     ABERTURA DA SESSÃO PÚBLICA: 08H30MIN DO DIA 01 DE DEZEMBRO DE 2026.
     horário de Brasília (DF). TIPO: MENOR PREÇO POR LOTE
     [Página 14] Balanço patrimonial, demonstração de resultado de exercício e demais demonstrações contábeis dos 2 (dois) últimos exercícios sociais
     [Página 15] Liquidez Geral (LG), Liquidez Corrente (LC) e Solvência Geral (SG) maiores que 1,0 (um)
     [Página 20] LOTE I – CLIMATIZADOR EVAPORATIVO DE TETO
     [Página 21] LOTE II – AR CONDICIONADO 7500 BTUs
     [Página 25] LOTE II – AR CONDICIONADO 7500 BTUs`
  );
  assert.deepEqual(doc.deadlines.map(item => [item.value, item.page]), [["2026-12-01T08:29", 1]]);
  assert.equal(doc.platforms[0].value, "Licitanet");
  assert.equal(doc.brasilia, true);
  assert.equal(doc.lots, 2);
  assert.deepEqual(doc.requirements.map(item => item.key).sort(), ["accounts", "exclusive", "lot", "ratios"]);
  assert.deepEqual(submissionDifferences(radarDeadlineKey("2026-12-01T11:30:00Z"), "Compras.gov.br", doc), { deadline: true, platform: true });
  assert.deepEqual(submissionDifferences(radarDeadlineKey("2026-12-01T08:29:00-03:00"), "Licitanet", doc), { deadline: false, platform: false });
});

test("unknowns, competing deadlines, unverified portals and invalid dates remain unconfirmed", () => {
  const doc = extractSubmissionCheck(`[Página 1] ABERTURA DA SESSÃO PÚBLICA: 08H30MIN DO DIA 01 DE DEZEMBRO DE 2026.
    Recebimento de propostas. Encerramento das propostas: 31/02/2026 às 08:30. Local da sessão pública: https://pncp.gov.br.
    [Página 2] Local da sessão pública: https://licitanet.com.br@outro.example. Não será exigido atestado.`);
  assert.deepEqual(doc.deadlines, []);
  assert.deepEqual(doc.platforms, []);
  assert.deepEqual(doc.requirements, []);
  assert.equal(disputeDestination("http://licitanet.com.br/sessao/1"), null);
  assert.equal(disputeDestination("https://licitanet.com.br.outro.example/"), null);
  assert.equal(disputeDestination("javascript:alert(1)"), null);
  assert.equal(radarDeadlineKey("2026-12-01"), "");
  assert.equal(radarDeadlineKey("2026-02-31T08:30:00Z"), "");
  const competing = extractSubmissionCheck(`[Página 1] Encerramento das propostas: 01/12/2026 às 08:29.
    [Página 2] Encerramento das propostas: 02/12/2026 às 08:29.`);
  assert.equal(competing.deadlines.length, 2);
  assert.equal(submissionDifferences("", "", competing).deadline, true);
});

test("a direct approved HTTPS portal link is preserved without using the publishing system", () => {
  assert.deepEqual(disputeDestination("https://licitanet.com.br/sessao/207739"), { platform: "Licitanet", url: "https://licitanet.com.br/sessao/207739" });
  assert.equal(disputeDestination("https://pncp.gov.br/app/editais/1"), null);
  assert.equal(disputeDestination("https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/acompanhamento-compra?compra=1").platform, "Compras.gov.br");
});
