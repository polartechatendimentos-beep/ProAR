import { supabaseConfigured, supabaseRest } from "./supabase-rest";

export type CompanyAccessResult = {
  ok: boolean;
  reason?: string;
  company?: Record<string, any>;
};

export async function validateCompanyAccess(companyId?: string | null): Promise<CompanyAccessResult> {
  if (!companyId) return { ok: true };
  if (!supabaseConfigured()) return { ok: false, reason: "Banco mestre não configurado." };
  const response = await supabaseRest(`proar_companies?select=id,slug,status,trade_name,trial_expires_at,plan_code,modules& id=eq.${encodeURIComponent(companyId)}&limit=1`.replace("& id", "&id"));
  if (!response.ok) return { ok: false, reason: "Não foi possível validar a empresa no ProAR Manager." };
  const rows = await response.json();
  const company = rows?.[0];
  if (!company) return { ok: false, reason: "Empresa não cadastrada no ProAR Manager." };
  if (company.status !== "active") return { ok: false, reason: "Empresa suspensa ou bloqueada no ProAR Manager.", company };
  if (company.trial_expires_at && new Date(company.trial_expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "O período de teste desta empresa terminou.", company };
  }
  return { ok: true, company };
}
