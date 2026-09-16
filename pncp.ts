import crypto from "crypto";
import { HVAC_TERMS, decimalText, normalizedText, procurementFingerprint, safeIsoDate, safeOfficialUrl, safeText, type ProcurementRecord } from "./domain";

const PNCP_ENDPOINT = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
const PNCP_DOCS = "https://pncp.gov.br/api/consulta/swagger-ui/index.html";
const PAGE_SIZE = 50;

function dateParam(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function nested(record: ProcurementRecord, key: string) {
  const value = record[key];
  return value && typeof value === "object" ? value as ProcurementRecord : {};
}

function collectItems(record: ProcurementRecord) {
  const candidates = [record.itens, record.listaItens, record.items];
  const items = candidates.find(Array.isArray);
  if (!Array.isArray(items)) return [];
  return items.map(item => {
    const row = item && typeof item === "object" ? item as ProcurementRecord : {};
    return [row.descricao, row.descricaoItem, row.nome, row.materialOuServicoNome].map(safeText).filter(Boolean).join(" ");
  }).filter(Boolean);
}

export function normalizePncpRecord(raw: unknown, collectedAt: string) {
  const item = raw && typeof raw === "object" ? raw as ProcurementRecord : {};
  const organization = nested(item, "orgaoEntidade");
  const unit = nested(item, "unidadeOrgao");
  const title = safeText(item.objetoContratacao ?? item.objetoCompra ?? item.descricao);
  const controlNumber = safeText(item.numeroControlePNCP ?? item.numeroControlePncp);
  const uf = safeText(unit.ufSigla ?? organization.uf);
  const sourceUrl = safeOfficialUrl(item.linkSistemaOrigem ?? item.url);
  const items = collectItems(item);
  const normalized: ProcurementRecord = {
    id: controlNumber || null,
    numeroControlePncp: controlNumber,
    numeroPregao: safeText(item.numeroCompra ?? item.numeroEdital),
    numeroProcesso: safeText(item.processo ?? item.numeroProcesso),
    titulo: title,
    descricao: safeText(item.informacaoComplementar ?? title),
    orgao: safeText(organization.razaoSocial ?? item.nomeOrgao),
    unidade: safeText(unit.nomeUnidade ?? unit.nome),
    uf: uf?.toUpperCase() ?? null,
    modalidade: safeText(item.modalidadeNome),
    tipoJulgamento: safeText(item.modoDisputaNome ?? item.criterioJulgamentoNome),
    modoDisputa: safeText(item.modoDisputaNome),
    isPriceRegistration: typeof item.srp === "boolean" ? item.srp : null,
    valorEstimado: decimalText(item.valorTotalEstimado),
    dataPublicacao: safeIsoDate(item.dataPublicacaoPncp ?? item.dataPublicacao),
    dataAbertura: safeIsoDate(item.dataAberturaProposta),
    dataFimProposta: safeIsoDate(item.dataEncerramentoProposta),
    linkEdital: sourceUrl,
    plataforma: "PNCP",
    status: "oportunidade",
    source: "PNCP",
    sourceId: "pncp",
    sourceUrl,
    collectedAt,
    lastSeenAt: collectedAt,
    items,
  };
  normalized.fingerprint = procurementFingerprint(normalized);
  normalized.rawHash = crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return normalized;
}

async function fetchPage(url: URL, timeoutMs: number, retries: number) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "ProAR-Licitacoes/2.0" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`PNCP_HTTP_${response.status}`);
        if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === retries) throw error;
        lastError = error;
      } else {
        return { response, payload: await response.json() as unknown };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("PNCP_NETWORK_ERROR");
      if (attempt === retries) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, Math.min(1200, 250 * (attempt + 1))));
  }
  throw lastError ?? new Error("PNCP_UNKNOWN_ERROR");
}

