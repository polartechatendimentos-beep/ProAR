import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { insertOperational, listOperational, updateOperational } from "@/lib/operational-repository";

const statuses = new Set(["previsto", "confirmado", "estornado"]);
const positive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const workId = request.nextUrl.searchParams.get("workId");
  if (!workId) return NextResponse.json({ error: "Obra obrigatória." }, { status: 400 });
  try {
    const consumptions = await listOperational(user, "proar_work_consumptions", `work_id=eq.${encodeURIComponent(workId)}&order=created_at.desc`);
    return NextResponse.json({ consumptions });
  } catch {
    return NextResponse.json({ error: "Consumos da obra indisponíveis. Execute a migração operacional." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json();
    const finalQuantity = positive(body.finalQuantity);
    const plannedQuantity = positive(body.plannedQuantity) ?? 0;
    const wastePercent = positive(body.wastePercent) ?? 0;
    const status = String(body.status || "confirmado");
    if (!body.workId || !body.workStage || !body.productId || finalQuantity === null || !statuses.has(status)) return NextResponse.json({ error: "Obra, etapa, produto, quantidade e situação válidos são obrigatórios." }, { status: 400 });
    const rows = await insertOperational(user, "proar_work_consumptions", {
      work_id: String(body.workId), block_code: body.blockCode || null, unit_code: body.unitCode || null,
      work_stage: String(body.workStage), product_id: String(body.productId), stock_movement_id: body.stockMovementId || null,
      planned_quantity: plannedQuantity, waste_percent: wastePercent, final_quantity: finalQuantity, status,
      created_by: user.displayName || "Usuário",
    });
    await insertOperational(user, "proar_audit_events", {
      entity_type: "consumo_obra", entity_id: String(rows[0]?.id || body.productId), action: "consumo_registrado",
      after_data: { workId: body.workId, productId: body.productId, finalQuantity, status }, created_by: user.displayName || "Usuário",
    });
    return NextResponse.json({ saved: true, consumption: rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar o consumo da obra. Verifique duplicidade por unidade, etapa e produto." }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json();
    const id = String(body.id || "");
    const status = String(body.status || "");
    if (!/^[a-f0-9-]{36}$/i.test(id) || !statuses.has(status)) return NextResponse.json({ error: "Consumo e situação válidos são obrigatórios." }, { status: 400 });
    const rows = await updateOperational(user, "proar_work_consumptions", `id=eq.${encodeURIComponent(id)}`, { status });
    if (!rows[0]) return NextResponse.json({ error: "Consumo não encontrado." }, { status: 404 });
    return NextResponse.json({ saved: true, consumption: rows[0] });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o consumo da obra." }, { status: 503 });
  }
}
