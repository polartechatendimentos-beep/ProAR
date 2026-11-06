import { createHash } from "node:crypto";

export type IncomingWhatsApp = {
  id?: string; from?: string; timestamp?: string; type?: string;
  text?: { body?: string }; button?: { text?: string; payload?: string };
  interactive?: { button_reply?: { title?: string; id?: string } };
};
export type InboxMessage = {
  kind: "whatsapp-inbound"; companyId: string; messageId: string;
  phone: string; timestamp: number; text: string; type: string;
};

export function inboundRecord(companyId: string, message: IncomingWhatsApp) {
  const timestamp = Number(message.timestamp);
  if (!companyId || typeof message.id !== "string" || !message.id || message.id.length > 512 ||
    typeof message.from !== "string" || !/^\d{8,15}$/.test(message.from) ||
    !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > 8640000000000) return null;
  const text = message.text?.body ?? message.button?.text ?? message.interactive?.button_reply?.title;
  const type = typeof message.type === "string" ? message.type.slice(0, 40) : "text";
  const payload: InboxMessage = { kind: "whatsapp-inbound", companyId, messageId: message.id,
    phone: message.from, timestamp, type,
    text: typeof text === "string" ? text.slice(0, 8000) : "Mensagem sem texto — consulte no WhatsApp." };
  const hash = createHash("sha256").update(JSON.stringify([companyId, message.id])).digest("hex");
  return { id: `whatsapp-inbound:${hash}`, payload, updated_at: new Date(timestamp * 1000).toISOString() };
}

export function inboxQuery(companyId: string, offset = 0) {
  return new URLSearchParams({ id: "like.whatsapp-inbound:*", "payload->>companyId": `eq.${companyId}`,
    select: "payload", order: "updated_at.desc,id.desc", limit: "101", offset: String(offset) });
}
