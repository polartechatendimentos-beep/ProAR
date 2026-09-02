import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { insertOperational, listOperational } from "@/lib/operational-repository";

const statuses = new Set(["solicitada", "em_analise", "aprovada", "em_execucao", "executada", "conferida", "concluida", "rejeitada", "cancelada"]);

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const workId = request.nextUrl.searchParams.get("workId");
  if (!workId) return NextResponse.json({ error: "Obra obrigatória." }, { status: 400 });
  try {
    const changes = await listOperational(user, "proar_work_change_requests", `work_id=eq.${encodeURIComponent(workId)}&order=requested_at.desc`);
    return NextResponse.json({ changes });
  } catch {
    return NextResponse.json({ error: "Alterações de medidas indisponíveis. Execute a migração operacional." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json();
    const status = String(body.status || "solicitada");
    if (!body.workId || !body.description || !statuses.has(status)) {
      return NextResponse.json({ error: "Obra, descrição e situação válida são obrigatórias." }, { status: 400 });
    }
    const rows = await insertOperational(user, "proar_work_change_requests", {
      work_id: String(body.workId), block_code: body.blockCode || null, unit_code: body.unitCode || null,
      environment_name: body.environmentName || null, work_stage: body.workStage || null, change_type: body.changeType || null,
      original_measure: body.originalMeasure || null, new_measure: body.newMeasure || null, measure_unit: body.measureUnit || null,
      description: String(body.description), reason: body.reason || null, requested_by: body.requestedBy || user.displayName || "Usuário",
      requested_at: body.requestedAt || new Date().toISOString(), status, parent_request_id: body.parentRequestId || null,
      revision: Number(body.revision) || 1, created_by: user.displayName || "Usuário"
    });
    return NextResponse.json({ saved: true, change: rows[0] });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar a alteração de medida." }, { status: 503 });
  }
}
