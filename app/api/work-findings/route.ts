import { NextResponse } from "next/server";
import { db } from "@/db";
import { workFindings, works } from "@/db/schema";
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
      const findings = await db
        .select()
        .from(workFindings)
        .where(eq(workFindings.workId, foundWork.id))
        .orderBy(desc(workFindings.criadoEm));
      return NextResponse.json({ success: true, count: findings.length, data: findings });
    }

    const session = await readSession(request);
    const companyId = session ? getEffectiveCompanyId(session) : 1;

    let conditions = [eq(workFindings.companyId, companyId)];
    if (workId) {
      conditions.push(eq(workFindings.workId, workId));
    }

    const list = await db
      .select()
      .from(workFindings)
      .where(and(...conditions))
      .orderBy(desc(workFindings.criadoEm));

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

    if (!body.workId || !body.titulo) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: workId e titulo." },
        { status: 400 }
      );
    }

    const [newFinding] = await db
      .insert(workFindings)
      .values({
        workId: Number(body.workId),
        companyId,
        titulo: body.titulo,
        descricao: body.descricao || "",
        tipo: body.tipo || "nao_conformidade",
        gravidade: body.gravidade || "media",
        status: body.status || "aberto",
        fotos: body.fotos || [],
      })
      .returning();

    return NextResponse.json({ success: true, data: newFinding });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: "ID obrigatório." }, { status: 400 });
    }

    const updateData: any = { atualizadoEm: new Date() };
    if (body.status) {
      updateData.status = body.status;
      if (body.status === "resolvido") {
        updateData.resolvidoEm = new Date();
      }
    }
    if (body.descricao !== undefined) updateData.descricao = body.descricao;
    if (body.gravidade !== undefined) updateData.gravidade = body.gravidade;

    const [updated] = await db
      .update(workFindings)
      .set(updateData)
      .where(eq(workFindings.id, Number(body.id)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
