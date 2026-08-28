export const WORK_STATUSES = [
  "INÍCIO DE OBRA", "AG. FRIGORÍGENA", "AG. ACABAMENTO", "AG. TUBULAÇÃO FORÇADA",
  "AG. ACABAMENTO EXAUSTÃO", "AG. EXAUSTOR", "AG. TAMPA FRIGORÍGENA", "SERVIÇO CONCLUÍDO",
] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];
export const UNKNOWN_WORK_STATUS = "STATUS NÃO IDENTIFICADO" as const;
const colors: Record<WorkStatus, string> = {
  "INÍCIO DE OBRA":"#64748b", "AG. FRIGORÍGENA":"#ef4444", "AG. ACABAMENTO":"#f59e0b",
  "AG. TUBULAÇÃO FORÇADA":"#8b5cf6", "AG. ACABAMENTO EXAUSTÃO":"#a855f7", "AG. EXAUSTOR":"#06b6d4",
  "AG. TAMPA FRIGORÍGENA":"#3b82f6", "SERVIÇO CONCLUÍDO":"#16a34a",
};
const statusKey = (value: unknown) => String(value ?? "").trim().toLocaleUpperCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
const aliases: Record<string, WorkStatus> = {
  "INICIO DE OBRA":"INÍCIO DE OBRA", "AG FRIGORIGENA":"AG. FRIGORÍGENA", "AG ACABAMENTO":"AG. ACABAMENTO",
  "AG VENTO KIT":"AG. TUBULAÇÃO FORÇADA", "VENTOKIT E FRIGORIGENA OK":"AG. TUBULAÇÃO FORÇADA", "AG TUBULACAO FORCADA":"AG. TUBULAÇÃO FORÇADA",
  "AG ACABAMENTO EXAUSTAO":"AG. ACABAMENTO EXAUSTÃO", "AG EXAUTOR":"AG. EXAUSTOR", "AG EXAUSTOR":"AG. EXAUSTOR",
  "AG TAMPA FRIGORIGENA":"AG. TAMPA FRIGORÍGENA", "FIM":"SERVIÇO CONCLUÍDO", "SERVICO CONCLUIDO":"SERVIÇO CONCLUÍDO",
};
for (const status of WORK_STATUSES) aliases[statusKey(status)] = status;
export function normalizeWorkStatus(value: unknown): WorkStatus | typeof UNKNOWN_WORK_STATUS { return aliases[statusKey(value)] ?? UNKNOWN_WORK_STATUS; }
export function getWorkProgress(value: unknown) { const normalized=normalizeWorkStatus(value); if(normalized===UNKNOWN_WORK_STATUS)return 0; return Math.round(WORK_STATUSES.indexOf(normalized)/(WORK_STATUSES.length-1)*100); }
export function getWorkStatusColor(value: unknown) { const normalized=normalizeWorkStatus(value); return normalized===UNKNOWN_WORK_STATUS?"#64748b":colors[normalized]; }
