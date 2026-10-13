import { NextRequest, NextResponse } from "next/server";
import { requiredSecret } from "../../../lib/security-env";
import { createEquipmentLabel, equipmentDisplayLabel, findEquipmentByLabelCode, isEquipmentLabelCode, publicMaintenanceHistory, verifyEquipmentLabel } from "../../../lib/equipment-maintenance-label";
import { readEquipmentMaintenanceState } from "../../../lib/equipment-maintenance-state";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET(request: NextRequest) {
  const token = String(request.nextUrl.searchParams.get("token") || "");
  const primaryCompanyId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
  const isShortCode = isEquipmentLabelCode(token);
  let secret: string;
  try {
    secret = process.env.PROAR_EQUIPMENT_LABEL_SECRET || requiredSecret("PROAR_SESSION_SECRET");
  } catch {
    return NextResponse.json({ error: "Consulta temporariamente indisponível." }, { status: 503, headers: privateHeaders });
  }
  const signedIdentity = isShortCode ? null : verifyEquipmentLabel(token, secret);
  if (!isShortCode && !signedIdentity) {
    return NextResponse.json({ error: "Etiqueta inválida." }, { status: 404, headers: privateHeaders });
  }
  const companyId = isShortCode ? primaryCompanyId : signedIdentity!.companyId;
  try {
    const state = await readEquipmentMaintenanceState(companyId);
    const equipment = isShortCode
      ? findEquipmentByLabelCode(state?.equipment ?? [], companyId, token, secret)
      : state?.equipment.find(item => String(item.id) === signedIdentity!.equipmentId);
    if (!equipment || equipment.publicMaintenanceHistoryEnabled !== true) {
      return NextResponse.json({ error: "Etiqueta não localizada ou consulta desativada." }, { status: 404, headers: privateHeaders });
    }
    const code = equipmentDisplayLabel(equipment, companyId, secret);
    const brand = String(equipment.brand || "").slice(0, 60);
    const model = String(equipment.model || "").slice(0, 80);
    const type = String(equipment.equipmentType || "Ar-condicionado").slice(0, 60);
    const capacity = Number(equipment.capacityBtus);
    return NextResponse.json({
      label: code,
      publicOrigin: companyId === primaryCompanyId ? "https://polartech.proar.online" : "",
      branding: companyId === primaryCompanyId
        ? { name:"POLARTECH", subtitle:"AR CONDICIONADO", whatsapp:"(17) 99243-4646" }
        : { name:"ASSISTÊNCIA TÉCNICA", subtitle:"HISTÓRICO DE MANUTENÇÃO", whatsapp:"" },
      equipment: { type, brand, model, capacityBtus: Number.isFinite(capacity) && capacity > 0 && capacity <= 1_000_000 ? capacity : null },
      history: publicMaintenanceHistory(equipment, state?.orders ?? []),
      message: "Somente atendimentos concluídos e vinculados a este equipamento são exibidos.",
    }, { headers: privateHeaders });
  } catch {
    return NextResponse.json({ error: "Histórico indisponível no momento. Tente novamente." }, { status: 503, headers: privateHeaders });
  }
}
