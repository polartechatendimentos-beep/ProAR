import { recordAppointmentReply } from "../../../../../../lib/chatdesk-appointment-reply";
import { NextRequest, NextResponse } from "next/server";
import { validChatWebhookToken, parseEvolutionInbound, parseEvolutionDelivery, canReplyToNewInbound } from "../../../../../../lib/chatdesk-events";
import { requiredSecret } from "../../../../../../lib/security-env";
import { assertActiveWhatsAppCompany, evolutionConnection, tenantEvolutionAutomationEnabled } from "../../../../../../lib/evolution-tenant";
import { changeChat, chatSettings } from "../../../../../../lib/chatdesk-store";
import { localTriage, eventReplyPlan, pilotReplyPlan, updateServiceIntake, type ChatConversation } from "../../../../../../lib/chatdesk-local";
import { applyChatDeliveryReceipt, completeChatSend } from "../../../../../../lib/chatdesk-delivery";
import { dispatchEvolutionJob } from "../../../../../../lib/evolution-jobs";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest, context: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await context.params;
  try {
    if (!validChatWebhookToken(companyId, requiredSecret("PROAR_TENANT_MASTER_KEY"), request.headers.get("x-proar-webhook-secret") || "")) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    if (Number(request.headers.get("content-length") || 0) > 300000) return NextResponse.json({ error: "Evento muito grande." }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 300000) return NextResponse.json({ error: "Evento muito grande." }, { status: 413 });
    const body = JSON.parse(raw);
    await assertActiveWhatsAppCompany(companyId);
    const connection = await evolutionConnection(companyId);
    if (!connection) return NextResponse.json({ error: "Instância indisponível." }, { status: 403 });
    if (body.instance !== connection.config.instance) return NextResponse.json({ error: "Instância inválida." }, { status: 403 });
    const events = parseEvolutionInbound(body, connection.config.instance);
    const receipts = parseEvolutionDelivery(body, connection.config.instance);
    for (const receipt of receipts) await changeChat(companyId, receipt.phone, current => applyChatDeliveryReceipt(current, receipt));
    if (!events.length) return NextResponse.json({ received: 0, receipts: receipts.length });
    const settings = await chatSettings(companyId);
    for (const event of events) {
      const triage = localTriage(event.text);
      const pilot = Boolean(settings.botEnabled && settings.botActivatedAt && settings.botTestPhone && settings.botTestPhone === event.phone
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
      // A verified redelivery can repair a failed reservation, not an uncertain send.
      const newest = chat?.messages.findLast(message => message.direction === "in");
      const repairReservation = !result.changed && freshPilot && newest?.id === event.id && newest.pilotTurn
        && !chat?.messages.some(message => message.id === botId);
      const mayReply = result.changed || repairReservation;
      let appointmentHandled = false, agendaFailed = false;
      try { appointmentHandled = !triage.optOut && await recordAppointmentReply(companyId, event); }
      catch (error) {
        // Continue only if we can durably flag this new conversation for staff.
        if (!freshPilot || !mayReply || result.chat?.assignee || result.chat?.botPaused || result.chat?.optOut) throw error;
        agendaFailed = true;
      }
      const recentBot = chat?.messages.some(message => message.actor === "local-assistant" && Date.now() - Date.parse(message.at) < 300000);
      if ((appointmentHandled && !freshPilot) || !mayReply || !chat || !settings.botEnabled || chat.optOut || chat.botPaused || chat.assignee) continue;
      if (settings.botActivatedAt) {
        if (process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED !== "true" || !canReplyToNewInbound({
          activatedAt: settings.botActivatedAt, testPhone: settings.botTestPhone,
          eventAt: event.at, phone: event.phone, text: event.text, acceptNewTurns: pilot,
        })) continue;
      } else if (recentBot || !await tenantEvolutionAutomationEnabled(companyId)) continue;
      // Reserve ownership in the conversation as well as in the outbox. A human
      // claim that wins the optimistic write prevents this automatic response.
      const reserved = await changeChat(companyId, event.phone, current => {
        if (!current || current.assignee || current.botPaused || current.optOut || current.messages.some(message => message.id === botId)) return null;
        if (repairReservation && current.messages.findLast(message => message.direction === "in")?.id !== event.id) return null;
        const plan = settings.botActivatedAt
          ? pilot ? pilotReplyPlan(current.messages, event.id, settings.botActivatedAt, Date.now(), agendaFailed, appointmentHandled, current.intake)
            : eventReplyPlan(current.messages, event.id, settings.botActivatedAt)
          : current.messages.some(message => message.actor === "local-assistant" && Date.now() - Date.parse(message.at) < 300000)
            ? null : {key: "", reply: triage.reply, first: true, handoff: false};
        if (!plan) return null;
        const introduction = settings.botActivatedAt
          ? `Assistente virtual${settings.companyName ? ` da ${settings.companyName}` : ""}.\n`
          : `*Assistente automático${settings.companyName ? ` — ${settings.companyName}` : ""}:*\n`;
        const text = plan.first ? introduction + (settings.greeting ? settings.greeting + "\n\n" : "") + plan.reply : plan.reply;
        const next = structuredClone(current);
        const at = new Date().toISOString();
        if (plan.handoff) {
          next.assistantHandoffAt = at;
          next.botPaused = true;
        }
        next.messages.push({ id: botId, direction: "out", text, actor: "local-assistant", at, status: "processing", assistantReplyKey: plan.key, ...("nudge" in plan && plan.nudge ? { assistantNudge: true } : {}) });
        return next;
      });
      const reservedMessage = reserved.chat?.messages.find(message => message.id === botId);
      if (!reserved.changed || !reservedMessage) continue;
      let status = "unknown", providerMessageId: string | undefined;
      try { const sent = await dispatchEvolutionJob(companyId, `chatbot:${event.phone}:${event.id}`, event.phone, reservedMessage.text); status = sent.status; if (sent.status === "accepted") providerMessageId = sent.messageId; } catch { /* Keep an auditable uncertain result. */ }
      await changeChat(companyId, event.phone, current => completeChatSend(current, botId, status, providerMessageId));
    }
    return NextResponse.json({ received: events.length });
  } catch { return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 503 }); }
}
