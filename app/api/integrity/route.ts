import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { hasPermission } from "../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";
import { databaseFetch, PRIMARY_DATABASE_URL } from "../../../lib/supabase-rest";
import { auditOperationalIntegrity } from "../../../lib/integrity-audit";

export async function GET(request: NextRequest) {
  const session = readSession(request.cookies.get("proar_session")?.value);
  if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasPermission(session, "integridade.visualizar")) return NextResponse.json({ error: "Você não possui permissão para consultar a integridade do sistema." }, { status: 403 });

  try {
    const company = session.companyId || process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
    const db = await resolveTenantDb(session.companyId);
    if (!db.url || !db.key) throw new Error("Banco indisponível");
    const stateId = db.dedicated ? "main" : company;
    const url = db.url === PRIMARY_DATABASE_URL
      ? `${PRIMARY_DATABASE_URL}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId)}&select=payload&limit=1`
      : `${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId)}&select=payload&limit=1`;
    const response = await databaseFetch(url, { headers: tenantHeaders(db.key), cache: "no-store" });
    if (!response.ok) throw new Error("Falha ao consultar a base operacional");
    const records = await response.json() as { payload?: Record<string, unknown> }[];
    const state = records[0]?.payload;
    if (!state || typeof state !== "object") return NextResponse.json({ error: "A base operacional ainda não possui um snapshot disponível para diagnóstico." }, { status: 409 });
    return NextResponse.json(auditOperationalIntegrity(state), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível executar o diagnóstico da base operacional." }, { status: 503 });
  }
}
