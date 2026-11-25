import { NextResponse } from "next/server";
import { and, count, eq, ilike, isNotNull, lt, gte, not } from "drizzle-orm";
import { db } from "@/db";
import { ordensServico, works } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { getEffectiveCompanyId } from "@/lib/company-access";

function saoPauloDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "0";
  const start = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")), 3));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: "Sua sessão expirou. Entre novamente no ProAR." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const companyId = getEffectiveCompanyId(session, url.searchParams.has("company_id") ? Number(url.searchParams.get("company_id")) : null);
    const now = new Date();
    const { start, end } = saoPauloDayRange(now);
    const notFinishedOrCancelled = and(
      not(ilike(ordensServico.status, "%conclu%")),
      not(ilike(ordensServico.status, "%cancel%")),
    );
    const openOrder = and(
      eq(ordensServico.companyId, companyId),
      isNotNull(ordensServico.dataAgendamento),
      notFinishedOrCancelled,
    );

    const [scheduledToday, overdue, activeWorks, worksAtBottleneck] = await Promise.all([
      db.select({ value: count() }).from(ordensServico).where(and(openOrder, gte(ordensServico.dataAgendamento, start), lt(ordensServico.dataAgendamento, end))),
      db.select({ value: count() }).from(ordensServico).where(and(
        eq(ordensServico.companyId, companyId),
        isNotNull(ordensServico.dataAgendamento),
        lt(ordensServico.dataAgendamento, now),
        notFinishedOrCancelled,
      )),
      db.select({ value: count() }).from(works).where(and(eq(works.companyId, companyId), not(ilike(works.status, "%conclu%")))),
      db.select({ value: count() }).from(works).where(and(eq(works.companyId, companyId), ilike(works.status, "AG.%"))),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        osCount: Number(scheduledToday[0]?.value || 0),
        osAtrasadasCount: Number(overdue[0]?.value || 0),
        obrasCount: Number(activeWorks[0]?.value || 0),
        obrasGargaloCount: Number(worksAtBottleneck[0]?.value || 0),
        // Orçamentos, contas e empenhos ainda não têm repositórios confiáveis para estes totais.
        orcamentosPendentesCount: null,
        contasVencendoCount: null,
        empenhosFaturarCount: null,
        atualizadoEm: now.toISOString(),
      },
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({
      success: false,
      error: "Não foi possível carregar os indicadores agora.",
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
