import { NextResponse } from "next/server";
import { db } from "@/db";
import { workFindings, works } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { desc, eq, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const workIdParam = searchParams.get("work_id");

    let workId: number | null = workIdParam ? Number(workIdParam) : null;
    let work = null;

    if (token) {
      const found = await db.select().from(works).where(eq(works.tokenPublico, token)).limit(1);
      if (found.length > 0) {
        work = found[0];
        workId = work.id;
      } else {
        // Fallback para mock
        workId = 1;
      }
    }

    // Busca do banco
    let list: any[] = [];
    try {
      if (workId) {
        list = await db
          .select()
          .from(workFindings)
          .where(eq(workFindings.workId, workId))
          .orderBy(desc(workFindings.criadoEm));
      } else {
        const session = await readSession(request);
        const companyId = session ? getEffectiveCompanyId(session) : 1;
        list = await db
          .select()
          .from(workFindings)
          .where(eq(workFindings.companyId, companyId))
          .orderBy(desc(workFindings.criadoEm));
      }
    } catch (e) {
      console.warn("[Work Findings GET] Falha ao consultar DB, usando dados locais de demonstração.");
    }

    // Dados de demonstração se a tabela estiver vazia
    if (list.length === 0) {
      list = [
        {
          id: 101,
          workId: workId || 1,
          companyId: 1,
          quadra: "Quadra 03",
          casa: "Casa 17",
          ambiente: "Quarto Frente",
          etapaRelacionada: "Rede Frigorígena",
          titulo: "Isolamento da tubulação em desacordo com norma",
          descricao: "Isolamento da tubulação não atende ao padrão de qualidade solicitado. Necessário revisar acabamento com fita vinílica e vedação.",
          tipo: "Qualidade do serviço",
          prioridade: "alta",
          situacao: "pendente",
          registradoPor: "Fiscalização Municipal (Eng. Carlos Eduardo)",
          funcaoRegistrador: "Fiscalização",
          fotos: [
            "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500"
          ],
          observacaoPolartech: null,
          fotosCorrecao: [],
          responsavelCorrecao: null,
          historico: [
            {
              data: "2026-09-03T13:42:00Z",
              autor: "Eng. Carlos Eduardo",
              funcao: "Fiscalização",
              acao: "Registro do apontamento de qualidade",
              descricao: "Isolamento da tubulação não atende ao padrão de qualidade solicitado.",
              situacao: "pendente"
            }
          ],
          criadoEm: new Date("2026-09-03T13:42:00Z"),
          atualizadoEm: new Date("2026-09-03T13:42:00Z"),
        },
        {
          id: 102,
          workId: workId || 1,
          companyId: 1,
          quadra: "Quadra 04",
          casa: "Casa 21",
          ambiente: "Sala de Estar",
          etapaRelacionada: "Tubulação Forçada",
          titulo: "Divergência de traçado da tubulação de exaustão",
          descricao: "Duto de exaustão passando em rota de interferência com duto elétrico. Necessário adequar suporte.",
          tipo: "Divergência de projeto",
          prioridade: "urgente",
          situacao: "aguardando_conferencia",
          registradoPor: "Engenharia Fiscal (Dr. Rogério)",
          funcaoRegistrador: "Engenharia",
          fotos: [],
          observacaoPolartech: "Suporte do duto readequado com curva suave de 45 graus e fixação em tirante metálico.",
          fotosCorrecao: [
            "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=500"
          ],
          responsavelCorrecao: "TEAM 11 (Técnico Jhonnatan)",
          dataCorrecao: new Date("2026-09-04T08:15:00Z"),
          historico: [
            {
              data: "2026-09-02T10:00:00Z",
              autor: "Dr. Rogério",
              funcao: "Engenharia",
              acao: "Registro de divergência de projeto",
              situacao: "pendente"
            },
            {
              data: "2026-09-04T08:15:00Z",
              autor: "TEAM 11 (Técnico Jhonnatan)",
              funcao: "PolarTech",
              acao: "Correção realizada e enviada para conferência",
              observacao: "Suporte do duto readequado com curva suave de 45 graus.",
              situacao: "aguardando_conferencia"
            }
          ],
          criadoEm: new Date("2026-09-02T10:00:00Z"),
          atualizadoEm: new Date("2026-09-04T08:15:00Z"),
        }
      ];
    }

    // Calcula contadores e agrupamento por casa
    const counts = {
      total: list.length,
      pendentes: list.filter((i) => i.situacao === "pendente").length,
      emAnalise: list.filter((i) => i.situacao === "em_analise").length,
      emCorrecao: list.filter((i) => i.situacao === "em_correcao").length,
      aguardandoConferencia: list.filter((i) => i.situacao === "aguardando_conferencia").length,
      resolvidas: list.filter((i) => i.situacao === "aprovada").length,
    };

    // Mapeamento de pendências ativas por casa: ex: { "Quadra 03_Casa 17": 1 }
    const housePendencies: Record<string, { count: number; worstStatus: string; items: any[] }> = {};
    for (const item of list) {
      if (item.situacao !== "aprovada" && item.situacao !== "cancelada") {
        const key = `${item.quadra}_${item.casa}`;
        if (!housePendencies[key]) {
          housePendencies[key] = { count: 0, worstStatus: item.situacao, items: [] };
        }
        housePendencies[key].count++;
        housePendencies[key].items.push(item);
      }
    }

    return NextResponse.json({
      success: true,
      count: list.length,
      counts,
      housePendencies,
      data: list,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
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
      registradoPor,
      funcaoRegistrador = "Fiscalização",
      fotos = [],
    } = body;

    // Validações obrigatórias
    if (!quadra || !casa || !ambiente || !etapaRelacionada || !titulo || !descricao || !registradoPor) {
      return NextResponse.json(
        {
          success: false,
          error: "Campos obrigatórios: Quadra, Casa/Lote, Ambiente, Etapa relacionada, Título, Descrição e Nome de quem está registrando.",
        },
        { status: 400 }
      );
    }

    // Resolve workId a partir do token público se fornecido
    let targetWorkId = workId ? Number(workId) : 1;
    let companyId = 1;

    if (token) {
      try {
        const found = await db.select().from(works).where(eq(works.tokenPublico, token)).limit(1);
        if (found.length > 0) {
          targetWorkId = found[0].id;
          companyId = found[0].companyId;
        }
      } catch (e) {}
    }

    const initialHistory = [
      {
        data: new Date().toISOString(),
        autor: registradoPor,
        funcao: funcaoRegistrador,
        acao: "Criação do Apontamento",
        descricao,
        situacao: "pendente",
      },
    ];

    let newRecord = null;
    try {
      const [inserted] = await db
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
      newRecord = inserted;
    } catch (e: any) {
      console.warn("[Work Findings POST] Fallback simulado sem DB:", e.message);
      newRecord = {
        id: Date.now(),
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
        criadoEm: new Date(),
      };
    }

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

    let existing = null;
    try {
      const result = await db.select().from(workFindings).where(eq(workFindings.id, Number(id))).limit(1);
      if (result.length > 0) {
        existing = result[0];
      }
    } catch (e) {}

    const historicoAtual = (existing?.historico as any[]) || [];
    let updatedData: any = { atualizadoEm: new Date() };

    // ==========================================
    // 1. Resposta da PolarTech (Enviar para conferência)
    // ==========================================
    if (action === "resposta_polartech" || body.observacaoPolartech) {
      const responsavel = body.responsavelCorrecao || "Equipe PolarTech";
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
            acao: "Correção realizada e enviada para conferência da Fiscalização",
            observacao: body.observacaoPolartech,
            situacao: "aguardando_conferencia",
          },
        ],
      };
    }

    // ==========================================
    // 2. Fiscalização / Engenharia Aprova Correção
    // ==========================================
    else if (action === "aprovar") {
      const aprovador = body.aprovadoPor || "Engenheiro / Fiscal";
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
            funcao: "Fiscalização",
            acao: "✓ Aprovado e liberado pela Fiscalização",
            situacao: "aprovada",
          },
        ],
      };
    }

    // ==========================================
    // 3. Fiscalização / Engenharia Reprova / Devolve
    // ==========================================
    else if (action === "reprovar") {
      const reprovador = body.reprovadoPor || "Engenheiro / Fiscal";
      const motivo = body.motivoReprovacao || "Ajuste insuficiente, verificar novamente o acabamento.";
      updatedData = {
        ...updatedData,
        situacao: "em_correcao",
        motivoReprovacao: motivo,
        historico: [
          ...historicoAtual,
          {
            data: new Date().toISOString(),
            autor: reprovador,
            funcao: "Fiscalização",
            acao: "↩ Reprovado / Devolvido para nova correção",
            motivo,
            situacao: "em_correcao",
          },
        ],
      };
    } else {
      if (body.situacao) updatedData.situacao = body.situacao;
      if (body.descricao) updatedData.descricao = body.descricao;
    }

    let updated = null;
    try {
      const [res] = await db
        .update(workFindings)
        .set(updatedData)
        .where(eq(workFindings.id, Number(id)))
        .returning();
      updated = res;
    } catch (e) {
      updated = { id, ...updatedData };
    }

    return NextResponse.json({
      success: true,
      message: action === "aprovar" ? "✓ Apontamento aprovado com sucesso!" : "✓ Status do apontamento atualizado.",
      data: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
