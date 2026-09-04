import { NextResponse } from "next/server";
import { db } from "@/db";
import { workChanges, works } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { desc, eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workId = searchParams.get("work_id") ? Number(searchParams.get("work_id")) : null;
    const token = searchParams.get("token");

    if (token) {
      const [foundWork] = await db.select().from(works).where(eq(works.tokenPublico, token)).limit(1);
      if (!foundWork) {
        return NextResponse.json({ success: false, error: "Obra não encontrada." }, { status: 404 });
      }
      const changes = await db
        .select()
        .from(workChanges)
        .where(eq(workChanges.workId, foundWork.id))
        .orderBy(desc(workChanges.data));
      return NextResponse.json({ success: true, count: changes.length, data: changes });
    }

    const session = await readSession(request);
    const companyId = session ? getEffectiveCompanyId(session) : 1;

    let conditions = [eq(workChanges.companyId, companyId)];
    if (workId) {
      conditions.push(eq(workChanges.workId, workId));
    }

    const list = await db
      .select()
      .from(workChanges)
      .where(and(...conditions))
      .orderBy(desc(workChanges.data));

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId);

    if (!body.workId || !body.descricao) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: workId e descricao." },
        { status: 400 }
      );
    }

    const [newChange] = await db
      .insert(workChanges)
      .values({
        workId: Number(body.workId),
        companyId,
        tipo: body.tipo || "diario_bordo",
        descricao: body.descricao,
        impacto: body.impacto || null,
        responsavel: body.responsavel || session.nome,
        aprovado: body.aprovado !== undefined ? Boolean(body.aprovado) : true,
      })
      .returning();

    return NextResponse.json({ success: true, data: newChange });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
