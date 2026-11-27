import type { ChatConversation, ChatMessage } from "./chatdesk-local.ts";

const replied = new Set(["accepted", "sent", "delivered", "read", "played"]);

export function firstUnansweredChatMessage(messages: readonly ChatMessage[]): string | null {
  // The message array is in ingestion order. Sort by provider time while keeping
  // insertion order for messages that carry the same timestamp.
  const ordered = messages.map((message,index) => ({ message,index,at:Date.parse(message.at) }))
    .filter(item => Number.isFinite(item.at))
    .sort((a,b) => a.at-b.at || a.index-b.index);
  let pending: string | null = null;
  for (const {message} of ordered) {
    if (message.direction === "in") {
      pending ??= message.at;
      continue;
    }
    if (message.direction !== "out" || message.assistantNudge || message.hoursNoticeFor || message.deliveryStatus === "failed") continue;
    if (message.deliveryStatus === "delivered" || message.deliveryStatus === "read" || !message.status || replied.has(message.status)) pending = null;
  }
  return pending;
}

export function nextUnansweredChat(items: readonly ChatConversation[], nowMs: number) {
  let next: { chat: ChatConversation; since: string; elapsedMinutes: number } | null = null;
  let earliest = Infinity;
  for (const chat of items) {
    if (chat.stage === "Concluído" || chat.optOut) continue;
    const projected = chat.queueActivity?.unansweredSince;
    const since = projected === undefined ? firstUnansweredChatMessage(chat.messages) : projected;
    const at = since ? Date.parse(since) : NaN;
    if (!since || !Number.isFinite(at) || at > nowMs) continue;
    if (at < earliest || (at === earliest && next && chat.phone.localeCompare(next.chat.phone) < 0)) {
      earliest = at;
      next = { chat, since, elapsedMinutes: Math.floor((nowMs-at)/60_000) };
    }
  }
  return next;
}

export function chatWaitingLabel(minutes: number) {
  if (minutes < 1) return "há menos de 1 min";
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes/60)} h`;
  const days = Math.floor(minutes/1440);
  return `há ${days} ${days===1?"dia":"dias"}`;
}
