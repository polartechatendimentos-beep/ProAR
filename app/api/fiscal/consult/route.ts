import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { callFiscalBridge } from "../../../../lib/fiscal-bridge";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.consultar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const body = await request.json() as { documentId?: string; documentType?: string; accessKey?: string; verificationCode?: string; protocol?: string };
    if (!body.documentId || !(body.accessKey || body.verificationCode || body.protocol)) return NextResponse.json({ error: "Informe documento e chave/código/protocolo para consulta." }, { status: 400 });
    const result = await callFiscalBridge({ companyId: String(access.session.companyId || ""), action: "consult", documentId: body.documentId, path: "/v1/documents/consult", body });
    if (!result.configured) return NextResponse.json(result.data, { status: 503 });
    if (!result.response.ok) return NextResponse.json({ status: "error", ...result.data, idempotencyKey: result.idempotencyKey }, { status: result.response.status });
    return NextResponse.json({ ...result.data, idempotencyKey: result.idempotencyKey, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Fiscal consult error", error);
    return NextResponse.json({ error: "Falha ao consultar documento fiscal." }, { status: 500 });
  }
}
