import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSessionForUser, readSession } from "../../../lib/proar-auth";
import { supabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";
import { hashPassword, verifyPassword } from "../../../lib/password";
import { tenantSlugFromHost } from "../../../lib/tenant-host";
import { validateCompanyAccess } from "../../../lib/company-access";
const COOKIE_NAME = "proar_session";
const safeEqual = (left: string, right: string) => { const a=Buffer.from(left); const b=Buffer.from(right); return a.length===b.length && timingSafeEqual(a,b); };

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  if (user.companyId) {
    const access = await validateCompanyAccess(user.companyId);
    if (!access.ok) {
      const response = NextResponse.json({ authenticated: false, error: access.reason }, { status: 403 });
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
  const staticUser = resolvedTenant ? null : authenticate(String(username), String(password));
  if (staticUser) {
    const claims = { username: staticUser.username, displayName: staticUser.displayName, role: staticUser.role, permissions: staticUser.permissions };
    const response = NextResponse.json({ authenticated: true, ...claims }); response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 }); return response;
  }

  if (resolvedTenant && supabaseConfigured()) {
    const companyResponse = await supabaseRest(`proar_companies?select=id,slug,status,trade_name,trial_expires_at,modules&slug=eq.${encodeURIComponent(resolvedTenant)}&limit=1`);
    const companies = companyResponse.ok ? await companyResponse.json() : []; const company = companies[0];
    if (company) {
      const instanceResponse = await supabaseRest(`proar_tenant_instances?select=provisioning_status&company_id=eq.${encodeURIComponent(company.id)}&limit=1`);
      const instances = instanceResponse.ok ? await instanceResponse.json() : [];
      if (instances[0]?.provisioning_status !== "ready") return NextResponse.json({ error: "Seu ambiente exclusivo ainda está sendo preparado. Tente novamente em alguns instantes ou contate o suporte." }, { status: 503 });
      if (company.status !== "active") return NextResponse.json({ error: "Empresa suspensa ou bloqueada no ProAR Manager." }, { status: 403 });
      if (company.trial_expires_at && new Date(company.trial_expires_at).getTime() < Date.now()) return NextResponse.json({ error: "O período de teste desta empresa terminou." }, { status: 403 });
      const userResponse = await supabaseRest(`proar_trial_users?select=username,display_name,password_hash,role,permissions,active,must_change_password&company_id=eq.${encodeURIComponent(company.id)}&username=eq.${encodeURIComponent(String(username).toLowerCase())}&limit=1`);
      const rows = userResponse.ok ? await userResponse.json() : []; const user = rows[0];
      if (user?.active && verifyPassword(String(password), String(user.password_hash || ""))) {
        if (!String(user.password_hash || "").startsWith("scrypt$")) {
          void supabaseRest(`proar_trial_users?company_id=eq.${encodeURIComponent(company.id)}&username=eq.${encodeURIComponent(String(user.username))}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ password_hash: hashPassword(String(password)), updated_at: new Date().toISOString() }) });
        }
        const claims = { username: user.username, displayName: user.display_name, role: user.role, permissions: Array.isArray(company.modules) && company.modules.length ? company.modules : (Array.isArray(user.permissions) ? user.permissions : ["*"]), companyId: company.id, companySlug: company.slug, trialExpiresAt: company.trial_expires_at };
        const response = NextResponse.json({ authenticated: true, ...claims, mustChangePassword: user.must_change_password, company: { id: company.id, slug: company.slug, tradeName: company.trade_name, modules: company.modules } });
        response.cookies.set(COOKIE_NAME, createSessionForUser(claims), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 }); return response;
      }
    }
  }
  return NextResponse.json({ error: "Utilizador ou senha inválidos." }, { status: 401 });
}

export async function DELETE() { const response = NextResponse.json({ authenticated: false }); response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 }); return response; }
