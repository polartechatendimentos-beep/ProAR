import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacaoDocuments } from "@/db/schema";
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
      ? and(eq(licitacaoDocuments.companyId, companyId), eq(licitacaoDocuments.licitacaoId, licitacaoId))
      : eq(licitacaoDocuments.companyId, companyId);
    const data = await db.select().from(licitacaoDocuments).where(where).orderBy(desc(licitacaoDocuments.criadoEm));
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível consultar os documentos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    if (!body.tipo || !body.empresa || !body.cnpj) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: tipo, empresa e cnpj." }, { status: 400 });
    }
    const [saved] = await db.insert(licitacaoDocuments).values({
      companyId,
      licitacaoId: body.licitacaoId ? Number(body.licitacaoId) : null,
      tipo: String(body.tipo),
      empresa: String(body.empresa),
      cnpj: String(body.cnpj),
      emissao: body.emissao ? new Date(body.emissao) : null,
      validade: body.validade ? new Date(body.validade) : null,
      orgaoEmissor: body.orgaoEmissor || null,
      situacao: body.situacao || "valido",
      arquivoNome: body.arquivoNome || null,
      arquivoUrl: body.arquivoUrl || null,
      iaValidou: Boolean(body.iaValidou),
      ultimaUtilizacao: body.ultimaUtilizacao || null,
      metadadosIa: body.metadadosIa || {},
    }).returning();
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível salvar o documento." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: "ID do documento é obrigatório." }, { status: 400 });
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    const [existing] = await db.select().from(licitacaoDocuments)
      .where(and(eq(licitacaoDocuments.id, Number(body.id)), eq(licitacaoDocuments.companyId, companyId)))
      .limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "Documento não encontrado." }, { status: 404 });

    const oldMetadata = existing.metadadosIa && typeof existing.metadadosIa === "object" && !Array.isArray(existing.metadadosIa)
      ? existing.metadadosIa as Record<string, unknown>
      : {};
    const history = Array.isArray(oldMetadata.historicoRevisao) ? oldMetadata.historicoRevisao : [];
    const action = String(body.situacao || existing.situacao);
    if (!["aprovado", "revisar", "pendente_revisao"].includes(action)) {
      return NextResponse.json({ success: false, error: "Situação de revisão inválida." }, { status: 400 });
    }
    const nextMetadata = {
      ...oldMetadata,
      ...(body.metadadosIa && typeof body.metadadosIa === "object" ? body.metadadosIa : {}),
      historicoRevisao: [...history, {
        data: new Date().toISOString(),
        usuario: session.nome,
        situacao: action,
        observacao: typeof body.observacao === "string" ? body.observacao.slice(0, 1000) : null,
      }],
    };
    const [saved] = await db.update(licitacaoDocuments).set({
      situacao: action,
      metadadosIa: nextMetadata,
      atualizadoEm: new Date(),
    }).where(and(eq(licitacaoDocuments.id, existing.id), eq(licitacaoDocuments.companyId, companyId))).returning();
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível revisar o documento." }, { status: 500 });
  }
}
