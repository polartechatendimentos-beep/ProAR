import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { callFiscalBridge } from "../../../../lib/fiscal-bridge";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const body = await request.json() as { documentId?: string; documentType?: "NF-e"|"NFC-e"; action?: "activate"|"reconcile"; reason?: string; accessKey?: string };
    if (!body.documentId || !body.documentType || !body.action) return NextResponse.json({ error: "Documento, modelo e ação de contingência são obrigatórios." }, { status: 400 });
    if (body.action === "activate" && String(body.reason || "").trim().length < 15) return NextResponse.json({ error: "Informe o motivo da contingência." }, { status: 400 });
    const result = await callFiscalBridge({ companyId: String(access.session.companyId || ""), action: `contingency-${body.action}`, documentId: body.documentId, path: "/v1/documents/contingency", body });
    if (!result.configured) return NextResponse.json(result.data, { status: 503 });
    if (!result.response.ok) return NextResponse.json({ status: "error", error: result.data?.message || "Ação de contingência não concluída.", provider: result.data }, { status: result.response.status });
    return NextResponse.json({ status: result.data?.status || "accepted", provider: result.data, idempotencyKey: result.idempotencyKey });
  } catch (error) {
    console.error("Fiscal contingency error", error);
    return NextResponse.json({ error: "Falha no fluxo de contingência." }, { status: 500 });
  }
}
