import { NextRequest, NextResponse } from "next/server";
import { hasPermission, sessionFromRequest } from "../../../lib/permissions";
import { requiredSecret } from "../../../lib/security-env";
import { createEquipmentLabel, publicMaintenanceHistory } from "../../../lib/equipment-maintenance-label";
import { readEquipmentMaintenanceState } from "../../../lib/equipment-maintenance-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasPermission(session, "os.visualizar") && !hasPermission(session, "equipamentos.visualizar")) {
    return NextResponse.json({ error: "Sem permissão para consultar equipamentos." }, { status: 403 });
  }
  const equipmentId = String(request.nextUrl.searchParams.get("equipmentId") || "").trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(equipmentId)) {
    return NextResponse.json({ error: "Identificação do equipamento inválida." }, { status: 400 });
  }
  const companyId = String(session.companySlug || "").toLowerCase() === String(process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech").toLowerCase()
    ? (process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal") : String(session.companyId || "");
  if (!companyId) return NextResponse.json({ error: "Empresa não identificada na sessão." }, { status: 401 });
  try {
    const state = await readEquipmentMaintenanceState(companyId);
    const equipment = state?.equipment.find(item => String(item.id) === equipmentId);
    if (!equipment) return NextResponse.json({ error: "Equipamento não localizado nesta empresa." }, { status: 404 });
    const label = createEquipmentLabel(companyId, equipmentId, (process.env.PROAR_EQUIPMENT_LABEL_SECRET || requiredSecret("PROAR_SESSION_SECRET")));
    const enabled = equipment.publicMaintenanceHistoryEnabled === true;
    return NextResponse.json({
      enabled, code: label.code,
      historyCount: publicMaintenanceHistory(equipment, state?.orders ?? [], 30).length,
      ...(enabled ? { token: label.token, publicPath: `/equipamento/${label.token}`, printPath: `/etiqueta/${label.token}` } : {}),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a etiqueta. Verifique a conexão com o banco." }, { status: 503 });
  }
}
