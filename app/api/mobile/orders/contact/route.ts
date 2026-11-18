import { NextRequest, NextResponse } from "next/server";
import { hasPermission, sessionFromRequest } from "../../../../../lib/permissions";
import { routeContext } from "../../../../../lib/work-route-store";
import { assignedToSession } from "../../../../../lib/mobile-field";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const html = (message: string, status: number) => new NextResponse(
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Contato do cliente · ProAR</title><body style="font:16px system-ui,sans-serif;background:#071a2e;color:#e6f2ff;padding:32px;max-width:600px;margin:auto"><h1 style="font-size:22px">WhatsApp · ProAR</h1><p>${message}</p><p>Volte ao ProAR e confirme o telefone cadastrado com a equipe administrativa.</p></body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } },
);

function normalizeBrazilNumber(value: unknown) {
  const raw = String(value ?? "").replace(/\D/g, "");
  if (!raw) return "";
  const number = raw.startsWith("55") ? raw : `55${raw}`;
  return /^55\d{10,11}$/.test(number) ? number : "";
}

function contactNumber(row: Record<string, unknown> | undefined) {
  if (!row) return "";
  for (const key of ["whatsapp", "phone", "telefone", "celular", "mobile", "phoneNumber", "contactPhone", "telefoneContato", "whatsappNumber", "customerPhone", "clientPhone", "telefoneCliente", "clientWhatsapp"]) {
    const number = normalizeBrazilNumber(row[key]);
    if (number) return number;
  }
  const contacts = Array.isArray(row.contacts) ? row.contacts : [];
  for (const value of contacts) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const contact = value as Record<string, unknown>;
    for (const key of ["whatsapp", "phone", "telefone", "celular", "mobile", "number"]) {
      const number = normalizeBrazilNumber(contact[key]);
      if (number) return number;
    }
  }
  return "";
}

function normalizedName(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export async function GET(request: NextRequest) {
  const session = sessionFromRequest(request);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return html("Acesse o contato pelo botão dentro da O.S. no ProAR.", 403);
  const referrer = request.headers.get("referer");
  if (referrer) { try { if (new URL(referrer).origin !== request.nextUrl.origin) return html("Acesse o contato pelo botão dentro da O.S. no ProAR.", 403); } catch { return html("Solicitação inválida.", 403); } }
  if (!session) return html("Sua sessão expirou. Entre novamente no ProAR.", 401);
  if (!hasPermission(session, "os.visualizar")) return html("Seu perfil não tem acesso a esta ordem de serviço.", 403);

  const orderId = String(request.nextUrl.searchParams.get("orderId") || "").trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(orderId)) return html("Ordem de serviço inválida.", 400);

  try {
    const context = await routeContext(session);
    const order = (context.state.serviceOrders || []).find((item: Record<string, unknown>) => item.id === orderId);
    const scopedSession = { ...session, employeeId: context.actor?.employeeId };
    if (!order || !assignedToSession(order, scopedSession)) return html("Esta ordem não está disponível para o seu perfil.", 403);

    const customerId = String(order.customerId || "").trim();
    const customerName = normalizedName(order.client);
    const allCustomers = [
      ...(Array.isArray(context.state.customers) ? context.state.customers : []),
      ...(Array.isArray(context.state.moduleRecords?.Clientes) ? context.state.moduleRecords.Clientes : []),
    ] as Record<string, unknown>[];
    let customer: Record<string, unknown> | undefined;
    if (customerId) {
      customer = allCustomers.find(row => String(row.id || row.customerId || "").trim() === customerId);
    } if (!customer && customerName) {
      const matches = allCustomers.filter(row => normalizedName(row.name || row.nome || row.client) === customerName);
      if (matches.length === 1) customer = matches[0];
    }

    const number = contactNumber(order) || contactNumber(customer);
    if (!number) return html("Não há um WhatsApp válido vinculado a esta O.S.", 404);

    const greeting = `Olá, sou da equipe técnica da PolarTech. Estou no atendimento ${orderId}.`;
    const destination = new URL(`https://wa.me/${number}`);
    destination.searchParams.set("text", greeting);
    const response = NextResponse.redirect(destination, 302);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch {
    return html("Não foi possível abrir o contato agora. Atualize a O.S. e tente novamente.", 503);
  }
}
