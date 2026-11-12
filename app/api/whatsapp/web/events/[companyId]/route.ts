import { NextRequest, NextResponse } from "next/server";
import { validChatWebhookToken, parseEvolutionInbound } from "../../../../../../lib/chatdesk-events";
import { requiredSecret } from "../../../../../../lib/security-env";
import { assertActiveWhatsAppCompany, evolutionConnection, tenantEvolutionAutomationEnabled } from "../../../../../../lib/evolution-tenant";
import { changeChat, chatSettings } from "../../../../../../lib/chatdesk-store";
import { localTriage, type ChatConversation } from "../../../../../../lib/chatdesk-local";
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
    const settings = await chatSettings(companyId);
    for (const event of events) {
      const triage = localTriage(event.text);
      const result = await changeChat(companyId, event.phone, previous => {
        if (previous?.messages.some(message => message.id === event.id && message.direction === "in")) return null;
        if (previous && previous.messages.length >= 1500) throw new Error("Histórico cheio.");
        const next: ChatConversation = previous ? structuredClone(previous) : { companyId, phone: event.phone, name: event.name, sector: triage.sector, stage: "Novo contato", assignee: "", revision: 0, botPaused: false, optOut: false, messages: [], requests: [], updatedAt: event.at };
        next.optOut ||= triage.optOut;
        if (!next.assignee && !next.botPaused) next.sector = triage.sector;
        if (next.stage === "Concluído") next.stage = "Novo contato";
        next.messages.push({ id: event.id, direction: "in", text: event.text, at: event.at });
        next.updatedAt = new Date().toISOString();
        return next;
      });
      const chat = result.chat;
      const recentBot = chat?.messages.some(message => message.actor === "local-assistant" && Date.now() - Date.parse(message.at) < 300000);
      if (!result.changed || !chat || !settings.botEnabled || chat.optOut || chat.botPaused || chat.assignee || recentBot || !await tenantEvolutionAutomationEnabled(companyId)) continue;
      const botId = `local:${event.id}`;
      const text = `*Assistente automático${settings.companyName ? ` — ${settings.companyName}` : ""}:*\n${settings.greeting ? settings.greeting + "\n\n" : ""}${triage.reply}`;
      // Reserve ownership in the conversation as well as in the outbox. A human
      // claim that wins the optimistic write prevents this automatic response.
      const reserved = await changeChat(companyId, event.phone, current => {
        if (!current || current.assignee || current.botPaused || current.optOut || current.messages.some(message => message.id === botId || (message.actor === "local-assistant" && Date.now() - Date.parse(message.at) < 300000))) return null;
        const next = structuredClone(current);
        next.messages.push({ id: botId, direction: "out", text, actor: "local-assistant", at: new Date().toISOString(), status: "processing" });
        return next;
      });
      if (!reserved.changed) continue;
      let status = "unknown", providerMessageId: string | undefined;
      try { const sent = await dispatchEvolutionJob(companyId, `chatbot:${event.phone}:${event.id}`, event.phone, text); status = sent.status; if (sent.status === "accepted") providerMessageId = sent.messageId; } catch { /* Keep an auditable uncertain result. */ }
      await changeChat(companyId, event.phone, current => {
        if (!current) return null;
        const next = structuredClone(current); const message = next.messages.find(item => item.id === botId);
        if (message) { message.status = status; message.providerMessageId = providerMessageId; }
        return next;
      });
    }
    return NextResponse.json({ received: events.length });
  } catch { return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 503 }); }
}
