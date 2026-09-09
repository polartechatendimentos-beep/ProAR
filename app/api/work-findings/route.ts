import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workExternalAccess, workFindings, works } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { readWorkExternalSession } from "@/lib/work-external-auth";

const EXTERNAL_ALLOWED_ACTIONS = new Set(["aprovar", "reprovar"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const workIdParam = searchParams.get("work_id");

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

      const counts = {
        total: findings.length,
        pendentes: findings.filter((i) => i.situacao === "pendente").length,
        emAnalise: findings.filter((i) => i.situacao === "em_analise").length,
        emCorrecao: findings.filter((i) => i.situacao === "em_correcao").length,
        aguardandoConferencia: findings.filter((i) => i.situacao === "aguardando_conferencia").length,
        resolvidas: findings.filter((i) => i.situacao === "aprovada").length,
      };

      const housePendencies: Record<string, { count: number; worstStatus: string; items: any[] }> = {};
      for (const item of findings) {
        if (item.situacao !== "aprovada" && item.situacao !== "cancelada") {
          const key = `${item.quadra}_${item.casa}`;
          if (!housePendencies[key]) {
            housePendencies[key] = { count: 0, worstStatus: item.situacao, items: [] };
          }
          housePendencies[key].count++;
          housePendencies[key].items.push(item);
        }
      }

      return NextResponse.json({ success: true, count: findings.length, counts, housePendencies, data: findings });
    }

    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    const companyId = getEffectiveCompanyId(session);
    const workId = workIdParam ? Number(workIdParam) : null;

    const list = await db
      .select()
      .from(workFindings)
      .where(workId ? and(eq(workFindings.companyId, companyId), eq(workFindings.workId, workId)) : eq(workFindings.companyId, companyId))
      .orderBy(desc(workFindings.criadoEm));

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const external = readWorkExternalSession(request);
    const session = await readSession(request);

    if (!external && !session) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    const {
      workId,
      token,
      quadra,
      casa,
      ambiente,
      etapaRelacionada,
      titulo,
      descricao,
      tipo = "nao_conformidade",
      prioridade = "normal",
      fotos = [],
    } = body;

    if (!quadra || !casa || !ambiente || !etapaRelacionada || !titulo || !descricao) {
      return NextResponse.json(
        {
          success: false,
          error: "Campos obrigatórios: Quadra, Casa/Lote, Ambiente, Etapa relacionada, Título e Descrição.",
        },
        { status: 400 }
      );
    }

    let targetWorkId: number | null = workId ? Number(workId) : null;
    let companyId = 1;

    if (external) {
      const [access] = await db.select().from(workExternalAccess).where(eq(workExternalAccess.id, external.accessId)).limit(1);
      if (!access || !access.enabled || access.workId !== external.workId) {
        return NextResponse.json({ success: false, error: "Sessão externa inválida ou bloqueada." }, { status: 403 });
      }
      if ((access.atualizadoEm?.toISOString?.() || String(access.id)) !== external.tokenVersion) {
        return NextResponse.json({ success: false, error: "Sessão externa expirada. Faça login novamente." }, { status: 401 });
      }

      targetWorkId = external.workId;
      companyId = external.companyId;

      if (!token) {
        return NextResponse.json({ success: false, error: "Token da obra obrigatório para acesso externo." }, { status: 400 });
      }

      const [work] = await db.select().from(works).where(eq(works.tokenPublico, String(token))).limit(1);
      if (!work || work.id !== targetWorkId) {
        return NextResponse.json({ success: false, error: "Credencial não pertence a esta obra." }, { status: 403 });
      }
    } else if (session) {
      companyId = assertCompanyAccess(session, body.companyId);
      if (!targetWorkId && token) {
        const [work] = await db.select().from(works).where(eq(works.tokenPublico, String(token))).limit(1);
        if (work) targetWorkId = work.id;
      }
    }

    if (!targetWorkId) {
      return NextResponse.json({ success: false, error: "workId/token obrigatório." }, { status: 400 });
    }

    const registradoPor = external ? external.nome : body.registradoPor || session!.nome;
    const funcaoRegistrador = external ? external.funcao : body.funcaoRegistrador || "Interno";

    const initialHistory = [
      {
        data: new Date().toISOString(),
        autor: registradoPor,
        funcao: funcaoRegistrador,
        origem: external ? external.tipo : "interno",
        acao: "Criação do apontamento",
        descricao,
        situacao: "pendente",
      },
    ];

    const [newRecord] = await db
      .insert(workFindings)
      .values({
        workId: targetWorkId,
        companyId,
        quadra,
        casa,
        ambiente,
        etapaRelacionada,
        titulo,
        descricao,
        tipo,
        prioridade,
        situacao: "pendente",
        registradoPor,
        funcaoRegistrador,
        fotos,
        historico: initialHistory,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: "✓ Apontamento registrado com sucesso.",
      data: newRecord,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID do apontamento obrigatório." }, { status: 400 });
    }

    const external = readWorkExternalSession(request);
    const session = await readSession(request);
    if (!external && !session) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    const [existing] = await db.select().from(workFindings).where(eq(workFindings.id, Number(id))).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Apontamento não encontrado." }, { status: 404 });
    }

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

    if (external && !EXTERNAL_ALLOWED_ACTIONS.has(String(action || ""))) {
      return NextResponse.json(
        { success: false, error: "Acesso externo só pode aprovar ou reprovar correções aguardando conferência." },
        { status: 403 }
      );
    }

    if (!external && !session) {
      return NextResponse.json({ success: false, error: "Acesso interno obrigatório para esta ação." }, { status: 403 });
    }

    const historicoAtual = (existing.historico as any[]) || [];
    let updatedData: any = { atualizadoEm: new Date() };

    if (action === "resposta_polartech") {
      if (!session) {
        return NextResponse.json({ success: false, error: "Apenas equipe interna pode responder correção." }, { status: 403 });
      }

      const responsavel = body.responsavelCorrecao || session.nome;
      updatedData = {
        ...updatedData,
        observacaoPolartech: body.observacaoPolartech,
        fotosCorrecao: body.fotosCorrecao || [],
        responsavelCorrecao: responsavel,
        dataCorrecao: new Date(),
        situacao: "aguardando_conferencia",
        historico: [
          ...historicoAtual,
          {
            data: new Date().toISOString(),
            autor: responsavel,
            funcao: "PolarTech",
            acao: "Correção realizada e enviada para conferência",
            observacao: body.observacaoPolartech,
            situacao: "aguardando_conferencia",
          },
        ],
      };
    } else if (action === "aprovar") {
      const aprovador = external ? external.nome : body.aprovadoPor || session?.nome || "Engenharia/Fiscalização";
      const funcao = external ? external.funcao : "Fiscalização";
      updatedData = {
        ...updatedData,
        situacao: "aprovada",
        aprovadoPor: aprovador,
        dataAprovacao: new Date(),
        resolvidoEm: new Date(),
        historico: [
          ...historicoAtual,
          {
            data: new Date().toISOString(),
            autor: aprovador,
            funcao,
            acao: "Aprovação da correção",
            situacao: "aprovada",
          },
        ],
      };
    } else if (action === "reprovar") {
      const reprovador = external ? external.nome : body.reprovadoPor || session?.nome || "Engenharia/Fiscalização";
      const funcao = external ? external.funcao : "Fiscalização";
      const motivo = body.motivoReprovacao || "Necessário novo ajuste técnico.";
      updatedData = {
        ...updatedData,
        situacao: "em_correcao",
        motivoReprovacao: motivo,
        historico: [
          ...historicoAtual,
          {
            data: new Date().toISOString(),
            autor: reprovador,
            funcao,
            acao: "Reprovação / devolução para correção",
            motivo,
            situacao: "em_correcao",
          },
        ],
      };
    } else {
      if (!session) {
        return NextResponse.json({ success: false, error: "Acesso interno obrigatório para atualização direta." }, { status: 403 });
      }
      if (body.situacao) updatedData.situacao = body.situacao;
      if (body.descricao !== undefined) updatedData.descricao = body.descricao;
      if (body.prioridade !== undefined) updatedData.prioridade = body.prioridade;
    }

    const [updated] = await db
      .update(workFindings)
      .set(updatedData)
      .where(eq(workFindings.id, Number(id)))
      .returning();

    return NextResponse.json({
      success: true,
      message: action === "aprovar" ? "✓ Apontamento aprovado com sucesso!" : "✓ Status do apontamento atualizado.",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
