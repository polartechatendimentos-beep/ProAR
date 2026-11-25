import { NextResponse } from "next/server";
import { and, asc, eq, ilike, not } from "drizzle-orm";
import { db } from "@/db";
import { ordensServico } from "@/db/schema";
import { getEffectiveCompanyId } from "@/lib/company-access";
import { readSession } from "@/lib/proar-auth";

const openOrder = and(
  not(ilike(ordensServico.status, "%conclu%")),
  not(ilike(ordensServico.status, "%cancel%")),
);

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Sua sessão expirou. Entre novamente no ProAR." }, { status: 401 });

  try {
    const companyId = getEffectiveCompanyId(session);
    const cacheScope = `${companyId}:${session.id}`;
    const orders = await db.select({
      id: ordensServico.id,
      numeroTarefa: ordensServico.numeroTarefa,
      clienteNome: ordensServico.clienteNome,
      equipe: ordensServico.equipe,
      tipoTarefa: ordensServico.tipoTarefa,
      dataAgendamento: ordensServico.dataAgendamento,
      endereco: ordensServico.endereco,
      orientacao: ordensServico.orientacao,
      relatoExecucao: ordensServico.relatoExecucao,
      status: ordensServico.status,
      checkIn: ordensServico.checkIn,
      checklist: ordensServico.checklist,
    }).from(ordensServico)
      .where(and(eq(ordensServico.companyId, companyId), openOrder))
      .orderBy(asc(ordensServico.dataAgendamento))
      .limit(100);

    return NextResponse.json({ success: true, cacheScope, data: orders }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ success: false, error: "Não foi possível carregar as ordens agora." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Sua sessão expirou. Entre novamente no ProAR." }, { status: 401 });

  try {
    const body = await request.json() as {
      id?: number;
      action?: "checkin" | "complete";
      relatoExecucao?: string;
      checklist?: Record<string, boolean>;
    };
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ success: false, error: "Ordem de serviço inválida." }, { status: 400 });
    if (body.action !== "checkin" && body.action !== "complete") return NextResponse.json({ success: false, error: "Ação inválida." }, { status: 400 });

    const companyId = getEffectiveCompanyId(session);
    const [order] = await db.select().from(ordensServico)
      .where(and(eq(ordensServico.id, id), eq(ordensServico.companyId, companyId)))
      .limit(1);
    if (!order) return NextResponse.json({ success: false, error: "OS não encontrada." }, { status: 404 });

    if (/cancel/i.test(order.status)) return NextResponse.json({ success: false, error: "Esta OS foi cancelada e não pode receber alterações." }, { status: 409 });
    if (/conclu/i.test(order.status)) {
      if (body.action === "complete" && order.checkOut) {
        return NextResponse.json({ success: true, duplicate: true, data: { id: order.id, status: order.status, checkOut: order.checkOut, duracao: order.duracao } });
      }
      if (body.action === "checkin" && order.checkIn) {
        return NextResponse.json({ success: true, duplicate: true, data: { id: order.id, status: order.status, checkIn: order.checkIn } });
      }
      return NextResponse.json({ success: false, error: "OS já encerrada." }, { status: 409 });
    }

    const now = new Date();
    if (body.action === "checkin") {
      const [updated] = await db.update(ordensServico).set({
        checkIn: order.checkIn || now,
        status: "Em andamento",
      }).where(and(eq(ordensServico.id, id), eq(ordensServico.companyId, companyId), openOrder)).returning({ id: ordensServico.id, status: ordensServico.status, checkIn: ordensServico.checkIn });
      if (!updated) return NextResponse.json({ success: false, error: "A OS foi alterada por outra sessão. Atualize a lista." }, { status: 409 });
      return NextResponse.json({ success: true, data: updated });
    }

    const relatoExecucao = String(body.relatoExecucao || "").trim();
    const checklist = body.checklist;
    if (!order.checkIn) return NextResponse.json({ success: false, error: "Faça o check-in antes de concluir a OS." }, { status: 409 });
    if (relatoExecucao.length < 10) return NextResponse.json({ success: false, error: "Descreva o serviço realizado com pelo menos 10 caracteres." }, { status: 400 });
    if (!checklist || !["localConfirmado", "servicoExecutado", "testeFinalizado"].every((key) => checklist[key] === true)) {
      return NextResponse.json({ success: false, error: "Confirme as três etapas do checklist para concluir." }, { status: 400 });
    }

    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - order.checkIn.getTime()) / 1000));
    const duracao = [Math.floor(elapsedSeconds / 3600), Math.floor((elapsedSeconds % 3600) / 60), elapsedSeconds % 60]
      .map((part) => String(part).padStart(2, "0")).join(":");
    const savedChecklist = {
      ...(order.checklist && typeof order.checklist === "object" && !Array.isArray(order.checklist) ? order.checklist as Record<string, unknown> : {}),
      localConfirmado: true,
      servicoExecutado: true,
      testeFinalizado: true,
    };
    const [updated] = await db.update(ordensServico).set({
      checkOut: now,
      duracao,
      relatoExecucao,
      checklist: savedChecklist,
      status: "Concluído",
    }).where(and(eq(ordensServico.id, id), eq(ordensServico.companyId, companyId), openOrder)).returning({ id: ordensServico.id, status: ordensServico.status, checkOut: ordensServico.checkOut, duracao: ordensServico.duracao });

    if (!updated) return NextResponse.json({ success: false, error: "A OS foi alterada por outra sessão. Atualize a lista." }, { status: 409 });
    return NextResponse.json({ success: true, data: updated });
  } catch {
    return NextResponse.json({ success: false, error: "Não foi possível salvar esta etapa. Verifique a conexão e tente novamente." }, { status: 500 });
  }
}
