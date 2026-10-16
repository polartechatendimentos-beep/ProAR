import { normalizedText, safeOfficialUrl, type ProcurementRecord } from "./domain";

/** Classifies PNCP records with explicit Compras.gov.br platform evidence. */
const HOSTS = new Set(["compras.gov.br", "www.compras.gov.br", "comprasnet.gov.br", "www.comprasnet.gov.br"]);
const PLATFORM = /\b(compras\s*gov(\s*br)?|comprasnet|sistema\s+de\s+compras\s+do\s+governo\s+federal)\b/;

export function classifyComprasGovFromPncp(raw: unknown): { matched: boolean; evidence: string | null; evidenceType: "url" | "platform" | null } {
  if (!raw || typeof raw !== "object") return { matched: false, evidence: null, evidenceType: null };
  const row = raw as ProcurementRecord;
  for (const key of ["linkSistemaOrigem", "urlSistemaOrigem", "linkPlataforma", "urlPlataforma"]) {
    const url = safeOfficialUrl(row[key]);
    if (!url) continue;
    try {
      if (HOSTS.has(new URL(url).hostname.toLowerCase())) return { matched: true, evidence: url, evidenceType: "url" };
    } catch { /* invalid metadata is not evidence */ }
  }
  for (const key of ["nomePlataforma", "plataformaDisputa", "sistemaOrigemNome"]) {
    const label = normalizedText(row[key]);
    if (label && PLATFORM.test(label)) return { matched: true, evidence: String(row[key]), evidenceType: "platform" };
  }
  return { matched: false, evidence: null, evidenceType: null };
}

export function attachComprasGovPncpEvidence(normalized: ProcurementRecord, raw: unknown): ProcurementRecord {
  const match = classifyComprasGovFromPncp(raw);
  if (!match.matched) return normalized;
  return {
    ...normalized,
    plataforma: "Compras.gov.br",
    source: "PNCP",
    sourceId: "pncp",
    sourcePlatform: "compras-gov",
    platformEvidence: match.evidence,
    platformEvidenceType: match.evidenceType,
    integrationMode: "compras_gov_via_pncp",
    platformVerification: "pncp_metadata",
  };
}

export function filterComprasGovViaPncp(rows: ProcurementRecord[]): ProcurementRecord[] {
  return rows.filter(row => row.sourcePlatform === "compras-gov" && row.integrationMode === "compras_gov_via_pncp");
}
