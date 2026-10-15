import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest, hasPermission, sessionCompany } from "../../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { databaseFetch } from "../../../../lib/supabase-rest";
import { mobileFieldOrders, mobileFieldSummary } from "../../../../lib/mobile-field";
import { routeContext } from "../../../../lib/work-route-store";
import { fieldOrderFingerprint, eligibleFieldEquipment } from "../../../../lib/mobile-workday";

import { assignedSignatureEmployee, safeSignatureImage } from "../../../../lib/service-order-signatures";

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
    const employeeContext = await routeContext(session);
    if (employeeContext.employee?.mobileAccessEnabled === false && !hasPermission(session,"rotas.visualizar")) return NextResponse.json({error:"Acesso mobile desativado para este funcionário."},{status:403,headers:privateHeaders});
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
      employeeId: employeeContext.actor?.employeeId,
    }).map(order=>({...order,editToken:fieldOrderFingerprint(records.get(order.id)!),technicianSignaturePreview:safeSignatureImage(assignedSignatureEmployee(records.get(order.id)!,employeeContext.state.moduleRecords?.Funcionários||[])?.employeeSignature),equipmentOptions:eligibleFieldEquipment(records.get(order.id)!,employeeContext.state.moduleRecords?.Equipamentos || []).map(item=>({id:String(item.id),label:String(item.physicalCode || item.name || item.serialNumber || item.id).slice(0,150)}))}));
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    return NextResponse.json({
      connected: true,
      stateFound,
      mode: "operational",
      user: { displayName: session.displayName || session.username, role: session.role, canEdit:hasPermission(session,"os.editar"), canApprove:hasPermission(session,"aprovacoes.aprovar"), scope:`${company.companyId}:${session.username}`, linkedEmployee:Boolean(employeeContext.actor), manager:hasPermission(session,"rotas.visualizar") },
      orders,
      summary: mobileFieldSummary(orders, today),
      lastReadAt: new Date().toISOString(),
      notice: "OS reais. Técnicos precisam de jornada ativa para atuar nos atendimentos.",
    }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({
      error: "Não foi possível carregar as ordens de serviço. Nenhum dado demonstrativo foi exibido.",
      code: "MOBILE_SYNC_UNAVAILABLE",
    }, { status: 503, headers: privateHeaders });
  }
}

