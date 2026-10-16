import { NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { getEffectiveCompanyId } from "@/lib/company-access";
import { searchPncp } from "@/lib/procurement/pncp";
import { filterBllViaPncp } from "@/lib/procurement/bll-via-pncp";
import { filterComprasGovViaPncp } from "@/lib/procurement/compras-gov-via-pncp";
import { type ProcurementRecord } from "@/lib/procurement/domain";
import { screenProcurement } from "@/lib/procurement/screening";

const DEFAULT_TERMS = [
  "ar condicionado", "ar-condicionado", "climatização", "climatizacao", "pmoc",
  "refrigeração", "refrigeracao", "manutenção de ar condicionado",
  "manutencao de ar condicionado", "instalação de ar condicionado",
  "instalacao de ar condicionado", "fluido refrigerante", "recarga de gás",
  "recarga de gas", "vrf", "vrv", "split", "cassete", "piso teto",
  "compressor", "higienização", "higienizacao", "chiller", "fan coil",
  "climatizador", "climatizadores", "ventilação", "ventilacao", "exaustão", "exaustao",
  "duto", "dutos", "evaporadora", "condensadora", "sistema de climatização",
  "sistema de climatizacao", "manutenção preventiva", "manutencao preventiva",
  "manutenção corretiva", "manutencao corretiva", "limpeza de ar condicionado",
  "limpeza de ar-condicionado", "limpeza de evaporadora", "limpeza de condensadora"
];

const MODALITY_CODES = [4, 5, 6, 7, 8, 9, 12];

function parseTerms(value: unknown) {
  if (!Array.isArray(value)) return DEFAULT_TERMS;
  const terms = value
    .flatMap(item => String(item ?? "").split(","))
    .map(item => item.trim())
    .filter(Boolean);
  return terms.length ? terms : DEFAULT_TERMS;
}

export async function POST(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    getEffectiveCompanyId(session, body.companyId ? Number(body.companyId) : null);

    const uf = String(body.uf || "SP").trim().toUpperCase();
    const days = Math.max(1, Math.min(60, Number(body.days) || 30));
    const maxPages = Math.max(1, Math.min(20, Number(body.maxPages) || 10));
    const terms = parseTerms(body.terms);
    const modalityCodes = Array.isArray(body.modalityCodes) && body.modalityCodes.length
      ? body.modalityCodes.map(Number).filter(Number.isFinite)
      : MODALITY_CODES;

    const result = await searchPncp({ uf, days, maxPages, terms, modalityCodes });
    // searchPncp already performs normalized relevance filtering. Do not filter a second
    // time here: double filtering previously hid valid PNCP opportunities.
    const sourceFilter = String(body.source || "all").toLowerCase();
    if (!["all", "pncp", "bll", "compras-gov"].includes(sourceFilter)) return NextResponse.json({ success: false, error: "Fonte inválida." }, { status: 400 });
    const allData = result.data as ProcurementRecord[];
    const data = sourceFilter === "bll" ? filterBllViaPncp(allData)
      : sourceFilter === "compras-gov" ? filterComprasGovViaPncp(allData) : allData;

    const enrichedData = data.map(record => ({ ...record, screening: screenProcurement(record) }));

    const health = {
      ...result.health,
      accepted: data.length,
      queriedModalities: modalityCodes,
      requestedTerms: terms,
    };

    return NextResponse.json({
      success: result.success,
      source: sourceFilter === "bll" ? "BLL via PNCP" : sourceFilter === "compras-gov" ? "Compras.gov.br via PNCP" : "PNCP",
      sourceFilter,
      sourceHealth: result.health,
      count: data.length,
      data: enrichedData,
      health,
      message: data.length
        ? `${data.length} oportunidade(s) encontrada(s) ${sourceFilter === "bll" ? "da BLL identificadas no PNCP" : sourceFilter === "compras-gov" ? "do Compras.gov.br identificadas no PNCP" : "no PNCP"} para ${uf}.`
        : result.success
          ? sourceFilter === "bll" ? "Nenhuma licitação com evidência de plataforma BLL nos registros PNCP consultados. Isso não comprova ausência de editais na BLL." : sourceFilter === "compras-gov" ? "Nenhuma licitação com evidência de plataforma Compras.gov.br nos registros PNCP consultados. Isso não comprova ausência de editais no Compras.gov.br." : "Nenhuma oportunidade encontrada no PNCP para os filtros atuais."
          : "Consulta parcial: a fonte PNCP apresentou indisponibilidade durante a coleta.",
      persistence: "Resultados oficiais carregados para conferência; nenhum dado fictício é criado.",
      complementarySources: ["Compras.gov.br", "BLL Compras", "Portal de Compras Públicas", "Licitanet", "BBMNET", "Licitações-e"],
    }, { status: result.success || data.length ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível consultar o PNCP.",
    }, { status: 500 });
  }
}
