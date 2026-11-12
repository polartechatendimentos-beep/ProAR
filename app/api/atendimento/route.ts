import { NextRequest, NextResponse } from "next/server";
import { chatAccess, listChats, readChat, changeChat, chatSettings, saveChatSettings, chatDb } from "../../../lib/chatdesk-store";
import { applyChatCommand, canReadChat, localTriage, localOrderDraft } from "../../../lib/chatdesk-local";
import { assertActiveWhatsAppCompany } from "../../../lib/evolution-tenant";
import { dispatchEvolutionJob, evolutionSendHistory } from "../../../lib/evolution-jobs";
import { hasPermission } from "../../../lib/permissions";
import { databaseFetch } from "../../../lib/supabase-rest";
import { tenantHeaders } from "../../../lib/tenant-rest";

export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: NextRequest) {
  const access = chatAccess(request);
  if (!access) return reply({ error: "Entre com um usuário autorizado desta empresa." }, 403);
  try {
    await assertActiveWhatsAppCompany(access.companyId);
    const phone = request.nextUrl.searchParams.get("phone");
    if (phone) {
      const chat = await readChat(access.companyId, phone);
      if (!chat || !canReadChat(access.actor, chat)) return reply({ error: "Atendimento indisponível para este usuário." }, 404);
      return reply({ chat: { ...chat, requests: [] }, assistant: localTriage(chat.messages.filter(message => message.direction === "in").at(-1)?.text || ""), orderDraft: localOrderDraft(chat) });
    }
    const offset = Number(request.nextUrl.searchParams.get("offset") || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return reply({ error: "Página inválida." }, 400);
    const [queue, settings] = await Promise.all([listChats(access.companyId, access.actor, offset), chatSettings(access.companyId)]);
    const history = access.actor.admin ? await evolutionSendHistory(access.companyId) : [];
    return reply({ ...queue, actor: access.actor, companyId: access.companyId, settings, history, assistantMode: "local-rules" });
  } catch { return reply({ error: "Não foi possível carregar a central. Confira a sessão e a base da empresa." }, 503); }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") !== "same-origin" || (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin)) return reply({ error: "Origem inválida." }, 403);
  const access = chatAccess(request);
  if (!access) return reply({ error: "Não autorizado." }, 403);
  try {
    await assertActiveWhatsAppCompany(access.companyId);
    const raw = await request.text();
    if (raw.length > 15000) return reply({ error: "Solicitação muito grande." }, 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Solicitação inválida." }, 400);
    if (body.action === "settings") {
      if (!access.actor.admin) return reply({ error: "Somente o administrador configura o assistente." }, 403);
      const settings = await saveChatSettings(access.companyId, { revision: Number(body.revision), botEnabled: body.botEnabled === true, companyName: String(body.companyName || ""), greeting: String(body.greeting || "") });
      return reply({ settings, saved: true });
    }
    const phone = String(body.phone || "");
    const command = { requestId: String(body.requestId || ""), action: String(body.action || ""), text: String(body.text || ""), sector: String(body.sector || ""), stage: String(body.stage || ""), paused: body.paused, orderId: String(body.orderId || "") };
    if (command.action === "linkOrder") {
      if (!hasPermission(access.session, "os.visualizar")) return reply({ error: "Sem permissão para consultar OS." }, 403);
      const db = await chatDb(access.companyId);
      const stateId = db.dedicated ? "main" : access.companyId;
      const response = await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${encodeURIComponent(stateId)}&limit=1`, { headers: tenantHeaders(db.key), cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível consultar a OS.");
      const rows = await response.json();
      const state = rows[0]?.payload;
      if ((state?._companyId && state._companyId !== access.companyId) || !state?.serviceOrders?.some((order: { id: string }) => order.id === command.orderId)) return reply({ error: "A OS não foi encontrada nesta empresa." }, 400);
    }
    const committed = await changeChat(access.companyId, phone, previous => {
      if (!previous) throw new Error("Atendimento não encontrado.");
      const result = applyChatCommand(previous, access.actor, command, new Date().toISOString());
      return result.replay ? null : result.chat;
    });
    if (!committed.changed) return reply({ replay: true, message: "Esta solicitação já foi registrada. Confira o histórico." });
    if (command.action === "send") {
      const outbound = committed.chat!.messages.find(message => message.id === command.requestId)!;
      let status = "unknown", providerMessageId: string | undefined;
      try {
        const result = await dispatchEvolutionJob(access.companyId, `chat:${phone}:${command.requestId}`, phone, outbound.text);
        status = result.status;
        if (result.status === "accepted") providerMessageId = result.messageId;
      } catch { /* Persist uncertain result; never retry an ambiguous send automatically. */ }
      await changeChat(access.companyId, phone, previous => {
        if (!previous) return null;
        const next = structuredClone(previous);
        const message = next.messages.find(item => item.id === command.requestId);
        if (message) { message.status = status; message.providerMessageId = providerMessageId; }
        return next;
      });
      return reply({ status, message: status === "accepted" ? "Mensagem aceita pelo servidor. A entrega depende da confirmação do WhatsApp." : "Envio sem confirmação. Confira o WhatsApp e o histórico antes de reenviar." });
    }
    return reply({ saved: true });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Não foi possível salvar o atendimento." }, 400); }
}
