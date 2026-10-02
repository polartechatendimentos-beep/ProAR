import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { validateFiscalPayload } from "../../../../lib/fiscal-validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.preparar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await request.json().catch(() => null);
  if (!body || !["NFSE","NFCE","NFE"].includes(body.kind)) {
    return NextResponse.json({ error:"Tipo de documento fiscal inválido." }, { status:400 });
  }
  const validation = validateFiscalPayload(body);
  return NextResponse.json({ ...validation, checkedAt:new Date().toISOString(), companyId:access.session.companyId });
}
