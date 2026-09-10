import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacoes } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { getEffectiveCompanyId } from "@/lib/company-access";

const DEFAULT_TERMS = [
  "ar condicionado", "climatização", "climatizacao", "pmoc", "refrigeração", "refrigeracao",
  "manutenção de ar condicionado", "manutencao de ar condicionado", "instalação", "instalacao",
  "fluido refrigerante", "recarga de gás", "recarga de gas", "vrf", "split", "cassete",
  "piso teto", "compressor", "higienização", "higienizacao"
];

const text = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const dateParam = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const companyId = getEffectiveCompanyId(session, body.companyId ? Number(body.companyId) : null);
    const uf = String(body.uf || "SP").toUpperCase();
    const days = Math.max(1, Math.min(30, Number(body.days) || 14));
    const terms: string[] = Array.isArray(body.terms) && body.terms.length ? body.terms.map((value: unknown) => String(value)) : DEFAULT_TERMS;

    const start = new Date();
    start.setDate(start.getDate() - days);
    const end = new Date();
    end.setDate(end.getDate() + 30);
    const pncpUrl = new URL("https://pncp.gov.br/api/consulta/v1/contratacoes/publicas");
    pncpUrl.searchParams.set("dataInicial", dateParam(start));
    pncpUrl.searchParams.set("dataFinal", dateParam(end));
    pncpUrl.searchParams.set("pagina", "1");
    pncpUrl.searchParams.set("tamanhoPagina", "500");

    const response = await fetch(pncpUrl, {
      headers: { Accept: "application/json", "User-Agent": "ProAR-Licitacoes/1.0" },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ success: false, error: "O PNCP não respondeu à consulta no momento.", source: "PNCP" }, { status: 502 });
    }

    const payload = await response.json() as { data?: unknown[] } | unknown[];
    const candidates = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];
    const termsNormalized = terms.map(normalize).filter(Boolean);
    let found = 0;
    let imported = 0;

    for (const raw of candidates) {
      const item = raw as Record<string, unknown>;
      const object = text(item.objetoContratacao || item.objetoCompra || item.descricao);
      const itemUf = text((item.unidadeOrgao as Record<string, unknown> | undefined)?.ufSigla || (item.orgaoEntidade as Record<string, unknown> | undefined)?.uf).toUpperCase();
      if (itemUf && itemUf !== uf) continue;
      if (!termsNormalized.some((term) => normalize(object).includes(term))) continue;
      found += 1;

      const controlNumber = text(item.numeroControlePNCP || item.numeroControlePncp);
      if (controlNumber) {
        const [existing] = await db.select({ id: licitacoes.id }).from(licitacoes)
          .where(and(eq(licitacoes.companyId, companyId), eq(licitacoes.numeroControlePncp, controlNumber))).limit(1);
        if (existing) continue;
      }

      await db.insert(licitacoes).values({
        companyId,
        numeroControlePncp: controlNumber || null,
        numeroPregao: text(item.numeroCompra || item.numeroEdital) || null,
        numeroProcesso: text(item.processo || item.numeroProcesso) || null,
        titulo: object || "Oportunidade encontrada no PNCP",
        descricao: text(item.informacaoComplementar || object) || null,
        orgao: text((item.orgaoEntidade as Record<string, unknown> | undefined)?.razaoSocial || item.nomeOrgao) || "Órgão Público",
        plataforma: "PNCP",
        uf: itemUf || uf,
        modalidade: text(item.modalidadeNome) || "Licitação",
        tipoJulgamento: "a_confirmar",
        modoDisputa: "a_confirmar",
        valorEstimado: item.valorTotalEstimado ? Number(item.valorTotalEstimado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null,
        dataAbertura: item.dataAberturaProposta ? new Date(String(item.dataAberturaProposta)) : null,
        dataFimProposta: item.dataEncerramentoProposta ? new Date(String(item.dataEncerramentoProposta)) : null,
        responsavelInterno: session.nome,
        checklistResumo: {},
        aiAnalise: { source: "PNCP", importedAt: new Date().toISOString(), terms },
        linkEdital: text(item.linkSistemaOrigem || item.url) || "https://pncp.gov.br/app/editais",
        categoria: "Climatização / PMOC",
        status: "oportunidade",
      });
      imported += 1;
    }

    return NextResponse.json({
      success: true,
      source: "PNCP",
      found,
      imported,
      message: imported ? `${imported} oportunidade(s) importada(s) do PNCP.` : "Nenhuma nova oportunidade encontrada no PNCP para os filtros atuais.",
      complementarySources: [
        { name: "Compras.gov.br", mode: "acesso manual / conector oficial pendente" },
        { name: "BLL Compras", mode: "acesso manual / conector oficial pendente" },
        { name: "Portal de Compras Públicas", mode: "acesso manual / conector oficial pendente" },
        { name: "Licitanet", mode: "acesso manual / conector oficial pendente" },
        { name: "BBMNET", mode: "acesso manual / conector oficial pendente" },
        { name: "Licitações-e", mode: "acesso manual / conector oficial pendente" },
      ],
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível consultar o PNCP." }, { status: 500 });
  }
}
