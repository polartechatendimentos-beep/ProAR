import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacaoBidSessions } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";

const ALLOWED_MODES = new Set(["observador", "assistido"]);
const ALLOWED_STATUS = new Set(["aguardando", "ativo", "pausado", "encerrado"]);

export async function GET(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const companyId = getEffectiveCompanyId(session, searchParams.get("company_id") ? Number(searchParams.get("company_id")) : null);
    const licitacaoId = searchParams.get("licitacao_id") ? Number(searchParams.get("licitacao_id")) : null;
    const where = licitacaoId ? and(eq(licitacaoBidSessions.companyId, companyId), eq(licitacaoBidSessions.licitacaoId, licitacaoId)) : eq(licitacaoBidSessions.companyId, companyId);
    const data = await db.select().from(licitacaoBidSessions).where(where).orderBy(desc(licitacaoBidSessions.criadoEm));
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível consultar as sessões." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    if (!body.licitacaoId || !body.portalNome) return NextResponse.json({ success: false, error: "Campos obrigatórios: licitacaoId e portalNome." }, { status: 400 });
    const mode = ALLOWED_MODES.has(body.modoOperacao) ? body.modoOperacao : "observador";
    const [saved] = await db.insert(licitacaoBidSessions).values({
      companyId, licitacaoId: Number(body.licitacaoId), portalNome: String(body.portalNome),
      portalEndereco: body.portalEndereco || null, perfilPortal: body.perfilPortal || null,
      confiancaReconhecimento: Math.max(0, Math.min(100, Number(body.confiancaReconhecimento) || 0)),
      modoOperacao: mode, status: "aguardando", killSwitchAtivado: false, gravacaoAtiva: Boolean(body.gravacaoAtiva),
      iniciadoEm: body.iniciadoEm ? new Date(body.iniciadoEm) : null, encerradoEm: null,
    }).returning();
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível criar a sessão." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: "ID obrigatório." }, { status: 400 });
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    const [existing] = await db.select().from(licitacaoBidSessions).where(and(eq(licitacaoBidSessions.id, Number(body.id)), eq(licitacaoBidSessions.companyId, companyId))).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "Sessão não encontrada." }, { status: 404 });
    const mode = body.modoOperacao === undefined ? existing.modoOperacao : (ALLOWED_MODES.has(body.modoOperacao) ? body.modoOperacao : existing.modoOperacao);
    const status = body.status === undefined ? existing.status : (ALLOWED_STATUS.has(body.status) ? body.status : existing.status);
    const [saved] = await db.update(licitacaoBidSessions).set({
      status, modoOperacao: mode,
      confiancaReconhecimento: body.confiancaReconhecimento === undefined ? existing.confiancaReconhecimento : Math.max(0, Math.min(100, Number(body.confiancaReconhecimento) || 0)),
      killSwitchAtivado: body.killSwitchAtivado === undefined ? existing.killSwitchAtivado : Boolean(body.killSwitchAtivado),
      gravacaoAtiva: body.gravacaoAtiva === undefined ? existing.gravacaoAtiva : Boolean(body.gravacaoAtiva),
      encerradoEm: body.encerradoEm ? new Date(body.encerradoEm) : existing.encerradoEm,
      atualizadoEm: new Date(),
    }).where(eq(licitacaoBidSessions.id, existing.id)).returning();
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar a sessão." }, { status: 500 });
  }
}