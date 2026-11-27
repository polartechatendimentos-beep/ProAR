import { recordAppointmentReply } from "./chatdesk-appointment-reply";
import { canReplyToNewInbound, type EvolutionInboundEvent } from "./chatdesk-events";
import { tenantEvolutionAutomationEnabled } from "./evolution-tenant";
import { changeChat, readChat, chatSettings } from "./chatdesk-store";
import { localTriage, matchChatAutomation, eventReplyPlan, pilotReplyPlan, handoffSupplementPlan, businessHoursNotice, recordIntakeReply, updateServiceIntake, type ChatConversation, type LocalChatSettings } from "./chatdesk-local";
import { completeChatSend } from "./chatdesk-delivery";
import { dispatchEvolutionJob, readEvolutionJobOutcome } from "./evolution-jobs";

export async function processInboundEvent(companyId: string, settings: LocalChatSettings, event: EvolutionInboundEvent, options: { durable?: boolean; historyOnly?: boolean; retryDisconnected?: boolean } = {}) {
  const triage = localTriage(event.text);
  const pilot = Boolean(!options.historyOnly && settings.botEnabled && settings.botActivatedAt && settings.botTestPhone && settings.botTestPhone === event.phone
    && process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED === "true");
  const freshPilot = pilot && canReplyToNewInbound({activatedAt:settings.botActivatedAt!,testPhone:settings.botTestPhone,eventAt:event.at,phone:event.phone,text:event.text,acceptNewTurns:true});
  const result = await changeChat(companyId, event.phone, previous => {
    if (previous?.messages.some(message => message.id === event.id && message.direction === "in")) return null;
    if (previous && previous.messages.length >= 1500) throw new Error("Histórico cheio.");
    const next: ChatConversation = previous ? structuredClone(previous) : { companyId, phone: event.phone, name: event.name, sector: triage.sector, stage: "Novo contato", assignee: "", revision: 0, botPaused: false, optOut: false, messages: [], requests: [], updatedAt: event.at };
    next.optOut ||= triage.optOut;
    const contextualDetail = settings.botEnabled && settings.botActivatedAt && (!settings.botTestPhone || settings.botTestPhone === event.phone)
      && triage.sector === "Geral" && previous?.messages.some(message => message.direction === "out" && message.actor === "local-assistant"
        && Date.now() - Date.parse(message.at) < 30 * 60_000);
    if (!next.assignee && !next.botPaused && !contextualDetail) next.sector = triage.sector;
    if (next.stage === "Concluído") { next.stage = "Novo contato"; delete next.intake; }
    next.messages.push({ id: event.id, direction: "in", text: event.text, at: event.at, ...(event.replyToId ? { replyToId: event.replyToId } : {}), ...(event.mediaKind ? { mediaKind: event.mediaKind } : {}), ...(freshPilot ? { pilotTurn: true } : {}) });
    if (freshPilot && !next.optOut) next.intake = updateServiceIntake(next.intake, next.messages, event.id);
    next.updatedAt = new Date().toISOString();
    return next;
  });
  // Runs on redelivery too: if the chat write succeeded but the agenda failed, retry safely.
  const chat = result.chat;
  const botId = `local:${event.id}`;
  const recoveryMessage = options.durable ? chat?.messages.find(message => message.id === botId && message.direction === "out" && message.status === "processing") : undefined;
  if (recoveryMessage) {
    await finishInboundSend(companyId, settings, event, recoveryMessage, { durable:true, freshPilot, retryDisconnected:options.retryDisconnected });
    return;
  }
  if (options.historyOnly) return;
  // A verified redelivery can repair a failed reservation, not an uncertain send.
  const newest = chat?.messages.findLast(message => message.direction === "in");
  const repairReservation = !result.changed && freshPilot && newest?.id === event.id && newest.pilotTurn
    && !chat?.messages.some(message => message.id === botId);
  const mayReply = result.changed || repairReservation;
  let appointmentHandled = false, agendaFailed = false;
  try { appointmentHandled = !triage.optOut && await recordAppointmentReply(companyId, event); }
  catch (error) {
    // Continue only if we can durably flag this new conversation for staff.
    if (!freshPilot || !mayReply || chat?.assignee || (chat?.botPaused && !chat.assistantHandoffAt) || chat?.optOut) throw error;
    agendaFailed = true;
  }
  const recentBot = chat?.messages.some(message => message.actor === "local-assistant" && Date.now() - Date.parse(message.at) < 300000);
  if ((appointmentHandled && !freshPilot) || !mayReply || !chat || !settings.botEnabled || chat.optOut || (chat.botPaused && (!freshPilot || !chat.assistantHandoffAt)) || chat.assignee) return;
  if (settings.botActivatedAt) {
    if (process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED !== "true" || !canReplyToNewInbound({
      activatedAt: settings.botActivatedAt, testPhone: settings.botTestPhone,
      eventAt: event.at, phone: event.phone, text: event.text, acceptNewTurns: pilot,
    })) return;
  } else if (recentBot || !await tenantEvolutionAutomationEnabled(companyId)) return;
  // Reserve ownership in the conversation as well as in the outbox. A human
  // claim that wins the optimistic write prevents this automatic response.
  const reserved = await changeChat(companyId, event.phone, current => {
    if (!current || current.assignee || (current.botPaused && (!freshPilot || !current.assistantHandoffAt)) || current.optOut || current.messages.some(message => message.id === botId)) return null;
    if (repairReservation && current.messages.findLast(message => message.direction === "in")?.id !== event.id) return null;
    const flow = matchChatAutomation(settings.flows,event.text,current.sector);
    const plan = current.botPaused ? handoffSupplementPlan(current, event.id, Date.now(), appointmentHandled, agendaFailed)
      : settings.botActivatedAt
      ? pilot ? pilotReplyPlan(current.messages, event.id, settings.botActivatedAt, Date.now(), agendaFailed, appointmentHandled, current.intake)
        : eventReplyPlan(current.messages, event.id, settings.botActivatedAt)
      : current.messages.some(message => message.actor === "local-assistant" && Date.now() - Date.parse(message.at) < 300000)
        ? null : {key: "", reply: triage.reply, first: true, handoff: false};
    if (!plan) return null;
    const introduction = settings.botActivatedAt
      ? `Assistente virtual${settings.companyName ? ` da ${settings.companyName}` : ""}.\n`
      : `*Assistente automático${settings.companyName ? ` — ${settings.companyName}` : ""}:*\n`;
    const notice = freshPilot && !triage.urgent ? businessHoursNotice(settings.businessHours) : null;
    const showNotice = notice && !current.messages.some(message=>message.hoursNoticeFor===notice.key);
    const text = (plan.first ? introduction + (settings.greeting ? settings.greeting + "\n\n" : "") : "")
      + (showNotice ? notice.text + "\n\n" : "") + (flow && !plan.handoff ? flow.response : plan.reply);
    const next = structuredClone(current);
    const at = new Date().toISOString();
    if (flow) {
      if(flow.targetSector)next.sector=flow.targetSector;
      if(flow.targetStage)next.stage=flow.targetStage;
      if(flow.addTags?.length)next.tags=[...new Set([...(next.tags||[]),...flow.addTags])].slice(0,20);
    }
    if (plan.handoff) {
      next.assistantHandoffAt = at;
      next.botPaused = true;
    }
    next.messages.push({ id: botId, direction: "out", text, actor: "local-assistant", at, status: "processing", assistantReplyKey: plan.key, ...(showNotice ? {hoursNoticeFor:notice.key} : {}), ...("nudge" in plan && plan.nudge ? { assistantNudge: true } : {}) });
    return next;
  });
  const reservedMessage = reserved.chat?.messages.find(message => message.id === botId);
  if (!reserved.changed || !reservedMessage) return;
  await finishInboundSend(companyId, settings, event, reservedMessage, { durable:options.durable, freshPilot, retryDisconnected:options.retryDisconnected });
}

