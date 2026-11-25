import type { ChatConversation, ChatMessage, LocalChatSettings } from "./chatdesk-local";

export type FollowUpSettings = { enabled: boolean; delayMinutes: number; enabledAt: string };
type Hours = { day: number; opens: string; closes: string };
type Settings = LocalChatSettings & { followUp?: FollowUpSettings; businessHours?: Hours[] };

const minute = 60_000;
const replyWindow = 24 * 60 * minute;
const localTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const eligibleStage = new Set(["Novo contato", "Aguardando cliente"]);
export const followUpText = "Se quiser continuar por aqui, pode me mandar a informação que ficou faltando. Se já resolveu, não precisa responder.";

export function isPilotFollowUpEnabled(settings: Settings, now: number) {
  const config = settings.followUp;
  return config?.enabled === true && settings.botEnabled === true && pilotFollowUpDeliveryWindow(settings.businessHours, now)
    && /^[1-9]\d{9,14}$/.test(settings.botTestPhone || "")
    && Number.isInteger(config.delayMinutes) && config.delayMinutes >= 15 && config.delayMinutes <= 1380
    && Number.isFinite(Date.parse(config.enabledAt)) && Date.parse(config.enabledAt) <= now
    && Number.isFinite(Date.parse(settings.botActivatedAt || "")) && Date.parse(settings.botActivatedAt || "") <= now;
}

// Reminders are never sent outside explicitly configured business hours.
function pilotFollowUpDeliveryWindow(hours: Hours[] | undefined, now: number) {
  if (!Number.isFinite(now) || !Array.isArray(hours) || !hours.length || hours.length > 14) return false;
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (hours.some(row => !row || !Number.isInteger(row.day) || row.day < 0 || row.day > 6
    || typeof row.opens !== "string" || typeof row.closes !== "string" || !time.test(row.opens) || !time.test(row.closes)
    || row.opens >= row.closes)) return false;
  const parts = localTime.formatToParts(now);
  const read = (name: string) => parts.find(part => part.type === name)?.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(read("weekday") || "");
  const current = `${read("hour")}:${read("minute")}`;
  return hours.some(window => window.day === day && current >= window.opens && current < window.closes);
}

export function planPilotFollowUp(chat: ChatConversation | null, settings: Settings, now: number, reserved?: ChatMessage) {
  if (!isPilotFollowUpEnabled(settings, now) || !chat
    || settings.companyId !== chat.companyId || settings.botTestPhone !== chat.phone
    || chat.optOut || chat.botPaused || chat.assistantHandoffAt || chat.assignee
    || !eligibleStage.has(chat.stage) || chat.messages.length >= (reserved ? 1501 : 1500)) return null;
  const lastInput = chat.messages.findLastIndex(message => message.direction === "in");
  if (lastInput < 0 || chat.messages.slice(lastInput + 1).some(message => message.direction === "note"
    || (message.direction === "event" && message.actor !== "local-assistant"))) return null;
  const messages = chat.messages.filter(message => message.direction === "in" || message.direction === "out");
  const lastCustomer = messages.findLastIndex(message => message.direction === "in");
  if (lastCustomer < 0) return null;
  const input = messages[lastCustomer];
  const inputAt = Date.parse(input.at);
  const config = settings.followUp!;
  if (input.pilotTurn !== true || !Number.isFinite(inputAt)
    || inputAt < Math.max(Date.parse(config.enabledAt), Date.parse(settings.botActivatedAt!))
    || now - inputAt >= replyWindow) return null;

  const tail = messages.slice(lastCustomer + 1);
  const question = tail.at(reserved ? -2 : -1);
  if (!question || question.id !== `local:${input.id}` || question.direction !== "out"
    || question.actor !== "local-assistant" || question.status !== "accepted"
    || !["delivered", "read"].includes(question.deliveryStatus || "") || !question.text.trimEnd().endsWith("?")
    || !question.assistantReplyKey || /^(?:urgente?|suplemento|handoff|acolhimento|agenda|lembrete|cortesia|fora-expediente)(?::|$)/.test(question.assistantReplyKey)) return null;
  const questionAt = Date.parse(question.at);
  if (!Number.isFinite(questionAt) || questionAt < inputAt || now - questionAt < config.delayMinutes * minute) return null;
  const id = `followup:${input.id}`;
  const existing = chat.messages.find(message => message.id === id);
  if (reserved) {
    if (tail.at(-1)?.id !== id || reserved.id !== id || existing?.status !== "processing" || existing.at !== reserved.at) return null;
  } else if (existing) return null;
  return { id, questionId: question.id, inputId: input.id };
}
