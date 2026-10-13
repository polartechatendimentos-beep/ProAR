import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest, hasPermission, sessionCompany } from "../../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { databaseFetch } from "../../../../lib/supabase-rest";
import { mobileFieldOrders, mobileFieldSummary } from "../../../../lib/mobile-field";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

export async function GET(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Entre no ProAR para acessar o aplicativo de campo.", loginRequired: true }, { status: 401, headers: privateHeaders });
  if (!hasPermission(session, "os.visualizar")) {
    return NextResponse.json({ error: "Seu perfil não tem permissão para consultar ordens de serviço." }, { status: 403, headers: privateHeaders });
  }
  const company = sessionCompany(session);
  if (!company.ok) return NextResponse.json({ error: company.error }, { status: company.status, headers: privateHeaders });
  try {
    const db = await resolveTenantDb(company.companyId);
    if (!db.url || !db.key) throw new Error("TENANT_DATABASE_UNAVAILABLE");
    const primaryId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
    const keys = db.dedicated ? ["main"] : company.companyId === primaryId ? [company.companyId, "main", "polartech"] : [company.companyId];
    const records = new Map<string, Record<string, unknown>>();
    let stateFound = false;
    for (const key of keys) {
      const response = await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(key)}&select=payload`, {
        headers: tenantHeaders(db.key), cache: "no-store",
      });
      if (!response.ok) throw new Error("TENANT_STATE_READ_FAILED");
      const rows = await response.json() as { payload?: { serviceOrders?: Record<string, unknown>[] } }[];
      for (const row of rows) {
        if (!row.payload) continue;
        stateFound = true;
        for (const item of Array.isArray(row.payload.serviceOrders) ? row.payload.serviceOrders : []) {
          const id = String(item.id || "");
          if (id && !records.has(id)) records.set(id, item);
        }
      }
    }
    const orders = mobileFieldOrders([...records.values()], {
      username: session.username,
      displayName: session.displayName,
      role: session.role,
    });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    return NextResponse.json({
      connected: true,
      stateFound,
      mode: "read-only",
      user: { displayName: session.displayName || session.username, role: session.role },
      orders,
      summary: mobileFieldSummary(orders, today),
      lastReadAt: new Date().toISOString(),
      notice: "Dados reais do ProAR. Alterações operacionais serão liberadas após homologação do fluxo de sincronização.",
    }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({
      error: "Não foi possível carregar as ordens de serviço. Nenhum dado demonstrativo foi exibido.",
      code: "MOBILE_SYNC_UNAVAILABLE",
    }, { status: 503, headers: privateHeaders });
  }
}
