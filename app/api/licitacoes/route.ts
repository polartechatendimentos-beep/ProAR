import {fetchOlimpiaTenders} from "@/lib/procurement/olimpia-connector";
import {tenderSearchMatches,pncpProposalQuery,withinTenderWindow} from "@/lib/procurement/search-relevance";
import {procurementAccess} from "@/lib/procurement/access";
import {procurementFilters,filterProcurementResults} from "@/lib/procurement/search-contract";
import {canonicalProcurementKey,identifyProcurementSource,mergeProcurementEvidence,type ProcurementTender,type SourceDiagnostic as ProcurementSourceDiagnostic} from "@/lib/procurement/domain";
import {fetchFiorilliTenders} from "@/lib/procurement/fiorilli-connector";
import {publicationSystem,disputePlatformFromUrl} from "@/lib/procurement/regional-sources";
import {fetchBllTenders} from "@/lib/procurement/bll-connector";
import { municipalTenderDate } from "@/lib/tender-date";
import { NextRequest, NextResponse } from "next/server";
import { supabaseRest } from "../../../lib/supabase-rest";
import { municipalityDistances, municipalityNameDistances } from "../../../lib/municipality-distances";

const privateJson=(body:unknown,init?:ResponseInit)=>{const headers=new Headers(init?.headers);headers.set("Cache-Control","private, no-store");return NextResponse.json(body,{...init,headers});};

const PNCP_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
const PNCP_CONSULTA_BASE = "https://pncp.gov.br/api/consulta/v1";
const PNCP_FILES_BASE = "https://pncp.gov.br/api/pncp/v1";
const COMPRAS_URL = "https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133";
const MUNICIPAL_SOURCES = [
  { city:"Mirassol", uf:"SP", distance:0, url:"https://www.mirassol.sp.gov.br/portal/editais/1" },
  { city:"Catanduva", uf:"SP", distance:58, url:"https://www.catanduva.sp.gov.br/portal/editais/1" },
] as const;
const UFS = ["SP", "MG", "MS", "PR", "GO"] as const;
const MODALITIES = [6, 8, 12, 4, 5, 7, 9] as const;
const TARGETED_PNCP_PAGES = 10;
const PNCP_PAGE_SIZE = 50;
export const maxDuration = 120;
const REQUEST_TIMEOUT_MS = 9000;
const COMPRAS_TIMEOUT_MS = 7000;
const MAX_RETRIES = 1;
const PNCP_CONCURRENCY = 8;
const COMPRAS_CONCURRENCY = 2;
const CITY_CODES: Record<string, { ibge: string; distance: number }> = {
  "jose bonifacio": { ibge: "3525706", distance: 62 },
  "sao jose do rio preto": {ibge:"3549805",distance:15},
  "olimpia": {ibge:"3533908",distance:62},
  "mirassol": {ibge:"3530300",distance:0},
};
const climateTerms = /ar\s*-?\s*condicionado|condicionador(?:es)? de ar|climatiza|refrigera|pmoc|hvac|split|multi\s*split|cassete|piso\s*teto|evaporador|condensador|chiller|vrf|fluido refrigerante|g[aá]s refrigerante|compressor frigor[ií]fico|manuten[cç][aã]o.*(?:climatiza|refrigera|condicion)|instala[cç][aã]o.*(?:ar|split|climatiza)|exaust[aã]o|ventila[cç][aã]o mec[aâ]nica/i;
const excludedTerms = /purificador(?:es)? de [aá]gua|equipamento fotodocumentador|mobili[aá]rio|geladeira dom[eé]stica|bebedouro(?!.*refrigera)/i;

