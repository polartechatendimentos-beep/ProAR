import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacaoChecklistItems } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";

export async function GET(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const licitacaoId = searchParams.get("licitacao_id") ? Number(searchParams.get("licitacao_id")) : null;
    const requestedCompany = searchParams.get("company_id");
    const companyId = getEffectiveCompanyId(session, requestedCompany ? Number(requestedCompany) : null);
    const where = licitacaoId
      ? and(eq(licitacaoChecklistItems.companyId, companyId), eq(licitacaoChecklistItems.licitacaoId, licitacaoId))
      : eq(licitacaoChecklistItems.companyId, companyId);
    const data = await db.select().from(licitacaoChecklistItems).where(where).orderBy(desc(licitacaoChecklistItems.criadoEm));
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível consultar o checklist." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    if (!body.licitacaoId || !body.categoria || !body.requisito) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: licitacaoId, categoria e requisito." }, { status: 400 });
    }
    const [saved] = await db.insert(licitacaoChecklistItems).values({
      companyId,
      licitacaoId: Number(body.licitacaoId),
      categoria: String(body.categoria),
      requisito: String(body.requisito),
      status: body.status || "pendente",
      risco: body.risco || "medio",
      justificativaIa: body.justificativaIa || null,
      paginaClausula: body.paginaClausula || null,
      documentoRelacionado: body.documentoRelacionado || null,
      historico: [{ data: new Date().toISOString(), acao: "Item criado", por: session.nome }],
    }).returning();
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível salvar o checklist." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: "ID obrigatório." }, { status: 400 });
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    const [existing] = await db.select().from(licitacaoChecklistItems).where(and(eq(licitacaoChecklistItems.id, Number(body.id)), eq(licitacaoChecklistItems.companyId, companyId))).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "Item não encontrado." }, { status: 404 });
    const history = Array.isArray(existing.historico) ? existing.historico : [];
    const [saved] = await db.update(licitacaoChecklistItems).set({
      status: body.status ?? existing.status,
      risco: body.risco ?? existing.risco,
      justificativaIa: body.justificativaIa ?? existing.justificativaIa,
      paginaClausula: body.paginaClausula ?? existing.paginaClausula,
      documentoRelacionado: body.documentoRelacionado ?? existing.documentoRelacionado,
      historico: [...history, { data: new Date().toISOString(), acao: "Atualização de checklist", por: session.nome, status: body.status ?? existing.status, risco: body.risco ?? existing.risco }],
      atualizadoEm: new Date(),
    }).where(eq(licitacaoChecklistItems.id, existing.id)).returning();
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar o checklist." }, { status: 500 });
  }
}