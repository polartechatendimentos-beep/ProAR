import { chatSettings, changeChat, readChat } from "./chatdesk-store";
import { completeChatSend } from "./chatdesk-delivery";
import { dispatchEvolutionJob } from "./evolution-jobs";
import type { ChatMessage } from "./chatdesk-local";
import { followUpText, isPilotFollowUpEnabled, planPilotFollowUp } from "./chatdesk-follow-up-plan";

export async function runPilotFollowUp(companyId: string) {
  if (process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED !== "true") return null;
  const settings = await chatSettings(companyId);
  if (settings.companyId !== companyId || !isPilotFollowUpEnabled(settings, Date.now())) return null;
  const to = settings.botTestPhone!;
  const candidate = planPilotFollowUp(await readChat(companyId, to), settings, Date.now());
  if (!candidate) return null;
  const message: ChatMessage = {
    id: candidate.id, direction: "out", text: followUpText, actor: "local-assistant",
    at: new Date().toISOString(), status: "processing", assistantReplyKey: "lembrete:piloto",
  };
  const reserved = await changeChat(companyId, to, current => {
    if (!current || planPilotFollowUp(current, settings, Date.now())?.id !== candidate.id) return null;
    return { ...current, messages: [...current.messages, message], updatedAt: message.at };
  });
  if (!reserved.changed) return null;
  let status = "unknown";
  let providerMessageId: string | undefined;
  try {
    const result = await dispatchEvolutionJob(companyId, `pilot-followup:${to}:${candidate.inputId}`, to, message.text, async () => {
      if (process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED !== "true") return false;
      const latest = await chatSettings(companyId);
      if (latest.revision !== settings.revision) return false;
      return planPilotFollowUp(await readChat(companyId, to), latest, Date.now(), message)?.id === candidate.id;
    });
    status = result.status;
    if (status === "accepted") providerMessageId = result.messageId;
  } catch { /* Leave an auditable record, never retry an uncertain send. */ }
  await changeChat(companyId, to, current => {
    // A blocked message was never sent. Keep a non-public marker to prevent attempts for that turn.
    if (current && (status === "blocked-context" || status === "blocked-optout")) {
      return { ...current, messages: current.messages.map(row => row.id === message.id ? {
        ...row, status, direction: "event", text: "Lembrete não enviado: o contexto da conversa mudou.",
      } : row) };
    }
    return completeChatSend(current, message.id, status, providerMessageId);
  });
  return status;
}
