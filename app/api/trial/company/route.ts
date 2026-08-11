import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

export async function GET(request: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Banco mestre não configurado." }, { status: 503 });
  const slug = String(request.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });
  const response = await supabaseRest(`proar_companies?select=id,legal_name,trade_name,cnpj,cpf,city,state,phone,email,address,logo_path,status,slug,plan_code,trial_started_at,trial_expires_at,brand_config,modules&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  const rows = response.ok ? await response.json() : [];
  if (!rows.length) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  const company = rows[0];
  const expired = company.trial_expires_at && new Date(company.trial_expires_at).getTime() < Date.now();
  return NextResponse.json({ company: { ...company, expired, daysRemaining: company.trial_expires_at ? Math.max(0, Math.ceil((new Date(company.trial_expires_at).getTime() - Date.now()) / 86400000)) : null } });
}
