export type ProposalOfficialItem = {
  item: string;
  lote?: string;
  descricao: string;
  unidade: string;
  quantidade: string;
};
export type ProposalSpreadsheetItem = ProposalOfficialItem & {
  lote: string;
  marca: string;
  modelo: string;
  quantidadeMilesimos: number;
  unitarioCentavos: number;
  totalCentavos: number;
  linha: number;
};
export type ProposalSpreadsheetIssue = { linha: number; mensagem: string };
export type ProposalSpreadsheetResult = {
  items: ProposalSpreadsheetItem[];
  issues: ProposalSpreadsheetIssue[];
  totalCentavos: number;
  officialStatus: "not-reviewed" | "matched" | "differences";
};

export const PROPOSAL_CSV_MAX_BYTES = 256_000;
const maxRows = 500;
const maxColumns = 32;
const maxMoneyCents = 999_999_999_999;
const thousand = BigInt(1000);
const fields = ["lote", "item", "descricao", "quantidade", "unidade", "valor_unitario", "marca", "modelo", "total"] as const;
type Field = typeof fields[number];
type Row = { linha: number; cells: string[] };
const normalize = (s: string) => s.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").toLowerCase();
const formula = (s: string) => /^[\s\p{Cf}]*[=+\-@]/u.test(s);
const normalizeId = (v: string) => normalize(v).replace(/^0+(?=\d+$)/, "");
const key = (item: Pick<ProposalOfficialItem, "item" | "lote">) => JSON.stringify([normalizeId(item.lote ?? ""), normalizeId(item.item)]);
const aliases = new Map<string, Field>([
  ...fields.map(field => [field, field] as const),
  ["n_item", "item"], ["numero_item", "item"], ["n_lote", "lote"], ["numero_lote", "lote"],
  ["descricao_item", "descricao"], ["qtd", "quantidade"], ["qtde", "quantidade"],
  ["un", "unidade"], ["und", "unidade"], ["preco_unitario", "valor_unitario"], ["unitario", "valor_unitario"],
  ["valor_unitario_r$", "valor_unitario"], ["valor_total", "total"], ["total_r$", "total"],
]);
const headerName = (s: string) => normalize(s).replace(/[\s()[\]./º°]+/g, "_").replace(/^_|_$/g, "");

function parseRows(text: string, delimiter: "," | ";", firstLine: number): Row[] {
  const rows: Row[] = [];
  let cells: string[] = [];
  let field = "", state: "start" | "text" | "quoted" | "closed" = "start", line = firstLine, rowStart = firstLine;
  const fail = (message: string) => { throw new Error(`Linha ${line}: ${message}`); };
  const pushCell = () => {
    if (field.length > 2000 || cells.length >= maxColumns) fail("A planilha excede o limite por campo ou de colunas.");
    cells.push(field.trim()); field = ""; state = "start";
  };
  const pushRow = () => {
    pushCell();
    if (cells.some(Boolean)) rows.push({ linha: rowStart, cells });
    if (rows.length > maxRows + 1) fail(`Use até ${maxRows} itens por planilha.`);
    cells = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (state === "quoted") {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else state = "closed";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        field += "\n"; line++;
      } else field += c;
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      pushRow(); line++; rowStart = line; continue;
    }
    if (c === delimiter) { pushCell(); continue; }
    if (state === "closed") {
      if (c !== " " && c !== "\t") fail("É esperado um separador depois do fechamento das aspas.");
      continue;
    }
    if (c === '"') {
      if (state !== "start") fail("Aspas inesperadas em campo sem encapsulamento.");
      state = "quoted"; continue;
    }
    if (state === "start" && (c === " " || c === "\t")) continue;
    state = "text";
    field += c;
  }
  if (state === "quoted") fail("Campo com aspas sem fechamento.");
  pushRow();
  return rows;
}

