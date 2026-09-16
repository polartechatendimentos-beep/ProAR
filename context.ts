import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents, licitacoes } from "@/db/schema";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { readSession, type UserSession } from "@/lib/proar-auth";

export class ProcurementHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ProcurementHttpError";
  }
}

export async function procurementContext(request: Request, requestedCompanyId?: unknown, write = false) {
  const session = await readSession(request);
  if (!session) throw new ProcurementHttpError(401, "Não autorizado.");
  try {
    const companyId = write
      ? assertCompanyAccess(session, requestedCompanyId ? Number(requestedCompanyId) : null)
      : getEffectiveCompanyId(session, requestedCompanyId ? Number(requestedCompanyId) : null);
    return { session, companyId };
  } catch {
    throw new ProcurementHttpError(403, "Empresa não autorizada.");
  }
}

export async function requireLicitacao(companyId: number, licitacaoId: unknown) {
  const id = Number(licitacaoId);
  if (!Number.isInteger(id) || id <= 0) throw new ProcurementHttpError(400, "Licitação inválida.");
  const [licitacao] = await db.select().from(licitacoes).where(and(eq(licitacoes.id, id), eq(licitacoes.companyId, companyId))).limit(1);
  if (!licitacao) throw new ProcurementHttpError(404, "Licitação não encontrada para esta empresa.");
  return licitacao;
}

export async function recordProcurementAudit(input: {
  request: Request;
  session: UserSession;
  companyId: number;
  action: string;
  entity: string;
  entityId?: string | number | null;
  details?: unknown;
}) {
  const forwarded = input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = input.request.headers.get("x-real-ip")?.trim();
  const [event] = await db.insert(auditEvents).values({
    companyId: input.companyId,
    userId: Number.isInteger(input.session.id) ? input.session.id : null,
    acao: input.action,
    entidade: input.entity,
    entidadeId: input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
    detalhes: {
      actor: { id: input.session.id, name: input.session.nome, role: input.session.role },
      payload: input.details ?? null,
      recordedBy: "server",
    },
    ip: forwarded || realIp || null,
  }).returning();
  return event;
}

export function procurementErrorResponse(error: unknown) {
  if (error instanceof ProcurementHttpError) return { status: error.status, message: error.message };
  return { status: 500, message: error instanceof Error ? error.message : "Falha interna no módulo de Licitações." };
}
