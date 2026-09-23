import { NextRequest, NextResponse } from "next/server";
import { municipalityDistances } from "../../../lib/municipality-distances";

const PNCP_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
const PNCP_CONSULTA_BASE = "https://pncp.gov.br/api/consulta/v1";
const COMPRAS_URL = "https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133";
const UFS = ["SP", "MG", "MS", "PR", "GO"] as const;
const MODALITIES = [4, 5, 6, 7, 8, 9, 12] as const;
const REQUEST_TIMEOUT_MS = 6500;
const COMPRAS_TIMEOUT_MS = 7000;
const MAX_RETRIES = 1;
const PNCP_CONCURRENCY = 3;
const COMPRAS_CONCURRENCY = 2;
const CITY_CODES: Record<string, { ibge: string; distance: number }> = {
  "jose bonifacio": { ibge: "3525706", distance: 62 },
};
const climateTerms = /ar\s*-?\s*condicionado|condicionador(?:es)? de ar|climatiza|refrigera|pmoc|hvac|split|multi\s*split|cassete|piso\s*teto|evaporador|condensador|chiller|vrf|fluido refrigerante|g[aá]s refrigerante|compressor frigor[ií]fico/i;
const excludedTerms = /purificador(?:es)? de [aá]gua|equipamento fotodocumentador|mobili[aá]rio|geladeira dom[eé]stica|bebedouro(?!.*refrigera)/i;

const cityDistances: Record<string, number> = {
  mirassol:0,"sao jose do rio preto":15,jaci:21,"bady bassitt":22,balsamo:29,"neves paulista":32,cedral:34,"monte aprazivel":41,potirendaba:43,tanabi:45,ibira:48,catanduva:58,olimpia:62,"nova granada":67,"novo horizonte":75,votuporanga:77,"paulo de faria":92,barretos:105,bebedouro:112,fernandopolis:120,"santa fe do sul":126,aracatuba:135,jaboticabal:145,lins:152,"sao joaquim da barra":185,franca:220,"ribeirao preto":225,bauru:230,"sao carlos":265,araraquara:270,"presidente prudente":285,"mogi guacu":295,"pocos de caldas":300
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export type PncpTender = {
  numeroControlePNCP?: string; objetoCompra?: string; modalidadeNome?: string;
  dataEncerramentoProposta?: string; valorTotalEstimado?: number; linkSistemaOrigem?: string;
  dataPublicacaoPncp?: string;
  anoCompra?: number; sequencialCompra?: number; usuarioNome?: string;
  sourcePortal?: "PNCP" | "Compras.gov.br" | "BLL Compras" | "Licitações-e";
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string; nomeUnidade?: string; codigoIbge?: string };
  distanciaMirassol?: number;
};

type SourceDiagnostic = {
  source: string;
  status: "ok" | "error";
  attempts: number;
  durationMs: number;
  count: number;
  error?: string;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isRetryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /(^|\s)(408|425|429|500|502|503|504)(\s|$)|timeout|abort|fetch failed|network/i.test(message);
}

