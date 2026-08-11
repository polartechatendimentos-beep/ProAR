import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { resumeTenantProvisioning } from "../../../../lib/tenant-provisioning";
const COOKIE_NAME = "proar_session";
const adminUser = (request: NextRequest) => {
  const user = readSession(request.cookies.get(COOKIE_NAME)?.value);
  return user && (user.role === "Administrador" || user.permissions.includes("*")) ? user : null;
};

export async function GET(request: NextRequest) {
  if (!adminUser(request)) return NextResponse.json({ error: "Acesso restrito ao ProAR Manager." }, { status: 403 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Banco mestre não configurado." }, { status: 503 });
  const companies = await supabaseRest("proar_companies?select=*&order=created_at.desc");
  const instances = await supabaseRest("proar_tenant_instances?select=*&order=created_at.desc");
  if (!companies.ok) return NextResponse.json({ error: "Falha ao consultar empresas." }, { status: 502 });
  return NextResponse.json({ companies: await companies.json(), instances: instances.ok ? await instances.json() : [] });
}

export async function PATCH(request: NextRequest) {
  const user = adminUser(request); if (!user) return NextResponse.json({ error: "Acesso restrito ao ProAR Manager." }, { status: 403 });
  const body = await request.json(); const companyId = String(body.companyId || "").trim(); if (!companyId) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });
  if (body.retryProvisioning === true) {
    try { const result = await resumeTenantProvisioning(companyId); return NextResponse.json({ saved: true, provisioning: result }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao finalizar banco dedicado." }, { status: 502 }); }
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (["active","blocked"].includes(body.status)) patch.status = body.status;
  if (typeof body.planCode === "string") patch.plan_code = body.planCode.slice(0, 40);
  if (typeof body.extendTrialDays === "number" && body.extendTrialDays > 0) patch.trial_expires_at = new Date(Date.now() + Math.min(body.extendTrialDays, 365) * 86400000).toISOString();
  if (Array.isArray(body.modules)) patch.modules = body.modules;
  const response = await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(companyId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  if (!response.ok) return NextResponse.json({ error: "Falha ao atualizar empresa." }, { status: 502 });
  await supabaseRest("proar_manager_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ company_id: companyId, action: "MANAGER_UPDATE", actor: user.username, details: patch }) });
  return NextResponse.json({ saved: true });
}
