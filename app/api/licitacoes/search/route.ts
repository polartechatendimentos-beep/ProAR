import { NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { getEffectiveCompanyId } from "@/lib/company-access";

const DEFAULT_TERMS = [
  "ar condicionado", "climatização", "climatizacao", "pmoc", "refrigeração", "refrigeracao",
  "manutenção de ar condicionado", "manutencao de ar condicionado", "instalação", "instalacao",
  "fluido refrigerante", "recarga de gás", "recarga de gas", "vrf", "split", "cassete",
  "piso teto", "compressor", "higienização", "higienizacao"
];

const text = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
const normalize = (value: unknown) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dateParam = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    getEffectiveCompanyId(session, body.companyId ? Number(body.companyId) : null);
    const uf = text(body.uf || "SP").toUpperCase();
    const days = Math.max(1, Math.min(30, Number(body.days) || 14));
    const terms: string[] = Array.isArray(body.terms) && body.terms.length
      ? body.terms.map((value: unknown) => String(value))
      : DEFAULT_TERMS;
    const start = new Date();
    start.setDate(start.getDate() - days);
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const pncpUrl = new URL("https://pncp.gov.br/api/consulta/v1/contratacoes/publicas");
    pncpUrl.searchParams.set("dataInicial", dateParam(start));
    pncpUrl.searchParams.set("dataFinal", dateParam(end));
    pncpUrl.searchParams.set("pagina", "1");
    pncpUrl.searchParams.set("tamanhoPagina", "500");

    const response = await fetch(pncpUrl, { headers: { Accept: "application/json", "User-Agent": "ProAR-Licitacoes/1.0" }, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ success: false, error: "O PNCP não respondeu à consulta no momento.", source: "PNCP" }, { status: 502 });

    const payload = await response.json() as { data?: unknown[] } | unknown[];
    const candidates = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];
    const normalizedTerms = terms.map(normalize).filter(Boolean);
    const data = candidates.flatMap((raw, index) => {
      const item = raw as Record<string, unknown>;
      const object = text(item.objetoContratacao || item.objetoCompra || item.descricao);
      const itemUf = text((item.unidadeOrgao as Record<string, unknown> | undefined)?.ufSigla || (item.orgaoEntidade as Record<string, unknown> | undefined)?.uf).toUpperCase();
      if ((itemUf && itemUf !== uf) || !normalizedTerms.some((term: string) => normalize(object).includes(term))) return [];
      const controlNumber = text(item.numeroControlePNCP || item.numeroControlePncp);
      return [{
        id: controlNumber || `pncp-${index}`,
        numeroControlePncp: controlNumber || undefined,
        numeroPregao: text(item.numeroCompra || item.numeroEdital) || undefined,
        numeroProcesso: text(item.processo || item.numeroProcesso) || undefined,
        titulo: object || "Oportunidade encontrada no PNCP",
        descricao: text(item.informacaoComplementar || object) || undefined,
        orgao: text((item.orgaoEntidade as Record<string, unknown> | undefined)?.razaoSocial || item.nomeOrgao) || "Órgão Público",
        plataforma: "PNCP",
        uf: itemUf || uf,
        modalidade: text(item.modalidadeNome) || "Licitação",
        valorEstimado: item.valorTotalEstimado ? Number(item.valorTotalEstimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : undefined,
        dataAbertura: text(item.dataAberturaProposta) || undefined,
        dataFimProposta: text(item.dataEncerramentoProposta) || undefined,
        responsavelInterno: session.nome,
        habilitacaoPercentual: 0,
        checklistResumo: { atendidos: 0, revisar: 0, criticos: 0, pendentes: 0 },
        linkEdital: text(item.linkSistemaOrigem || item.url) || "https://pncp.gov.br/app/editais",
        status: "oportunidade",
        source: "PNCP",
      }];
    });

    return NextResponse.json({
      success: true, source: "PNCP", count: data.length, data,
      message: data.length ? `${data.length} oportunidade(s) encontrada(s) no PNCP para ${uf}.` : "Nenhuma oportunidade encontrada no PNCP para os filtros atuais.",
      persistence: "Os resultados foram carregados para conferência. A gravação permanente será habilitada após a migração do banco.",
      complementarySources: ["Compras.gov.br", "BLL Compras", "Portal de Compras Públicas", "Licitanet", "BBMNET", "Licitações-e"],
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível consultar o PNCP." }, { status: 500 });
  }
}
