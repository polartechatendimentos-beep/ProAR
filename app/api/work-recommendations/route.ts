import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workExternalAccess, works, workRecommendations } from "@/db/schema";
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
        .from(workRecommendations)
        .where(eq(workRecommendations.workId, work.id))
        .orderBy(desc(workRecommendations.criadoEm));

      return NextResponse.json({ success: true, count: list.length, data: list });
    }

    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

    const companyId = getEffectiveCompanyId(session);
    if (workIdParam) {
      const workId = Number(workIdParam);
      const list = await db
        .select()
        .from(workRecommendations)
        .where(and(eq(workRecommendations.workId, workId), eq(workRecommendations.companyId, companyId)))
        .orderBy(desc(workRecommendations.criadoEm));
      return NextResponse.json({ success: true, count: list.length, data: list });
    }

    const list = await db
      .select()
      .from(workRecommendations)
      .where(eq(workRecommendations.companyId, companyId))
      .orderBy(desc(workRecommendations.criadoEm));
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

    if (!body.categoria || !body.titulo || !body.recomendacao) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: categoria, titulo e recomendacao." },
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

    const criador = external ? external.nome : internal!.nome;
    const tipoCriador = external ? external.tipo : "interno";
    const historico = [
      {
        data: new Date().toISOString(),
        autor: criador,
        tipo: tipoCriador,
        acao: "Criação de recomendação",
        situacao: "nova",
      },
    ];

    const [saved] = await db
      .insert(workRecommendations)
      .values({
        companyId,
        workId,
        scope: body.scope || "casa_lote",
        quadra: body.quadra || null,
        houseId: body.houseId || null,
        ambiente: body.ambiente || null,
        etapa: body.etapa || null,
        categoria: body.categoria,
        titulo: body.titulo,
        recomendacao: body.recomendacao,
        justificativa: body.justificativa || null,
        impacto: body.impacto || "medio",
        prioridade: body.prioridade || "normal",
        prazoSugerido: body.prazoSugerido || null,
        antesProximaEtapa: Boolean(body.antesProximaEtapa),
        situacao: "nova",
        fotos: body.fotos || [],
        criadoPor: criador,
        tipoCriador,
        historico,
      })
      .returning();

    return NextResponse.json({ success: true, data: saved, message: "Recomendação registrada com sucesso." });
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

    const [existing] = await db.select().from(workRecommendations).where(eq(workRecommendations.id, Number(body.id))).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "Recomendação não encontrada." }, { status: 404 });

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
    if (body.situacao !== undefined) updates.situacao = body.situacao;
    if (body.prioridade !== undefined) updates.prioridade = body.prioridade;
    if (body.recomendacao !== undefined) updates.recomendacao = body.recomendacao;
    if (body.justificativa !== undefined) updates.justificativa = body.justificativa;

    updates.historico = [
      ...historicoAtual,
      {
        data: new Date().toISOString(),
        autor: actor,
        tipo: actorTipo,
        acao: "Atualização de recomendação",
        situacao: body.situacao || existing.situacao,
      },
    ];

    const [saved] = await db.update(workRecommendations).set(updates).where(eq(workRecommendations.id, existing.id)).returning();
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
