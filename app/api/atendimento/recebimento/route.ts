import { NextRequest, NextResponse } from "next/server";
import { chatAccess } from "../../../../lib/chatdesk-store";
import { chatWebhookToken } from "../../../../lib/chatdesk-events";
import { requiredSecret } from "../../../../lib/security-env";
import { assertActiveWhatsAppCompany, evolutionConnection } from "../../../../lib/evolution-tenant";
import { evolutionRequestWithConfig } from "../../../../lib/proar-evolution";
import { tenantSlugFromHost } from "../../../../lib/tenant-host";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") !== "same-origin" || (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const access = chatAccess(request);
  if (!access?.actor.admin) return NextResponse.json({ error: "Acesso restrito ao administrador da empresa." }, { status: 403 });
  try {
    await assertActiveWhatsAppCompany(access.companyId);
    // Use a direct tenant origin only when the signed session belongs to that
    // exact subdomain. The shared origin remains the default for other setups.
    const tenantSlug = tenantSlugFromHost(request.nextUrl.hostname);
    if (tenantSlug && access.session.companySlug && tenantSlug !== access.session.companySlug) {
      return NextResponse.json({ error: "Sessão não pertence a esta empresa." }, { status: 403 });
    }
    const directTenant = tenantSlug && tenantSlug === access.session.companySlug
      && request.nextUrl.protocol === "https:" && !request.nextUrl.port;
    const configured = directTenant ? request.nextUrl.origin : process.env.PROAR_WHATSAPP_WEBHOOK_BASE_URL;
    if (!configured) return NextResponse.json({ error: "O recebimento aguarda a configuração do endereço público desta versão do ProAR." }, { status: 503 });
    const base = new URL(configured);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/" || !/(^|\.)(proar\.online|proar\.app)$/.test(base.hostname)) throw new Error("Endereço público inválido.");
    const connection = await evolutionConnection(access.companyId);
    if (!connection) throw new Error("Conecte o WhatsApp da empresa primeiro.");
    const url = new URL(`api/whatsapp/web/events/${encodeURIComponent(access.companyId)}`, base).href;
    const token = chatWebhookToken(access.companyId, requiredSecret("PROAR_TENANT_MASTER_KEY"));
    const events = ["MESSAGES_UPSERT", "MESSAGES_UPDATE"];
    await evolutionRequestWithConfig(connection.config, "webhook/set", { webhook: { enabled: true, url, headers: { "x-proar-webhook-secret": token }, events, byEvents: false, base64: false } });
    const stored = await evolutionRequestWithConfig(connection.config, "webhook/find");
    const webhook = stored.webhook || stored;
    if (webhook.enabled !== true || webhook.url !== url || webhook.headers?.["x-proar-webhook-secret"] !== token || !Array.isArray(webhook.events) || !events.every(event => webhook.events.includes(event))) throw new Error("O servidor não confirmou o recebimento seguro. Confira a configuração.");
    return NextResponse.json({ configured: true }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível ativar o recebimento." }, { status: 502 }); }
}
