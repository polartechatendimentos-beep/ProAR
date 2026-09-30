import { resolveTenantDb, tenantHeaders, type TenantDb } from "./tenant-rest";
import { databaseFetch, commitNeonOperationalState, PRIMARY_DATABASE_URL } from "./supabase-rest";
import { RouteError, routeDayKey, type RouteDay, type RouteActor } from "./work-routes";
import type { readSession } from "./proar-auth";

type Session = NonNullable<ReturnType<typeof readSession>>;
export async function routeContext(session: Session) {
  const company = session.companyId || process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
  const db = await resolveTenantDb(session.companyId);
  if (!db.url || !db.key) throw new RouteError("Banco da empresa indisponível.", 503);
  const id = db.dedicated ? "main" : company;
  const response = await routeRest(db, `proar_state?id=eq.${encodeURIComponent(id)}&select=payload&limit=1`);
  if (!response.ok) throw new RouteError("Falha ao consultar o cadastro da empresa.", 503);
  const rows = await response.json();
  const state = rows[0]?.payload;
  if (!state) throw new RouteError("Base operacional da empresa não encontrada.", 409);
  const employees = (state.moduleRecords?.Funcionários || []) as Array<{ id: string; name: string; employeeUsername?: string; status?: string }>;
  const employee = employees.find(item => item.employeeUsername?.trim().toLocaleLowerCase("pt-BR") === session.username.trim().toLocaleLowerCase("pt-BR") && item.status !== "Inativo");
  const actor: RouteActor | null = employee ? { employeeId: String(employee.id), employeeName: employee.name, username: session.username } : null;
  return { db, company, state, employees, actor };
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
  if (db.url === PRIMARY_DATABASE_URL) return Boolean(await commitNeonOperationalState(key, previous?._revision ?? null, payload, []));
  const path = previous ? `proar_state?id=eq.${encodeURIComponent(key)}&payload->>_revision=eq.${previous._revision}&select=payload` : "proar_state?on_conflict=id&select=payload";
  const response = await routeRest(db, path, { method: previous ? "PATCH" : "POST", headers: { Prefer: previous ? "return=representation" : "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(previous ? { payload, updated_at: new Date().toISOString() } : { id: key, payload, updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new RouteError("Falha ao gravar a jornada.", 503);
  return (await response.json()).length > 0;
}
