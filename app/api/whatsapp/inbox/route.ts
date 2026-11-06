import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../lib/permissions";
import { databaseFetch } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { inboxQuery, type InboxMessage } from "../../../../lib/whatsapp-inbox";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const access = requirePermission(request, "clientes.visualizar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const company = sessionCompany(access.session);
  if (!company.ok) return NextResponse.json({ error: company.error }, { status: company.status });
  const offset = Number(request.nextUrl.searchParams.get("offset") || 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
    return NextResponse.json({ error: "Página inválida." }, { status: 400 });
  }
  try {
    const db = await resolveTenantDb(company.companyId);
    if (!db.url || !db.key) throw new Error("Banco indisponível");
    const response = await databaseFetch(`${db.url}/rest/v1/proar_state?${inboxQuery(company.companyId, offset)}`,
      { headers: tenantHeaders(db.key), cache: "no-store" });
    if (!response.ok) throw new Error("Consulta indisponível");
    const rows = await response.json() as { payload: InboxMessage }[];
    return NextResponse.json({ messages: rows.slice(0, 100).map(row => row.payload), hasMore: rows.length > 100 },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as conversas. Tente atualizar novamente." }, { status: 503 });
  }
}