async function withRetry<T>(label: string, operation: () => Promise<T>, maxRetries = MAX_RETRIES) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    try {
      return { value: await operation(), attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt > maxRetries || !isRetryable(error)) break;
      await sleep(350 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`${label}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function runLimited<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const run = async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function identifySource(item: PncpTender): PncpTender["sourcePortal"] {
  const origin = normalize(`${item.linkSistemaOrigem ?? ""} ${item.usuarioNome ?? ""}`);
  if (/bllcompras|bll compras|bolsa de licitacoes do brasil/.test(origin)) return "BLL Compras";
  if (/licitacoes-e|licitacoes e|licitacao-e|bb\.com\.br/.test(origin)) return "Licitações-e";
  if (/comprasnet|compras\.gov|cnetmobile|serpro/.test(origin)) return "Compras.gov.br";
  return "PNCP";
}

async function fetchPage(dataInicial: string, dataFinal: string, uf: string, page = 1) {
  const query = new URLSearchParams({ dataInicial, dataFinal, pagina: String(page), tamanhoPagina: "50", uf });
  const result = await withRetry(`PNCP-${uf}-página-${page}`, async () => {
    const response = await fetch(`${PNCP_URL}?${query}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
        "User-Agent": "ProAR-Licitacoes/1.0 (+https://polartech.proar.online)",
        Referer: "https://polartech.proar.online/",
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`respondeu ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data as PncpTender[] : [];
  });
  return { items: result.value, attempts: result.attempts };
}

async function fetchPages(dataInicial: string, dataFinal: string, uf: string, maxPages = 5) {
  const items: PncpTender[] = [];
  let attempts = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const current = await fetchPage(dataInicial, dataFinal, uf, page);
    attempts += current.attempts;
    items.push(...current.items);
    if (current.items.length < 50) break;
  }
  return { items, attempts };
}

type ComprasTender = {
  numeroControlePNCP?: string; anoCompraPncp?: number; sequencialCompraPncp?: number;
  objetoCompra?: string; modalidadeNome?: string; dataEncerramentoPropostaPncp?: string;
  dataPublicacaoPncp?: string; valorTotalEstimado?: number; orgaoEntidadeCnpj?: string;
  orgaoEntidadeRazaoSocial?: string; unidadeOrgaoMunicipioNome?: string;
  unidadeOrgaoUfSigla?: string; unidadeOrgaoNomeUnidade?: string;
  unidadeOrgaoCodigoIbge?: number; linkSistemaOrigem?: string;
};

function mapComprasTender(item: ComprasTender): PncpTender {
  return {
    numeroControlePNCP: item.numeroControlePNCP,
    anoCompra: item.anoCompraPncp,
    sequencialCompra: item.sequencialCompraPncp,
    objetoCompra: item.objetoCompra,
    modalidadeNome: item.modalidadeNome,
    dataEncerramentoProposta: item.dataEncerramentoPropostaPncp,
    dataPublicacaoPncp: item.dataPublicacaoPncp,
    valorTotalEstimado: item.valorTotalEstimado,
    linkSistemaOrigem: item.linkSistemaOrigem,
    usuarioNome: "Compras.gov.br",
    sourcePortal: "Compras.gov.br",
    orgaoEntidade: { razaoSocial: item.orgaoEntidadeRazaoSocial, cnpj: item.orgaoEntidadeCnpj },
    unidadeOrgao: {
      municipioNome: item.unidadeOrgaoMunicipioNome,
      ufSigla: item.unidadeOrgaoUfSigla,
      nomeUnidade: item.unidadeOrgaoNomeUnidade,
      codigoIbge: item.unidadeOrgaoCodigoIbge ? String(item.unidadeOrgaoCodigoIbge) : undefined,
    },
  };
}

async function fetchCompras(dataInicial: string, dataFinal: string, codigoModalidade: number, municipalityCode?: string) {
  const query = new URLSearchParams({
    dataPublicacaoPncpInicial: dataInicial,
    dataPublicacaoPncpFinal: dataFinal,
    codigoModalidade: String(codigoModalidade),
    unidadeOrgaoUfSigla: "SP",
    pagina: "1",
    tamanhoPagina: "500",
  });
  if (municipalityCode) query.set("unidadeOrgaoCodigoIbge", municipalityCode);
  const result = await withRetry(`Compras.gov.br-modalidade-${codigoModalidade}`, async () => {
    const response = await fetch(`${COMPRAS_URL}?${query}`, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
        "User-Agent": "ProAR-Licitacoes/1.0 (+https://polartech.proar.online)",
        Referer: "https://polartech.proar.online/",
      },
      next: { revalidate: 300 }, signal: AbortSignal.timeout(COMPRAS_TIMEOUT_MS),
    });
    if (!response.ok && municipalityCode && response.status === 404) return [];
    if (!response.ok) throw new Error(`respondeu ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload?.resultado) ? (payload.resultado as ComprasTender[]).map(mapComprasTender) : [];
  });
  return { items: result.value, attempts: result.attempts };
}

async function readMonitorStore() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { items: [] as PncpTender[], lastScan: null as string | null, lastError: "" };
  const response = await fetch(`${url}/rest/v1/proar_state?id=eq.licitacoes&select=payload`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return { items: [] as PncpTender[], lastScan: null as string | null, lastError: "" };
  const rows = await response.json();
  return rows[0]?.payload ?? { items: [], lastScan: null, lastError: "" };
}

function filterStoredItems(items: PncpTender[], term: string, radius: number) {
  const normalizedTerm = normalize(term);
  return items.filter(item => {
    const searchable = normalize(`${item.objetoCompra ?? ""} ${item.orgaoEntidade?.razaoSocial ?? ""} ${item.unidadeOrgao?.municipioNome ?? ""} ${item.unidadeOrgao?.nomeUnidade ?? ""}`);
    return (!normalizedTerm || searchable.includes(normalizedTerm)) && (item.distanciaMirassol ?? 0) <= radius;
  });
}

