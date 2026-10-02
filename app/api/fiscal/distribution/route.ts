import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { callFiscalBridge } from "../../../../lib/fiscal-bridge";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.consultar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const body = await request.json() as { nsu?: string; accessKey?: string; from?: string; to?: string };
    const documentId = body.accessKey || body.nsu || `DIST-${body.from || "latest"}-${body.to || "latest"}`;
    const result = await callFiscalBridge({ companyId: String(access.session.companyId || ""), action: "distribution", documentId, path: "/v1/documents/distribution", body });
    if (!result.configured) return NextResponse.json(result.data, { status: 503 });
    if (!result.response.ok) return NextResponse.json({ status: "error", error: result.data?.message || "Consulta DF-e não concluída.", provider: result.data }, { status: result.response.status });
    return NextResponse.json({ status: "ok", documents: Array.isArray(result.data?.documents) ? result.data.documents : [], lastNsu: result.data?.lastNsu, maxNsu: result.data?.maxNsu, provider: result.data });
  } catch (error) {
    console.error("Fiscal distribution error", error);
    return NextResponse.json({ error: "Falha ao consultar distribuição DF-e." }, { status: 500 });
  }
}
