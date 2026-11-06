import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { loadWhatsAppConfig } from "../../../../lib/proar-whatsapp";
import { databaseFetch } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { inboundRecord } from "../../../../lib/whatsapp-inbox";

export const runtime = "nodejs";

type Reply = {
  id?: string; from?: string; timestamp?: string; context?: { id?: string };
  text?: { body?: string }; button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
};
type Event = { entry?: { changes?: { field?: string; value?: { metadata?: { phone_number_id?: string }; messages?: Reply[] } }[] }[] };
type Attempt = { originId: string; recipient: string; appointmentDate: string; appointmentTime: string };
type Confirmation = { status: string; messageId: string; timestamp: number; date?: string; time?: string };
type Order = { id: string; date?: string; time?: string; whatsappConfirmation?: Confirmation };
type State = { _revision?: number; _companyId?: string; serviceOrders?: Order[] };

export function GET(request: NextRequest) {
  const token = process.env.PROAR_META_WEBHOOK_VERIFY_TOKEN;
  const params = request.nextUrl.searchParams;
  const challenge = params.get("hub.challenge");
  if (token && challenge && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === token) {
    return new NextResponse(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "Verificação inválida." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.PROAR_META_APP_SECRET;
  const company = process.env.PROAR_META_WEBHOOK_COMPANY_ID;
  if (!secret || !company) return NextResponse.json({ error: "Webhook indisponível." }, { status: 503 });
  const raw = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-hub-signature-256") || "";
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature) || !timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"))) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 403 });
  }

  try {
    const event = JSON.parse(raw.toString("utf8")) as Event;
    const config = await loadWhatsAppConfig(company);
    if (!config.active || !config.phoneNumberId) return NextResponse.json({ received: true });
    const db = await resolveTenantDb(company);
    if (!db.url || !db.key) throw new Error("Banco indisponível");
    const url = `${db.url}/rest/v1/proar_state`;
    const headers = tenantHeaders(db.key);
    const stateFilter = `id=eq.${encodeURIComponent(db.dedicated ? "main" : company)}`;
    for (const entry of event.entry ?? []) for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || change.value?.metadata?.phone_number_id !== config.phoneNumberId) continue;
      for (const message of change.value.messages ?? []) {
        const incoming = inboundRecord(company, message);
        if (incoming) {
          const saved = await databaseFetch(`${url}?on_conflict=id`, {
            method: "POST", headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
            body: JSON.stringify(incoming),
          });
          if (!saved.ok) throw new Error("Falha ao registrar mensagem recebida");
        }
        const value = (message.interactive?.button_reply?.id || message.button?.payload || message.button?.text || message.text?.body || "").trim().toLowerCase();
        const status = ["1", "sim", "confirmar"].includes(value) ? "Confirmada"
          : ["2", "reagendar", "solicitar reagendamento"].includes(value) ? "Reagendamento solicitado" : "";
        const reference = message.context?.id;
        const timestamp = Number(message.timestamp);
        if (!status || !message.id || !message.from || !reference || !Number.isSafeInteger(timestamp) || timestamp <= 0) continue;
        const query = new URLSearchParams({
          "id": "like.whatsapp-send:*", "payload->>companyId": `eq.${company}`, "payload->>providerMessageId": `eq.${reference}`,
          "payload->>status": "eq.accepted", "payload->>messageKind": "eq.appointment", select: "payload", limit: "2",
        });
        const lookup = await databaseFetch(`${url}?${query}`, { headers, cache: "no-store" });
        if (!lookup.ok) throw new Error("Falha ao consultar envio");
        const matches = await lookup.json() as { payload: Attempt }[];
        const attempt = matches[0]?.payload;
        if (matches.length !== 1 || attempt.recipient !== message.from || !attempt.appointmentDate || !attempt.appointmentTime) continue;
        let settled = false;
        for (let retry = 0; retry < 3; retry++) {
          const read = await databaseFetch(`${url}?${stateFilter}&select=payload`, { headers, cache: "no-store" });
          if (!read.ok) throw new Error("Falha ao consultar OS");
          const [row] = await read.json() as { payload: State }[];
          if (!row) throw new Error("Base operacional indisponível");
          const state = row.payload;
          if (state._companyId && state._companyId !== company) throw new Error("Empresa divergente");
          const order = state.serviceOrders?.find(item => item.id === attempt.originId);
          if (!order || order.date !== attempt.appointmentDate || order.time !== attempt.appointmentTime ||
            order.whatsappConfirmation?.messageId === message.id || (order.whatsappConfirmation?.date === order.date && order.whatsappConfirmation?.time === order.time && (order.whatsappConfirmation?.timestamp ?? 0) >= timestamp)) {
            settled = true;
            break;
          }
          const revision = state._revision ?? 0;
          const filter = state._revision == null ? "payload->>_revision=is.null" : `payload->>_revision=eq.${revision}`;
          const now = new Date().toISOString();
          const save = await databaseFetch(`${url}?${stateFilter}&${filter}`, {
            method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
            body: JSON.stringify({ payload: { ...state, _revision: revision + 1, _updatedAt: now,
              serviceOrders: state.serviceOrders?.map(item => item.id === order.id
                ? { ...item, whatsappConfirmation: { status, messageId: message.id, timestamp, date: order.date, time: order.time } } : item),
            }, updated_at: now }),
          });
          if (!save.ok) throw new Error("Falha ao gravar confirmação");
          if ((await save.json()).length) { settled = true; break; }
        }
        if (!settled) throw new Error("Conflito ao gravar confirmação");
      }
    }
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Falha temporária ao processar evento." }, { status: 503 });
  }
}
