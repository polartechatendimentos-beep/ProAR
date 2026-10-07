import { NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { getEffectiveCompanyId } from "@/lib/company-access";
import { searchPncp } from "@/lib/procurement/pncp";
import { type ProcurementRecord } from "@/lib/procurement/domain";

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

    const onlyOpen = String(body.status || "").toLowerCase() === "recebendo_proposta" || body.onlyOpen === true;
    const result = await searchPncp({ uf, days, maxPages, terms, modalityCodes, onlyOpen });
    // searchPncp already performs normalized relevance filtering. Do not filter a second
    // time here: double filtering previously hid valid PNCP opportunities.
    const data = result.data as ProcurementRecord[];

    const health = {
      ...result.health,
      accepted: data.length,
      queriedModalities: modalityCodes,
      requestedTerms: terms,
      requestedStatus: onlyOpen ? "recebendo_proposta" : "todos",
    };

    return NextResponse.json({
      success: result.success,
      source: "PNCP",
      count: data.length,
      data,
      health,
      message: data.length
        ? `${data.length} oportunidade(s) encontrada(s) no PNCP para ${uf}.`
        : result.success
          ? "Nenhuma oportunidade encontrada no PNCP para os filtros atuais."
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
