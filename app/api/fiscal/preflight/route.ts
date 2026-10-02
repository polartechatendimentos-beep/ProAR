import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { validateFiscalPayload, type FiscalValidationPayload } from "../../../../lib/fiscal-validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.consultar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const payload = await request.json() as FiscalValidationPayload;
    const result = validateFiscalPayload(payload);
    return NextResponse.json(result, { status: result.valid ? 200 : 422 });
  } catch (error) {
    console.error("Fiscal preflight error", error);
    return NextResponse.json({ error: "Não foi possível validar o documento fiscal." }, { status: 400 });
  }
}
