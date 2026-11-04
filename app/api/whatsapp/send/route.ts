import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { loadWhatsAppConfig, normalizeWhatsAppNumber, sendWhatsAppTemplate } from "../../../../lib/proar-whatsapp";
import { databaseFetch } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { validateWhatsAppMessageInput, whatsappAttemptRecordId, type WhatsAppMessageKind } from "../../../../lib/whatsapp-message-policy";

export const runtime = "nodejs";

type StateRow = { payload?: { customers?: Record<string, unknown>[]; serviceOrders?: Record<string, unknown>[] } };
type SendBody = { originId?: string; kind?: WhatsAppMessageKind; parameters?: unknown; consentConfirmed?: boolean; eventKey?: string };

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function readPhone(order: Record<string, unknown>, customer?: Record<string, unknown>) {
  const raw = order.whatsappPhone || customer?.whatsapp || customer?.phone;
  return String(raw || "").replace(/\D/g, "");
}

async function readCompanyState(companyId: string, dedicated: boolean, db: { url: string; key: string }) {
  const primary = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
  const ids = dedicated ? ["main"] : companyId === primary ? [companyId, "main", "polartech"] : [companyId];
  const states: StateRow[] = [];
  for (const id of [...new Set(ids)]) {
    const response = await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`, {
      headers: tenantHeaders(db.key), cache: "no-store",
    });
    if (!response.ok) continue;
    const rows = await response.json() as StateRow[];
    if (rows[0]?.payload) states.push(rows[0]);
  }
  return states;
}

async function writeAttempt(db: { url: string; key: string }, id: string, payload: Record<string, unknown>, insert: boolean) {
  const url = `${db.url}/rest/v1/proar_state${insert ? "?on_conflict=id" : `?id=eq.${encodeURIComponent(id)}`}`;
  const response = await databaseFetch(url, {
    method: insert ? "POST" : "PATCH",
    headers: { ...tenantHeaders(db.key), ...(insert ? { Prefer: "resolution=ignore-duplicates,return=representation" } : { Prefer: "return=minimal" }) },
    body: JSON.stringify(insert ? { id, payload, updated_at: new Date().toISOString() } : { payload, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  return response;
}

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "os.editar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const session = access.session;
  const body = await request.json().catch(() => null) as SendBody | null;
  if (!body) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  const validationIssue = validateWhatsAppMessageInput(body);
  if (validationIssue) return NextResponse.json({ error: validationIssue }, { status: body.consentConfirmed === true ? 400 : 422 });
  const originId = cleanText(body.originId, 120);
  const kind = body.kind as WhatsAppMessageKind;
  const eventKey = cleanText(body.eventKey, 180);

  const primaryCompanyId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
  const primaryCompanySlug = (process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech").toLowerCase();
  const companyId = String(session.companySlug || "").toLowerCase() === primaryCompanySlug
    ? primaryCompanyId
    : String(session.companyId || primaryCompanyId);
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) return NextResponse.json({ error: "Banco da empresa indisponível." }, { status: 503 });
  const rows = await readCompanyState(companyId, db.dedicated, db);
  const orders = rows.flatMap(row => Array.isArray(row.payload?.serviceOrders) ? row.payload.serviceOrders : []);
  const customers = rows.flatMap(row => Array.isArray(row.payload?.customers) ? row.payload.customers : []);
  const order = orders.find(item => String(item.id || "") === originId);
  if (!order) return NextResponse.json({ error: "A OS não foi encontrada na empresa da sessão." }, { status: 404 });
  const customer = customers.find(item =>
    (order.customerId && String(item.id || "") === String(order.customerId)) ||
    String(item.name || "").trim().toLocaleLowerCase("pt-BR") === String(order.client || "").trim().toLocaleLowerCase("pt-BR")
  );
  const consentField = "whatsappAppointmentReminderEnabled";
  if (order[consentField] === false) return NextResponse.json({ error: "O envio está desativado para esta OS." }, { status: 403 });
  const to = readPhone(order, customer);
  if (to.length < 10 || to.length > 13) return NextResponse.json({ error: "Cadastre um telefone/WhatsApp válido no cliente ou na OS." }, { status: 422 });

  let config;
  try { config = await loadWhatsAppConfig(companyId); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Cofre do WhatsApp indisponível." }, { status: 503 }); }
  if (!config.active || !config.phoneNumberId || !config.accessToken) {
    return NextResponse.json({ error: "WhatsApp Business não está configurado/ativo. Configure a integração ou use o envio manual pelo WhatsApp." }, { status: 428 });
  }
  const template = cleanText(kind === "appointment" ? config.appointmentTemplate : config.reminderTemplate, 100);
  if (!/^[a-z0-9_]+$/.test(template)) return NextResponse.json({ error: "Configure um nome válido de modelo aprovado pela Meta." }, { status: 422 });

  const attemptId = whatsappAttemptRecordId(companyId, originId, kind, eventKey);
  const createdAt = new Date().toISOString();
  const attempt = {
    kind: "whatsapp-send-audit", status: "transmitting", originType: "os", originId, messageKind: kind,
    template, requestedBy: session.username, requestedByName: session.displayName,
    consentConfirmed: true, consentConfirmedAt: createdAt, createdAt,
  };
  const inserted = await writeAttempt(db, attemptId, attempt, true);
  if (inserted.status === 409) {
    return NextResponse.json({ error: "Este evento já foi enviado ou está em processamento. Consulte o histórico antes de tentar novamente.", duplicate: true }, { status: 409 });
  }
  if (!inserted.ok) return NextResponse.json({ error: "Não foi possível registrar a tentativa de envio com segurança." }, { status: 503 });

  try {
    const provider = await sendWhatsAppTemplate(config, to, template, (body.parameters as string[]).map(value => cleanText(value)));
    const messageId = String((provider as { messages?: { id?: string }[] })?.messages?.[0]?.id || "");
    await writeAttempt(db, attemptId, { ...attempt, status: "accepted", providerMessageId: messageId || undefined, acceptedAt: new Date().toISOString() }, false);
    return NextResponse.json({ sent: true, status: "accepted", messageId, message: "Mensagem aceita pela Meta para envio. A confirmação não significa que já foi entregue." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no provedor WhatsApp.";
    await writeAttempt(db, attemptId, { ...attempt, status: "failed", error: message.slice(0, 240), failedAt: new Date().toISOString() }, false).catch(() => undefined);
    return NextResponse.json({ error: message, status: "failed" }, { status: 502 });
  }
}
