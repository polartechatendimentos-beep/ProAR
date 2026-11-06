import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { sendOrderWhatsApp, type SendBody } from "../../../../lib/whatsapp-appointment-send";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "os.editar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const session = access.session;
  const body = await request.json().catch(() => null) as SendBody | null;
  if (!body) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  const primaryCompanyId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
  const primaryCompanySlug = (process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech").toLowerCase();
  const companyId = String(session.companySlug || "").toLowerCase() === primaryCompanySlug
    ? primaryCompanyId
    : String(session.companyId || primaryCompanyId);
  return sendOrderWhatsApp(companyId, session, body);
}
