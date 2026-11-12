import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../../lib/proar-auth";
import { assertActiveWhatsAppCompany } from "../../../../../lib/evolution-tenant";
import { evolutionSendHistory } from "../../../../../lib/evolution-jobs";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  const expectedCompany = request.headers.get("x-proar-company-id");
  if ((expectedCompany && expectedCompany !== user?.companyId) || !user?.companyId || (!user.permissions.includes("*") && !user.permissions.includes("Configurações"))) return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  try {
    await assertActiveWhatsAppCompany(user.companyId);
    return NextResponse.json({ items: await evolutionSendHistory(user.companyId) }, { headers: { "Cache-Control": "no-store, private" } });
  } catch { return NextResponse.json({ error: "Não foi possível consultar os envios." }, { status: 502 }); }
}
