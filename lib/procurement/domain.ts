export type ProcurementRecord = Record<string, unknown>;

export const HVAC_TERMS = [
  "ar condicionado", "climatizacao", "refrigeracao", "pmoc", "manutencao preventiva",
  "manutencao corretiva", "higienizacao", "instalacao", "desinstalacao", "rede frigorigen",
  "tubulacao de cobre", "fluido refrigerante", "recarga de gas", "split", "multi split",
  "cassete", "piso teto", "vrf", "vrv", "chiller", "fan coil", "exaustao", "ventilacao",
  "compressor", "pecas de refrigeracao", "equipamento de climatizacao",
] as const;

export const PROCUREMENT_SOURCES = [
  { id: "pncp", name: "PNCP", mode: "official_api", status: "active", officialUrl: "https://pncp.gov.br/", docsUrl: "https://pncp.gov.br/api/consulta/swagger-ui/index.html", note: "Consulta oficial GET, somente leitura." },
  { id: "compras-gov", name: "Compras.gov.br", mode: "official_open_data", status: "contract_test_required", officialUrl: "https://www.gov.br/compras/pt-br/", docsUrl: "https://dadosabertos.compras.gov.br/swagger-ui/index.html", note: "Aguardando teste de contrato do Swagger/CSV oficial." },
  { id: "portal-compras-publicas", name: "Portal de Compras Públicas", mode: "authorized_partner_api", status: "authorization_required", officialUrl: "https://www.portaldecompraspublicas.com.br/", docsUrl: "https://apipcp.portaldecompraspublicas.com.br/", note: "Exige publicKey e autorização formal." },
  { id: "bll", name: "BLL Compras", mode: "manual_link", status: "manual", officialUrl: "https://bll.org.br/editais/", docsUrl: null, note: "Consulta manual; API pública não confirmada." },
  { id: "bnc", name: "BNC", mode: "manual_link", status: "manual", officialUrl: "https://bnc.org.br/editais/", docsUrl: null, note: "Consulta manual; API pública não confirmada." },
  { id: "bec-sp", name: "BEC/SP", mode: "manual_link", status: "manual", officialUrl: "https://www.bec.sp.gov.br/", docsUrl: null, note: "Consulta manual; não automatizar CAPTCHA." },
  { id: "licitanet", name: "Licitanet", mode: "manual_link", status: "manual", officialUrl: "https://licitanet.com.br/sessao-publica", docsUrl: null, note: "Consulta manual; respeitar controles da plataforma." },
  { id: "licitar-digital", name: "Licitar Digital", mode: "manual_link", status: "manual", officialUrl: "https://app2.licitardigital.com.br/pesquisa", docsUrl: null, note: "Consulta manual até autorização formal." },
  { id: "bbmnet", name: "BBMNET", mode: "manual_link", status: "manual", officialUrl: "https://www.bbmnetlicitacoes.com.br/", docsUrl: null, note: "Consulta manual até integração autorizada." },
  { id: "compras-br", name: "Compras BR", mode: "manual_link", status: "manual", officialUrl: "https://comprasbr.com.br/aviso-de-licitacoes/", docsUrl: null, note: "Consulta manual; API pública não confirmada." },
] as const;

export type PreflightStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";
export type PreflightCheck = {
  code: string;
  status: PreflightStatus;
  origin: string;
  message: string;
  correctiveAction: string;
};

export type PreflightResult = {
  readyToSubmit: boolean;
  calculatedAt: string;
  summary: { passed: number; warnings: number; blockers: number; notApplicable: number };
  checks: PreflightCheck[];
  schemaVersion: 1;
  dryRun: boolean;
};

export type ProcurementStatus = "OPEN" | "IN_PROGRESS" | "ADJUDICATED" | "ACTIVE_INSTRUMENT" | "CLOSED" | "UNKNOWN";

export function normalizeProcurementStatus(value: unknown, endDate?: unknown): ProcurementStatus {
  const text = normalizedText(value);
  if (/cancelad|revogad|fracassad|desert/.test(text)) return "CLOSED";
  if (/contrato|ata de registro|arp|vigente/.test(text)) return "ACTIVE_INSTRUMENT";
  if (/adjudic|homolog/.test(text)) return "ADJUDICATED";
  if (/disputa|julgament|habilit|recurso/.test(text)) return "IN_PROGRESS";
  if (/abert|receb|oportun|particip|credenciamento/.test(text)) return "OPEN";
  if (endDate) {
    const date = new Date(String(endDate));
    if (!Number.isNaN(date.getTime()) && date.getTime() > Date.now()) return "OPEN";
    if (!Number.isNaN(date.getTime())) return "CLOSED";
  }
  return "UNKNOWN";
}

