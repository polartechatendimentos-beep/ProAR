import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { callFiscalBridge } from "../../../../lib/fiscal-bridge";

export const runtime = "nodejs";
const allowed = new Set(["CCE","MANIFEST_SCIENCE","MANIFEST_CONFIRMATION","MANIFEST_UNKNOWN","MANIFEST_NOT_PERFORMED","SUBSTITUTION"]);

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const body = await request.json() as { documentId?: string; documentType?: string; accessKey?: string; eventType?: string; text?: string; sequence?: number };
    if (!body.documentId || !body.eventType || !allowed.has(body.eventType)) return NextResponse.json({ error: "Evento fiscal inválido." }, { status: 400 });
    if (!body.accessKey) return NextResponse.json({ error: "Chave do documento fiscal é obrigatória." }, { status: 400 });
    if (body.eventType === "CCE" && String(body.text || "").trim().length < 15) return NextResponse.json({ error: "Carta de Correção exige texto explicativo." }, { status: 400 });
    const result = await callFiscalBridge({ companyId: String(access.session.companyId || ""), action: body.eventType.toLowerCase(), documentId: body.documentId, path: "/v1/documents/event", body });
    if (!result.configured) return NextResponse.json(result.data, { status: 503 });
    if (!result.response.ok || !["authorized","registered","accepted"].includes(String(result.data?.status || ""))) return NextResponse.json({ status: "rejected", error: result.data?.message || "Evento não autorizado.", provider: result.data, idempotencyKey: result.idempotencyKey }, { status: 422 });
    return NextResponse.json({ status: "registered", eventType: body.eventType, protocol: result.data?.protocol, registeredAt: result.data?.registeredAt || new Date().toISOString(), provider: result.data, idempotencyKey: result.idempotencyKey });
  } catch (error) {
    console.error("Fiscal event error", error);
    return NextResponse.json({ error: "Falha ao registrar evento fiscal." }, { status: 500 });
  }
}