async function searchAutomaticTenders(options?: { start?: Date; end?: Date; radius?: number; all?: boolean; term?: string }) {
  const today = options?.start ?? new Date();
  const end = options?.end ?? new Date(today.getTime() + 60 * 86400000);
  const dataInicial = today.toISOString().slice(0, 10).replaceAll("-", "");
  const dataFinal = end.toISOString().slice(0, 10).replaceAll("-", "");
  const publicationStart = new Date(today.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const publicationEnd = today.toISOString().slice(0, 10);
  const normalizedTerm = normalize(options?.term ?? "");
  const municipality = Object.entries(CITY_CODES).find(([name]) => normalizedTerm.includes(name))?.[1];

  // Cada UF/modalidade é independente: limitar concorrência evita sobrecarga
  // do PNCP e retryar somente falhas transitórias mantém resultados parciais.
  const startedAt = new Map<string, number>();
  const [pncpSettled, comprasSettled] = await Promise.all([
    runLimited(municipality ? [] : UFS, PNCP_CONCURRENCY, async uf => {
      const key = `PNCP-${uf}`; startedAt.set(key, Date.now());
      const value = await fetchPages(dataInicial, dataFinal, uf);
      return { value, diagnostic: { source: key, status: "ok" as const, attempts: value.attempts, durationMs: Date.now() - (startedAt.get(key) ?? Date.now()), count: value.items.length } };
    }),
    runLimited(MODALITIES, COMPRAS_CONCURRENCY, async code => {
      const key = `Compras.gov.br-${code}`; startedAt.set(key, Date.now());
      const value = await fetchCompras(publicationStart, publicationEnd, code, municipality?.ibge);
      return { value, diagnostic: { source: key, status: "ok" as const, attempts: value.attempts, durationMs: Date.now() - (startedAt.get(key) ?? Date.now()), count: value.items.length } };
    }),
  ]);
  const raw = [
    ...pncpSettled.flatMap(result => result.status === "fulfilled" ? result.value.value.items : []),
    ...comprasSettled.flatMap(result => result.status === "fulfilled" ? result.value.value.items : []),
  ];
  const diagnostics: SourceDiagnostic[] = [
    ...pncpSettled.map((result, index) => result.status === "fulfilled" ? result.value.diagnostic : { source: `PNCP-${UFS[index]}`, status: "error" as const, attempts: MAX_RETRIES + 1, durationMs: Date.now() - (startedAt.get(`PNCP-${UFS[index]}`) ?? Date.now()), count: 0, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }),
    ...comprasSettled.map((result, index) => result.status === "fulfilled" ? result.value.diagnostic : { source: `Compras.gov.br-${MODALITIES[index]}`, status: "error" as const, attempts: MAX_RETRIES + 1, durationMs: Date.now() - (startedAt.get(`Compras.gov.br-${MODALITIES[index]}`) ?? Date.now()), count: 0, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }),
  ];
  const failedSources = diagnostics.filter(item => item.status === "error").map(item => item.source);
  for (const item of diagnostics.filter(item => item.status === "error")) console.warn("PNCP source unavailable", item);

  const radius = options?.radius ?? 300;
  const startTime = new Date(today.toISOString().slice(0, 10) + "T00:00:00-03:00").getTime();
  const endTime = new Date(end.toISOString().slice(0, 10) + "T23:59:59-03:00").getTime();
  const term = normalizedTerm;
  const filtered = raw.filter(item => {
    const object = item.objetoCompra ?? "";
    const searchable = normalize(`${object} ${item.orgaoEntidade?.razaoSocial ?? ""} ${item.unidadeOrgao?.municipioNome ?? ""} ${item.unidadeOrgao?.nomeUnidade ?? ""}`);
    if (!options?.all && (term ? !searchable.includes(term) : (!climateTerms.test(object) || excludedTerms.test(object)))) return false;
    const closing = item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta).getTime() : 0;
    const published = item.dataPublicacaoPncp ? new Date(item.dataPublicacaoPncp).getTime() : 0;
    // O conjunto do Compras.gov.br nem sempre informa o encerramento. Nesses casos,
    // mantém publicações recentes; registros com encerramento conhecido e vencido saem.
    if (closing ? (closing < startTime || closing > endTime) : (!published || published < today.getTime() - 60 * 86400000)) return false;
    const municipalityName = normalize(item.unidadeOrgao?.municipioNome ?? "");
    const distance = municipalityDistances[String(item.unidadeOrgao?.codigoIbge ?? "")] ?? CITY_CODES[municipalityName]?.distance ?? cityDistances[municipalityName];
    if (distance === undefined || distance > radius) return false;
    item.distanciaMirassol = distance;
    item.sourcePortal = item.sourcePortal ?? identifySource(item);
    return true;
  });
  const unique = Array.from(new Map(filtered.map(item => [item.numeroControlePNCP || `${item.orgaoEntidade?.cnpj}-${item.anoCompra}-${item.sequencialCompra}`, item])).values());
  unique.sort((a, b) => new Date(a.dataEncerramentoProposta ?? 0).getTime() - new Date(b.dataEncerramentoProposta ?? 0).getTime());
  return { data: unique.slice(0, 500), failedSources, diagnostics };
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("detail") === "1") {
      const cnpj = (request.nextUrl.searchParams.get("cnpj") ?? "").replace(/\D/g, "");
      const ano = Number(request.nextUrl.searchParams.get("ano") ?? 0);
      const sequencial = Number(request.nextUrl.searchParams.get("sequencial") ?? 0);
      if (cnpj.length !== 14 || !ano || !sequencial) return NextResponse.json({ data: null, error: "Identificadores da contratação incompletos." }, { status: 400 });
      try {
        const response = await fetch(`${PNCP_CONSULTA_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!response.ok) return NextResponse.json({ data: null, warning: `O PNCP não retornou os detalhes desta contratação (${response.status}).` }, { status: 502 });
        return NextResponse.json({ data: await response.json(), source: "PNCP consulta detalhada" });
      } catch (error) {
        console.error("PNCP detail failed", error);
        return NextResponse.json({ data: null, warning: "O PNCP demorou para responder aos detalhes desta contratação. Tente novamente ou abra o edital oficial." }, { status: 504 });
      }
    }
    if (request.nextUrl.searchParams.get("documents") === "1") {
      const cnpj = (request.nextUrl.searchParams.get("cnpj") ?? "").replace(/\D/g, "");
      const ano = Number(request.nextUrl.searchParams.get("ano") ?? 0);
      const sequencial = Number(request.nextUrl.searchParams.get("sequencial") ?? 0);
      if (cnpj.length !== 14 || !ano || !sequencial) return NextResponse.json({ data: [], error: "Identificadores da contratação incompletos." }, { status: 400 });
      const response = await fetch(`${PNCP_CONSULTA_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(6500) });
      if (!response.ok) return NextResponse.json({ data: [], warning: `O PNCP não retornou os documentos desta contratação (${response.status}).` });
      const payload = await response.json();
      const docs = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      return NextResponse.json({ data: docs });
    }
    if (request.nextUrl.searchParams.get("monitor") === "1") {
      const store = await readMonitorStore();
      return NextResponse.json({ data: store.items ?? [], lastScan: store.lastScan, warning: store.lastError ?? "", source: "Monitor oficial PNCP" });
    }
    const startParam = request.nextUrl.searchParams.get("dataInicial");
    const endParam = request.nextUrl.searchParams.get("dataFinal");
    const start = startParam ? new Date(`${startParam}T12:00:00-03:00`) : new Date();
    const end = endParam ? new Date(`${endParam}T23:59:59-03:00`) : new Date(Date.now() + 60 * 86400000);
    const radius = Math.min(300, Math.max(1, Number(request.nextUrl.searchParams.get("raio") ?? 300)));
    const term = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const result = await searchAutomaticTenders({ start, end, radius, all: !term, term });

    if (!result.data.length && result.failedSources.length >= UFS.length) {
      const store = await readMonitorStore();
      const storedMatches = filterStoredItems(store.items ?? [], term, radius);
      if (storedMatches.length) return NextResponse.json({ data: storedMatches, lastScan: store.lastScan, source: "Última busca válida filtrada", radius, warning: "Consulta oficial temporariamente indisponível; exibindo somente resultados salvos compatíveis com a pesquisa." });
    }

    const portalCounts = result.data.reduce<Record<string, number>>((acc, item) => {
      const portal = item.sourcePortal ?? "PNCP"; acc[portal] = (acc[portal] ?? 0) + 1; return acc;
    }, {});
    return NextResponse.json({
      data: result.data, source: "PNCP e portais de origem", radius, portalCounts, partial: result.failedSources.length > 0, sourceDiagnostics: result.diagnostics,
      warning: result.failedSources.length ? `Consulta parcial: ${result.failedSources.join(", ")} não respondeu. Os demais resultados foram carregados.` : "",
    });
  } catch (error) {
    console.error("PNCP search failed", error);
    const store = await readMonitorStore();
    const term = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const radius = Math.min(300, Math.max(1, Number(request.nextUrl.searchParams.get("raio") ?? 300)));
    const storedMatches = filterStoredItems(store.items ?? [], term, radius);
    if (storedMatches.length) return NextResponse.json({ data: storedMatches, lastScan: store.lastScan, source: "Última busca válida filtrada", radius, warning: "Consulta oficial temporariamente indisponível; exibindo somente resultados salvos compatíveis com a pesquisa." });
    return NextResponse.json({ data: [], warning: "Os portais oficiais estão temporariamente indisponíveis. Use Atualizar para tentar novamente." });
  }
}
