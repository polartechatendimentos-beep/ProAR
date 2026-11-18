import { NextRequest, NextResponse } from "next/server";
import { hasPermission, sessionFromRequest } from "../../../../lib/permissions";
import { routeContext, routeRest } from "../../../../lib/work-route-store";
import { RouteError, workDate } from "../../../../lib/work-routes";

export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
type PunchType = "clock-in" | "break-start" | "break-end" | "clock-out";
type PunchEvent = { id: string; type: PunchType; at: string; recordedAt: string; offline: boolean; location?: { latitude: number; longitude: number; accuracy: number; capturedAt: string }; source: "mobile-ponto" };
type Correction = { id: string; type: PunchType; requestedAt: string; reason: string; status: "pending" | "approved" | "rejected"; requestedAtServer: string; employeeId: string; employeeName: string; reviewedAt?: string; reviewer?: string; reviewReason?: string };
type Day = { companyId: string; employeeId: string; employeeName: string; date: string; _revision: number; punches: PunchEvent[]; corrections: Correction[]; adjustments: Array<{ id: string; type: PunchType; at: string; correctionId: string; reason: string; approvedAt: string; approvedBy: string }> };
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value; }
function stateId(company: string, employee: string, date: string) { return "mobile-punch-v2:" + Buffer.from(company).toString("hex") + ":" + Buffer.from(employee).toString("hex") + ":" + date; }
async function loadDay(db: Awaited<ReturnType<typeof routeContext>>["db"], company: string, employee: string, date: string): Promise<Day | null> {
  const id = stateId(company, employee, date);
  const response = await routeRest(db, "proar_state?id=eq." + encodeURIComponent(id) + "&select=payload&limit=1");
  if (!response.ok) throw new RouteError("Não foi possível consultar o ponto.", 503);
  const rows = await response.json() as Array<{ payload?: Day }>;
  const day = rows[0]?.payload;
  if (!day) return null;
  if (day.companyId !== company || day.employeeId !== employee || day.date !== date || !Array.isArray(day.punches) || !Array.isArray(day.corrections)) throw new RouteError("Registro de ponto inválido.", 409);
  return day;
}
async function saveDay(db: Awaited<ReturnType<typeof routeContext>>["db"], next: Day, previous: Day | null) {
  const id = stateId(next.companyId, next.employeeId, next.date);
  const path = previous
    ? "proar_state?id=eq." + encodeURIComponent(id) + "&payload->>_revision=eq." + previous._revision + "&select=payload"
    : "proar_state?on_conflict=id&select=payload";
  const response = await routeRest(db, path, {
    method: previous ? "PATCH" : "POST",
    headers: { Prefer: previous ? "return=representation" : "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(previous ? { payload: next, updated_at: new Date().toISOString() } : { id, payload: next, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new RouteError("Não foi possível salvar o ponto.", 503);
  return (await response.json() as unknown[]).length > 0;
}
function emptyDay(company: string, employeeId: string, employeeName: string, date: string): Day {
  return { companyId: company, employeeId, employeeName, date, _revision: 0, punches: [], corrections: [], adjustments: [] };
}
function currentStatus(day: Day): "off" | "active" | "break" {
  const last = [...day.punches].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  if (!last || last.type === "clock-out") return "off";
  if (last.type === "break-start") return "break";
  return "active";
}
async function writeAccessAudit(db: Awaited<ReturnType<typeof routeContext>>["db"], company: string, viewer: string, employeeId: string, action: string) {
  const id = "mobile-punch-audit-v1:" + Buffer.from(company).toString("hex") + ":" + Date.now() + ":" + crypto.randomUUID();
  const response = await routeRest(db, "proar_state?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ id, updated_at: new Date().toISOString(), payload: { companyId: company, employeeId, viewer, action, at: new Date().toISOString() } }),
  });
  if (!response.ok) throw new RouteError("Não foi possível registrar a consulta de auditoria.", 503);
}
export async function GET(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return reply({ error: "Sessão inválida." }, 401);
  try {
    const c = await routeContext(session), manager = hasPermission(session, "rotas.visualizar");
    if (c.employee?.mobileAccessEnabled === false && !manager) return reply({ error: "Acesso ao App Mobile desativado para este funcionário." }, 403);
    const review = request.nextUrl.searchParams.get("review") === "1";
    if (review) {
      if (!manager) return reply({ error: "Sem permissão para revisar solicitações." }, 403);
      const prefix = "mobile-punch-v2:" + Buffer.from(c.company).toString("hex") + ":";
      const response = await routeRest(c.db, "proar_state?id=like." + encodeURIComponent(prefix + "*") + "&select=payload&limit=1001");
      if (!response.ok) throw new RouteError("Não foi possível carregar solicitações.", 503);
      const rows = await response.json() as Array<{ payload?: Day }>;
      const items = rows.map(row => row.payload).filter((day): day is Day => Boolean(day && day.companyId === c.company))
        .flatMap(day => day.corrections.filter(item => item.status === "pending").map(item => ({ ...item, date: day.date })));
      await writeAccessAudit(c.db, c.company, session.username, "*", "review-list");
      return reply({ requests: items.slice(0, 300), truncated: items.length > 300 });
    }
    const requested = request.nextUrl.searchParams.get("employeeId") || c.actor?.employeeId || "";
    const date = request.nextUrl.searchParams.get("date") || workDate(new Date().toISOString());
    if (!requested || !c.employees.some(e => String(e.id) === requested)) return reply({ error: "Funcionário não encontrado." }, 404);
    if (requested !== c.actor?.employeeId && !manager) return reply({ error: "Sem permissão para consultar marcações de terceiros." }, 403);
    if (!validDate(date) || date > workDate(new Date().toISOString()) || Date.parse(date + "T12:00:00Z") < Date.now() - 91 * 86400000) return reply({ error: "Selecione uma data dos últimos 90 dias." }, 400);
    if (requested !== c.actor?.employeeId) await writeAccessAudit(c.db, c.company, session.username, requested, "view-day");
    const day = await loadDay(c.db, c.company, requested, date);
    return reply({ day: day || emptyDay(c.company, requested, c.employees.find(e => String(e.id) === requested)?.name || "Funcionário", date), compliance: "operational-only", notice: "Registro operacional. Não substitui comprovante REP-P assinado." });
  } catch (error) { return reply({ error: error instanceof RouteError ? error.message : "Não foi possível consultar o ponto." }, error instanceof RouteError ? error.status : 503); }
}
export async function POST(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session) return reply({ error: "Sessão inválida." }, 401);
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return reply({ error: "Origem não autorizada." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 12000) return reply({ error: "Registro muito grande." }, 413);
  try {
    const body = await request.json() as Record<string, unknown>;
    const c = await routeContext(session), actor = c.actor;
    if (c.employee?.mobileAccessEnabled === false) return reply({ error: "Acesso ao App Mobile desativado para este funcionário." }, 403);
    const action = String(body.action || "");
    if (action === "review") {
      if (!hasPermission(session, "rotas.visualizar")) return reply({ error: "Sem permissão para revisar solicitações." }, 403);
      const employeeId = String(body.employeeId || ""), date = String(body.date || ""), requestId = String(body.requestId || ""), decision = String(body.decision || "");
      if (!c.employees.some(e => String(e.id) === employeeId) || !validDate(date) || !/^[A-Za-z0-9-]{8,100}$/.test(requestId) || !["approve", "reject"].includes(decision)) return reply({ error: "Solicitação inválida." }, 400);
      for (let attempt = 0; attempt < 4; attempt++) {
        const previous = await loadDay(c.db, c.company, employeeId, date);
        if (!previous) return reply({ error: "Dia não encontrado." }, 404);
        const correction = previous.corrections.find(item => item.id === requestId);
        if (!correction) return reply({ error: "Solicitação não encontrada." }, 404);
        if (correction.status !== "pending") return reply({ saved: true, day: previous, alreadyReviewed: true });
        const now = new Date().toISOString(), reason = String(body.reason || "").trim().slice(0, 500);
        const next: Day = { ...previous, _revision: previous._revision + 1, corrections: previous.corrections.map(item => item.id === requestId ? { ...item, status: decision === "approve" ? "approved" : "rejected", reviewedAt: now, reviewer: session.username, reviewReason: reason } : item), adjustments: decision === "approve" ? [...previous.adjustments, { id: "adj-" + requestId, type: correction.type, at: correction.requestedAt, correctionId: requestId, reason: correction.reason, approvedAt: now, approvedBy: session.username }] : previous.adjustments };
        if (await saveDay(c.db, next, previous)) return reply({ saved: true, day: next });
      }
      return reply({ error: "O ponto foi atualizado por outra pessoa. Atualize e tente novamente." }, 409);
    }
    if (!actor) return reply({ error: "Vincule este usuário a um funcionário ativo para registrar o ponto." }, 403);
    if (!["clock-in", "break-start", "break-end", "clock-out", "correction-request"].includes(action)) return reply({ error: "Ação de ponto inválida." }, 400);
    const date = String(body.date || ""), requestId = String(body.requestId || "");
    if (!validDate(date) || !/^[A-Za-z0-9-]{8,100}$/.test(requestId)) return reply({ error: "Data ou identificador da operação inválido." }, 400);
    if (date > workDate(new Date().toISOString())) return reply({ error: "A data não pode estar no futuro." }, 400);
    const offline = body.offline === true;
    const now = new Date().toISOString();
    const suppliedAt = String(body.at || now), parsedAt = Date.parse(suppliedAt);
    if (action !== "correction-request" && (Date.parse(date + "T12:00:00Z") < Date.now() - 3 * 86400000 || !Number.isFinite(parsedAt) || workDate(new Date(parsedAt).toISOString()) !== date || parsedAt > Date.now() + 5 * 60000 || parsedAt < Date.now() - 3 * 86400000)) return reply({ error: "Horário da marcação inválido." }, 400);
    if (action === "correction-request" && Date.parse(date + "T12:00:00Z") < Date.now() - 90 * 86400000) return reply({ error: "O pedido de correção está fora do período permitido." }, 400);
    let location: PunchEvent["location"];
    if (body.location && typeof body.location === "object") {
      const p = body.location as Record<string, unknown>, latitude = Number(p.latitude), longitude = Number(p.longitude), accuracy = Number(p.accuracy), capturedAt = String(p.capturedAt || "");
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1000 || !Number.isFinite(Date.parse(capturedAt)) || Math.abs(Date.now() - Date.parse(capturedAt)) > 5 * 60000) return reply({ error: "Localização inválida ou desatualizada." }, 422);
      location = { latitude, longitude, accuracy, capturedAt };
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const previous = await loadDay(c.db, c.company, actor.employeeId, date);
      const current = previous || emptyDay(c.company, actor.employeeId, actor.employeeName, date);
      if (action === "correction-request") {
        const type = String(body.correctionType || "") as PunchType, requestedAt = String(body.requestedAt || ""), reason = String(body.reason || "").trim();
        if (!["clock-in", "break-start", "break-end", "clock-out"].includes(type) || !Number.isFinite(Date.parse(requestedAt)) || workDate(new Date(requestedAt).toISOString()) !== date || reason.length < 8 || reason.length > 500) return reply({ error: "Informe o tipo, horário e motivo da correção." }, 400);
        if (current.corrections.some(item => item.id === requestId)) return reply({ saved: true, day: current, duplicate: true });
        const next = { ...current, _revision: current._revision + 1, corrections: [...current.corrections, { id: requestId, type, requestedAt, reason, status: "pending" as const, requestedAtServer: now, employeeId: actor.employeeId, employeeName: actor.employeeName }] };
        if (await saveDay(c.db, next, previous)) return reply({ saved: true, day: next });
        continue;
      }
      if (current.punches.some(item => item.id === requestId)) return reply({ saved: true, day: current, duplicate: true });
      const status = currentStatus(current);
      const allowed = action === "clock-in" ? status === "off" && current.punches.length === 0
        : action === "break-start" ? status === "active"
        : action === "break-end" ? status === "break"
        : action === "clock-out" ? status === "active" : false;
      if (!allowed) return reply({ error: "Esta marcação não corresponde ao estado atual do ponto. Atualize o painel." }, 409);
      const event: PunchEvent = { id: requestId, type: action as PunchType, at: offline ? suppliedAt : now, recordedAt: now, offline, source: "mobile-ponto", ...(location ? { location } : {}) };
      const next = { ...current, _revision: current._revision + 1, punches: [...current.punches, event] };
      if (await saveDay(c.db, next, previous)) return reply({ saved: true, day: next });
    }
    return reply({ error: "Outro dispositivo atualizou o ponto. Sincronize e tente novamente." }, 409);
  } catch (error) { return reply({ error: error instanceof RouteError ? error.message : "Não foi possível salvar o ponto." }, error instanceof RouteError ? error.status : 503); }
}
