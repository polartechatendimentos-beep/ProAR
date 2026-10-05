import { supabaseConfigured, supabaseRest } from "./supabase-rest";

export type CompanyAccessResult = {
  ok: boolean;
  code?: "SYSTEM_BLOCKED" | "TRIAL_EXPIRED" | "COMPANY_NOT_FOUND" | "MANAGER_UNAVAILABLE";
  reason?: string;
  company?: Record<string, unknown>;
};

function evaluateCompany(company:Record<string,unknown>):CompanyAccessResult {
  if (company.trial_expires_at && String(company.plan_code||"trial")==="trial" && new Date(String(company.trial_expires_at)).getTime() < Date.now()) {
    return { ok:false, code:"TRIAL_EXPIRED", reason:"O período de teste desta empresa terminou. Entre em contato com a equipe da ProAR para converter ou prorrogar o acesso.", company };
  }
  if (company.status !== "active") {
    const source=String(company.access_block_source||"");
    if (source==="billing") {
      return { ok:false, code:"SYSTEM_BLOCKED", reason:"Sistema bloqueado por mensalidade em atraso. Após a confirmação do pagamento, o acesso será liberado automaticamente.", company };
    }
    return { ok:false, code:"SYSTEM_BLOCKED", reason:String(company.suspended_reason || "Sistema bloqueado. Entre em contato com a equipe da ProAR."), company };
  }
  return { ok:true, company };
}

const select="id,slug,status,trade_name,trial_expires_at,plan_code,modules,access_block_source,suspended_reason";

export async function validateCompanyAccess(companyId?: string | null): Promise<CompanyAccessResult> {
  if (!companyId) return { ok: true };
  if (!supabaseConfigured()) return { ok: false, code:"MANAGER_UNAVAILABLE", reason: "Banco mestre não configurado." };
  const response = await supabaseRest(`proar_companies?select=${select}&id=eq.${encodeURIComponent(companyId)}&limit=1`);
  if (!response.ok) return { ok: false, code:"MANAGER_UNAVAILABLE", reason: "Não foi possível validar a empresa no ProAR Manager." };
  const rows = await response.json();
  const company = rows?.[0];
  if (!company) return { ok: false, code:"COMPANY_NOT_FOUND", reason: "Empresa não cadastrada no ProAR Manager." };
  return evaluateCompany(company);
}

export async function validateCompanyAccessBySlug(slug?: string | null): Promise<CompanyAccessResult> {
  const normalized=String(slug||"").trim().toLowerCase();
  if (!normalized) return { ok:true };
  if (!supabaseConfigured()) return { ok:false, code:"MANAGER_UNAVAILABLE", reason:"Banco mestre não configurado." };
  const response=await supabaseRest(`proar_companies?select=${select}&slug=eq.${encodeURIComponent(normalized)}&limit=1`);
  if (!response.ok) return { ok:false, code:"MANAGER_UNAVAILABLE", reason:"Não foi possível validar a empresa no ProAR Manager." };
  const rows=await response.json();
  const company=rows?.[0];
  if (!company) return { ok:false, code:"COMPANY_NOT_FOUND", reason:"Empresa não cadastrada no ProAR Manager." };
  return evaluateCompany(company);
}
