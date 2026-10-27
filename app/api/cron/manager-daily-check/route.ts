import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { hashPassword } from "../../../../lib/password";
import { runManagerBillingCycle, syncPlanEntitlements } from "../../../../lib/manager-billing";
import { ALL_MANAGER_MODULES } from "../../../../lib/manager-plans";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const auth = request.headers.get("authorization") || "";
  return Boolean(secret) && safeEqual(auth, `Bearer ${secret}`);
}
const digits = (value: string) => value.replace(/\D/g, "");

async function ensurePolartech() {
  const slug = "polartech";
  const bySlug = await supabaseRest(`proar_companies?select=*&slug=eq.${slug}&limit=1`);
  const existingRows = bySlug.ok ? await bySlug.json() : [];
  let company = existingRows?.[0];
  if (!company) {
    const id = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
    const cnpj = digits(process.env.PROAR_POLARTECH_CNPJ || "45823828000188");
    const record = {
      id,
      cnpj,
      legal_name: process.env.PROAR_POLARTECH_LEGAL_NAME || "PolarTech",
      trade_name: process.env.PROAR_POLARTECH_TRADE_NAME || "PolarTech",
      city: process.env.PROAR_POLARTECH_CITY || "Mirassol",
      state: (process.env.PROAR_POLARTECH_STATE || "SP").slice(0, 2),
      phone: process.env.PROAR_POLARTECH_PHONE || "",
      email: process.env.PROAR_POLARTECH_EMAIL || "",
      address: process.env.PROAR_POLARTECH_ADDRESS || "",
      slug,
      plan_code: "completo",
      modules: ALL_MANAGER_MODULES,
      status: "active",
      trial_started_at: null,
      trial_expires_at: null,
      updated_at: new Date().toISOString(),
    };
    const insert = await supabaseRest("proar_companies?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(record) });
    if (!insert.ok) throw new Error("Falha ao cadastrar PolarTech automaticamente no Manager.");
    const rows = await insert.json(); company = rows?.[0] || record;
  } else {
    const updatedAt = new Date().toISOString();
    const patch = { plan_code:"completo", modules:ALL_MANAGER_MODULES, updated_at:updatedAt };
    const update = await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(company.id)}`, { method:"PATCH", headers:{ Prefer:"return=representation" }, body:JSON.stringify(patch) });
    if (!update.ok) throw new Error("Falha ao sincronizar módulos completos da PolarTech.");
    const rows = await update.json();
    company = rows?.[0] || { ...company, ...patch };
  }
  await syncPlanEntitlements(String(company.id),"completo",ALL_MANAGER_MODULES,"system-cron");

  const username = "tiago.viana";
  const existingUserResponse = await supabaseRest(`proar_trial_users?select=username&company_id=eq.${encodeURIComponent(company.id)}&username=eq.${encodeURIComponent(username)}&limit=1`);
  const existingUsers = existingUserResponse.ok ? await existingUserResponse.json() : [];
  if (!existingUsers.length) {
    const password = process.env.PROAR_POLARTECH_TIAGO_PASSWORD?.trim();
    if (!password) throw new Error("PROAR_POLARTECH_TIAGO_PASSWORD é obrigatório para criar o administrador inicial.");
    const userRecord = {
      company_id: company.id,
      username,
      display_name: "Tiago Viana",
      password_hash: hashPassword(password),
      role: "Administrador",
      permissions: ["*"],
      active: true,
      must_change_password: true,
      updated_at: new Date().toISOString(),
    };
    const userInsert = await supabaseRest("proar_trial_users", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(userRecord) });
    if (!userInsert.ok) throw new Error("Falha ao criar o administrador inicial da PolarTech.");
  }
  return company;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Cron não autorizado." }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Banco mestre não configurado." }, { status: 503 });
  try {
    const polartech = await ensurePolartech();
    const response = await supabaseRest("proar_companies?select=id,slug,status,plan_code,trial_expires_at,access_block_source&order=created_at.asc");
    if (!response.ok) throw new Error("Falha ao consultar empresas.");
    const companies = await response.json();
    const now = new Date();
    let blocked = 0; let checked = 0;
    for (const company of companies) {
      checked += 1;
      const expiredTrial = company.plan_code === "trial" && company.trial_expires_at && new Date(company.trial_expires_at).getTime() < now.getTime();
      const patch: Record<string, unknown> = { last_manager_check_at: now.toISOString(), updated_at: now.toISOString() };
      if (expiredTrial && company.access_block_source !== "manual" && (company.status === "active" || company.access_block_source === "billing")) {
        patch.status = "blocked";
        patch.access_block_source = "trial";
        patch.access_blocked_at = now.toISOString();
        patch.suspended_reason = "Período de teste encerrado automaticamente pelo ProAR Manager.";
        blocked += 1;
      } else if (!expiredTrial && company.status !== "active" && company.access_block_source === "trial") {
        patch.status = "active";
        patch.access_block_source = null;
        patch.access_blocked_at = null;
        patch.suspended_reason = null;
      }
      await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(company.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    }
    const billing = await runManagerBillingCycle("system-cron");
    await supabaseRest("proar_manager_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ company_id: polartech.id, action: "DAILY_COMPANY_ACCESS_CHECK", actor: "system-cron", details: { checked, blocked, billing, at: now.toISOString() } }) });
    return NextResponse.json({ ok: true, checked, blocked, billing, polartech: polartech.id, checkedAt: now.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na verificação diária." }, { status: 500 });
  }
}
