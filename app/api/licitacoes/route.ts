import { NextResponse } from "next/server";
import { db } from "@/db";
import { licitacoes } from "@/db/schema";
import { and, desc, eq, like, or } from "drizzle-orm";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";

const PRICE_ROLES = new Set(["Administrador", "Gerência", "superadmin", "manager"]);

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
