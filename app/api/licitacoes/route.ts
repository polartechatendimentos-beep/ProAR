import { NextResponse } from "next/server";
import { db } from "@/db";
import { licitacoes } from "@/db/schema";
import { and, desc, eq, like, or } from "drizzle-orm";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";

const PRICE_ROLES = new Set(["Administrador", "Gerência", "superadmin", "manager"]);
const APPROVAL_ROLES = new Set(["Administrador", "Gerência", "superadmin", "manager"]);

async function contextFor(request: Request, requestedCompanyId?: number | null) {
  const session = await readSession(request);
  if (!session) return { error: NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 }) };
  try {
    return { session, companyId: getEffectiveCompanyId(session, requestedCompanyId) };
  } catch {
    return { error: NextResponse.json({ success: false, error: "Empresa não autorizada." }, { status: 403 }) };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedCompany = searchParams.get("company_id");
    const context = await contextFor(request, requestedCompany ? Number(requestedCompany) : null);
    if ("error" in context) return context.error;
    const statusFilter = searchParams.get("status") || "em_andamento";
    const query = (searchParams.get("q") || "").trim();
    const uf = searchParams.get("uf");
    const conditions: any[] = [eq(licitacoes.companyId, context.companyId)];

    if (statusFilter !== "todas") conditions.push(eq(licitacoes.status, statusFilter));
    if (uf) conditions.push(eq(licitacoes.uf, uf));
    if (query) {
      conditions.push(or(
        like(licitacoes.titulo, `%${query}%`),
        like(licitacoes.orgao, `%${query}%`),
        like(licitacoes.descricao, `%${query}%`),
        like(licitacoes.numeroPregao, `%${query}%`),
        like(licitacoes.numeroProcesso, `%${query}%`)
      ));
    }

    const list = await db.select().from(licitacoes).where(and(...conditions)).orderBy(desc(licitacoes.criadoEm)).limit(200);
    const resumo = {
      total: list.length,
      emAndamento: list.filter((item) => item.status === "em_andamento").length,
      vencidas: list.filter((item) => item.status === "vencida").length,
      ganhas: list.filter((item) => item.status === "ganha").length,
      habilitacaoMedia: list.length ? Math.round(list.reduce((acc, item) => acc + (item.habilitacaoPercentual || 0), 0) / list.length) : 0,
    };
    return NextResponse.json({ success: true, count: list.length, resumo, data: list });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível consultar as licitações." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    if (!body.titulo || !body.orgao) return NextResponse.json({ success: false, error: "Campos obrigatórios: titulo e orgao." }, { status: 400 });
    const canManagePrice = PRICE_ROLES.has(session.role);
    const [saved] = await db.insert(licitacoes).values({
      companyId,
      numeroControlePncp: body.numeroControlePncp || null,
      numeroPregao: body.numeroPregao || null,
      numeroProcesso: body.numeroProcesso || null,
      titulo: String(body.titulo),
      descricao: body.descricao || null,
      orgao: String(body.orgao),
      plataforma: body.plataforma || null,
      uf: body.uf || "SP",
      modalidade: body.modalidade || "Pregão Eletrônico",
      tipoJulgamento: body.tipoJulgamento || "menor_preco_global",
      modoDisputa: body.modoDisputa || "aberto",
      valorEstimado: body.valorEstimado || null,
      dataAbertura: body.dataAbertura ? new Date(body.dataAbertura) : null,
      horaSessao: body.horaSessao || null,
      dataFimProposta: body.dataFimProposta ? new Date(body.dataFimProposta) : null,
      responsavelInterno: body.responsavelInterno || session.nome,
      pisoTecnico: canManagePrice ? body.pisoTecnico || null : null,
      pisoAbsoluto: canManagePrice ? body.pisoAbsoluto || null : null,
      margemMinima: canManagePrice ? body.margemMinima || null : null,
      habilitacaoPercentual: 0,
      checklistResumo: {},
      aiAnalise: {},
      prazosEdital: [],
      resultadoDetalhado: {},
      aprovacaoDossie: {},
      linkEdital: body.linkEdital || null,
      categoria: body.categoria || null,
      status: body.status || "em_andamento",
    }).returning();
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível cadastrar a licitação." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    if (!body.id) return NextResponse.json({ success: false, error: "ID da licitação é obrigatório." }, { status: 400 });
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    const [existing] = await db.select().from(licitacoes).where(and(eq(licitacoes.id, Number(body.id)), eq(licitacoes.companyId, companyId))).limit(1);
    if (!existing) return NextResponse.json({ success: false, error: "Licitação não encontrada." }, { status: 404 });

    const updates: Record<string, unknown> = { atualizadoEm: new Date() };
    for (const field of ["numeroControlePncp","numeroPregao","numeroProcesso","titulo","descricao","orgao","plataforma","uf","modalidade","tipoJulgamento","modoDisputa","valorEstimado","horaSessao","responsavelInterno","linkEdital","categoria","status","habilitacaoPercentual","checklistResumo","aiAnalise"]) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (body.prazosEdital !== undefined) {
      if (!Array.isArray(body.prazosEdital) || body.prazosEdital.length > 100) return NextResponse.json({ success: false, error: "Lista de prazos inválida." }, { status: 400 });
      if (body.prazosEdital.some((item: unknown) => !item || typeof item !== "object" || Array.isArray(item))) return NextResponse.json({ success: false, error: "Os prazos devem ser objetos válidos." }, { status: 400 });
      const prior = Array.isArray(existing.prazosEdital) ? existing.prazosEdital as Record<string, unknown>[] : [];
      updates.prazosEdital = body.prazosEdital.map((item: Record<string, unknown>) => {
        const old = prior.find(entry => entry.id === item.id);
        return { id: String(item.id || ""), tipo: String(item.tipo || "Outro").slice(0, 100), data: String(item.data || ""), responsavel: typeof item.responsavel === "string" ? item.responsavel.slice(0, 200) : "", criadoEm: old?.criadoEm || new Date().toISOString(), criadoPor: old?.criadoPor || session.nome };
      });
    }
    if (body.resultadoDetalhado !== undefined) {
      if (!Array.isArray(body.resultadoDetalhado) || body.resultadoDetalhado.length > 100) return NextResponse.json({ success: false, error: "Histórico de resultado inválido." }, { status: 400 });
      if (body.resultadoDetalhado.some((item: unknown) => !item || typeof item !== "object" || Array.isArray(item))) return NextResponse.json({ success: false, error: "Os eventos de resultado devem ser objetos válidos." }, { status: 400 });
      const prior = Array.isArray(existing.resultadoDetalhado) ? existing.resultadoDetalhado as Record<string, unknown>[] : [];
      updates.resultadoDetalhado = body.resultadoDetalhado.map((item: Record<string, unknown>) => {
        const old = prior.find(entry => entry.id === item.id);
        return { id: String(item.id || ""), etapa: String(item.etapa || "Sessão").slice(0, 100), descricao: String(item.descricao || "").slice(0, 3000), resultado: typeof item.resultado === "string" ? item.resultado.slice(0, 500) : "", valorFinal: typeof item.valorFinal === "string" ? item.valorFinal.slice(0, 100) : "", criadoEm: old?.criadoEm || new Date().toISOString(), criadoPor: old?.criadoPor || session.nome };
      });
    }
    if (body.aprovacaoDossie !== undefined) {
      if (!APPROVAL_ROLES.has(session.role)) return NextResponse.json({ success: false, error: "Apenas responsáveis autorizados podem aprovar o dossiê." }, { status: 403 });
      if (!body.aprovacaoDossie || typeof body.aprovacaoDossie !== "object" || Array.isArray(body.aprovacaoDossie)) {
        return NextResponse.json({ success: false, error: "Dados de aprovação inválidos." }, { status: 400 });
      }
      if (body.aprovacaoDossie.status !== "aprovado") return NextResponse.json({ success: false, error: "Situação de aprovação inválida." }, { status: 400 });
      const previousApproval = existing.aprovacaoDossie && typeof existing.aprovacaoDossie === "object" && !Array.isArray(existing.aprovacaoDossie)
        ? existing.aprovacaoDossie as Record<string, unknown>
        : {};
      const approvalHistory = Array.isArray(previousApproval.historico) ? previousApproval.historico : [];
      const approvalEvent = { status: String(body.aprovacaoDossie.status || "aprovado"), usuario: session.nome, data: new Date().toISOString(), observacao: String(body.aprovacaoDossie.observacao || "").slice(0, 1000) };
      updates.aprovacaoDossie = { ...body.aprovacaoDossie, status: approvalEvent.status, aprovadoPor: session.nome, aprovadoEm: approvalEvent.data, atualizadoEm: approvalEvent.data, historico: [...approvalHistory, approvalEvent] };
    }
    if (PRICE_ROLES.has(session.role)) {
      for (const field of ["pisoTecnico", "pisoAbsoluto", "margemMinima"]) if (body[field] !== undefined) updates[field] = body[field];
    }
    if (body.dataAbertura !== undefined) updates.dataAbertura = body.dataAbertura ? new Date(body.dataAbertura) : null;
    if (body.dataFimProposta !== undefined) updates.dataFimProposta = body.dataFimProposta ? new Date(body.dataFimProposta) : null;

    const [saved] = await db.update(licitacoes).set(updates).where(eq(licitacoes.id, existing.id)).returning();
    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar a licitação." }, { status: 500 });
  }
}