async function finishInboundSend(
  companyId:string, settings:LocalChatSettings, event:EvolutionInboundEvent, message:ChatConversation["messages"][number],
  options:{durable?:boolean;freshPilot:boolean;retryDisconnected?:boolean},
) {
  let status = "unknown", providerMessageId: string | undefined;
  const source = `chatbot:${event.phone}:${event.id}`;
  const stillAllowed = async () => {
    if (process.env.PROAR_WHATSAPP_DURABLE_PILOT_COMPANY_ID !== companyId || process.env.PROAR_WHATSAPP_DURABLE_PILOT !== "true" || process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED !== "true") return false;
    const active = await chatSettings(companyId);
    if (!active.botEnabled || !active.botActivatedAt || active.botActivatedAt !== settings.botActivatedAt || active.botTestPhone !== event.phone
      || !canReplyToNewInbound({activatedAt:active.botActivatedAt,testPhone:active.botTestPhone,eventAt:event.at,phone:event.phone,text:event.text,acceptNewTurns:true},Date.now())) return false;
    const current = await readChat(companyId, event.phone);
    return Boolean(current && !current.assignee && !current.optOut && (!current.botPaused || current.assistantHandoffAt) &&
      current.messages.findLast(item => item.direction === "in")?.id === event.id &&
      current.messages.some(item=>item.id===message.id && item.status==="processing"));
  };
  if (options.durable) {
    // A reservation alone is reversible. Any outbox entry means a send might
    // already have started; never call the provider a second time for it.
    const prior = await readEvolutionJobOutcome(companyId, source);
    if (prior) { status = prior.status; providerMessageId = prior.messageId; }
    else if (!options.freshPilot || !settings.botEnabled || !await stillAllowed()) status = "blocked-context";
    else {
      try {
        const sent = await dispatchEvolutionJob(companyId, source, event.phone, message.text, stillAllowed);
        if (sent.status === "duplicate") {
          const raced = await readEvolutionJobOutcome(companyId, source);
          status = raced?.status || "unknown"; providerMessageId = raced?.messageId;
        } else { status = sent.status; if (sent.status === "accepted") providerMessageId = sent.messageId; }
      } catch {
        // Restore proven acceptance if the transport succeeded before a write error.
        const recovered = await readEvolutionJobOutcome(companyId, source);
        status = recovered?.status || "unknown"; providerMessageId = recovered?.messageId;
      }
    }
  } else {
    try {
      const sent = await dispatchEvolutionJob(companyId, source, event.phone, message.text);
      status = sent.status;
      if (sent.status === "accepted") providerMessageId = sent.messageId;
    } catch { /* Keep an auditable uncertain result. */ }
  }
  if (status === "disconnected" && options.retryDisconnected) throw new Error("WhatsApp desconectado antes de iniciar o envio.");
  await changeChat(companyId, event.phone, current => {
    const existing=current?.messages.find(item=>item.id===message.id && item.direction==="out");
    if (options.durable && existing?.status !== "processing") return null;
    const next = completeChatSend(current, message.id, status, providerMessageId);
    if (options.freshPilot && status === "accepted" && next) {
      const newerTurn = next.messages.findLast(item => item.direction === "in")?.id !== event.id;
      const updated = recordIntakeReply(next.intake, message.assistantReplyKey || "", message.text, message.at,
        Boolean(next.botPaused && !message.assistantReplyKey?.startsWith("suplemento:")));
      if (updated && newerTurn && next.intake) updated.lastQuestion = next.intake.lastQuestion;
      next.intake = updated;
    }
    return next;
  });
}
