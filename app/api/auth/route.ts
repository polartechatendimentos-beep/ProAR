import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSessionForUser, readSession } from "../../../lib/proar-auth";
import { supabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import { hashPassword, verifyPassword } from "../../../lib/password";
import { normalizeHost, tenantSlugFromHost } from "../../../lib/tenant-host";
import { INTERNAL_HOSTS, INTERNAL_QA_COMPANY_ID, INTERNAL_QA_COMPANY_SLUG } from "../../../lib/release-governance";
import { validateCompanyAccess, validateCompanyAccessBySlug } from "../../../lib/company-access";
import { validateManagerCredentials } from "../../../lib/manager-auth";
import { classifyProarError } from "../../../lib/system-errors";
import { ALL_MANAGER_MODULES } from "../../../lib/manager-plans";
import { managerPlan } from "../../../lib/manager-plans";
const COOKIE_NAME = "proar_session";
const PRIMARY_COMPANY_ID = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
const PRIMARY_COMPANY_SLUG = (process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech").trim().toLowerCase();
const isPrimaryTenant = (companyId?: string, companySlug?: string) => companyId === PRIMARY_COMPANY_ID || String(companySlug || "").trim().toLowerCase() === PRIMARY_COMPANY_SLUG;
const primaryTenantModules = () => [...ALL_MANAGER_MODULES];
const contractedModules = (companyId?: string, companySlug?: string, planCode?: unknown) => isPrimaryTenant(companyId,companySlug) ? primaryTenantModules() : [...managerPlan(planCode || "basico").modules];
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

  const host=normalizeHost(request.headers.get("host"));
  const internalHost=INTERNAL_HOSTS.has(host);
  if(internalHost){
    const claims={...user,companyId:INTERNAL_QA_COMPANY_ID,companySlug:INTERNAL_QA_COMPANY_SLUG,entitledModules:primaryTenantModules()};
    const response=NextResponse.json({authenticated:true,...claims,releaseEnvironment:host==="homologacao.proar.online"?"homologation":"internal"});
    if(user.companyId!==INTERNAL_QA_COMPANY_ID||user.companySlug!==INTERNAL_QA_COMPANY_SLUG||!Array.isArray(user.entitledModules)){
      response.cookies.set(COOKIE_NAME,createSessionForUser(claims),{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:60*60*12});
    }
    return response;
  }

  // Sessões antigas podem não ter companyId/companySlug, ou podem carregar uma lista
  // de módulos desatualizada. O domínio do tenant é a fonte adicional de identidade.
  const hostTenant = tenantSlugFromHost(request.headers.get("host"));
  const effectiveCompanySlug = String(user.companySlug || hostTenant || "").trim().toLowerCase() || undefined;
  const primaryTenant = isPrimaryTenant(user.companyId, effectiveCompanySlug);
  const effectiveCompanyId = primaryTenant ? PRIMARY_COMPANY_ID : user.companyId;
  let entitledModules = primaryTenant ? primaryTenantModules() : user.entitledModules;

  if (effectiveCompanyId) {
    const access = effectiveCompanySlug
      ? await validateCompanyAccessBySlug(effectiveCompanySlug)
      : effectiveCompanyId === PRIMARY_COMPANY_ID
        ? await validateCompanyAccessBySlug(PRIMARY_COMPANY_SLUG)
        : await validateCompanyAccess(effectiveCompanyId);
    if (!access.ok) {
      if (!(primaryTenant && access.code === "MANAGER_UNAVAILABLE")) {
        const status = access.code === "MANAGER_UNAVAILABLE" ? 503 : 403;
        const response = NextResponse.json({ authenticated: false, code: access.code, blocked:access.code==="SYSTEM_BLOCKED", error: access.reason }, { status });
        response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
        return response;
      }
      console.warn("AUTH_PRIMARY_MANAGER_UNAVAILABLE", { companyId:effectiveCompanyId, companySlug:effectiveCompanySlug });
    }
    if (access.company && !primaryTenant) entitledModules = contractedModules(effectiveCompanyId,effectiveCompanySlug,access.company.plan_code);
  }

  if (primaryTenant) entitledModules = primaryTenantModules();
  const claims = {
    ...user,
    companyId: effectiveCompanyId,
    companySlug: primaryTenant ? PRIMARY_COMPANY_SLUG : effectiveCompanySlug,
    entitledModules,
  };
  const response = NextResponse.json({ authenticated: true, ...claims });

  if (primaryTenant && (
    user.companyId !== PRIMARY_COMPANY_ID ||
    user.companySlug !== PRIMARY_COMPANY_SLUG ||
    !Array.isArray(user.entitledModules) ||
    user.entitledModules.length !== ALL_MANAGER_MODULES.length
  )) {
    response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  }
  return response;
}

async function handlePostAuth(request: NextRequest) {
  const { username = "", password = "", tenant = "" } = await request.json();
  const host=normalizeHost(request.headers.get("host"));
  const internalHost=INTERNAL_HOSTS.has(host);
  const hostTenant = tenantSlugFromHost(request.headers.get("host"));
  const resolvedTenant = internalHost ? "" : (hostTenant || String(tenant || "").trim().toLowerCase());
  if (resolvedTenant && supabaseConfigured()) {
    const access = await validateCompanyAccessBySlug(resolvedTenant);
    if (!access.ok) {
      const primaryTenant = resolvedTenant === PRIMARY_COMPANY_SLUG;
      if (!(primaryTenant && access.code === "MANAGER_UNAVAILABLE")) {
        return NextResponse.json(
          { code:access.code, error:access.reason, blocked:access.code==="SYSTEM_BLOCKED" },
          { status:access.code === "MANAGER_UNAVAILABLE" ? 503 : 403 },
        );
      }
      console.warn("AUTH_PRIMARY_MANAGER_UNAVAILABLE", { tenant:resolvedTenant });
    }
  }
  const isConfiguredTiago = String(username).trim().toLocaleLowerCase("pt-BR") === "tiago.viana" && Boolean(process.env.PROAR_POLARTECH_TIAGO_PASSWORD) && safeEqual(String(password), String(process.env.PROAR_POLARTECH_TIAGO_PASSWORD));
  if (validateManagerCredentials(String(username), String(password)) || isConfiguredTiago) {
    let companyId = internalHost ? INTERNAL_QA_COMPANY_ID : PRIMARY_COMPANY_ID;
    let companySlug = internalHost ? INTERNAL_QA_COMPANY_SLUG : (resolvedTenant || PRIMARY_COMPANY_SLUG);
    let entitledModules: string[] | undefined = internalHost ? primaryTenantModules() : (isPrimaryTenant(companyId, companySlug) ? primaryTenantModules() : undefined);
    if (!internalHost && resolvedTenant && resolvedTenant !== PRIMARY_COMPANY_SLUG && supabaseConfigured()) {
      const tenantResponse = await supabaseRest(`proar_companies?select=id,slug,status,plan_code&slug=eq.${encodeURIComponent(resolvedTenant)}&limit=1`);
      const tenantRows = tenantResponse.ok ? await tenantResponse.json() : [];
      if (tenantRows[0]?.status === "active") {
        companyId = String(tenantRows[0].id);
        companySlug = String(tenantRows[0].slug || resolvedTenant);
        entitledModules = contractedModules(companyId,companySlug,tenantRows[0].plan_code);
      }
    }
    const claims = { username: String(username), displayName: "Tiago Viana", role: "Administrador", permissions: ["*"], companyId, companySlug, entitledModules, ...(internalHost?{releaseEnvironment:host==="homologacao.proar.online"?"homologation":"internal"}:{}) };
    const response = NextResponse.json({ authenticated: true, ...claims });
    response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
    return response;
  }
  // Usuários administrativos/legados continuam válidos também no domínio oficial.
  // O tenant só é usado como fallback quando não houver usuário existente.
  const staticUser = authenticate(String(username), String(password));
  if (staticUser) {
    const primaryTenant = resolvedTenant === PRIMARY_COMPANY_SLUG;
    const claims = {
      username: staticUser.username,
      displayName: staticUser.displayName,
      role: staticUser.role,
      permissions: staticUser.permissions,
      ...(internalHost ? {
        companyId: INTERNAL_QA_COMPANY_ID,
        companySlug: INTERNAL_QA_COMPANY_SLUG,
        entitledModules: primaryTenantModules(),
        releaseEnvironment:host==="homologacao.proar.online"?"homologation":"internal",
      } : primaryTenant ? {
        companyId: PRIMARY_COMPANY_ID,
        companySlug: PRIMARY_COMPANY_SLUG,
        entitledModules: primaryTenantModules(),
      } : {}),
    };
    const response = NextResponse.json({ authenticated: true, ...claims });
    response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
    return response;
  }

  const legacyEmployee = internalHost ? null : await authenticateLegacyEmployee(String(username), String(password));
  if (legacyEmployee) {
    if ("denied" in legacyEmployee) return NextResponse.json({ error: legacyEmployee.reason }, { status: 403 });
    const response = NextResponse.json({ authenticated: true, ...legacyEmployee }); response.cookies.set(COOKIE_NAME, createSessionForUser(legacyEmployee), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 }); return response;
  }

  if (resolvedTenant && supabaseConfigured()) {
    const companyResponse = await supabaseRest(`proar_companies?select=id,slug,status,trade_name,trial_expires_at,plan_code&slug=eq.${encodeURIComponent(resolvedTenant)}&limit=1`);
    const companies = companyResponse.ok ? await companyResponse.json() : []; const company = companies[0];
    if (company) {
      const instanceResponse = await supabaseRest(`proar_tenant_instances?select=provisioning_status&company_id=eq.${encodeURIComponent(company.id)}&limit=1`);
      const instances = instanceResponse.ok ? await instanceResponse.json() : [];
      if (instances[0]?.provisioning_status !== "ready") return NextResponse.json({ error: "Seu ambiente exclusivo ainda está sendo preparado. Tente novamente em alguns instantes ou contate o suporte." }, { status: 503 });
      if (company.status !== "active") return NextResponse.json({ code:"SYSTEM_BLOCKED", blocked:true, error:"Sistema bloqueado. Entre em contato com a equipe da ProAR." }, { status: 403 });
      if (company.trial_expires_at && new Date(company.trial_expires_at).getTime() < Date.now()) return NextResponse.json({ code:"TRIAL_EXPIRED", error:"O período de teste desta empresa terminou." }, { status: 403 });
      const userResponse = await supabaseRest(`proar_trial_users?select=username,display_name,password_hash,role,permissions,active,must_change_password&company_id=eq.${encodeURIComponent(company.id)}&username=eq.${encodeURIComponent(String(username).toLowerCase())}&limit=1`);
      const rows = userResponse.ok ? await userResponse.json() : []; const user = rows[0];
      if (user?.active && verifyPassword(String(password), String(user.password_hash || ""))) {
        if (!String(user.password_hash || "").startsWith("scrypt$")) {
          void supabaseRest(`proar_trial_users?company_id=eq.${encodeURIComponent(company.id)}&username=eq.${encodeURIComponent(String(user.username))}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ password_hash: hashPassword(String(password)), updated_at: new Date().toISOString() }) });
        }
        const isTiagoAdministrator = String(user.username).toLowerCase() === "tiago.viana" && String(user.role) === "Administrador";
        const permissions = String(user.role) === "Administrador" || isTiagoAdministrator ? ["*"] : (Array.isArray(user.permissions) ? user.permissions : []);
        const entitledModules = contractedModules(String(company.id),String(company.slug),company.plan_code);
        const claims = { username: user.username, displayName: user.display_name, role: user.role, permissions, companyId: company.id, companySlug: company.slug, trialExpiresAt: company.trial_expires_at, entitledModules };
        const response = NextResponse.json({ authenticated: true, ...claims, mustChangePassword: user.must_change_password, company: { id: company.id, slug: company.slug, tradeName: company.trade_name, modules: entitledModules } });
        response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 }); return response;
      }
    }
  }
  return NextResponse.json({ error: "Utilizador ou senha inválidos." }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    return await handlePostAuth(request);
  } catch (error) {
    const descriptor=classifyProarError(error);
    console.error("AUTH_POST_FAILED", {
      name:error instanceof Error ? error.name : "Error",
      message:error instanceof Error ? error.message : String(error),
      code:descriptor.code,
    });
    return NextResponse.json(
      {
        authenticated:false,
        code:descriptor.code,
        error:descriptor.userMessage,
      },
      { status:500 },
    );
  }
}

export async function DELETE() { const response = NextResponse.json({ authenticated: false }); response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 }); return response; }
