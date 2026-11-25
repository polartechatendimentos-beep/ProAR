import { createHmac, timingSafeEqual } from "node:crypto";
import type { DeliveryStatus } from "./chatdesk-delivery";
export function chatWebhookToken(companyId: string, secret: string) {
  if (!companyId || secret.length < 32) throw new Error("Recebimento seguro indisponível.");
  return createHmac("sha256", secret).update(`proar-chatdesk-webhook:v1:${companyId}`).digest("hex");
}
export function validChatWebhookToken(companyId: string, secret: string, provided: string) {
  const expected = Buffer.from(chatWebhookToken(companyId, secret));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function parseEvolutionInbound(value: unknown, expectedInstance: string) {
  const body = object(value);
  if (body.instance !== expectedInstance || String(body.event).toUpperCase().replace(/\./g, "_") !== "MESSAGES_UPSERT") return [];
  const data = Array.isArray(body.data) ? body.data : [body.data];
  return data.slice(0, 50).flatMap(item => {
    const row = object(item), key = object(row.key);
    if (key.fromMe !== false || typeof key.id !== "string" || !key.id || key.id.length > 512) return [];
    const jid = [key.remoteJidAlt, key.remoteJid].find(value => typeof value === "string" && /^[1-9]\d{9,14}@s\.whatsapp\.net$/.test(value));
    if (typeof jid !== "string") return [];
    let message = object(row.message);
    if (message.ephemeralMessage) message = object(object(message.ephemeralMessage).message);
    const text = message.conversation || object(message.extendedTextMessage).text || object(message.imageMessage).caption || object(message.buttonsResponseMessage).selectedDisplayText;
    const timestamp = Number(row.messageTimestamp);
    const millis = timestamp > 1000000000000 ? timestamp : timestamp * 1000;
    if (!Number.isFinite(millis) || millis <= 0 || millis > Date.now() + 300000 || !Number.isFinite(new Date(millis).getTime())) return [];
    return [{ id: key.id, phone: jid.split("@")[0], name: typeof row.pushName === "string" ? row.pushName.slice(0, 100) : jid.split("@")[0], text: typeof text === "string" && text.trim() ? text.slice(0, 8000) : "Mensagem sem texto. Consulte o anexo no WhatsApp.", at: new Date(millis).toISOString() }];
  });
}

// Separate the tenant's first-response setting from its background reminder
// setting. The platform kill switch remains in force for both paths.
export function canReplyToNewInbound(
  input: { activatedAt: string; testPhone?: string; eventAt: string; phone: string; text: string },
  now = Date.now(),
): boolean {
  const since = Date.parse(input.activatedAt), at = Date.parse(input.eventAt);
  if (!Number.isFinite(since) || !Number.isFinite(at) || at <= since || at > now || now - at > 300_000) return false;
  if (input.testPhone && input.phone !== input.testPhone) return false;
  const text = input.text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!text || text === "mensagem sem texto. consulte o anexo no whatsapp.") return false;
  return !/^(?:ok|certo|entendi|beleza|(?:muito )?obrigad[oa]|valeu)[.!\s]*$/.test(text);
}

// Evolution's baileys provider emits a flat MESSAGES_UPDATE record. Accept
// the nested event variant as well, but never infer delivery from SERVER_ACK.
export function parseEvolutionDelivery(value: unknown, expectedInstance: string) {
  const body = object(value);
  if (body.instance !== expectedInstance || String(body.event).toUpperCase().replace(/\./g, "_") !== "MESSAGES_UPDATE") return [];
  const data = Array.isArray(body.data) ? body.data : [body.data];
  return data.slice(0, 50).flatMap(item => {
    const row = object(item), key = object(row.key), providerMessageId = row.keyId || key.id;
    if ((row.fromMe ?? key.fromMe) !== true || typeof providerMessageId !== "string" || !providerMessageId || providerMessageId.length > 512) return [];
    const jid = [row.remoteJidAlt, key.remoteJidAlt, row.remoteJid, key.remoteJid].find(value => typeof value === "string" && /^[1-9]\d{9,14}@s\.whatsapp\.net$/.test(value));
    if (typeof jid !== "string") return [];
    const status = row.status ?? object(row.update).status;
    const deliveryStatus: DeliveryStatus | null = status === "DELIVERY_ACK" || status === 3 ? "delivered"
      : status === "READ" || status === "PLAYED" || status === 4 || status === 5 ? "read"
        : status === "ERROR" || status === 0 ? "failed" : null;
    return deliveryStatus ? [{ providerMessageId, phone: jid.split("@")[0], deliveryStatus }] : [];
  });
}
