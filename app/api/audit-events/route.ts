import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { insertOperational, listOperational } from "@/lib/operational-repository";

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const entityType = request.nextUrl.searchParams.get("entityType");
  const entityId = request.nextUrl.searchParams.get("entityId");
  if (!entityType || !entityId) return NextResponse.json({ error: "Entidade obrigatória." }, { status: 400 });
  try {
    const events = await listOperational(user, "proar_audit_events", `entity_type=eq.${encodeURIComponent(entityType)}&entity_id=eq.${encodeURIComponent(entityId)}&order=created_at.desc`);
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ error: "Histórico indisponível. Execute a migração operacional." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.entityType || !body.entityId || !body.action) return NextResponse.json({ error: "Entidade e ação são obrigatórias." }, { status: 400 });
    const rows = await insertOperational(user, "proar_audit_events", {
      entity_type: String(body.entityType), entity_id: String(body.entityId), action: String(body.action),
      before_data: body.beforeData || null, after_data: body.afterData || null, reason: body.reason || null,
      created_by: user.displayName || "Usuário"
    });
    return NextResponse.json({ saved: true, event: rows[0] });
  } catch {
    return NextResponse.json({ error: "Não foi possível registrar o histórico." }, { status: 503 });
  }
}
