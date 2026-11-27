import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOfficialProposalSpreadsheet,
  PROPOSAL_CSV_MAX_BYTES,
  proposalDraftCsv,
  reviewProposalSpreadsheet,
} from "../lib/proposal-spreadsheet.ts";

const header = "lote;item;descrição;quantidade;unidade;valor_unitário;total;marca;modelo\n";
const sample = header + '01;1;"Manutenção; split 24.000";2,5;un;R$ 1.000,01;2.500,03;Elgin;Eco Dream\r\n';

test("converte CSV UTF-8 pt-BR com aspas, BOM e separador Excel sem erros de arredondamento", () => {
  const review = reviewProposalSpreadsheet("\uFEFFsep=;\r\n" + sample);
  assert.deepEqual(review.issues, []);
  assert.equal(review.officialStatus, "not-reviewed");
  assert.equal(review.totalCentavos, 250003);
  assert.deepEqual(review.items.map(({ descricao, unitarioCentavos, quantidade, marca, modelo }) => ({ descricao, unitarioCentavos, quantidade, marca, modelo })), [
    { descricao: "Manutenção; split 24.000", unitarioCentavos: 100001, quantidade: "2,5", marca: "Elgin", modelo: "Eco Dream" },
  ]);
  const csv = proposalDraftCsv(review);
  assert.match(csv, /RASCUNHO INTERNO • não conferido com o edital/);
  assert.match(csv, /"2500,03"/);
  assert.equal(reviewProposalSpreadsheet(csv).totalCentavos, 250003);
});

test("aceita vírgula como delimitador, aspas escapadas e identificação de linha física", () => {
  const review = reviewProposalSpreadsheet('item,descricao,quantidade,unidade,valor_unitario\r\n1,"Split ""Premium""\r\ncom suporte","1,25",UN,"92,08"\r\n2,Novo,abc,UN,"20,00"');
  assert.equal(review.items[0].descricao, 'Split "Premium"\ncom suporte');
  assert.equal(review.totalCentavos, 11510);
  assert.equal(review.issues[0].linha, 4);
  assert.throws(() => proposalDraftCsv(review), /pendências/);
});

test("bloqueia totais divergentes, fórmula, número de colunas e duplicidade no mesmo lote", () => {
  const review = reviewProposalSpreadsheet(sample +
    "01;01;Duplicado;1;un;1;1;;\n" +
    "01;2;Total incorreto;2;un;1,99;3,97;;\n" +
    "01;3;=HYPERLINK(MAL);1;un;1;1;;\n" +
    "01;4;Sem coluna;1;un;1;1\n" +
    "02;1;Outro lote;1;un;0,01;0,01;;\n");
  assert.equal(review.items.length, 2);
  assert.deepEqual(review.issues.map(item => item.linha), [3, 4, 5, 6]);
  assert.match(review.issues[0].mensagem, /repetido/);
  assert.match(review.issues[1].mensagem, /Total informado não confere/);
  assert.match(review.issues[2].mensagem, /Não use fórmulas/);
  assert.match(review.issues[3].mensagem, /número de colunas/);
  assert.throws(() => proposalDraftCsv(review), /pendências/);
});

test("compara identificação, descrição, unidade e quantidade, sinaliza item ausente no lote cotado", () => {
  const ref = parseOfficialProposalSpreadsheet("lote;item;descricao;unidade;qtd\n1;01;MANUTENCAO, preventiva;UN;2,5\n1;2;Manutenção corretiva;un;1\n99;1;Fora do escopo;hr;2\n");
  assert.equal(ref.issues.length, 0);
  const first = sample.replace('"Manutenção; split 24.000"', '"Manutenção, preventiva"');
  const incomplete = reviewProposalSpreadsheet(first, ref.officialItems);
  assert.equal(incomplete.officialStatus, "differences");
  assert.match(incomplete.issues[0].mensagem, /Falta o item 2 do lote 1/);
  const complete = reviewProposalSpreadsheet(first + "1;2;Manutenção corretiva;1;un;105,20;105,20;;\n", ref.officialItems);
  assert.equal(complete.officialStatus, "matched");
  assert.equal(complete.totalCentavos, 260523);
  assert.match(proposalDraftCsv(complete), /comparado com a referência fornecida/);
  const wrong = reviewProposalSpreadsheet(sample.replace(";2,5;un;", ";3;m;").replace(";2.500,03;", ";;"), ref.officialItems);
  assert.match(wrong.issues[0].mensagem, /quantidade, unidade, descrição/);
});

test("permite cotar subconjunto de itens independentes e não confirma uma referência vazia", () => {
  const official = [
    { item: "2", descricao: "PMOC", unidade: "serviço", quantidade: "1" },
    { item: "3", descricao: "Instalação", unidade: "serviço", quantidade: "2" },
  ];
  const item = header + ";3;Instalação;2;serviço;2200,98;4401,96;;\n";
  assert.equal(reviewProposalSpreadsheet(item, official).officialStatus, "matched");
  assert.equal(reviewProposalSpreadsheet(item, []).officialStatus, "not-reviewed");
  assert.equal(reviewProposalSpreadsheet(item, [official[0], official[0]]).officialStatus, "differences");
});

test("recusa CSV malformado, schema ambíguo, arquivo vazio e tamanho acima do limite", () => {
  for (const input of [
    "",
    'item;descricao;quantidade;unidade;valor_unitario\n1;"aberta',
    'item;descricao;quantidade;qtd;unidade;valor_unitario\n1;PMOC;1;1;un;20,00',
    'item;descricao;quantidade;unidade\n1;PMOC;1;un',
    "x".repeat(PROPOSAL_CSV_MAX_BYTES+1),
  ]) {
    const review = reviewProposalSpreadsheet(input);
    assert.equal(review.items.length, 0);
    assert.ok(review.issues.length);
    assert.throws(() => proposalDraftCsv(review), /pendências/);
  }
});

test("não aceita base parcial quando a própria planilha de referência tem erros", () => {
  const reference = parseOfficialProposalSpreadsheet("item;descricao;quantidade;unidade\n1;PMOC;1;un\n2;;1;un");
  assert.equal(reference.officialItems.length, 0);
  assert.equal(reference.issues[0].linha, 3);
});
