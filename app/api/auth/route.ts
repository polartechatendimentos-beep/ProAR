import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSessionForUser, readSession } from "../../../lib/proar-auth";
import { supabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import { hashPassword, verifyPassword } from "../../../lib/password";
import { tenantSlugFromHost } from "../../../lib/tenant-host";
import { validateCompanyAccess, validateCompanyAccessBySlug } from "../../../lib/company-access";
import { validateManagerCredentials } from "../../../lib/manager-auth";
const COOKIE_NAME = "proar_session";
const PRIMARY_COMPANY_ID = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
const PRIMARY_COMPANY_SLUG = (process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech").trim().toLowerCase();
const safeEqual = (left: string, right: string) => { const a=Buffer.from(left); const b=Buffer.from(right); return a.length===b.length && timingSafeEqual(a,b); };

async function authenticateLegacyEmployee(username: string, password: string) {
  if (!supabaseConfigured()) return null;
  const normalized = username.trim().toLocaleLowerCase("pt-BR");
  const response = await supabaseRest("proar_state?select=id,payload");
  if (!response.ok) return null;
  const rows = await response.json() as { id: string; payload?: { moduleRecords?: Record<string, Array<Record<string, unknown>>> } }[];
  const primaryCompanyId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
  for (const row of rows) {
    const employees = row.payload?.moduleRecords?.["Funcionários"] ?? [];
    const employee = employees.find(item => item.status !== "Inativo" && String(item.employeeUsername ?? "").trim().toLocaleLowerCase("pt-BR") === normalized);
    if (!employee) continue;
    const storedHash = String(employee.employeePasswordHash ?? "");
    const suppliedHash = createHash("sha256").update(password).digest("hex");
    const passwordMatches = storedHash.startsWith("scrypt$")
      ? verifyPassword(password, storedHash)
      : safeEqual(suppliedHash, storedHash);
    if (!storedHash || !passwordMatches) continue;
    if (employee.restrictLoginToWorkHours === true) {
      const start = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(employee.workdayStart || "")) ? String(employee.workdayStart) : "07:00";
      const end = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(employee.workdayEnd || "")) ? String(employee.workdayEnd) : "18:00";
      const current = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
      const inside = start <= end ? current >= start && current <= end : current >= start || current <= end;
      if (!inside) return { denied: true as const, reason: `Login permitido somente no expediente configurado (${start}–${end}, horário de Brasília).` };
    }
    const permissionsMap = (employee.employeePermissions ?? {}) as Record<string, string[]>;
    const permissions = String(employee.employeeRole || "") === "Administrador" ? ["*"] : Object.entries(permissionsMap).flatMap(([module, actions]) => actions.includes("Visualizar") ? [module, ...actions.map(action => `${module}:${action}`)] : []);
    return { username: String(employee.employeeUsername || normalized), displayName: String(employee.name || normalized), role: String(employee.employeeRole || "Utilizador"), permissions, companyId: primaryCompanyId, legacy: true };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  if (user.companyId) {
    const access = user.companySlug
      ? await validateCompanyAccessBySlug(user.companySlug)
      : user.companyId === PRIMARY_COMPANY_ID
        ? await validateCompanyAccessBySlug(PRIMARY_COMPANY_SLUG)
        : await validateCompanyAccess(user.companyId);
    if (!access.ok) {
      const response = NextResponse.json({ authenticated: false, code: access.code, blocked:access.code==="SYSTEM_BLOCKED", error: access.reason }, { status: 403 });
      response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
      return response;
    }
  }
  return NextResponse.json({ authenticated: true, ...user });
}

export async function POST(request: NextRequest) {
  const { username = "", password = "", tenant = "" } = await request.json();
  const hostTenant = tenantSlugFromHost(request.headers.get("host"));
  const resolvedTenant = hostTenant || String(tenant || "").trim().toLowerCase();
  if (resolvedTenant && supabaseConfigured()) {
    const access = await validateCompanyAccessBySlug(resolvedTenant);
    if (!access.ok) {
      return NextResponse.json({ code:access.code, error:access.reason, blocked:access.code==="SYSTEM_BLOCKED" }, { status:403 });
    }
  }
  const isConfiguredTiago = String(username).trim().toLocaleLowerCase("pt-BR") === "tiago.viana" && Boolean(process.env.PROAR_POLARTECH_TIAGO_PASSWORD) && safeEqual(String(password), String(process.env.PROAR_POLARTECH_TIAGO_PASSWORD));
  if (validateManagerCredentials(String(username), String(password)) || isConfiguredTiago) {
    let companyId = PRIMARY_COMPANY_ID;
    let companySlug = resolvedTenant || PRIMARY_COMPANY_SLUG;
    if (resolvedTenant && resolvedTenant !== PRIMARY_COMPANY_SLUG && supabaseConfigured()) {
      const tenantResponse = await supabaseRest(`proar_companies?select=id,slug,status&slug=eq.${encodeURIComponent(resolvedTenant)}&limit=1`);
      const tenantRows = tenantResponse.ok ? await tenantResponse.json() : [];
      if (tenantRows[0]?.status === "active") { companyId = String(tenantRows[0].id); companySlug = String(tenantRows[0].slug || resolvedTenant); }
    }
    const claims = { username: String(username), displayName: "Tiago Viana", role: "Administrador", permissions: ["*"], companyId, companySlug };
    const response = NextResponse.json({ authenticated: true, ...claims });
    response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
    return response;
  }
  // Usuários administrativos/legados continuam válidos também no domínio oficial.
  // O tenant só é usado como fallback quando não houver usuário existente.
  const staticUser = authenticate(String(username), String(password));
  if (staticUser) {
    const claims = { username: staticUser.username, displayName: staticUser.displayName, role: staticUser.role, permissions: staticUser.permissions };
    const response = NextResponse.json({ authenticated: true, ...claims }); response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 }); return response;
  }

  const legacyEmployee = await authenticateLegacyEmployee(String(username), String(password));
  if (legacyEmployee) {
    if ("denied" in legacyEmployee) return NextResponse.json({ error: legacyEmployee.reason }, { status: 403 });
    const response = NextResponse.json({ authenticated: true, ...legacyEmployee }); response.cookies.set(COOKIE_NAME, createSessionForUser(legacyEmployee), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 }); return response;
  }

  if (resolvedTenant && supabaseConfigured()) {
    const companyResponse = await supabaseRest(`proar_companies?select=id,slug,status,trade_name,trial_expires_at,modules&slug=eq.${encodeURIComponent(resolvedTenant)}&limit=1`);
    const companies = companyResponse.ok ? await companyResponse.json() : []; const company = companies[0];
    if (company) {
      const instanceResponse = await supabaseRest(`proar_tenant_instances?select=provisioning_status&company_id=eq.${encodeURIComponent(company.id)}&limit=1`);
      const instances = instanceResponse.ok ? await instanceResponse.json() : [];
      if (instances[0]?.provisioning_status !== "ready") return NextResponse.json({ error: "Seu ambiente exclusivo ainda está sendo preparado. Tente novamente em alguns instantes ou contate o suporte." }, { status: 503 });
      if (company.status !== "active") return NextResponse.json({ code:"SYSTEM_BLOCKED", blocked:true, error:"Sistema bloqueado pelo ProAR Manager." }, { status: 403 });
      if (company.trial_expires_at && new Date(company.trial_expires_at).getTime() < Date.now()) return NextResponse.json({ code:"TRIAL_EXPIRED", error:"O período de teste desta empresa terminou." }, { status: 403 });
      const userResponse = await supabaseRest(`proar_trial_users?select=username,display_name,password_hash,role,permissions,active,must_change_password&company_id=eq.${encodeURIComponent(company.id)}&username=eq.${encodeURIComponent(String(username).toLowerCase())}&limit=1`);
      const rows = userResponse.ok ? await userResponse.json() : []; const user = rows[0];
      if (user?.active && verifyPassword(String(password), String(user.password_hash || ""))) {
        if (!String(user.password_hash || "").startsWith("scrypt$")) {
          void supabaseRest(`proar_trial_users?company_id=eq.${encodeURIComponent(company.id)}&username=eq.${encodeURIComponent(String(user.username))}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ password_hash: hashPassword(String(password)), updated_at: new Date().toISOString() }) });
        }
        const isTiagoAdministrator = String(user.username).toLowerCase() === "tiago.viana" && String(user.role) === "Administrador";
        const permissions = String(user.role) === "Administrador" || isTiagoAdministrator ? ["*"] : (Array.isArray(user.permissions) ? user.permissions : []);
        const claims = { username: user.username, displayName: user.display_name, role: user.role, permissions, companyId: company.id, companySlug: company.slug, trialExpiresAt: company.trial_expires_at };
        const response = NextResponse.json({ authenticated: true, ...claims, mustChangePassword: user.must_change_password, company: { id: company.id, slug: company.slug, tradeName: company.trade_name, modules: company.modules } });
        response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 }); return response;
      }
    }
  }
  return NextResponse.json({ error: "Utilizador ou senha inválidos." }, { status: 401 });
}

export async function DELETE() { const response = NextResponse.json({ authenticated: false }); response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 }); return response; }
