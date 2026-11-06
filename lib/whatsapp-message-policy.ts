import { createHash } from "node:crypto";

export type WhatsAppMessageKind = "appointment" | "pmoc";

export type WhatsAppMessageInput = {
  kind?: unknown;
  originId?: unknown;
  eventKey?: unknown;
  consentConfirmed?: unknown;
  parameters?: unknown;
};

export function validateWhatsAppMessageInput(input: WhatsAppMessageInput): string | null {
  const kind = String(input.kind || "");
  if (kind !== "appointment" && kind !== "pmoc") return "Tipo de mensagem não suportado.";
  if (!String(input.originId || "").trim() || !String(input.eventKey || "").trim()) return "Informe a OS e o evento de origem.";
  if (input.consentConfirmed !== true) return "Confirme a autorização do cliente para receber mensagens.";
  if (!Array.isArray(input.parameters) || input.parameters.length > 10) return "Parâmetros do modelo inválidos.";
  if (input.parameters.some(value => typeof value !== "string" || !value.trim() || value.length > 500)) return "Cada parâmetro deve conter texto de até 500 caracteres.";
  return null;
}

export function whatsappAttemptRecordId(companyId: string, originId: string, kind: WhatsAppMessageKind, eventKey: string) {
  const digest = createHash("sha256").update([companyId, originId, kind, eventKey].join(":")).digest("hex");
  return `whatsapp-send:${digest.slice(0, 48)}`;
}
