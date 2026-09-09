import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacaoBidEvents } from "@/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const licitacaoId = searchParams.get("licitacao_id") ? Number(searchParams.get("licitacao_id")) : null;
    const bidSessionId = searchParams.get("bid_session_id") ? Number(searchParams.get("bid_session_id")) : null;
    const companyId = searchParams.get("company_id") ? Number(searchParams.get("company_id")) : 1;

    const conditions = [eq(licitacaoBidEvents.companyId, companyId)];
    if (licitacaoId) conditions.push(eq(licitacaoBidEvents.licitacaoId, licitacaoId));
    if (bidSessionId) conditions.push(eq(licitacaoBidEvents.bidSessionId, bidSessionId));

    const list = await db.select().from(licitacaoBidEvents).where(and(...conditions)).orderBy(desc(licitacaoBidEvents.horaEvento)).limit(500);
    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.licitacaoId || !body.acao) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: licitacaoId e acao." }, { status: 400 });
    }

    const [saved] = await db
      .insert(licitacaoBidEvents)
      .values({
        companyId: body.companyId ? Number(body.companyId) : 1,
        licitacaoId: Number(body.licitacaoId),
        bidSessionId: body.bidSessionId ? Number(body.bidSessionId) : null,
        horaEvento: body.horaEvento ? new Date(body.horaEvento) : new Date(),
        melhorMercado: body.melhorMercado || null,
        nossoLance: body.nossoLance || null,
        posicao: body.posicao || null,
        acao: body.acao,
        origem: body.origem || "agente",
        mensagemPregoeiro: body.mensagemPregoeiro || null,
        metadados: body.metadados || {},
      })
      .returning();

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