function payloadRows(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as ProcurementRecord;
  for (const key of ["data", "content", "items", "resultado"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function hasNextPage(payload: unknown, currentPage: number, rows: unknown[]) {
  if (!payload || typeof payload !== "object") return rows.length === PAGE_SIZE;
  const record = payload as ProcurementRecord;
  const totalPages = Number(record.totalPaginas ?? record.totalPages ?? 0);
  if (Number.isFinite(totalPages) && totalPages > 0) return currentPage < totalPages;
  const empty = record.paginasRestantes === 0 || record.hasNext === false;
  return !empty && rows.length === PAGE_SIZE;
}

export async function searchPncp(options: {
  uf?: string;
  days?: number;
  terms?: string[];
  maxPages?: number;
  modalityCodes?: number[];
  timeoutMs?: number;
}) {
  const startedAt = Date.now();
  const collectedAt = new Date().toISOString();
  const days = Math.max(1, Math.min(60, Number(options.days) || 14));
  const maxPages = Math.max(1, Math.min(5, Number(options.maxPages) || 2));
  const timeoutMs = Math.max(3000, Math.min(20000, Number(options.timeoutMs) || 9000));
  const uf = safeText(options.uf)?.toUpperCase() ?? null;
  const terms = (options.terms?.length ? options.terms : [...HVAC_TERMS]).slice(0, 40).map(normalizedText).filter(Boolean);
  const modalityCodes = (options.modalityCodes?.length ? options.modalityCodes : [6]).slice(0, 5);
  const start = new Date();
  start.setDate(start.getDate() - days);
  const end = new Date();
  end.setDate(end.getDate() + 30);
  const accepted: ProcurementRecord[] = [];
  let rejected = 0;
  let pagesRead = 0;
  let httpStatus = 200;

  for (const modalityCode of modalityCodes) {
    for (let page = 1; page <= maxPages; page += 1) {
      const url = new URL(PNCP_ENDPOINT);
      url.searchParams.set("dataInicial", dateParam(start));
      url.searchParams.set("dataFinal", dateParam(end));
      url.searchParams.set("codigoModalidadeContratacao", String(modalityCode));
      url.searchParams.set("pagina", String(page));
      url.searchParams.set("tamanhoPagina", String(PAGE_SIZE));
      try {
        const { response, payload } = await fetchPage(url, timeoutMs, 2);
        httpStatus = response.status;
        pagesRead += 1;
        const rows = payloadRows(payload);
        for (const row of rows) {
          const normalized = normalizePncpRecord(row, collectedAt);
          const searchable = normalizedText([normalized.titulo, normalized.descricao, ...(normalized.items as string[] ?? [])].join(" "));
          if (uf && normalized.uf && normalized.uf !== uf) continue;
          if (!normalized.titulo || !normalized.orgao || !terms.some(term => searchable.includes(term))) {
            rejected += 1;
            continue;
          }
          accepted.push(normalized);
        }
        if (!hasNextPage(payload, page, rows)) break;
      } catch (error) {
        return {
          success: false,
          source: "PNCP",
          data: accepted,
          health: {
            status: accepted.length ? "degraded" : "unavailable",
            lastAttemptAt: collectedAt,
            lastSuccessAt: accepted.length ? collectedAt : null,
            durationMs: Date.now() - startedAt,
            httpStatus,
            pagesRead,
            accepted: accepted.length,
            rejected,
            errorCode: error instanceof Error ? error.message : "PNCP_ERROR",
            errorMessage: "A fonte oficial ficou indisponível; resultados já carregados foram preservados.",
            docsUrl: PNCP_DOCS,
          },
        };
      }
    }
  }

  const unique = Array.from(new Map(accepted.map(item => [String(item.numeroControlePncp || item.fingerprint), item])).values());
  return {
    success: true,
    source: "PNCP",
    data: unique,
    health: {
      status: "healthy",
      lastAttemptAt: collectedAt,
      lastSuccessAt: collectedAt,
      durationMs: Date.now() - startedAt,
      httpStatus,
      pagesRead,
      accepted: unique.length,
      rejected,
      duplicates: accepted.length - unique.length,
      docsUrl: PNCP_DOCS,
    },
  };
}
