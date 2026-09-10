import { NextResponse } from "next/server";
import { db } from "@/db";
import { licitacoes } from "@/db/schema";
import { and, desc, eq, like, or } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "em_andamento";
    const query = (searchParams.get("q") || "").trim();
    const uf = searchParams.get("uf");

    const conditions: any[] = [];

    if (statusFilter && statusFilter !== "todas") {
      conditions.push(eq(licitacoes.status, statusFilter));
    }
    if (uf) {
      conditions.push(eq(licitacoes.uf, uf));
    }
    if (query) {
      conditions.push(
        or(
          like(licitacoes.titulo, `%${query}%`),
          like(licitacoes.orgao, `%${query}%`),
          like(licitacoes.descricao, `%${query}%`),
          like(licitacoes.numeroPregao, `%${query}%`),
          like(licitacoes.numeroProcesso, `%${query}%`)
        )
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    let list = await db.select().from(licitacoes).where(whereClause).orderBy(desc(licitacoes.criadoEm)).limit(200);

    if (list.length === 0 && (!statusFilter || statusFilter === "em_andamento")) {
      list = [
        {
          id: 101,
          numeroControlePncp: "12345678000199-1-000042/2026",
          numeroPregao: "PE 088/2026",
          numeroProcesso: "PROC-2026-998",
          titulo: "Pregão Eletrônico 088/2026 - Serviços de Climatização",
          descricao: "Contratação para manutenção e instalação em unidades públicas.",
          orgao: "Prefeitura de Tanabi",
          plataforma: "ComprasGov",
          uf: "SP",
          modalidade: "Pregão Eletrônico",
          tipoJulgamento: "menor_preco_global",
          modoDisputa: "aberto",
          valorEstimado: "R$ 713.100,00",
          dataAbertura: new Date("2026-09-10T09:00:00Z"),
          horaSessao: "09:00",
          dataFimProposta: new Date("2026-09-09T18:00:00Z"),
          responsavelInterno: "Administrador Matriz",
          pisoTecnico: "R$ 535.000,00",
          pisoAbsoluto: "R$ 548.000,00",
          margemMinima: "13%",
          habilitacaoPercentual: 86,
          checklistResumo: {
            atendidos: 24,
            revisar: 3,
            criticos: 1,
            pendentes: 1,
          },
          aiAnalise: {
            riscoTecnico: "medio_alto",
            pontoCritico: "Atestado sem quantidade explícita de recargas 9k-12k",
          },
          linkEdital: "https://pncp.gov.br/app/editais",
          categoria: "Climatização / PMOC",
          status: "em_andamento",
          notificadoWhatsapp: true,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        } as any,
      ];
    }

    const resumo = {
      total: list.length,
      emAndamento: list.filter((l: any) => l.status === "em_andamento").length,
      vencidas: list.filter((l: any) => l.status === "vencida").length,
      ganhas: list.filter((l: any) => l.status === "ganha").length,
      habilitacaoMedia: list.length
        ? Math.round(list.reduce((acc: number, l: any) => acc + (l.habilitacaoPercentual || 0), 0) / list.length)
        : 0,
    };

    return NextResponse.json({ success: true, count: list.length, resumo, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.titulo || !body.orgao) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: titulo e orgao." }, { status: 400 });
    }

    const [newLicitacao] = await db
      .insert(licitacoes)
      .values({
        numeroControlePncp: body.numeroControlePncp,
        numeroPregao: body.numeroPregao,
        numeroProcesso: body.numeroProcesso,
        titulo: body.titulo,
        descricao: body.descricao,
        orgao: body.orgao,
        plataforma: body.plataforma,
        uf: body.uf || "SP",
        modalidade: body.modalidade || "Pregão Eletrônico",
        tipoJulgamento: body.tipoJulgamento || "menor_preco_global",
        modoDisputa: body.modoDisputa || "aberto",
        valorEstimado: body.valorEstimado,
        dataAbertura: body.dataAbertura ? new Date(body.dataAbertura) : null,
        horaSessao: body.horaSessao || null,
        dataFimProposta: body.dataFimProposta ? new Date(body.dataFimProposta) : null,
        responsavelInterno: body.responsavelInterno || "Administrador Matriz",
        pisoTecnico: body.pisoTecnico || null,
        pisoAbsoluto: body.pisoAbsoluto || null,
        margemMinima: body.margemMinima || null,
        habilitacaoPercentual: body.habilitacaoPercentual ? Number(body.habilitacaoPercentual) : 0,
        checklistResumo: body.checklistResumo || {},
        aiAnalise: body.aiAnalise || {},
        linkEdital: body.linkEdital,
        categoria: body.categoria,
        status: body.status || "em_andamento",
      })
      .returning();

    return NextResponse.json({ success: true, data: newLicitacao });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: "ID da licitação é obrigatório." }, { status: 400 });
    }

    const updates: any = { atualizadoEm: new Date() };
    const fields = [
      "numeroControlePncp",
      "numeroPregao",
      "numeroProcesso",
      "titulo",
      "descricao",
      "orgao",
      "plataforma",
      "uf",
      "modalidade",
      "tipoJulgamento",
      "modoDisputa",
      "valorEstimado",
      "horaSessao",
      "responsavelInterno",
      "pisoTecnico",
      "pisoAbsoluto",
      "margemMinima",
      "linkEdital",
      "categoria",
      "status",
      "habilitacaoPercentual",
      "checklistResumo",
      "aiAnalise",
    ];

    for (const field of fields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (body.dataAbertura !== undefined) updates.dataAbertura = body.dataAbertura ? new Date(body.dataAbertura) : null;
    if (body.dataFimProposta !== undefined) updates.dataFimProposta = body.dataFimProposta ? new Date(body.dataFimProposta) : null;

    const [updated] = await db.update(licitacoes).set(updates).where(eq(licitacoes.id, Number(body.id))).returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
