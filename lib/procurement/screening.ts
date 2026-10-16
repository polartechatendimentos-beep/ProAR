import { HVAC_TERMS, normalizedText, safeIsoDate, type ProcurementRecord } from "./domain";

/** Explainable deterministic screening, not an AI model or bid authorization. */
export function screenProcurement(record: ProcurementRecord, now = new Date()) {
  const description = normalizedText([record.titulo, record.descricao, ...(Array.isArray(record.items) ? record.items : [])].join(" "));
  const matchedTerms = HVAC_TERMS.filter(term => description.includes(normalizedText(term)));
  const deadline = safeIsoDate(record.dataFimProposta);
  const remainingDays = deadline ? Math.ceil((new Date(deadline).getTime() - now.getTime()) / 86400000) : null;
  const exclusions = ["veiculo", "automotivo", "ar condicionado veicular", "onibus"];
  const requiresReview = exclusions.some(term => description.includes(term));
  const relevanceScore = Math.min(70, matchedTerms.length * 14);
  const deadlineScore = remainingDays === null ? 0 : remainingDays < 0 ? 0 : remainingDays <= 2 ? 5 : remainingDays <= 15 ? 20 : 10;
  const evidenceScore = record.sourceUrl || record.linkEdital ? 10 : 0;
  const score = Math.max(0, relevanceScore + deadlineScore + evidenceScore - (requiresReview ? 25 : 0));
  return {
    score,
    classification: requiresReview ? "MANUAL_REVIEW" : matchedTerms.length ? "HVAC_CANDIDATE" : "NOT_RELEVANT",
    matchedTerms,
    remainingDays,
    deadlineAlert: remainingDays === null ? "UNKNOWN" : remainingDays < 0 ? "EXPIRED" : remainingDays <= 2 ? "URGENT" : remainingDays <= 7 ? "SOON" : "NORMAL",
    requiresReview,
    missingEvidence: !record.linkEdital && !record.sourceUrl,
    notes: ["Pontuação heurística, não substitui leitura do edital.", "Viabilidade financeira depende de custos e quantitativos verificados."],
  };
}
