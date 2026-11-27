import { NextRequest, NextResponse, after } from "next/server";
import { validChatWebhookToken, parseEvolutionInbound, parseEvolutionDelivery, canReplyToNewInbound } from "../../../../../../lib/chatdesk-events";
import { requiredSecret } from "../../../../../../lib/security-env";
import { assertActiveWhatsAppCompany, evolutionConnection } from "../../../../../../lib/evolution-tenant";
import { changeChat, chatSettings } from "../../../../../../lib/chatdesk-store";
import { applyChatDeliveryReceipt } from "../../../../../../lib/chatdesk-delivery";
import { localTriage } from "../../../../../../lib/chatdesk-local";
import { processInboundEvent } from "../../../../../../lib/chatdesk-inbound-worker";
import { enqueuePilotEvents, drainQueuedPilot } from "../../../../../../lib/chatdesk-pilot-queue";
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
    const queued = process.env.PROAR_WHATSAPP_DURABLE_PILOT_COMPANY_ID === companyId && process.env.PROAR_WHATSAPP_DURABLE_PILOT === "true" && process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED === "true"
      && settings.botEnabled && settings.botTestPhone && settings.botActivatedAt
      ? events.filter(event => !localTriage(event.text).optOut && canReplyToNewInbound({activatedAt:settings.botActivatedAt!,testPhone:settings.botTestPhone,eventAt:event.at,phone:event.phone,text:event.text,acceptNewTurns:true},Date.now()))
      : [];
    if (queued.length) {
      await enqueuePilotEvents(companyId, settings.botActivatedAt!, connection.config.instance, queued);
      after(async () => { try { await drainQueuedPilot(companyId); } catch { /* Recovery cron handles durable work. */ } });
    }
    const enqueued = new Set(queued);
    for (const event of events) if (!enqueued.has(event)) await processInboundEvent(companyId, settings, event);
    return NextResponse.json({ received: events.length });
  } catch { return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 503 }); }
}
