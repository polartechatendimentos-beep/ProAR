import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { classifyProarError } from "../../../../lib/system-errors";
import { recordSystemIncident } from "../../../../lib/system-observability";

export async function GET(request: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "Banco mestre não configurado.", code:"PROAR-DB-001" }, { status: 503 });
  const slug = String(request.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });
  try {
    const response = await supabaseRest(`proar_companies?select=id,legal_name,trade_name,cnpj,cpf,city,state,phone,whatsapp,email,address,zip_code,state_registration,municipal_registration,company_type,tax_regime,logo_path,status,slug,plan_code,trial_started_at,trial_expires_at,brand_config,modules&slug=eq.${encodeURIComponent(slug)}&limit=1`);
    if (!response.ok) {
      const descriptor=classifyProarError(`Banco respondeu HTTP ${response.status}`,response.status);
      return NextResponse.json({ error: descriptor.userMessage, code:descriptor.code }, { status:503 });
    }
    const rows = await response.json();
    if (!rows.length) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    const company = rows[0];
    const expired = company.trial_expires_at && new Date(company.trial_expires_at).getTime() < Date.now();
    return NextResponse.json({ company: { ...company, expired, daysRemaining: company.trial_expires_at ? Math.max(0, Math.ceil((new Date(company.trial_expires_at).getTime() - Date.now()) / 86400000)) : null } });
  } catch (error) {
    const descriptor=classifyProarError(error);
    void recordSystemIncident({module:"Cadastro de empresa",operation:"Consultar empresa por slug",error,code:descriptor.code,route:"/api/trial/company",metadata:{slug}});
    return NextResponse.json({ error:descriptor.userMessage, code:descriptor.code }, { status:503 });
  }
}
