import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacoes } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { getEffectiveCompanyId } from "@/lib/company-access";
import { simulateBid } from "@/lib/procurement/domain";

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    const licitacaoId = Number(body.licitacaoId);
    if (!Number.isInteger(licitacaoId) || licitacaoId <= 0) return NextResponse.json({ success: false, error: "Licitação inválida." }, { status: 400 });
    const companyId = getEffectiveCompanyId(session, body.companyId ? Number(body.companyId) : null);
    const [licitacao] = await db.select().from(licitacoes).where(and(eq(licitacoes.id, licitacaoId), eq(licitacoes.companyId, companyId))).limit(1);
    if (!licitacao) return NextResponse.json({ success: false, error: "Licitação não encontrada nesta empresa." }, { status: 404 });
    const data = simulateBid({
      bestMarket: body.bestMarket,
      proposedBid: body.proposedBid,
      technicalFloor: licitacao.pisoTecnico,
      absoluteFloor: licitacao.pisoAbsoluto,
      minimumIncrement: body.minimumIncrement,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível simular o lance." }, { status: 500 });
  }
}
