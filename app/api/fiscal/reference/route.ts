import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { callFiscalBridge } from "../../../../lib/fiscal-bridge";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = requirePermission(request, "fiscal.consultar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const table = request.nextUrl.searchParams.get("table") || "summary";
  const result = await callFiscalBridge({ companyId:String(access.session.companyId||""), action:"reference", documentId:`reference-${table}`, path:"/v1/reference/tables", body:{ table } });
  if (!result.configured) return NextResponse.json({ ...result.data, table }, { status:503 });
  if (!result.response.ok) return NextResponse.json({ error: result.data?.message || "Não foi possível atualizar a tabela fiscal.", provider:result.data }, { status:result.response.status });
  return NextResponse.json({ table, data:result.data, checkedAt:new Date().toISOString() });
}
