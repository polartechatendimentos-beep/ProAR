import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { hashPassword } from "../../../../lib/password";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
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
  const cnpj = digits(process.env.PROAR_POLARTECH_CNPJ || "45823828000188");
  const byCnpj = await supabaseRest(`proar_companies?select=*&cnpj=eq.${encodeURIComponent(cnpj)}&limit=1`);
  let company = byCnpj.ok ? (await byCnpj.json())?.[0] : null;
  if (!company) {
    const bySlug = await supabaseRest(`proar_companies?select=*&slug=eq.${slug}&limit=1`);
    company = bySlug.ok ? (await bySlug.json())?.[0] : null;
  }

  const now = new Date().toISOString();
  const id = company?.id || process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
  const record = {
    id,
    cnpj,
    legal_name: process.env.PROAR_POLARTECH_LEGAL_NAME || company?.legal_name || "PolarTech",
    trade_name: process.env.PROAR_POLARTECH_TRADE_NAME || company?.trade_name || "PolarTech",
    city: process.env.PROAR_POLARTECH_CITY || company?.city || "Mirassol",
    state: (process.env.PROAR_POLARTECH_STATE || company?.state || "SP").slice(0, 2),
    phone: process.env.PROAR_POLARTECH_PHONE || company?.phone || "",
    email: process.env.PROAR_POLARTECH_EMAIL || company?.email || "",
    address: process.env.PROAR_POLARTECH_ADDRESS || company?.address || "",
    slug,
    plan_code: "internal",
    status: "active",
    trial_started_at: null,
    trial_expires_at: null,
    updated_at: now,
  };
  const upsert = await supabaseRest("proar_companies?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(record) });
  if (!upsert.ok) throw new Error("Falha ao cadastrar ou atualizar a PolarTech no Manager.");
  const rows = await upsert.json();
  company = rows?.[0] || record;

  const username = "tiago.viana";
  const password = process.env.PROAR_POLARTECH_TIAGO_PASSWORD || "289936";
  const userRecord = {
    company_id: company.id,
    username,
    display_name: "Tiago Viana",
    password_hash: hashPassword(password),
    role: "Administrador",
    permissions: ["*"],
    active: true,
    must_change_password: false,
    updated_at: now,
  };
  const userUpsert = await supabaseRest("proar_trial_users?on_conflict=company_id,username", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(userRecord) });
  if (!userUpsert.ok) throw new Error("Falha ao atualizar o usuário Tiago.Viana.");
  return company;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Cron não autorizado." }, { status: 401 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Banco mestre não configurado." }, { status: 503 });
  try {
    const polartech = await ensurePolartech();
    const response = await supabaseRest("proar_companies?select=id,slug,status,plan_code,trial_expires_at&order=created_at.asc");
    if (!response.ok) throw new Error("Falha ao consultar empresas.");
    const companies = await response.json();
    const now = new Date();
    let blocked = 0;
    let checked = 0;
    for (const company of companies) {
      checked += 1;
      const expiredTrial = company.plan_code === "trial" && company.trial_expires_at && new Date(company.trial_expires_at).getTime() < now.getTime();
      const patch: Record<string, unknown> = { last_manager_check_at: now.toISOString(), updated_at: now.toISOString() };
      if (expiredTrial && company.status === "active") {
        patch.status = "blocked";
        patch.suspended_reason = "Período de teste encerrado automaticamente pelo ProAR Manager.";
        blocked += 1;
      }
      await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(company.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    }
    await supabaseRest("proar_manager_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ company_id: polartech.id, action: "DAILY_COMPANY_ACCESS_CHECK", actor: "system-cron", details: { checked, blocked, at: now.toISOString() } }) });
    return NextResponse.json({ ok: true, checked, blocked, polartech: polartech.id, checkedAt: now.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na verificação diária." }, { status: 500 });
  }
}
