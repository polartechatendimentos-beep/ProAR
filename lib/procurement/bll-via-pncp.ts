import { normalizedText, safeOfficialUrl, type ProcurementRecord } from "./domain";

/**
 * BLL via PNCP is a classification of official PNCP records, NOT a BLL API.
 * Never infer a BLL origin from the procurement title or the contracting entity.
 */
const BLL_HOSTS = new Set(["bll.org.br", "www.bll.org.br", "bllcompras.com", "www.bllcompras.com", "bllcompras.org.br", "www.bllcompras.org.br"]);
const BLL_LABEL = /\b(bll\s*(compras|licitacoes)?|bolsa\s+de\s+licitacoes\s+(e\s+leiloes|do\s+brasil))\b/;

function confirmedBllUrl(value: unknown): string | null {
  const url = safeOfficialUrl(value);
  if (!url) return null;
  try {
    return BLL_HOSTS.has(new URL(url).hostname.toLowerCase()) ? url : null;
  } catch { return null; }
}

export function classifyBllFromPncp(raw: unknown): { matched: boolean; evidence: string | null; evidenceType: "url" | "platform" | null } {
  if (!raw || typeof raw !== "object") return { matched: false, evidence: null, evidenceType: null };
  const row = raw as ProcurementRecord;
  for (const key of ["linkSistemaOrigem", "urlSistemaOrigem", "linkPlataforma", "urlPlataforma"]) {
    const url = confirmedBllUrl(row[key]);
    if (url) return { matched: true, evidence: url, evidenceType: "url" };
  }
  for (const key of ["nomePlataforma", "plataformaDisputa", "sistemaOrigemNome"]) {
    const label = normalizedText(row[key]);
    if (label && BLL_LABEL.test(label)) return { matched: true, evidence: String(row[key]), evidenceType: "platform" };
  }
  return { matched: false, evidence: null, evidenceType: null };
}

export function attachBllPncpEvidence(normalized: ProcurementRecord, raw: unknown): ProcurementRecord {
  const match = classifyBllFromPncp(raw);
  if (!match.matched) return normalized;
  return {
    ...normalized,
    plataforma: "BLL Compras",
    source: "PNCP",
    sourceId: "pncp",
    sourcePlatform: "bll",
    platformEvidence: match.evidence,
    platformEvidenceType: match.evidenceType,
    integrationMode: "bll_via_pncp",
    platformVerification: "pncp_metadata",
  };
}

export function filterBllViaPncp(rows: ProcurementRecord[]): ProcurementRecord[] {
  return rows.filter(row => row.sourcePlatform === "bll" && row.integrationMode === "bll_via_pncp");
}
