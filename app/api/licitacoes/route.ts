import { NextRequest, NextResponse } from "next/server";
import { municipalityDistances } from "../../../lib/municipality-distances";

const PNCP_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
const UFS = ["SP", "MG", "MS", "PR", "GO"] as const;
const REQUEST_TIMEOUT_MS = 6500;
const climateTerms = /ar\s*-?\s*condicionado|condicionador(?:es)? de ar|climatiza|refrigera|pmoc|hvac|split|multi\s*split|cassete|piso\s*teto|evaporador|condensador|chiller|vrf|fluido refrigerante|g[aá]s refrigerante|compressor frigor[ií]fico/i;
const excludedTerms = /purificador(?:es)? de [aá]gua|equipamento fotodocumentador|mobili[aá]rio|geladeira dom[eé]stica|bebedouro(?!.*refrigera)/i;

export const cityDistances: Record<string, number> = {
  mirassol:0,"sao jose do rio preto":15,jaci:21,"bady bassitt":22,balsamo:29,"neves paulista":32,cedral:34,"monte aprazivel":41,potirendaba:43,tanabi:45,ibira:48,catanduva:58,olimpia:62,"nova granada":67,"novo horizonte":75,votuporanga:77,"paulo de faria":92,barretos:105,bebedouro:112,fernandopolis:120,"santa fe do sul":126,aracatuba:135,jaboticabal:145,lins:152,"sao joaquim da barra":185,franca:220,"ribeirao preto":225,bauru:230,"sao carlos":265,araraquara:270,"presidente prudente":285,"mogi guacu":295,"pocos de caldas":300
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export type PncpTender = {
  numeroControlePNCP?: string; objetoCompra?: string; modalidadeNome?: string;
  dataEncerramentoProposta?: string; valorTotalEstimado?: number; linkSistemaOrigem?: string;
  anoCompra?: number; sequencialCompra?: number; usuarioNome?: string;
  sourcePortal?: "PNCP" | "Compras.gov.br" | "BLL Compras" | "Licitações-e";
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string; nomeUnidade?: string; codigoIbge?: string };
  distanciaMirassol?: number;
};

function identifySource(item: PncpTender): PncpTender["sourcePortal"] {
  const origin = normalize(`${item.linkSistemaOrigem ?? ""} ${item.usuarioNome ?? ""}`);
  if (/bllcompras|bll compras|bolsa de licitacoes do brasil/.test(origin)) return "BLL Compras";
  if (/licitacoes-e|licitacoes e|licitacao-e|bb\.com\.br/.test(origin)) return "Licitações-e";
  if (/comprasnet|compras\.gov|cnetmobile|serpro/.test(origin)) return "Compras.gov.br";
  return "PNCP";
}

async function fetchPage(dataFinal: string, uf: string, page = 1) {
  const query = new URLSearchParams({ dataFinal, pagina: String(page), tamanhoPagina: "50", uf });
  const response = await fetch(`${PNCP_URL}?${query}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`PNCP ${uf} respondeu ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data as PncpTender[] : [];
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

export async function searchAutomaticTenders(options?: { start?: Date; end?: Date; radius?: number; all?: boolean; term?: string }) {
  const today = options?.start ?? new Date();
  const end = options?.end ?? new Date(today.getTime() + 60 * 86400000);
  const dataFinal = end.toISOString().slice(0, 10).replaceAll("-", "");

  // As consultas estaduais rodam simultaneamente. Assim, uma fonte lenta não
  // bloqueia as demais nem estoura o limite da função serverless da Vercel.
  const settled = await Promise.allSettled(UFS.map(uf => fetchPage(dataFinal, uf)));
  const raw = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const failedSources = settled.flatMap((result, index) => result.status === "rejected" ? [UFS[index]] : []);

  const radius = options?.radius ?? 300;
  const startTime = new Date(today.toISOString().slice(0, 10) + "T00:00:00-03:00").getTime();
  const endTime = new Date(end.toISOString().slice(0, 10) + "T23:59:59-03:00").getTime();
  const term = normalize(options?.term ?? "");
  const filtered = raw.filter(item => {
    const object = item.objetoCompra ?? "";
    if (!options?.all && (term ? !normalize(object).includes(term) : (!climateTerms.test(object) || excludedTerms.test(object)))) return false;
    const closing = item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta).getTime() : 0;
    if (!closing || closing < startTime || closing > endTime) return false;
    const distance = municipalityDistances[String(item.unidadeOrgao?.codigoIbge ?? "")] ?? cityDistances[normalize(item.unidadeOrgao?.municipioNome ?? "")];
    if (distance === undefined || distance > radius) return false;
    item.distanciaMirassol = distance;
    item.sourcePortal = identifySource(item);
    return true;
  });
  const unique = Array.from(new Map(filtered.map(item => [item.numeroControlePNCP || `${item.orgaoEntidade?.cnpj}-${item.anoCompra}-${item.sequencialCompra}`, item])).values());
  unique.sort((a, b) => new Date(a.dataEncerramentoProposta ?? 0).getTime() - new Date(b.dataEncerramentoProposta ?? 0).getTime());
  return { data: unique, failedSources };
}

export async function GET(request: NextRequest) {
  try {
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

    if (!result.data.length && result.failedSources.length === UFS.length) {
      const store = await readMonitorStore();
      if (store.items?.length) return NextResponse.json({ data: store.items, lastScan: store.lastScan, source: "Última busca válida", radius, warning: "Consulta oficial temporariamente indisponível; exibindo o último resultado salvo." });
    }

    const portalCounts = result.data.reduce<Record<string, number>>((acc, item) => {
      const portal = item.sourcePortal ?? "PNCP"; acc[portal] = (acc[portal] ?? 0) + 1; return acc;
    }, {});
    return NextResponse.json({
      data: result.data, source: "PNCP e portais de origem", radius, portalCounts,
      warning: result.failedSources.length ? `Consulta parcial: ${result.failedSources.join(", ")} não respondeu. Os demais resultados foram carregados.` : "",
    });
  } catch (error) {
    console.error("PNCP search failed", error);
    const store = await readMonitorStore();
    if (store.items?.length) return NextResponse.json({ data: store.items, lastScan: store.lastScan, source: "Última busca válida", warning: "Consulta oficial temporariamente indisponível; exibindo o último resultado salvo." });
    return NextResponse.json({ data: [], warning: "Os portais oficiais estão temporariamente indisponíveis. Use Atualizar para tentar novamente." });
  }
}