const cityDistances: Record<string, number> = {
  mirassol:0,"jose bonifacio":62,"sao jose do rio preto":15,jaci:21,"bady bassitt":22,balsamo:29,"neves paulista":32,cedral:34,"monte aprazivel":41,potirendaba:43,tanabi:45,ibira:48,catanduva:58,olimpia:62,"nova granada":67,"novo horizonte":75,votuporanga:77,"paulo de faria":92,barretos:105,bebedouro:112,fernandopolis:120,"santa fe do sul":126,aracatuba:135,jaboticabal:145,lins:152,"sao joaquim da barra":185,franca:220,"ribeirao preto":225,bauru:230,"sao carlos":265,araraquara:270,"presidente prudente":285,"mogi guacu":295,"pocos de caldas":300
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export type PncpTender = ProcurementTender & {
  numeroControlePNCP?: string; objetoCompra?: string; modalidadeNome?: string;
  dataEncerramentoProposta?: string; valorTotalEstimado?: number; linkSistemaOrigem?: string;
  dataPublicacaoPncp?: string;
  anoCompra?: number; sequencialCompra?: number; usuarioNome?: string;
  sourcePortal?: "PNCP" | "Compras.gov.br" | "BLL Compras" | "Licitações-e" | "Portal Municipal";
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string; nomeUnidade?: string; codigoIbge?: string };
  distanciaMirassol?: number;
  validationStatus?: "active_confirmed" | "history" | "incomplete";
  validationReason?: string;
  canonicalKey?: string;
};


function canonicalTenderKey(item: PncpTender) {
  return canonicalProcurementKey(item);
}

function validateTender(item: PncpTender, now = Date.now()) {
  const closing=item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta).getTime() : 0;
  const text=normalize(`${item.situacaoCompraNome??""}`);
  item.canonicalKey=canonicalTenderKey(item);
  if (closing && closing <= now) { item.validationStatus="history"; item.validationReason="Prazo de propostas/sessão já encerrado."; return item; }
  if (/homologad|revogad|anulad|encerrad|cancelad|suspens|fracassad|desert/.test(text)) { item.validationStatus="history"; item.validationReason="Processo identificado como encerrado/histórico."; return item; }
  if (!closing || !item.unidadeOrgao?.municipioNome || (item.ingestedFrom?.includes("BLL feed autorizado") && (item.orgaoEntidade?.cnpj??"").replace(/\D/g,"").length!==14 && !/^\d{14}-1-\d+\/\d{4}$/.test(item.numeroControlePNCP??""))) { item.validationStatus="incomplete"; item.validationReason="Data de sessão ou município não confirmado na origem."; return item; }
  item.validationStatus="active_confirmed"; item.validationReason="Prazo futuro e identificação oficial confirmados na fonte consultada.";
  return item;
}

function preferValidatedTender(a: PncpTender, b: PncpTender) {
  const score=(item:PncpTender)=>(item.validationStatus==="active_confirmed"?8:item.validationStatus==="incomplete"?4:1)+(item.valorTotalEstimado?2:0)+(item.distanciaMirassol!==undefined?1:0)+(item.sourcePortal==="PNCP"?2:0);
  return score(b)>score(a)?b:a;
}
type SourceDiagnostic = ProcurementSourceDiagnostic;

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

function identifySource(item: PncpTender): NonNullable<PncpTender["sourcePortal"]> {
  return identifyProcurementSource(item);
}

async function fetchPage(dataFinal: string, uf: string, modality:number, page = 1, municipalityCode?:string) {
  const query = pncpProposalQuery(dataFinal,uf,modality,page,municipalityCode);
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
    if (response.status === 204) return { items: [] as PncpTender[], totalPages: 0 };
    if (!response.ok) throw new Error(`respondeu ${response.status}`);
    const payload = await response.json();
    return { items: Array.isArray(payload?.data) ? payload.data as PncpTender[] : [], totalPages: Number.isFinite(Number(payload?.totalPaginas)) ? Number(payload.totalPaginas) : null };
  });
  return { ...result.value, attempts: result.attempts };
}