export function procurementStatusLabel(value: unknown, endDate?: unknown) {
  const labels: Record<ProcurementStatus, string> = {
    OPEN: "Aberta para participação", IN_PROGRESS: "Em disputa / julgamento",
    ADJUDICATED: "Adjudicada / homologada", ACTIVE_INSTRUMENT: "Contrato / ARP vigente",
    CLOSED: "Encerrada / cancelada", UNKNOWN: "Não confirmado",
  };
  return labels[normalizeProcurementStatus(value, endDate)];
}

export function normalizedText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function safeText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

export function safeOfficialUrl(value: unknown) {
  const raw = safeText(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9,.-]/g, "");
  if (!/[0-9]/.test(cleaned)) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function decimalText(value: unknown) {
  const parsed = parseMoney(value);
  return parsed === null ? null : parsed.toFixed(2);
}

export function safeIsoDate(value: unknown) {
  const raw = safeText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function procurementFingerprint(record: ProcurementRecord) {
  const parts = [record.orgao, record.numeroProcesso, record.numeroPregao, record.uf, record.titulo]
    .map(normalizedText)
    .filter(Boolean);
  return parts.join("|");
}

export function calculatePreflight(input: {
  licitacao: ProcurementRecord;
  documents: ProcurementRecord[];
  checklist: ProcurementRecord[];
  dryRun: boolean;
  auditAvailable?: boolean;
}): PreflightResult {
  const { licitacao, documents, checklist, dryRun } = input;
  const checks: PreflightCheck[] = [];
  const add = (check: PreflightCheck) => checks.push(check);
  const external = normalizedText(licitacao.plataforma).includes("pncp") || Boolean(licitacao.numeroControlePncp);
  const identityOk = Boolean(safeText(licitacao.titulo) && safeText(licitacao.orgao) && safeText(licitacao.uf));
  add(identityOk
    ? { code: "IDENTITY", status: "PASS", origin: "licitacoes", message: "Identificação básica preenchida.", correctiveAction: "Nenhuma." }
    : { code: "IDENTITY", status: "BLOCKER", origin: "licitacoes", message: "Título, órgão ou UF não confirmado.", correctiveAction: "Completar e validar a identificação da oportunidade." });

  const integration = ((licitacao.aiAnalise as ProcurementRecord | null)?.integration ?? {}) as ProcurementRecord;
  const provenanceOk = !external || Boolean(safeText(licitacao.numeroControlePncp) && safeText(integration.collectedAt) && safeOfficialUrl(licitacao.linkEdital));
  add(provenanceOk
    ? { code: "PROVENANCE", status: "PASS", origin: "ai_analise.integration", message: external ? "Fonte externa identificada." : "Registro manual identificado.", correctiveAction: "Nenhuma." }
    : { code: "PROVENANCE", status: "BLOCKER", origin: "ai_analise.integration", message: "Fonte, coleta ou link oficial não confirmado.", correctiveAction: "Revalidar a oportunidade na fonte oficial." });

  const opening = safeIsoDate(licitacao.dataAbertura);
  const proposalEnd = safeIsoDate(licitacao.dataFimProposta);
  const deadlineOk = Boolean(opening || proposalEnd) && (!proposalEnd || new Date(proposalEnd).getTime() > Date.now());
  add(deadlineOk
    ? { code: "DEADLINES", status: "PASS", origin: "licitacoes", message: "Prazo confirmado e não vencido.", correctiveAction: "Nenhuma." }
    : { code: "DEADLINES", status: "BLOCKER", origin: "licitacoes", message: "Prazo não confirmado, inválido ou vencido.", correctiveAction: "Validar abertura e encerramento na fonte oficial." });

  const now = Date.now();
  const validDocuments = documents.filter(document => {
    const validity = safeIsoDate(document.validade);
    return Boolean(safeText(document.arquivoUrl) && validity && new Date(validity).getTime() >= now);
  });
  add(validDocuments.length
    ? { code: "DOCUMENTS", status: "PASS", origin: "licitacao_documents", message: `${validDocuments.length} documento(s) vigente(s) com evidência.`, correctiveAction: "Nenhuma." }
    : { code: "DOCUMENTS", status: "BLOCKER", origin: "licitacao_documents", message: "Nenhum documento vigente com evidência de arquivo.", correctiveAction: "Anexar e revisar os documentos obrigatórios." });

  const blockedChecklist = checklist.filter(item => !["atendido", "nao_aplicavel"].includes(normalizedText(item.status).replaceAll(" ", "_")));
  add(checklist.length && !blockedChecklist.length
    ? { code: "CHECKLIST", status: "PASS", origin: "licitacao_checklist_items", message: "Checklist revisado sem pendências.", correctiveAction: "Nenhuma." }
    : { code: "CHECKLIST", status: "BLOCKER", origin: "licitacao_checklist_items", message: checklist.length ? `${blockedChecklist.length} requisito(s) ainda bloqueiam o envio.` : "Checklist ainda não foi estruturado.", correctiveAction: "Revisar requisitos, risco e evidências humanas." });

  add(safeOfficialUrl(licitacao.linkEdital)
    ? { code: "NOTICE", status: "PASS", origin: "licitacoes.link_edital", message: "Link oficial do edital disponível.", correctiveAction: "Nenhuma." }
    : { code: "NOTICE", status: "BLOCKER", origin: "licitacoes.link_edital", message: "Edital oficial não confirmado.", correctiveAction: "Vincular edital ou anexo oficial." });

  add({ code: "PROPOSAL", status: "BLOCKER", origin: "modelo não disponível", message: "Itens, quantidades, preços, custos e totais da proposta ainda não possuem modelo estruturado.", correctiveAction: "Concluir a modelagem de proposta antes de liberar o envio." });
  add({ code: "TECHNICAL_CAPACITY", status: "BLOCKER", origin: "modelo não disponível", message: "Capacidade técnica quantitativa ainda não pode ser comprovada pelo schema atual.", correctiveAction: "Estruturar atestados e quantitativos antes de liberar o envio." });
  add(input.auditAvailable && !dryRun
    ? { code: "AUDIT", status: "PASS", origin: "audit_events", message: "Execução registrada em auditoria server-side.", correctiveAction: "Nenhuma." }
    : { code: "AUDIT", status: "BLOCKER", origin: "audit_events", message: dryRun ? "Prévia não registrada; não libera envio." : "Auditoria indisponível.", correctiveAction: "Executar e registrar a auditoria pré-envio." });

  const summary = {
    passed: checks.filter(check => check.status === "PASS").length,
    warnings: checks.filter(check => check.status === "WARNING").length,
    blockers: checks.filter(check => check.status === "BLOCKER").length,
    notApplicable: checks.filter(check => check.status === "NOT_APPLICABLE").length,
  };
  return { readyToSubmit: summary.blockers === 0, calculatedAt: new Date().toISOString(), summary, checks, schemaVersion: 1, dryRun };
}

export function simulateBid(input: {
  bestMarket?: unknown;
  proposedBid?: unknown;
  technicalFloor?: unknown;
  absoluteFloor?: unknown;
  minimumIncrement?: unknown;
}) {
  const bestMarket = parseMoney(input.bestMarket);
  const proposedBid = parseMoney(input.proposedBid);
  const technicalFloor = parseMoney(input.technicalFloor);
  const absoluteFloor = parseMoney(input.absoluteFloor);
  const minimumIncrement = Math.max(0.01, parseMoney(input.minimumIncrement) ?? 0.01);
  const floors = [technicalFloor, absoluteFloor].filter((value): value is number => value !== null);
  const effectiveFloor = floors.length ? Math.max(...floors) : null;
  const suggestedBid = bestMarket !== null && effectiveFloor !== null
    ? Math.max(effectiveFloor, Number((bestMarket - minimumIncrement).toFixed(2)))
    : null;
  const evaluatedBid = proposedBid ?? suggestedBid;
  const authorizationRequired = evaluatedBid !== null && effectiveFloor !== null && evaluatedBid < effectiveFloor;
  return {
    bestMarket,
    proposedBid,
    technicalFloor,
    absoluteFloor,
    effectiveFloor,
    minimumIncrement,
    suggestedBid,
    evaluatedBid,
    authorizationRequired,
    canCopy: evaluatedBid !== null && !authorizationRequired,
    canSubmitExternally: false,
    message: authorizationRequired
      ? "LANCE ABAIXO DO LIMITE AUTORIZADO. Solicite autorização; nenhum envio foi realizado."
      : suggestedBid === null
        ? "Sugestão não calculada: confirme melhor lance e piso autorizado."
        : "Simulação concluída. O valor pode ser copiado; nenhum envio externo será realizado.",
  };
}
