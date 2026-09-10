import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacaoBidEvents, licitacaoBidSessions } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";

const ALLOWED_ACTIONS = new Set(["observado", "enviado_manual", "enviado_assistido", "pausa", "erro"]);
const ALLOWED_ORIGINS = new Set(["usuario", "agente", "importacao"]);

export async function GET(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const companyId = getEffectiveCompanyId(session, searchParams.get("company_id") ? Number(searchParams.get("company_id")) : null);
    const conditions = [eq(licitacaoBidEvents.companyId, companyId)];
    if (searchParams.get("licitacao_id")) conditions.push(eq(licitacaoBidEvents.licitacaoId, Number(searchParams.get("licitacao_id"))));
    if (searchParams.get("bid_session_id")) conditions.push(eq(licitacaoBidEvents.bidSessionId, Number(searchParams.get("bid_session_id"))));
    const data = await db.select().from(licitacaoBidEvents).where(and(...conditions)).orderBy(desc(licitacaoBidEvents.horaEvento)).limit(500);
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível consultar os eventos." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null);
    if (!body.licitacaoId || !body.acao) return NextResponse.json({ success: false, error: "Campos obrigatórios: licitacaoId e acao." }, { status: 400 });
    if (!ALLOWED_ACTIONS.has(body.acao)) return NextResponse.json({ success: false, error: "Ação de lance não permitida." }, { status: 400 });
    if (body.bidSessionId) {
      const [bidSession] = await db.select().from(licitacaoBidSessions).where(and(eq(licitacaoBidSessions.id, Number(body.bidSessionId)), eq(licitacaoBidSessions.companyId, companyId))).limit(1);
      if (!bidSession) return NextResponse.json({ success: false, error: "Sessão de disputa não encontrada." }, { status: 404 });
    }
    const [saved] = await db.insert(licitacaoBidEvents).values({
      companyId, licitacaoId: Number(body.licitacaoId), bidSessionId: body.bidSessionId ? Number(body.bidSessionId) : null,
      horaEvento: body.horaEvento ? new Date(body.horaEvento) : new Date(),
      melhorMercado: body.melhorMercado || null, nossoLance: body.nossoLance || null,
      posicao: body.posicao || null, acao: body.acao,
      origem: ALLOWED_ORIGINS.has(body.origem) ? body.origem : "usuario",
      mensagemPregoeiro: body.mensagemPregoeiro || null, metadados: body.metadados || {},
    }).returning();
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível registrar o evento." }, { status: 500 });
  }
}