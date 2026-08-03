import { NextRequest, NextResponse } from "next/server";
import { municipalityDistances } from "../../../lib/municipality-distances";

const PNCP_URL = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";
const climateTerms = /ar\s*-?\s*condicionado|condicionador(?:es)? de ar|climatiza|refrigera|pmoc|hvac|split|multi\s*split|cassete|piso\s*teto|evaporador|condensador|chiller|vrf|fluido refrigerante|g[aá]s refrigerante|compressor frigor[ií]fico/i;
const excludedTerms = /purificador(?:es)? de [aá]gua|equipamento fotodocumentador|mobili[aá]rio|geladeira dom[eé]stica|bebedouro(?!.*refrigera)/i;

// Distâncias rodoviárias aproximadas a partir de Mirassol/SP. Municípios fora da
// área conhecida são descartados quando o filtro de raio está ativo.
export const cityDistances: Record<string, number> = {
  mirassol:0,"sao jose do rio preto":15,jaci:21,"bady bassitt":22,balsamo:29,"neves paulista":32,cedral:34,"monte aprazivel":41,potirendaba:43,tanabi:45,ibira:48,catanduva:58,olimpia:62,"nova granada":67,"novo horizonte":75,votuporanga:77,"paulo de faria":92,barretos:105,bebedouro:112,fernandopolis:120,"santa fe do sul":126,aracatuba:135,jaboticabal:145,lins:152,"sao joaquim da barra":185,franca:220,"ribeirao preto":225,bauru:230,"sao carlos":265,araraquara:270,"presidente prudente":285,"mogi guacu":295,"pocos de caldas":300
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export type PncpTender = {
  numeroControlePNCP?: string; objetoCompra?: string; modalidadeNome?: string;
  dataEncerramentoProposta?: string; valorTotalEstimado?: number; linkSistemaOrigem?: string;
  anoCompra?: number; sequencialCompra?: number;
  orgaoEntidade?: { razaoSocial?: string; cnpj?: string };
  unidadeOrgao?: { municipioNome?: string; ufSigla?: string; nomeUnidade?: string; codigoIbge?: string };
  distanciaMirassol?: number;
};

async function fetchPage(dataFinal: string, uf: string, page: number) {
  const query = new URLSearchParams({ dataFinal, pagina: String(page), tamanhoPagina: "50", uf });
  const response = await fetch(`${PNCP_URL}?${query}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`PNCP respondeu ${response.status}`);
  const payload = await response.json();
  return { data: Array.isArray(payload?.data) ? payload.data as PncpTender[] : [], totalPages: Math.min(Number(payload?.totalPaginas ?? 1), 8) };
}

export async function searchAutomaticTenders(options?: { start?: Date; end?: Date; radius?: number; all?: boolean; term?: string }) {
  const today = options?.start ?? new Date();
  const end = options?.end ?? new Date(today.getTime() + 60 * 86400000);
  const fmt = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  const calls = ["SP", "MG", "MS", "PR", "GO"].map(async uf => {
    const first = await fetchPage(fmt(end), uf, 1);
    const extra = await Promise.all(Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) => fetchPage(fmt(end), uf, index + 2).catch(() => ({ data: [], totalPages: 0 }))));
    return [first.data, ...extra.map(page => page.data)].flat();
  });
  const settled = await Promise.allSettled(calls);
  const raw = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const radius = options?.radius ?? 300;
  const startTime = new Date(today.toISOString().slice(0, 10) + "T00:00:00-03:00").getTime();
  const endTime = new Date(end.toISOString().slice(0, 10) + "T23:59:59-03:00").getTime();
  const filtered = raw.filter(item => {
    const object = item.objetoCompra ?? "";
    if (!options?.all) {
      const term = normalize(options?.term ?? "");
      if (term ? !normalize(object).includes(term) : (!climateTerms.test(object) || excludedTerms.test(object))) return false;
    }
    const closing = item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta).getTime() : 0;
    if (!closing || closing < startTime || closing > endTime) return false;
    const distance = municipalityDistances[String(item.unidadeOrgao?.codigoIbge ?? "")] ?? cityDistances[normalize(item.unidadeOrgao?.municipioNome ?? "")];
    if (distance === undefined || distance > radius) return false;
    item.distanciaMirassol = distance;
    return true;
  });
  const unique = Array.from(new Map(filtered.map(item => [item.numeroControlePNCP || `${item.orgaoEntidade?.cnpj}-${item.anoCompra}-${item.sequencialCompra}`, item])).values());
  unique.sort((a, b) => new Date(a.dataEncerramentoProposta ?? 0).getTime() - new Date(b.dataEncerramentoProposta ?? 0).getTime());
  return { data: unique, failed: settled.filter(result => result.status === "rejected").length };
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("monitor") === "1") {
      const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Base não configurada");
      const response = await fetch(`${url}/rest/v1/proar_state?id=eq.licitacoes&select=payload`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      const store = rows[0]?.payload ?? { items: [], lastScan: null };
      return NextResponse.json({ data: store.items ?? [], lastScan: store.lastScan, warning: store.lastError ?? "", source: "Monitor PNCP" });
    }
    const startParam = request.nextUrl.searchParams.get("dataInicial");
    const endParam = request.nextUrl.searchParams.get("dataFinal");
    const start = startParam ? new Date(`${startParam}T12:00:00-03:00`) : new Date();
    const end = endParam ? new Date(`${endParam}T23:59:59-03:00`) : new Date(Date.now() + 60 * 86400000);
    const radius = Math.min(300, Math.max(1, Number(request.nextUrl.searchParams.get("raio") ?? 300)));
    const term = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const result = await searchAutomaticTenders({ start, end, radius, all: !term, term });
    return NextResponse.json({ data: result.data, source: "PNCP", radius, warning: result.failed === 5 ? "O PNCP não respondeu à consulta completa. Tente atualizar novamente." : "" });
  } catch (error) {
    console.error("PNCP search failed", error);
    return NextResponse.json({ error: "O serviço oficial do PNCP está temporariamente indisponível." }, { status: 502 });
  }
}
