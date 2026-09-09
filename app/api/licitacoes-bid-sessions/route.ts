import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacaoBidSessions } from "@/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const licitacaoId = searchParams.get("licitacao_id") ? Number(searchParams.get("licitacao_id")) : null;
    const companyId = searchParams.get("company_id") ? Number(searchParams.get("company_id")) : 1;

    const list = await db
      .select()
      .from(licitacaoBidSessions)
      .where(licitacaoId ? and(eq(licitacaoBidSessions.companyId, companyId), eq(licitacaoBidSessions.licitacaoId, licitacaoId)) : eq(licitacaoBidSessions.companyId, companyId))
      .orderBy(desc(licitacaoBidSessions.criadoEm));

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.licitacaoId || !body.portalNome) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: licitacaoId e portalNome." }, { status: 400 });
    }

    const [saved] = await db
      .insert(licitacaoBidSessions)
      .values({
        companyId: body.companyId ? Number(body.companyId) : 1,
        licitacaoId: Number(body.licitacaoId),
        portalNome: body.portalNome,
        portalEndereco: body.portalEndereco || null,
        perfilPortal: body.perfilPortal || null,
        confiancaReconhecimento: body.confiancaReconhecimento ? Number(body.confiancaReconhecimento) : 0,
        modoOperacao: body.modoOperacao || "observador",
        status: body.status || "aguardando",
        killSwitchAtivado: Boolean(body.killSwitchAtivado),
        gravacaoAtiva: Boolean(body.gravacaoAtiva),
        iniciadoEm: body.iniciadoEm ? new Date(body.iniciadoEm) : null,
        encerradoEm: body.encerradoEm ? new Date(body.encerradoEm) : null,
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
    if (!body.id) return NextResponse.json({ success: false, error: "id obrigatório." }, { status: 400 });

    const [saved] = await db
      .update(licitacaoBidSessions)
      .set({
        status: body.status,
        modoOperacao: body.modoOperacao,
        confiancaReconhecimento: body.confiancaReconhecimento,
        killSwitchAtivado: body.killSwitchAtivado,
        gravacaoAtiva: body.gravacaoAtiva,
        encerradoEm: body.encerradoEm ? new Date(body.encerradoEm) : undefined,
        atualizadoEm: new Date(),
      })
      .where(eq(licitacaoBidSessions.id, Number(body.id)))
      .returning();

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
