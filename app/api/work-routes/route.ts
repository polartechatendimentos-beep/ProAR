import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { hasPermission } from "../../../lib/permissions";
import { routeContext, routeRest, loadRouteDay, commitRouteDay } from "../../../lib/work-route-store";
import { RouteError, applyRouteCommand, routeDate, workDate, routeCompanyPrefix, routeSummary, type RouteDay, type RouteCommand } from "../../../lib/work-routes";

export const runtime = "nodejs";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });
function errorReply(error: unknown) { return reply({ error: error instanceof RouteError ? error.message : "Não foi possível confirmar a operação de rota." }, error instanceof RouteError ? error.status : 503); }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T00:00:00Z")) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value; }
export async function GET(request: NextRequest) {
  const session = readSession(request.cookies.get("proar_session")?.value);
  if (!session) return reply({ error: "Sessão inválida." }, 401);
  try {
    const context = await routeContext(session);
    const manager = hasPermission(session, "rotas.visualizar");
    const requested = request.nextUrl.searchParams.get("employeeId") || context.actor?.employeeId || "";
    const team = request.nextUrl.searchParams.get("team") === "1";
    if ((team || requested !== context.actor?.employeeId) && !manager) throw new RouteError("Histórico restrito a gestores com permissão de rotas.", 403);
    if (!team && !context.employees.some(employee => String(employee.id) === requested)) throw new RouteError("Funcionário não encontrado na empresa.", 404);
    const now = new Date().toISOString(), today = workDate(now);
    const to = request.nextUrl.searchParams.get("to") || today;
    if (!validDate(to)) throw new RouteError("Data final inválida.");
    const from = request.nextUrl.searchParams.get("from") || new Date(Date.parse(to + "T12:00:00Z") - (team ? 0 : 30) * 86400000).toISOString().slice(0, 10);
    if (!validDate(from) || !validDate(to) || to < from || Date.parse(to) - Date.parse(from) > 90 * 86400000 || Date.parse(from) < Date.parse(today) - 90 * 86400000 || to > today) throw new RouteError("Selecione um período dentro dos últimos 90 dias.");
    const routeId = request.nextUrl.searchParams.get("routeId");
    let days: RouteDay[];
    if (routeId) {
      const date = routeDate(routeId);
      if (date < from || date > to) throw new RouteError("Rota fora do período consultado.");
      const day = await loadRouteDay(context.db, context.company, requested, date); days = day ? [day] : [];
    } else {
      const prefix = routeCompanyPrefix(context.company);
      const pattern = `${prefix}*${team ? "" : ":" + Buffer.from(requested).toString("hex")}`;
      const response = await routeRest(context.db, `proar_state?id=like.${encodeURIComponent(pattern)}&id=gte.${encodeURIComponent(prefix + from + ":")}&id=lte.${encodeURIComponent(prefix + to + ":~")}&select=payload&order=id.desc&limit=1001`);
      if (!response.ok) throw new RouteError("Falha ao consultar as rotas.", 503);
      days = (await response.json()).map((row: { payload: RouteDay }) => row.payload);
    }
    const truncated = days.length > 1000;
    days = days.slice(0, 1000).filter(day => day.companyId === context.company && day.date >= from && day.date <= to && (team || day.employeeId === requested));
    const routes = days.flatMap(day => day.routes).filter(route => !routeId || route.id === routeId).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const orders = context.actor ? (context.state.serviceOrders || []).filter((order: { tech?: string; employeeId?: string; techId?: string }) => order.employeeId === context.actor?.employeeId || order.techId === context.actor?.employeeId || [context.actor?.employeeName, session.displayName, session.username].some(name => name && order.tech?.trim().toLocaleLowerCase("pt-BR") === name.trim().toLocaleLowerCase("pt-BR"))).map((order: { id: string; client: string; unit: string; address: string; date: string; status: string }) => ({ id: order.id, client: order.client, unit: order.unit, address: order.address, date: order.date, status: order.status })) : [];
    return reply({ routes: routeId ? routes : routes.map(routeSummary), employee: context.actor, orders, manager, retentionDays: 90, truncated, serverTime: now });
  } catch (error) { return errorReply(error); }
}
export async function POST(request: NextRequest) {
  const session = readSession(request.cookies.get("proar_session")?.value);
  if (!session) return reply({ error: "Sessão inválida." }, 401);
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return reply({ error: "Origem não autorizada." }, 403);
  if (Number(request.headers.get("content-length") || 0) > 64000) return reply({ error: "Lote GPS muito grande." }, 413);
  try {
    const text = await request.text();
    if (text.length > 64000) return reply({ error: "Lote GPS muito grande." }, 413);
    let command: RouteCommand;
    try { command = JSON.parse(text); } catch { throw new RouteError("JSON inválido."); }
    if (!["start", "points", "checkin", "checkout", "finish"].includes(command.action)) throw new RouteError("Operação de rota inválida.");
    const context = await routeContext(session);
    if (!context.actor) throw new RouteError("Vincule este usuário a um funcionário ativo antes de iniciar rotas.", 403);
    const actor = context.actor, now = new Date().toISOString();
    const date = command.action === "start" ? workDate(now) : routeDate(command.routeId || "");
    if (Date.parse(date) < Date.parse(workDate(now)) - 2 * 86400000) throw new RouteError("Jornada antiga não aceita novas operações.", 409);
    if (command.action === "start") {
      const yesterday = new Date(Date.parse(date + "T12:00:00Z") - 86400000).toISOString().slice(0,10);
      const prior = await loadRouteDay(context.db, context.company, actor.employeeId, yesterday);
      if (prior?.routes.some(route => route.status === "active")) throw new RouteError("Encerre a jornada anterior antes de iniciar outra.", 409);
    }
    const order = command.osId ? (context.state.serviceOrders || []).find((item: { id: string; tech?: string; employeeId?: string; techId?: string }) => item.id === command.osId && (item.employeeId === actor.employeeId || item.techId === actor.employeeId || [actor.employeeName, session.displayName, actor.username].some(name => item.tech?.trim().toLocaleLowerCase("pt-BR") === name.trim().toLocaleLowerCase("pt-BR")))) : undefined;
    if (command.action === "checkin" && !order) throw new RouteError("OS não atribuída a este colaborador.", 403);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const current = await loadRouteDay(context.db, context.company, actor.employeeId, date);
      const day = current || { companyId: context.company, employeeId: actor.employeeId, date, _revision: 0, routes: [] };
      const updated = applyRouteCommand(day, command, actor, now, order);
      if (updated === day || await commitRouteDay(context.db, updated, current)) {
        const route = command.action === "start" ? updated.routes.find(item => item.status === "active") || updated.routes.find(item => item.id === `${date}:${command.requestId}`) : updated.routes.find(item => item.id === command.routeId);
        return reply({ saved: true, route: route ? routeSummary(route) : null, serverTime: now });
      }
    }
    return reply({ error: "Outro aparelho alterou esta jornada. Atualize e tente novamente." }, 409);
  } catch (error) { return errorReply(error); }
}
