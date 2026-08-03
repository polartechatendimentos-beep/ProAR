import { NextResponse } from "next/server";
import { db } from "@/db";
import { licitacoes } from "@/db/schema";
import { desc, eq, like, or, and } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "em_andamento"; // Padrão: Licitações em andamento
    const query = searchParams.get("q") || "";
    const uf = searchParams.get("uf");

    let conditions = [];

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
          like(licitacoes.descricao, `%${query}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let list = await db.select().from(licitacoes).where(whereClause).orderBy(desc(licitacoes.criadoEm)).limit(100);

    // Dados de demonstração/fallback se o banco estiver vazio
    if (list.length === 0 && (!statusFilter || statusFilter === "em_andamento")) {
      list = [
        {
          id: 101,
          numeroControlePncp: "12345678000199-1-000042/2026",
          titulo: "Pregão Eletrônico nº 042/2026 - Manutenção e Higienização de Ar Condicionado",
          descricao: "Contratação de empresa especializada em serviços de manutenção preventiva, corretiva e higienização de sistemas de climatização (PMOC).",
          orgao: "Prefeitura Municipal de Mirassol - SP",
          uf: "SP",
          modalidade: "Pregão Eletrônico",
          valorEstimado: "R$ 185.000,00",
          dataAbertura: new Date("2026-08-15T09:00:00Z"),
          dataFimProposta: new Date("2026-08-14T18:00:00Z"),
          linkEdital: "https://pncp.gov.br/app/editais",
          categoria: "Climatização / PMOC",
          status: "em_andamento",
          notificadoWhatsapp: true,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        },
        {
          id: 102,
          numeroControlePncp: "98765432000188-1-000015/2026",
          titulo: "Concorrência Pública nº 015/2026 - Instalação de Sistemas de Refrigeração Central",
          descricao: "Fornecimento com instalação e garantia de aparelhos de ar condicionado do tipo Split e Multi Split.",
          orgao: "Secretaria de Saúde do Estado de São Paulo",
          uf: "SP",
          modalidade: "Concorrência Eletrônica",
          valorEstimado: "R$ 420.000,00",
          dataAbertura: new Date("2026-08-20T10:00:00Z"),
          dataFimProposta: new Date("2026-08-19T23:59:00Z"),
          linkEdital: "https://pncp.gov.br/app/editais",
          categoria: "Engenharia / Climatização",
          status: "em_andamento",
          notificadoWhatsapp: false,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        },
        {
          id: 103,
          numeroControlePncp: "55443322000177-1-000008/2026",
          titulo: "Dispensa de Licitação nº 008/2026 - Serviço Emergencial de Limpeza e Troca de Filtros",
          descricao: "Serviços emergenciais de higienização bactericida e limpeza de serpentinas em unidades escolares.",
          orgao: "Câmara Municipal de Mirassol - SP",
          uf: "SP",
          modalidade: "Dispensa Eletrônica",
          valorEstimado: "R$ 38.500,00",
          dataAbertura: new Date("2026-08-10T14:00:00Z"),
          dataFimProposta: new Date("2026-08-09T17:00:00Z"),
          linkEdital: "https://pncp.gov.br/app/editais",
          categoria: "Higienização / Manutenção",
          status: "em_andamento",
          notificadoWhatsapp: true,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        },
      ] as any;
    }

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newLicitacao = await db.insert(licitacoes).values({
      numeroControlePncp: body.numeroControlePncp,
      titulo: body.titulo,
      descricao: body.descricao,
      orgao: body.orgao,
      uf: body.uf || "SP",
      modalidade: body.modalidade || "Pregão Eletrônico",
      valorEstimado: body.valorEstimado,
      dataAbertura: body.dataAbertura ? new Date(body.dataAbertura) : null,
      dataFimProposta: body.dataFimProposta ? new Date(body.dataFimProposta) : null,
      linkEdital: body.linkEdital,
      categoria: body.categoria,
      status: body.status || "em_andamento",
    }).returning();

    return NextResponse.json({ success: true, data: newLicitacao[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
