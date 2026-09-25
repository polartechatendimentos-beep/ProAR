import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { systemState } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";

const keyFor = (companyId: number, id: string) => `orcamento:${companyId}:${id}`;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Sessão inválida." }, { status: 401 });
  const { id } = await context.params;
  const key = keyFor(session.companyId || 1, id);
  const rows = await db.select().from(systemState).where(eq(systemState.chave, key)).limit(1);
  const row = rows[0];
  return NextResponse.json({ success: true, data: row?.valor || null, version: row?.atualizadoEm?.toISOString() || null });
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Sessão inválida." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json();
  const key = keyFor(session.companyId || 1, id);
  const current = await db.select().from(systemState).where(eq(systemState.chave, key)).limit(1);
  const now = new Date();

  if (!current[0]) {
    if (body.version) return NextResponse.json({ success: false, conflict: true, error: "O orçamento foi criado em outra sessão. Recarregue antes de salvar." }, { status: 409 });
    const inserted = await db.insert(systemState).values({ chave: key, valor: body.data, atualizadoEm: now }).onConflictDoNothing().returning();
    if (!inserted.length) return NextResponse.json({ success: false, conflict: true, error: "Outra sessão salvou este orçamento primeiro." }, { status: 409 });
    return NextResponse.json({ success: true, version: inserted[0].atualizadoEm.toISOString() });
  }

  const expected = body.version ? new Date(body.version) : null;
  if (!expected || Number.isNaN(expected.getTime())) return NextResponse.json({ success: false, conflict: true, error: "Versão ausente. Recarregue o orçamento antes de salvar." }, { status: 409 });
  const updated = await db.update(systemState).set({ valor: body.data, atualizadoEm: now })
    .where(and(eq(systemState.chave, key), eq(systemState.atualizadoEm, expected))).returning();
  if (!updated.length) return NextResponse.json({ success: false, conflict: true, error: "Este orçamento foi alterado em outra aba. Suas mudanças não foram sobrescritas." }, { status: 409 });
  return NextResponse.json({ success: true, version: updated[0].atualizadoEm.toISOString() });
}
