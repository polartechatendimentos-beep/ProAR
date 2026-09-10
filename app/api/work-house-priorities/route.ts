import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workExternalAccess, works, workHousePriorities } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { readWorkExternalSession } from "@/lib/work-external-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workIdParam = searchParams.get("work_id");
    const token = searchParams.get("token");

    if (token) {
      const [work] = await db.select().from(works).where(eq(works.tokenPublico, token)).limit(1);
      if (!work) return NextResponse.json({ success: false, error: "Obra não encontrada." }, { status: 404 });

      const list = await db
        .select()
        .from(workHousePriorities)
        .where(eq(workHousePriorities.workId, work.id))
        .orderBy(desc(workHousePriorities.criadoEm));

      return NextResponse.json({ success: true, count: list.length, data: list });
    }

    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

    const companyId = getEffectiveCompanyId(session);
    if (workIdParam) {
      const workId = Number(workIdParam);
      const list = await db
        .select()
        .from(workHousePriorities)
        .where(and(eq(workHousePriorities.workId, workId), eq(workHousePriorities.companyId, companyId)))
        .orderBy(desc(workHousePriorities.criadoEm));
      return NextResponse.json({ success: true, count: list.length, data: list });
    }

    const list = await db
      .select()
      .from(workHousePriorities)
      .where(eq(workHousePriorities.companyId, companyId))
      .orderBy(desc(workHousePriorities.criadoEm));
    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const external = readWorkExternalSession(request);
    const internal = await readSession(request);

    if (!external && !internal) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    if (!body.quadra || !body.houseId || !body.motivo) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: quadra, houseId e motivo." },
        { status: 400 }
      );
    }

    let workId = body.workId ? Number(body.workId) : null;
    let companyId = 1;

    if (external) {
      const [access] = await db.select().from(workExternalAccess).where(eq(workExternalAccess.id, external.accessId)).limit(1);
      if (!access || !access.enabled || access.workId !== external.workId) {
        return NextResponse.json({ success: false, error: "Sessão externa inválida ou bloqueada." }, { status: 403 });
      }
      if ((access.atualizadoEm?.toISOString?.() || String(access.id)) !== external.tokenVersion) {
        return NextResponse.json({ success: false, error: "Sessão externa expirada. Faça login novamente." }, { status: 401 });
      }

      workId = external.workId;
      companyId = external.companyId;
      if (body.token) {
        const [workByToken] = await db.select().from(works).where(eq(works.tokenPublico, String(body.token))).limit(1);
        if (!workByToken || workByToken.id !== workId) {
          return NextResponse.json({ success: false, error: "Credencial não pertence a esta obra." }, { status: 403 });
        }
      }
    }

    if (internal) {
      companyId = assertCompanyAccess(internal, body.companyId);
      if (!workId && body.token) {
        const [workByToken] = await db.select().from(works).where(eq(works.tokenPublico, String(body.token))).limit(1);
        if (workByToken) workId = workByToken.id;
      }
    }

    if (!workId) {
      return NextResponse.json({ success: false, error: "workId/token obrigatório." }, { status: 400 });
    }

    const solicitante = external ? external.nome : internal!.nome;
    const solicitanteTipo = external ? external.tipo : "interno";
    const historico = [
      {
        data: new Date().toISOString(),
        autor: solicitante,
        tipo: solicitanteTipo,
        acao: "Criação de prioridade",
        nivel: body.nivel || "normal",
        motivo: body.motivo,
      },
    ];

    const [saved] = await db
      .insert(workHousePriorities)
      .values({
        companyId,
        workId,
        quadra: body.quadra,
        houseId: body.houseId,
        nivel: body.nivel || "normal",
        motivo: body.motivo,
        observacao: body.observacao || null,
        fotos: body.fotos || [],
        solicitadoPor: solicitante,
        solicitanteTipo,
        ativo: true,
        historico,
      })
      .returning();

    return NextResponse.json({ success: true, data: saved, message: "Prioridade registrada com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const external = readWorkExternalSession(request);
    const internal = await readSession(request);

    if (!external && !internal) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    if (!body.id) return NextResponse.json({ success: false, error: "id obrigatório." }, { status: 400 });

    const [existing] = await db.select().from(workHousePriorities).where(eq(workHousePriorities.id, Number(body.id))).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "Prioridade não encontrada." }, { status: 404 });

    if (external && existing.workId !== external.workId) {
      return NextResponse.json({ success: false, error: "Credencial não pertence a esta obra." }, { status: 403 });
    }
    if (external) {
      const [access] = await db.select().from(workExternalAccess).where(eq(workExternalAccess.id, external.accessId)).limit(1);
      if (!access || !access.enabled || access.workId !== external.workId) {
        return NextResponse.json({ success: false, error: "Sessão externa inválida ou bloqueada." }, { status: 403 });
      }
      if ((access.atualizadoEm?.toISOString?.() || String(access.id)) !== external.tokenVersion) {
        return NextResponse.json({ success: false, error: "Sessão externa expirada. Faça login novamente." }, { status: 401 });
      }
    }

    const actor = external ? external.nome : internal!.nome;
    const actorTipo = external ? external.tipo : "interno";
    const historicoAtual = (existing.historico as any[]) || [];

    const updates: any = { atualizadoEm: new Date() };
    if (body.nivel !== undefined) updates.nivel = body.nivel;
    if (body.motivo !== undefined) updates.motivo = body.motivo;
    if (body.observacao !== undefined) updates.observacao = body.observacao;
    if (body.ativo !== undefined) updates.ativo = Boolean(body.ativo);

    updates.historico = [
      ...historicoAtual,
      {
        data: new Date().toISOString(),
        autor: actor,
        tipo: actorTipo,
        acao: body.ativo === false ? "Remoção lógica de prioridade" : "Atualização de prioridade",
        nivel: body.nivel,
      },
    ];

    const [saved] = await db.update(workHousePriorities).set(updates).where(eq(workHousePriorities.id, existing.id)).returning();
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
