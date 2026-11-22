import type { ChatConversation, ChatSector } from "./chatdesk-local";

export type ChatSlaRule = { firstResponseMinutes: number; followUpMinutes: number };
export type ChatSlaSettings = { companyId: string; rules: Partial<Record<ChatSector, ChatSlaRule>> };
export type ChatSlaResult = { state: "no-inbound" | "answered" | "on-time" | "warning" | "overdue"; minutesWaiting: number | null; deadline: string | null; sector: ChatSector };

export function evaluateChatSla(chat: ChatConversation, settings: ChatSlaSettings, now: string): ChatSlaResult {
  if (chat.companyId !== settings.companyId) throw new Error("Configuração de SLA de outra empresa.");
  const rule = settings.rules[chat.sector];
  const limit = chat.stage === "Novo contato" ? rule?.firstResponseMinutes : rule?.followUpMinutes;
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 10080)) throw new Error("Prazo de SLA inválido.");
  const messages = chat.messages.filter(m => m.direction === "in" || m.direction === "out").slice().sort((a,b) => Date.parse(a.at) - Date.parse(b.at));
  const lastInbound = messages.filter(m => m.direction === "in").at(-1);
  const base = { sector: chat.sector, minutesWaiting: null, deadline: null };
  if (!lastInbound) return { ...base, state: "no-inbound" };
  if (chat.stage === "Concluído" || messages.some(m => m.direction === "out" && Date.parse(m.at) >= Date.parse(lastInbound.at))) return { ...base, state: "answered" };
  const started = Date.parse(lastInbound.at), current = Date.parse(now);
  if (!Number.isFinite(started) || !Number.isFinite(current) || current < started) throw new Error("Data de SLA inválida.");
  const waiting = Math.floor((current - started) / 60000);
  if (!limit) return { ...base, state: "on-time", minutesWaiting: waiting };
  return { sector: chat.sector, minutesWaiting: waiting, deadline: new Date(started + limit * 60000).toISOString(), state: waiting >= limit ? "overdue" : waiting >= limit * .8 ? "warning" : "on-time" };
}
