import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacaoChecklistItems } from "@/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const licitacaoId = searchParams.get("licitacao_id") ? Number(searchParams.get("licitacao_id")) : null;
    const companyId = searchParams.get("company_id") ? Number(searchParams.get("company_id")) : 1;

    const list = await db
      .select()
      .from(licitacaoChecklistItems)
      .where(licitacaoId ? and(eq(licitacaoChecklistItems.companyId, companyId), eq(licitacaoChecklistItems.licitacaoId, licitacaoId)) : eq(licitacaoChecklistItems.companyId, companyId))
      .orderBy(desc(licitacaoChecklistItems.criadoEm));

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.licitacaoId || !body.categoria || !body.requisito) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: licitacaoId, categoria e requisito." }, { status: 400 });
    }

    const [saved] = await db
      .insert(licitacaoChecklistItems)
      .values({
        companyId: body.companyId ? Number(body.companyId) : 1,
        licitacaoId: Number(body.licitacaoId),
        categoria: body.categoria,
        requisito: body.requisito,
        status: body.status || "pendente",
        risco: body.risco || "medio",
        justificativaIa: body.justificativaIa || null,
        paginaClausula: body.paginaClausula || null,
        documentoRelacionado: body.documentoRelacionado || null,
        historico: body.historico || [],
      })
      .returning();

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: "id obrigatório." }, { status: 400 });
    }

    const [existing] = await db.select().from(licitacaoChecklistItems).where(eq(licitacaoChecklistItems.id, Number(body.id))).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "Item não encontrado." }, { status: 404 });

    const historico = (existing.historico as any[]) || [];
    const [saved] = await db
      .update(licitacaoChecklistItems)
      .set({
        status: body.status || existing.status,
        risco: body.risco || existing.risco,
        justificativaIa: body.justificativaIa ?? existing.justificativaIa,
        paginaClausula: body.paginaClausula ?? existing.paginaClausula,
        documentoRelacionado: body.documentoRelacionado ?? existing.documentoRelacionado,
        historico: [
          ...historico,
          {
            data: new Date().toISOString(),
            acao: "Atualização de checklist",
            status: body.status || existing.status,
            risco: body.risco || existing.risco,
          },
        ],
        atualizadoEm: new Date(),
      })
      .where(eq(licitacaoChecklistItems.id, existing.id))
      .returning();

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