async function fetchPages(dataFinal: string, uf: string, modality:number, maxPages = TARGETED_PNCP_PAGES, municipalityCode?:string, deadline=Date.now()+70000) {
  const items: PncpTender[] = [];
  let attempts = 0;
  let pagesRead = 0;
  let truncated = false;
  let error: string | undefined;
  for (let page = 1; page <= maxPages; page += 1) {
    try {
      if(Date.now()>deadline-20000){truncated=true;error="Limite de tempo da varredura atingido; resultados parciais preservados.";break;}
      const current = await fetchPage(dataFinal, uf, modality, page,municipalityCode);
      attempts += current.attempts;
      pagesRead += 1;
      items.push(...current.items);
      if (current.totalPages !== null ? page >= current.totalPages : current.items.length < PNCP_PAGE_SIZE) break;
      truncated = page === maxPages;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      truncated = true;
      break;
    }
  }
  return { items, attempts, pagesRead, truncated, error };
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

async function fetchMunicipalSource(source: typeof MUNICIPAL_SOURCES[number]) {
  const started=Date.now();
  try {
    const response=await fetch(source.url,{headers:{Accept:"text/html","User-Agent":"ProAR-Licitacoes/1.0 (+https://polartech.proar.online)"},cache:"no-store",signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
    if(!response.ok) throw new Error(`respondeu ${response.status}`);
    const html=await response.text();
    const text=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/\s+/g," ");
    const blocks=text.split(/(?=Preg[aã]o Eletr[oô]nico\s*(?:n[º°o.]*)?\s*\d+\/\d{4})/i);
    const items:PncpTender[]=[];
    for(const block of blocks){
      if(!climateTerms.test(block) || excludedTerms.test(block)) continue;
      const number=block.match(/Preg[aã]o Eletr[oô]nico\s*(?:n[º°o.]*)?\s*(\d+)\/(\d{4})/i);
      const process=block.match(/N[º°o.]?\s*Processo\s*:?\s*(\d+)\/(\d{4})/i);

      const value=block.match(/Valor\s*Estimado\s*:?\s*R\$\s*([\d.]+,\d{2})/i);
      const status=block.match(/Situa[cç][aã]o\s*:?\s*([A-Za-zÀ-ÿ ]{3,30})/i);
      if(!number) continue;
      const closing=municipalTenderDate(block);
      items.push(validateTender({
        numeroControlePNCP:`MUNICIPAL-${normalize(source.city)}-${number[1]}-${number[2]}`,
        anoCompra:Number(number[2]), sequencialCompra:Number(number[1]),
        objetoCompra:block.slice(0,700), modalidadeNome:`Pregão Eletrônico • ${status?.[1]?.trim()??"Situação não informada"}`,
        dataEncerramentoProposta:closing, valorTotalEstimado:value?Number(value[1].replace(/\./g,"").replace(",",".")):undefined,
        linkSistemaOrigem:source.url, usuarioNome:"Portal Municipal", sourcePortal:"Portal Municipal",
        orgaoEntidade:{razaoSocial:`Prefeitura do Município de ${source.city}`},
        unidadeOrgao:{municipioNome:source.city,ufSigla:source.uf}, distanciaMirassol:source.distance,
      }));
    }
    return {items,diagnostic:{source:`Portal Municipal - ${source.city}`,status:"ok" as const,attempts:1,durationMs:Date.now()-started,count:items.length}};
  } catch(error) {
    return {items:[] as PncpTender[],diagnostic:{source:`Portal Municipal - ${source.city}`,status:"error" as const,attempts:1,durationMs:Date.now()-started,count:0,error:error instanceof Error?error.message:String(error)}};
  }
}

async function readMonitorStore() {
  const response = await supabaseRest("proar_state?id=eq.licitacoes&select=payload", { signal: AbortSignal.timeout(4000) });
  if (!response) return { items: [] as PncpTender[], lastScan: null as string | null, lastError: "" };
  if (!response.ok) return { items: [] as PncpTender[], lastScan: null as string | null, lastError: "" };
  const rows = await response.json();
  return rows[0]?.payload ?? { items: [], lastScan: null, lastError: "" };
}

function filterStoredItems(items: PncpTender[], term: string, radius: number) {
  const normalizedTerm = normalize(term);
  return items.filter(item => {
    const searchable = normalize(`${item.objetoCompra ?? ""} ${item.orgaoEntidade?.razaoSocial ?? ""} ${item.unidadeOrgao?.municipioNome ?? ""} ${item.unidadeOrgao?.nomeUnidade ?? ""}`);
    return tenderSearchMatches(item.objetoCompra??"",searchable,normalizedTerm) && item.distanciaMirassol !== undefined && item.distanciaMirassol <= radius;
  });
}

async function searchAutomaticTenders(options?: { start?: Date; end?: Date; radius?: number; all?: boolean; term?: string; city?:string }) {
  const today = options?.start ?? new Date();
  const end = options?.end ?? new Date(today.getTime() + 366 * 86400000);
  const dataFinal = end.toISOString().slice(0, 10).replaceAll("-", "");
  const publicationStart = new Date(today.getTime() - 60 * 86400000).toISOString().slice(0, 10);
  const publicationEnd = today.toISOString().slice(0, 10);
  const normalizedTerm = normalize(options?.term ?? "");
  const cityQuery=normalize(options?.city||normalizedTerm);
  const municipality = Object.entries(CITY_CODES).find(([name]) => cityQuery.includes(name))?.[1];

  // Cada UF/modalidade é independente: limitar concorrência evita sobrecarga
  // do PNCP e retryar somente falhas transitórias mantém resultados parciais.
  const startedAt = new Map<string, number>();
  const scanDeadline=Date.now()+70000;
  const regionalCities=municipality?[municipality]:[CITY_CODES["sao jose do rio preto"],CITY_CODES.olimpia,CITY_CODES.mirassol];
  const pncpTasks=[...regionalCities.flatMap(city=>[6,8,12].map(modality=>({uf:"SP",modality,ibge:city.ibge}))),...(municipality?[]:Array.from(UFS).flatMap(uf=>MODALITIES.map(modality=>({uf,modality,ibge:undefined as string|undefined}))))];
  const [pncpSettled, comprasSettled, municipalSettled,bllResult,fiorilliResult,olimpiaResult] = await Promise.all([
    runLimited(pncpTasks,PNCP_CONCURRENCY,async task=>{
      const {uf,modality}=task,key=`PNCP-${uf}-${task.ibge||"estadual"}-modalidade-${modality}`;startedAt.set(key,Date.now());
      const value=await fetchPages(dataFinal,uf,modality,task.ibge?5:uf==="SP"?TARGETED_PNCP_PAGES:3,task.ibge,scanDeadline);
      return {value,diagnostic:{source:key,status:value.error?"error" as const:"ok" as const,attempts:value.attempts,durationMs:Date.now()-(startedAt.get(key)??Date.now()),count:value.items.length,pagesRead:value.pagesRead,truncated:value.truncated,error:value.error}};
    }),
    runLimited(MODALITIES, COMPRAS_CONCURRENCY, async code => {
      const key = `Compras.gov.br-${code}`; startedAt.set(key, Date.now());
      const value = await fetchCompras(publicationStart, publicationEnd, code, municipality?.ibge);
      return { value, diagnostic: { source: key, status: "ok" as const, attempts: value.attempts, durationMs: Date.now() - (startedAt.get(key) ?? Date.now()), count: value.items.length } };
    }),
    Promise.all(MUNICIPAL_SOURCES.filter(source=>source.distance <= (options?.radius??300)).map(fetchMunicipalSource)),
    fetchBllTenders(),
    fetchFiorilliTenders({year:today.getFullYear(),radius:options?.radius??300}),
    (options?.radius??300)>=62?fetchOlimpiaTenders():Promise.resolve(null),
  ]);
  const raw = [
    ...pncpSettled.flatMap(result => result.status === "fulfilled" ? result.value.value.items.map(item=>({...item,sourcePortal:item.sourcePortal??identifySource(item),publicationSystem:publicationSystem(item.usuarioNome),disputePlatform:disputePlatformFromUrl(item.linkSistemaOrigem),sourceOrigins:[...new Set(["PNCP",item.sourcePortal??identifySource(item),...(publicationSystem(item.usuarioNome)?[publicationSystem(item.usuarioNome)!]:[])])],ingestedFrom:["PNCP"]})) : []),
    ...comprasSettled.flatMap(result => result.status === "fulfilled" ? result.value.value.items : []),
    ...municipalSettled.flatMap(result=>result.items),
    ...bllResult.items,
    ...fiorilliResult.items,
    ...(olimpiaResult?.items??[]),
  ];
  const diagnostics: SourceDiagnostic[] = [
    ...pncpSettled.map((result, index) => result.status === "fulfilled" ? result.value.diagnostic : { source: `PNCP-${pncpTasks[index].uf}-modalidade-${pncpTasks[index].modality}`, status: "error" as const, attempts: MAX_RETRIES + 1, durationMs: Date.now() - (startedAt.get(`PNCP-${pncpTasks[index].uf}-modalidade-${pncpTasks[index].modality}`) ?? Date.now()), count: 0, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }),
    ...comprasSettled.map((result, index) => result.status === "fulfilled" ? result.value.diagnostic : { source: `Compras.gov.br-${MODALITIES[index]}`, status: "error" as const, attempts: MAX_RETRIES + 1, durationMs: Date.now() - (startedAt.get(`Compras.gov.br-${MODALITIES[index]}`) ?? Date.now()), count: 0, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }),
    ...municipalSettled.map(result=>result.diagnostic),
    ...fiorilliResult.diagnostics,
    ...(olimpiaResult?[olimpiaResult.diagnostic]:[]),
    ...["Licitações-e","BEC-SP"].map(name=>({source:`${name} · via PNCP`,status:pncpSettled.length>0&&pncpSettled.every(r=>r.status==="fulfilled"&&!r.value.value.error)?"ok" as const:"error" as const,attempts:0,durationMs:0,count:pncpSettled.flatMap(r=>r.status==="fulfilled"?r.value.value.items:[]).filter(item=>disputePlatformFromUrl(item.linkSistemaOrigem)===name).length,mode:"pncp_bridge" as const,detail:"Plataforma identificada no link oficial retornado pelo PNCP; não houve consulta direta à sala de disputa."})),
    ...["Fiorilli","Betha","IPM / Atende.net","Equiplano","Aspec","SMARAPD"].map(name=>({source:`${name} · via PNCP`,status:pncpSettled.length>0&&pncpSettled.every(r=>r.status==="fulfilled"&&!r.value.value.error)?"ok" as const:"error" as const,attempts:0,durationMs:0,count:pncpSettled.flatMap(r=>r.status==="fulfilled"?r.value.value.items:[]).filter(item=>publicationSystem(item.usuarioNome)===name).length,mode:"pncp_bridge" as const,detail:"Classificação pelo publicador informado no PNCP. Não comprova consulta direta nem cobertura integral do fornecedor."})),
    ...(bllResult.diagnostic?[bllResult.diagnostic]:[]),
    {source:"BLL Compras · via PNCP",status:pncpSettled.length>0&&pncpSettled.every(r=>r.status==="fulfilled"&&!r.value.value.error)?"ok" as const:"error" as const,attempts:0,durationMs:Math.max(0,...pncpSettled.map(r=>r.status==="fulfilled"?r.value.diagnostic.durationMs:0)),count:pncpSettled.flatMap(r=>r.status==="fulfilled"?r.value.value.items:[]).filter(item=>identifySource(item)==="BLL Compras").length,mode:"pncp_bridge",detail:"Cobertura BLL obtida na consulta PNCP; não comprova disponibilidade direta da BLL."},
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
    if (!tenderSearchMatches(object,`${searchable} ${item.numeroCompra??""} ${item.numeroControlePNCP??""}`,term)) return false;
    if(!withinTenderWindow(item.dataEncerramentoProposta,item.dataPublicacaoPncp,startTime,endTime,item.sourcePortal==="Portal Municipal"))return false;
    const municipalityName = normalize(item.unidadeOrgao?.municipioNome ?? "");
    const municipalityKey = `${municipalityName}|${String(item.unidadeOrgao?.ufSigla ?? "").toUpperCase()}`;
    const distance = municipalityDistances[String(item.unidadeOrgao?.codigoIbge ?? "")] ?? municipalityNameDistances[municipalityKey] ?? (item.unidadeOrgao?.ufSigla === "SP" ? CITY_CODES[municipalityName]?.distance ?? cityDistances[municipalityName] : undefined);
    // Em pesquisa textual explícita, não descarte um resultado oficial apenas
    // porque a tabela local de distâncias ainda não conhece o município.
    // O raio continua obrigatório para o radar automático.
    if (distance === undefined) {
      // Nunca classificar município desconhecido como 0 km de Mirassol.
      // Em busca textual o registro oficial pode permanecer, mas sem distância,
      // deixando a UI informar que o cálculo ainda não está disponível.
      if (!term) return false;
      delete item.distanciaMirassol;
    } else {
      if (distance > radius) return false;
      item.distanciaMirassol = distance;
    }
    item.sourcePortal = item.sourcePortal ?? identifySource(item);
    return true;
  });
  const validated = filtered.map(item => validateTender(item));
  const deduped = new Map<string, PncpTender>();
  for (const item of validated) { const key=item.canonicalKey ?? canonicalTenderKey(item); const current=deduped.get(key); deduped.set(key,current?mergeProcurementEvidence(preferValidatedTender(current,item),preferValidatedTender(current,item)===current?item:current):item); }
  const unique = Array.from(deduped.values());
  unique.sort((a, b) => new Date(a.dataEncerramentoProposta ?? 0).getTime() - new Date(b.dataEncerramentoProposta ?? 0).getTime());
  return { data: unique.slice(0, 2000), failedSources, diagnostics, coverage: { received: raw.length, relevant: filtered.length, duplicates: validated.length - unique.length, total: unique.length, displayed: Math.min(unique.length, 2000), pagesRead: diagnostics.reduce((sum, source) => sum + (source.pagesRead ?? 0), 0), truncated: diagnostics.some(source => source.truncated) || unique.length > 2000 } };
}

export async function GET(request: NextRequest) {
  const access=procurementAccess(request);
  if(!access.ok)return privateJson({error:access.error},{status:access.status,headers:{"Cache-Control":"private, no-store"}});
  let filters:ReturnType<typeof procurementFilters>;
  try{filters=procurementFilters(request.nextUrl.searchParams);}catch(error){return privateJson({data:[],error:error instanceof Error?error.message:"Filtros inválidos."},{status:400});}
  const applyFilters=(items:PncpTender[])=>filterProcurementResults(items,filters);
  try {
    if (request.nextUrl.searchParams.get("detail") === "1") {
      const cnpj = (request.nextUrl.searchParams.get("cnpj") ?? "").replace(/\D/g, "");
      const ano = Number(request.nextUrl.searchParams.get("ano") ?? 0);
      const sequencial = Number(request.nextUrl.searchParams.get("sequencial") ?? 0);
      if (cnpj.length !== 14 || !ano || !sequencial) return privateJson({ data: null, error: "Identificadores da contratação incompletos." }, { status: 400 });
      const linkSistemaOrigem = `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`;
      try {
        const response = await fetch(`${PNCP_CONSULTA_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!response.ok) return privateJson({ data: null, linkSistemaOrigem, warning: `O PNCP não retornou os detalhes desta contratação (${response.status}). O edital oficial continua disponível.` });
        return privateJson({ data: await response.json(), source: "PNCP consulta detalhada" });
      } catch (error) {
        console.error("PNCP detail failed", error);
        return privateJson({ data: null, linkSistemaOrigem, warning: "O PNCP demorou para responder aos detalhes desta contratação. O edital oficial continua disponível." });
      }
    }
    if (request.nextUrl.searchParams.get("documents") === "1") {
      const cnpj = (request.nextUrl.searchParams.get("cnpj") ?? "").replace(/\D/g, "");
      const ano = Number(request.nextUrl.searchParams.get("ano") ?? 0);
      const sequencial = Number(request.nextUrl.searchParams.get("sequencial") ?? 0);
      if (cnpj.length !== 14 || !ano || !sequencial) return privateJson({ data: [], error: "Identificadores da contratação incompletos." }, { status: 400 });
      const response = await fetch(`${PNCP_FILES_BASE}/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(6500) });
      if (!response.ok) return privateJson({ data: [], warning: `O PNCP não retornou os documentos desta contratação (${response.status}).` });
      const payload = await response.json();
      const docs = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      return privateJson({ data: docs });
    }
    if (request.nextUrl.searchParams.get("monitor") === "1") {
      const store = await readMonitorStore();
      return privateJson({ data: applyFilters((store.items ?? []).map((item:PncpTender)=>validateTender(item))), lastScan: store.lastScan, warning: store.lastError ?? "", source: "Monitor oficial PNCP" });
    }
    const startParam = request.nextUrl.searchParams.get("dataInicial");
    const endParam = request.nextUrl.searchParams.get("dataFinal");
    const start = startParam ? new Date(`${startParam}T12:00:00-03:00`) : new Date();
    const end = endParam ? new Date(`${endParam}T23:59:59-03:00`) : new Date(Date.now() + 366 * 86400000);
    const radius = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get("raio_km") ?? request.nextUrl.searchParams.get("raio") ?? (filters.strictRadius||400))));
    const term = (request.nextUrl.searchParams.get("termo") ?? request.nextUrl.searchParams.get("q") ?? "").trim();
    const requestedPortals = (request.nextUrl.searchParams.get("portais") ?? "").split(",").map(value => value.trim()).filter(Boolean);
    const orderBy = request.nextUrl.searchParams.get("ordenar_por") === "valor" ? "valor" : "distancia";
    const result = await searchAutomaticTenders({ start, end, radius, all: !term, term,city:filters.city });
    const portalAliases: Record<string, string> = {
      pncp: "PNCP", "compras.gov.br": "Compras.gov.br", comprasgov: "Compras.gov.br", bec: "BEC-SP", "bec-sp": "BEC-SP",
      compraspublicas: "Portal de Compras Públicas", "portal de compras públicas": "Portal de Compras Públicas",
      bll: "BLL Compras", "bll compras": "BLL Compras", licitacoese: "Licitações-e", "licitações-e": "Licitações-e",
    };
    result.data=applyFilters(result.data);
    const normalizedPortals = requestedPortals.map(value => portalAliases[normalize(value)] ?? value);
    // Portais de origem em registros PNCP não comprovam um conector direto validado.
    const connectedPortals = new Set(["PNCP", "Compras.gov.br",...(result.diagnostics.some(d=>d.mode==="direct"&&d.status==="ok")?["BLL Compras"]:[])]);
    const unavailablePortals = normalizedPortals.filter(portal => !connectedPortals.has(portal));
    if (normalizedPortals.length) result.data = result.data.filter(item => normalizedPortals.includes(item.sourcePortal ?? "PNCP"));
    result.data.sort((a, b) => orderBy === "valor"
      ? (b.valorTotalEstimado ?? 0) - (a.valorTotalEstimado ?? 0)
      : (a.distanciaMirassol ?? Number.MAX_SAFE_INTEGER) - (b.distanciaMirassol ?? Number.MAX_SAFE_INTEGER));

    if (!result.data.length && result.failedSources.length >= UFS.length) {
      const store = await readMonitorStore();
      const storedMatches = applyFilters(filterStoredItems(store.items ?? [], term, radius));
      if (storedMatches.length) return privateJson({ data: storedMatches, lastScan: store.lastScan, source: "Última busca válida filtrada", radius, warning: "Consulta oficial temporariamente indisponível; exibindo somente resultados salvos compatíveis com a pesquisa." });
    }

    const portalCounts = result.data.reduce<Record<string, number>>((acc, item) => {
      const portal = item.sourcePortal ?? "PNCP"; acc[portal] = (acc[portal] ?? 0) + 1; return acc;
    }, {});
    return privateJson({
      data: result.data, resultados: result.data, source: "PNCP e portais de origem", radius, raio_km: radius, portalCounts, partial: result.failedSources.length > 0 || result.coverage.truncated, sourceDiagnostics: result.diagnostics, coverage: result.coverage, kpis: { total_editais: result.data.filter(item=>item.validationStatus==="active_confirmed").length, valor_total_estimado: result.data.filter(item=>item.validationStatus==="active_confirmed").reduce((sum,item)=>sum+(item.valorTotalEstimado??0),0), homologadas_historico: result.data.filter(item=>item.validationStatus==="history").length, dados_incompletos: result.data.filter(item=>item.validationStatus==="incomplete").length, portais_ativos: Object.keys(portalCounts).length },
      warning: result.coverage.truncated ? "Consulta parcial: o limite de páginas/resultados foi atingido ou uma página não respondeu. Os registros já carregados foram preservados; refine os filtros ou atualize." : unavailablePortals.length ? `Fonte sem consulta direta confirmada nesta rotina: ${unavailablePortals.join(", ")}. Registros podem chegar pelo PNCP. Nenhum resultado fictício foi gerado.` : result.failedSources.length ? `Consulta parcial: ${result.failedSources.join(", ")} não respondeu. Os demais resultados foram carregados.` : "",
    });
  } catch (error) {
    console.error("PNCP search failed", error);
    const store = await readMonitorStore();
    const term = (request.nextUrl.searchParams.get("termo") ?? request.nextUrl.searchParams.get("q") ?? "").trim();
    const radius = Math.min(1000, Math.max(1, Number(request.nextUrl.searchParams.get("raio_km") ?? request.nextUrl.searchParams.get("raio") ?? (filters.strictRadius||400))));
    const storedMatches = applyFilters(filterStoredItems(store.items ?? [], term, radius));
    if (storedMatches.length) return privateJson({ data: storedMatches, lastScan: store.lastScan, source: "Última busca válida filtrada", radius, warning: "Consulta oficial temporariamente indisponível; exibindo somente resultados salvos compatíveis com a pesquisa." });
    return privateJson({ data: [], warning: "Os portais oficiais estão temporariamente indisponíveis. Use Atualizar para tentar novamente." });
  }
}
