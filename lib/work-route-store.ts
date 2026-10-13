import { resolveTenantDb, tenantHeaders, type TenantDb } from "./tenant-rest";
import { databaseFetch, commitNeonOperationalState, PRIMARY_DATABASE_URL } from "./supabase-rest";
import { RouteError, routeDayKey, type RouteDay, type RouteActor } from "./work-routes";
import type { readSession } from "./proar-auth";

type Session = NonNullable<ReturnType<typeof readSession>>;
export async function routeContext(session: Session) {
  const company = String(session.companySlug || "").toLowerCase() === String(process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech").toLowerCase() ? process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal" : session.companyId;
  if (!company) throw new RouteError("Sessão sem empresa válida.", 401);
  const db = await resolveTenantDb(company);
  if (!db.url || !db.key) throw new RouteError("Banco da empresa indisponível.", 503);
  const id = db.dedicated ? "main" : company;
  const response = await routeRest(db, `proar_state?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`);
  if (!response.ok) throw new RouteError("Falha ao consultar o cadastro da empresa.", 503);
  const rows = await response.json();
  const state = rows[0]?.payload;
  if (!state) throw new RouteError("Base operacional da empresa não encontrada.", 409);
  if (state._companyId && state._companyId !== company) throw new RouteError("Base operacional de outra empresa.",403);
  const employees = (state.moduleRecords?.Funcionários || []) as Array<{ id: string; name: string; employeeUsername?: string; status?: string; mobileAccessEnabled?: boolean; requireGpsForOs?: boolean }>;
  const employee = employees.find(item => item.employeeUsername?.trim().toLocaleLowerCase("pt-BR") === session.username.trim().toLocaleLowerCase("pt-BR") && item.status !== "Inativo");
  const actor: RouteActor | null = employee ? { employeeId: String(employee.id), employeeName: employee.name, username: session.username } : null;
  return { db, company, state, employees, employee, actor };
}
export function routeRest(db: TenantDb, path: string, init: RequestInit = {}) { return databaseFetch(`${db.url}/rest/v1/${path}`, { ...init, headers: { ...tenantHeaders(db.key), ...init.headers }, cache: "no-store" }); }
export async function loadRouteDay(db: TenantDb, company: string, employee: string, date: string) {
  const key = routeDayKey(company, employee, date);
  const response = await routeRest(db, `proar_state?id=eq.${encodeURIComponent(key)}&select=payload&limit=1`);
  if (!response.ok) throw new RouteError("Falha ao carregar a jornada.", 503);
  const rows = await response.json();
  const day = (rows[0]?.payload || null) as RouteDay | null;
  if (day && (day.companyId !== company || day.employeeId !== employee || day.date !== date)) throw new RouteError("Identidade da jornada inválida.", 409);
  return day;
}
export async function commitRouteDay(db: TenantDb, next: RouteDay, previous: RouteDay | null) {
  const key = routeDayKey(next.companyId, next.employeeId, next.date);
  const payload = { ...next };
  if (db.url === PRIMARY_DATABASE_URL) return Boolean(await commitNeonOperationalState(key, previous?._revision ?? null, payload, operationalPunchRows(next)));
  const path = previous ? `proar_state?id=eq.${encodeURIComponent(key)}&payload->>_revision=eq.${previous._revision}&select=payload` : "proar_state?on_conflict=id&select=payload";
  const response = await routeRest(db, path, { method: previous ? "PATCH" : "POST", headers: { Prefer: previous ? "return=representation" : "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(previous ? { payload, updated_at: new Date().toISOString() } : { id: key, payload, updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new RouteError("Falha ao gravar a jornada.", 503);
  const saved=(await response.json()).length > 0;
  if(saved)await archiveOperationalPunches(db,next);
  return saved;
}

function operationalPunchRows(day:RouteDay) {
  return day.routes.flatMap(route=>route.events.filter(event=>["start","pause","resume","finish"].includes(event.type)).map(event=>({
    id:`work-punch-v1:${Buffer.from(day.companyId).toString("hex")}:${Buffer.from(day.employeeId).toString("hex")}:${day.date}:${event.id}`,
    payload:{companyId:day.companyId,employeeId:day.employeeId,employeeName:route.employeeName,date:day.date,routeId:route.id,eventId:event.id,type:event.type,at:event.at,actor:event.actor,fingerprint:event.fingerprint,selfieEvidence:event.selfieEvidence,source:"operational-journey",compliance:"not-rep-p"},
  })));
}
export async function archiveOperationalPunches(db:TenantDb,day:RouteDay) {
  const rows=operationalPunchRows(day);if(!rows.length)return;
  const response=await routeRest(db,"proar_state?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(rows.map(row=>({...row,updated_at:new Date().toISOString()})))});
  if(!response.ok)throw new RouteError("Marcação registrada; comprovante operacional aguardando confirmação. Tente novamente com a mesma operação.",503);
}

