import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { callFiscalBridge } from "../../../../lib/fiscal-bridge";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const body = await request.json() as { documentType?: "NF-e"|"NFC-e"; series?: string; startNumber?: number; endNumber?: number; year?: number; reason?: string };
    if (!body.documentType || !body.series || !body.startNumber || !body.endNumber) return NextResponse.json({ error: "Modelo, série e intervalo numérico são obrigatórios." }, { status: 400 });
    if (body.endNumber < body.startNumber) return NextResponse.json({ error: "Intervalo de numeração inválido." }, { status: 400 });
    if (String(body.reason || "").trim().length < 15) return NextResponse.json({ error: "Informe justificativa para inutilização." }, { status: 400 });
    const documentId = `INUT-${body.documentType}-${body.series}-${body.startNumber}-${body.endNumber}`;
    const result = await callFiscalBridge({ companyId: String(access.session.companyId || ""), action: "inutilization", documentId, path: "/v1/documents/inutilization", body });
    if (!result.configured) return NextResponse.json(result.data, { status: 503 });
    if (!result.response.ok || !["authorized","registered","accepted"].includes(String(result.data?.status || ""))) return NextResponse.json({ status: "rejected", error: result.data?.message || "Inutilização não autorizada.", provider: result.data }, { status: 422 });
    return NextResponse.json({ status: "registered", protocol: result.data?.protocol, registeredAt: result.data?.registeredAt || new Date().toISOString(), provider: result.data });
  } catch (error) {
    console.error("Fiscal inutilization error", error);
    return NextResponse.json({ error: "Falha ao inutilizar numeração fiscal." }, { status: 500 });
  }
}