function parseScaled(value: string, decimalPlaces: number, money: boolean) {
  const text = (money ? value.replace(/^R\$\s*/u, "") : value).trim();
  const match = text.match(/^(\d{1,10}|\d{1,3}(?:\.\d{3}){1,3})(?:,(\d+))?$/);
  if (!match || (match[2]?.length ?? 0) > decimalPlaces) return null;
  const scaled = Number(match[1].replace(/\./g, "") + (match[2] ?? "").padEnd(decimalPlaces, "0"));
  return Number.isSafeInteger(scaled) ? scaled : null;
}
const quantityScaled = (input: string) => parseScaled(input, 3, false);
const formatQuantity = (scaled: number) => (scaled / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const formatProposalValue = (scaled: number) => (scaled / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const moneyCsv = (scaled: number) => (scaled / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

function mapHeader(row: Row | undefined): Map<Field, number> {
  const map = new Map<Field, number>();
  for (const [i, header] of (row?.cells ?? []).entries()) {
    const name = aliases.get(headerName(header));
    if (!name) continue;
    if (map.has(name)) throw new Error(`Repita a importação com uma única coluna “${name}”.`);
    map.set(name, i);
  }
  return map;
}

function decode(text: string, compareOnly: boolean) {
  if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) throw new Error("Arquivo vazio ou formato incompatível. Salve a planilha como CSV UTF-8.");
  if (new TextEncoder().encode(text).length > PROPOSAL_CSV_MAX_BYTES) throw new Error("O CSV deve ter até 256 KB.");
  const withoutBom = text.replace(/^\uFEFF/, "");
  const excelDirective = withoutBom.match(/^sep=([;,])(?:\r\n|\n|\r)/i);
  const body = excelDirective ? withoutBom.slice(excelDirective[0].length) : withoutBom;
  const required: Field[] = ["item", "descricao", "quantidade", "unidade"];
  if (!compareOnly) required.push("valor_unitario");
  let structuralError = "";
  const delimiters: readonly ("," | ";")[] = excelDirective ? [excelDirective[1] as "," | ";"] : [";", ","];
  for (const delimiter of delimiters) {
    try {
      const rows = parseRows(body, delimiter, excelDirective ? 2 : 1), headers = mapHeader(rows[0]);
      if (required.every(field => headers.has(field))) {
        if (rows.length < 2) throw new Error("O CSV tem cabeçalho, mas não contém itens.");
        return { rows, headers };
      }
    } catch (error) {
      if (!structuralError && error instanceof Error) structuralError = error.message;
    }
  }
  throw new Error(structuralError || `Confira o cabeçalho. Colunas obrigatórias: ${required.join(", ")}.`);
}

function inspectRows(text: string, compareOnly: boolean) {
  const items: ProposalSpreadsheetItem[] = [], issues: ProposalSpreadsheetIssue[] = [];
  let totalCentavos = 0;
  const seen = new Set<string>();
  let rows: Row[], headers: Map<Field, number>;
  try { ({ rows, headers } = decode(text, compareOnly)); }
  catch (error) { return { items, issues: [{ linha: 0, mensagem: (error as Error).message }], totalCentavos }; }
  for (const row of rows.slice(1)) {
    const invalid = (mensagem: string) => issues.push({ linha: row.linha, mensagem });
    if (row.cells.length !== rows[0].cells.length) { invalid("O número de colunas não confere com o cabeçalho."); continue; }
    const get = (field: Field) => { const index = headers.get(field); return index === undefined ? "" : row.cells[index]; };
    const item = get("item"), lote = get("lote"), descricao = get("descricao"), unidade = get("unidade");
    const marca = get("marca"), modelo = get("modelo"), qtd = quantityScaled(get("quantidade"));
    if (row.cells.some(formula)) { invalid("Não use fórmulas no CSV; substitua por valores."); continue; }
    if (!item || !descricao || !unidade) { invalid("Preencha item, descrição e unidade."); continue; }
    if (item.length > 40 || lote.length > 40 || unidade.length > 60 || descricao.length > 500 || marca.length > 100 || modelo.length > 100) {
      invalid("Reduza os campos longos: descrição até 500 caracteres, marca/modelo até 100, unidade até 60 e item/lote até 40."); continue;
    }
    if (qtd === null || qtd <= 0 || qtd > 999_999_999) { invalid("Quantidade deve ser positiva (até 999.999,999) com até três casas decimais."); continue; }
    const unitario = compareOnly ? 0 : parseScaled(get("valor_unitario"), 2, true);
    if (unitario === null || (!compareOnly && unitario <= 0) || unitario > maxMoneyCents) { invalid("Valor unitário deve ser positivo e ter até duas casas decimais."); continue; }
    const total = Number((BigInt(unitario) * BigInt(qtd) + BigInt(500)) / thousand);
    if (!compareOnly && total === 0) { invalid("O total do item deve ser de pelo menos R$ 0,01."); continue; }
    if (total > maxMoneyCents || totalCentavos + total > maxMoneyCents) { invalid("O total excede o limite da planilha."); continue; }
    if (!compareOnly && get("total") && parseScaled(get("total"), 2, true) !== total) {
      invalid(`Total informado não confere. Quantidade × valor unitário: ${formatProposalValue(total)}.`); continue;
    }
    const proposed = { item, lote, descricao, unidade, quantidade: formatQuantity(qtd), quantidadeMilesimos: qtd, unitarioCentavos: unitario, totalCentavos: total, marca, modelo, linha: row.linha };
    if (seen.has(key(proposed))) { invalid("Item repetido no mesmo lote."); continue; }
    seen.add(key(proposed)); items.push(proposed); totalCentavos += total;
  }
  return { items, issues, totalCentavos };
}

export function parseOfficialProposalSpreadsheet(text: string) {
  const { issues, items } = inspectRows(text, true);
  const officialItems: ProposalOfficialItem[] = issues.length ? [] : items.map(({ item, lote, descricao, unidade, quantidade }) => ({ item, lote, descricao, unidade, quantidade }));
  return { officialItems, issues };
}

export function reviewProposalSpreadsheet(text: string, officialItems?: readonly ProposalOfficialItem[]): ProposalSpreadsheetResult {
  const result = inspectRows(text, false);
  if (!officialItems?.length) return { ...result, officialStatus: "not-reviewed" };
  const compare: ProposalSpreadsheetIssue[] = [];
  const official = new Map<string, ProposalOfficialItem>();
  for (const item of officialItems) {
    if (!item.item?.trim() || !item.descricao?.trim() || !item.unidade?.trim() || (quantityScaled(item.quantidade) ?? 0) <= 0 || official.has(key(item))) {
      compare.push({ linha: 0, mensagem: "A referência de itens do edital está incompleta ou contém item repetido. Revise a base oficial." });
      break;
    }
    official.set(key(item), item);
  }
  if (!compare.length) {
    const lots = new Set(result.items.map(row => normalizeId(row.lote)).filter(Boolean));
    const included = new Set(result.items.map(key));
    for (const row of result.items) {
      const ref = official.get(key(row));
      if (!ref) { compare.push({ linha: row.linha, mensagem: "Item/lote não localizado na referência do edital." }); continue; }
      const differences = [
        [row.quantidadeMilesimos !== quantityScaled(ref.quantidade), "quantidade"],
        [normalize(row.unidade) !== normalize(ref.unidade), "unidade"],
        [normalize(row.descricao) !== normalize(ref.descricao), "descrição"],
      ].filter(([changed]) => changed).map(([, label]) => label);
      if (differences.length) compare.push({ linha: row.linha, mensagem: `Divergência na referência do edital: ${differences.join(", ")}.` });
    }
    for (const row of official.values()) {
      if (row.lote && lots.has(normalizeId(row.lote)) && !included.has(key(row))) {
        compare.push({ linha: 0, mensagem: `Falta o item ${row.item} do lote ${row.lote} na proposta.` });
      }
    }
  }
  return { ...result, issues: [...result.issues, ...compare], officialStatus: result.issues.length || compare.length ? "differences" : "matched" };
}

const csvCell = (value: string) => `"${(formula(value) ? "'" + value : value).replace(/"/g, '""')}"`;
export function proposalDraftCsv(review: ProposalSpreadsheetResult) {
  if (review.issues.length || !review.items.length) throw new Error("Corrija as pendências antes de baixar o rascunho.");
  const head = [...fields, "situacao"];
  const flag = review.officialStatus === "matched" ? "RASCUNHO INTERNO • comparado com a referência fornecida" : "RASCUNHO INTERNO • não conferido com o edital";
  const data = review.items.map(item => [item.lote, item.item, item.descricao, item.quantidade, item.unidade, moneyCsv(item.unitarioCentavos), item.marca, item.modelo, moneyCsv(item.totalCentavos), flag].map(csvCell).join(";"));
  return "\uFEFF" + [head.join(";"), ...data].join("\r\n") + "\r\n";
}

export const proposalCsvTemplate = "\uFEFF" + fields.join(";") + "\r\n";
