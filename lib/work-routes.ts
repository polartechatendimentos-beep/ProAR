import { createHash } from "node:crypto";
export type GpsPoint = { id: string; capturedAt: string; receivedAt: string; latitude: number; longitude: number; accuracy: number; reliable: boolean; osId?: string };
export type RouteStop = { id: string; osId: string; customer: string; address: string; arrivedAt: string; departedAt?: string; latitude: number; longitude: number; accuracy: number };
export type WorkRoute = { id: string; employeeId: string; employeeName: string; startedAt: string; endedAt?: string; status: "active" | "completed"; consentAt: string; consentVersion: "1"; expiresAt: string; distanceKm: number; points: GpsPoint[]; stops: RouteStop[]; events: { id: string; type: string; at: string; actor: string; fingerprint?: string }[]; closedReason?: string };
export type RouteDay = { companyId: string; employeeId: string; date: string; _revision: number; routes: WorkRoute[] };
export type RouteActor = { employeeId: string; employeeName: string; username: string };
export type RouteCommand = { action: "start" | "points" | "checkin" | "checkout" | "finish"; requestId: string; routeId?: string; consent?: boolean; points?: { id: string; capturedAt: string; latitude: number; longitude: number; accuracy: number }[]; osId?: string; reason?: string };
export class RouteError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
export function workDate(now: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now)); }
export function routeDayKey(company: string, employee: string, date: string) { return `${routeCompanyPrefix(company)}${date}:${Buffer.from(employee).toString("hex")}`; }
export function routeCompanyPrefix(company: string) { return `workroute-v1:${Buffer.from(company).toString("hex")}:`; }
export function routeDate(id: string) { const match = id.match(/^(\d{4}-\d{2}-\d{2}):[a-zA-Z0-9-]{8,80}$/); if (!match || !Number.isFinite(Date.parse(match[1] + "T00:00:00Z")) || new Date(match[1] + "T00:00:00Z").toISOString().slice(0, 10) !== match[1]) throw new RouteError("Identificador de rota inválido."); return match[1]; }
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) { const rad = (n: number) => n * Math.PI / 180; const dLat = rad(b.latitude - a.latitude); const dLng = rad(b.longitude - a.longitude); const value = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value))); }
export function validatePoint(input: NonNullable<RouteCommand["points"]>[number], now: string): GpsPoint {
  if (!input || !/^[a-zA-Z0-9-]{8,100}$/.test(input.id || "")) throw new RouteError("Identificador de ponto inválido.");
  const time = Date.parse(input.capturedAt);
  if (!Number.isFinite(time) || time > Date.parse(now) + 5 * 60000 || time < Date.parse(now) - 24 * 3600000) throw new RouteError("Horário do GPS fora da janela de 24 horas.");
  if (![input.latitude, input.longitude, input.accuracy].every(Number.isFinite) || Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180 || input.accuracy < 0 || input.accuracy > 50000) throw new RouteError("Coordenadas ou precisão inválidas.");
  return { ...input, capturedAt: new Date(time).toISOString(), receivedAt: now, reliable: input.accuracy <= 100 };
}
export function applyRouteCommand(day: RouteDay, command: RouteCommand, actor: RouteActor, now: string, order?: { id: string; client: string; address: string }): RouteDay {
  if (day.employeeId !== actor.employeeId) throw new RouteError("Rota de outro colaborador.", 403);
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(command.requestId || "")) throw new RouteError("Chave da operação inválida.");
  const fingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  const next = structuredClone(day);
  if (command.action === "start") {
    if (command.requestId.length > 80) throw new RouteError("Identificador de jornada muito longo.");
    if (command.consent !== true) throw new RouteError("Confirme o aviso de localização de trabalho.");
    const active = next.routes.find(route => route.status === "active");
    if (active) return day;
    const id = `${day.date}:${command.requestId}`;
    if (next.routes.some(route => route.id === id)) return day;
    if (day.date !== workDate(now)) throw new RouteError("Inicie a rota na data atual.");
    next.routes.push({ id, employeeId: actor.employeeId, employeeName: actor.employeeName, startedAt: now, status: "active", consentAt: now, consentVersion: "1", expiresAt: new Date(Date.parse(now) + 12 * 3600000).toISOString(), distanceKm: 0, points: [], stops: [], events: [{ id: command.requestId, type: "start", at: now, actor: actor.username, fingerprint }] });
  } else {
    const route = next.routes.find(item => item.id === command.routeId);
    if (!route) throw new RouteError("Rota não encontrada para este colaborador.", 404);
    const replay = route.events.find(event => event.id === command.requestId);
    if (replay) { if (replay.type !== command.action || (replay.fingerprint && replay.fingerprint !== fingerprint)) throw new RouteError("Chave já usada em outra operação.", 409); return day; }
    if (route.status !== "active") { if (command.action === "finish") return day; throw new RouteError("A coleta desta rota foi encerrada.", 409); }
    if (!["points", "checkin", "checkout", "finish"].includes(command.action)) throw new RouteError("Operação inválida.");
    if (!["finish", "points"].includes(command.action) && Date.parse(now) > Date.parse(route.expiresAt)) throw new RouteError("Jornada expirada. Encerre a rota e inicie uma nova.", 409);
    if (command.action === "points" || command.action === "checkin") {
      if (!command.points?.length || command.points.length > 50) throw new RouteError("Envie de 1 a 50 pontos GPS.");
      for (const input of command.points) {
        const point = validatePoint(input, now);
        if (Date.parse(point.capturedAt) < Date.parse(route.startedAt) - 60000 || Date.parse(point.capturedAt) > Date.parse(route.expiresAt)) throw new RouteError("Ponto fora da jornada.");
        const existing = route.points.find(item => item.id === point.id);
        if (existing) { if (existing.latitude !== point.latitude || existing.longitude !== point.longitude || existing.capturedAt !== point.capturedAt || existing.accuracy !== point.accuracy) throw new RouteError("Ponto já registrado com outro conteúdo.", 409); continue; }
        if (route.points.length >= 3000) throw new RouteError("Limite da jornada atingido. Encerre a rota.", 409);
        point.osId = route.stops.find(item => !item.departedAt)?.osId;
        route.points.push(point);
      }
      route.points.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id));
      let distance = 0;
      for (let i = 1; i < route.points.length; i += 1) {
        const a = route.points[i - 1], b = route.points[i];
        const seconds = (Date.parse(b.capturedAt) - Date.parse(a.capturedAt)) / 1000;
        const meters = distanceMeters(a, b);
        if (a.reliable && b.reliable && seconds > 0 && seconds <= 20 * 60 && meters / seconds <= 55 && meters > Math.max(10, Math.min(a.accuracy, b.accuracy))) distance += meters;
      }
      route.distanceKm = Math.round(distance) / 1000;
      if (command.action === "checkin") {
        if (!order || order.id !== command.osId) throw new RouteError("Selecione uma OS válida da empresa.");
        const active = route.stops.find(item => !item.departedAt);
        if (active) throw new RouteError("Registre a saída da OS anterior.", 409);
        const point = route.points.find(item => item.id === command.points![0].id)!;
        route.stops.push({ id: command.requestId, osId: order.id, customer: order.client, address: order.address, arrivedAt: now, latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy });
      }
    } else if (command.action === "checkout") {
      const stop = route.stops.find(item => !item.departedAt);
      if (!stop) throw new RouteError("Nenhum atendimento com check-in ativo.", 409);
      stop.departedAt = now;
    } else {
      route.status = "completed"; route.endedAt = now; route.closedReason = String(command.reason || "Encerrada pelo colaborador").slice(0, 160);
      for (const stop of route.stops) if (!stop.departedAt) stop.departedAt = now;
    }
    route.events.push({ id: command.requestId, type: command.action, at: now, actor: actor.username, fingerprint });
  }
  next._revision += 1;
  return next;
}
export function routeSummary(route: WorkRoute) { const { points, ...summary } = route; return { ...summary, pointCount: points.length, imprecisePoints: points.filter(point => !point.reliable).length, lastPoint: points.at(-1) || null, distanceNote: "Estimativa por amostras GPS; lacunas e pontos imprecisos não compõem a distância." }; }
