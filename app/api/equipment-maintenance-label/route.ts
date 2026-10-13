import { NextRequest, NextResponse } from "next/server";
import { hasPermission, sessionCompany, sessionFromRequest } from "../../../lib/permissions";
import { requiredSecret } from "../../../lib/security-env";
import { createEquipmentLabel, equipmentDisplayLabel, findEquipmentByLabelCode, isEquipmentLabelCode, normalizeEquipmentLabelCode, publicMaintenanceHistory } from "../../../lib/equipment-maintenance-label";
import { readEquipmentMaintenanceState } from "../../../lib/equipment-maintenance-state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  if (!hasPermission(session, "os.visualizar") && !hasPermission(session, "equipamentos.visualizar")) {
    return NextResponse.json({ error: "Sem permissão para consultar equipamentos." }, { status: 403 });
  }
  const equipmentId = String(request.nextUrl.searchParams.get("equipmentId") || "").trim();
  const requestedCode = normalizeEquipmentLabelCode(request.nextUrl.searchParams.get("code"));
  const requestedCustomerId = String(request.nextUrl.searchParams.get("customerId") || "").trim();
  if (requestedCode) {
    if (!isEquipmentLabelCode(requestedCode) || !/^[A-Za-z0-9_-]{1,120}$/.test(requestedCustomerId)) {
      return NextResponse.json({ error: "Informe uma etiqueta válida e selecione o cliente da OS." }, { status: 400 });
    }
  } else if (!/^[A-Za-z0-9_-]{1,120}$/.test(equipmentId)) {
    return NextResponse.json({ error: "Identificação do equipamento inválida." }, { status: 400 });
  }
  const tenant = sessionCompany(session);
  if (!tenant.ok) return NextResponse.json({ error: tenant.error }, { status: tenant.status });
  const companyId = String(session.companySlug || "").trim().toLowerCase() === String(process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech").trim().toLowerCase()
    ? (process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal") : tenant.companyId;
  try {
    const state = await readEquipmentMaintenanceState(companyId);
    const secret = process.env.PROAR_EQUIPMENT_LABEL_SECRET || requiredSecret("PROAR_SESSION_SECRET");
    const equipment = requestedCode
      ? findEquipmentByLabelCode(state?.equipment ?? [], companyId, requestedCode, secret)
      : state?.equipment.find(item => String(item.id) === equipmentId);
    if (!equipment) return NextResponse.json({ error: "Etiqueta não cadastrada ou equipamento não localizado." }, { status: 404 });
    if (requestedCode && String(equipment.customerId || "") !== requestedCustomerId) {
      return NextResponse.json({ error: "Esta etiqueta não pertence ao cliente selecionado na OS." }, { status: 403 });
    }
    const resolvedId = String(equipment.id);
    const label = createEquipmentLabel(companyId, resolvedId, secret);
    const enabled = equipment.publicMaintenanceHistoryEnabled === true;
    const primaryCompanyId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
    const isPolartech = companyId === primaryCompanyId;
    const displayedCode = equipmentDisplayLabel(equipment, companyId, secret);
    if (isPolartech && !findEquipmentByLabelCode(state?.equipment ?? [], companyId, displayedCode, secret)) {
      return NextResponse.json({ error: "Identificador de etiqueta duplicado. Contate o suporte antes de imprimir." }, { status: 409 });
    }
    const codeOrToken = isPolartech ? displayedCode : label.token;
    return NextResponse.json({
      equipmentId: resolvedId,
      enabled, code: displayedCode,
      historyCount: publicMaintenanceHistory(equipment, state?.orders ?? [], 30).length,
      ...(enabled ? { publicPath: `/equipamento/${codeOrToken}`, printPath: `/etiqueta/${codeOrToken}`, publicOrigin: isPolartech ? "https://polartech.proar.online" : "" } : {}),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a etiqueta. Verifique a conexão com o banco." }, { status: 503 });
  }
}
