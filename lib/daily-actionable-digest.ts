import { createHash } from "node:crypto";
import { agendaToday, shiftAgendaDate, validAgendaDate } from "./agenda-calendar.ts";
import { localTriage, type ChatConversation } from "./chatdesk-local.ts";

type Row = Record<string, unknown>;
type Kind = "conversation" | "quote" | "visit";
export type DigestItem = { kind: Kind; reference: string; title: string; detail: string; urgent?: boolean };
type DigestSection = { total: number; items: DigestItem[] };
export type DailyActionableDigest = {
  generatedAt: string;
  today: string;
  tomorrow: string;
  complete: boolean;
  conversations: DigestSection;
  quotes: DigestSection;
  visits: DigestSection;
};

const clean = (value: unknown, max = 130) => typeof value === "string" ? value.trim().slice(0, max) : "";
const normal = (value: unknown) => clean(value, 3000).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const validReplyStates = new Set(["accepted", "sent", "delivered", "read", "played"]);
const courtesyOnly = /^(?:(?:ok(?:ei)?|obrigad[oa](?: viu)?|valeu|abracos?|boa|beleza|blz|certo|entendi|de nada|tudo certo|perfeito)[.!\s]*)+$/;
const attachmentOnly = /^mensagem sem texto\. consulte o anexo no whatsapp\.$/;
const activeVisit = /^(?:agendad[oa]|reagendad[oa]|cliente confirmado)$/;
const closedOrders = /\b(?:cancelad|conclu|finaliz)/;
const quoteFollowUp = /^(?:enviado|aguardando (?:cliente|retorno|aprovacao)|vencido)$/;
const confirmation = /^(?:confirmad[oa]|cliente confirmado)$/;

export function digestDayStart(now: Date) {
  const day = agendaToday(now);
  // Calculate the UTC instant of local midnight using the IANA zone, without
  // assuming a fixed offset if the business timezone changes in the future.
  const utc = new Date(`${day}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", timeZoneName: "longOffset" }).formatToParts(utc);
  const offset = parts.find(part => part.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  return new Date(`${day}T00:00:00${offset}`).toISOString();
}

function dedupe(items: DigestItem[]) {
  return [...new Map(items.map(item => [item.reference,item])).values()];
}
const section = (items: DigestItem[]): DigestSection => ({ total: items.length, items: items.slice(0, 20) });

export function dailyActionableDigest(input: { chats: ChatConversation[]; quotes: Row[]; orders: Row[]; sales?: Row[]; complete: boolean; pilotPhone?: string }, now = new Date()): DailyActionableDigest {
  const today = agendaToday(now);
  const tomorrow = shiftAgendaDate(today, 1);
  const nowMs = now.getTime();
  const conversationItems = input.chats.flatMap(chat => {
    if (chat.stage === "Concluído" || chat.optOut || !chat.phone || chat.phone === input.pilotPhone) return [];
    const messages = (Array.isArray(chat.messages) ? chat.messages : [])
      .map((message, sequence) => ({ ...message, epoch: Date.parse(message.at), sequence }))
      .filter(message => Number.isFinite(message.epoch) && message.epoch <= nowMs)
      .sort((a,b) => a.epoch-b.epoch || a.sequence-b.sequence);
    const latestReplyIndex = messages.findLastIndex(message => message.direction === "out" && (message as { deliveryStatus?: string }).deliveryStatus !== "failed" && (!message.status || validReplyStates.has(message.status)));
    const inbound = messages.findLast((message, index) => {
      const body = normal(message.text).replace(/[\p{Emoji_Presentation}\uFE0F]/gu, "").trim();
      return message.direction === "in" && index > latestReplyIndex && agendaToday(new Date(message.epoch)) === today
        && body.length > 0 && !courtesyOnly.test(body) && !attachmentOnly.test(body) && !localTriage(body).optOut;
    });
    if (!inbound) return [];
    const urgent = localTriage(inbound.text).urgent;
    const human = chat.assignee ? " • com responsável" : " • sem responsável";
    return [{ epoch: inbound.epoch, item: { kind: "conversation" as const, reference: createHash("sha256").update(chat.phone + ":" + inbound.id).digest("hex").slice(0, 24), title: clean(chat.name).replace(/^\+?\d{10,15}$/,"") || `Contato final ${chat.phone.slice(-4)}`, detail: `${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(inbound.epoch)} • ${chat.sector}${human}`, urgent } }];
  }).sort((a,b) => Number(b.item.urgent) - Number(a.item.urgent) || a.epoch-b.epoch).map(row => row.item);

  const convertedQuotes = new Set([...input.orders, ...(input.sales || [])].map(row => clean(row.sourceBudgetId || row.budgetId)));
  const quoteItems = input.quotes.flatMap(row => {
    const reference = clean(row.id);
    const end = clean(row.endDate);
    if (!reference || !validAgendaDate(end) || end >= today || !quoteFollowUp.test(normal(row.status)) || convertedQuotes.has(reference) || clean(row.serviceOrderId || row.convertedOrderId)) return [];
    return [{ end, item: { kind: "quote" as const, reference, title: clean(row.client) || clean(row.name) || reference, detail: `${reference} • validade encerrou em ${end.split("-").reverse().join("/")}` } }];
  }).sort((a,b) => a.end.localeCompare(b.end)).map(row => row.item);

  const visitItems = input.orders.flatMap(row => {
    const reference = clean(row.id);
    const status = normal(row.status);
    const reply = normal(row.appointmentConfirmation);
    const time = clean(row.time);
    if (!reference || row.date !== tomorrow || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || closedOrders.test(status) || !activeVisit.test(status)) return [];
    const needsRescheduling = /^reagend/.test(reply);
    if (!needsRescheduling && (confirmation.test(status) || confirmation.test(reply))) return [];
    return [{ time, item: { kind: "visit" as const, reference, title: clean(row.client) || reference, detail: `${time} • ${reference} • ${clean(row.service) || "Visita"} • ${needsRescheduling ? "cliente pediu reagendamento" : "presença não confirmada"}` } }];
  }).sort((a,b) => a.time.localeCompare(b.time)).map(row => row.item);

  return { generatedAt: now.toISOString(), today, tomorrow, complete: input.complete, conversations: section(dedupe(conversationItems)), quotes: section(dedupe(quoteItems)), visits: section(dedupe(visitItems)) };
}
