import { supabaseConfigured, supabaseRest } from "./supabase-rest";
import { financialAccessState } from "./manager-billing";

export type CompanyAccessResult = {
  ok: boolean;
  code?: "SYSTEM_BLOCKED" | "FINANCIAL_BLOCKED" | "MAINTENANCE_MODE" | "TRIAL_EXPIRED" | "COMPANY_NOT_FOUND" | "MANAGER_UNAVAILABLE";
  reason?: string;
  company?: Record<string, unknown>;
};



async function validateOperationalControl(company:Record<string,unknown>): Promise<CompanyAccessResult> {
  const response=await supabaseRest(`proar_manager_controls?select=maintenance_enabled,maintenance_message,feature_flags,support_access_enabled,support_access_until&company_id=eq.${encodeURIComponent(String(company.id||""))}&limit=1`);
  if (!response.ok) return { ok:true, company };
  const rows=await response.json(); const control=rows?.[0];
  if (control?.maintenance_enabled) return {
    ok:false,
    code:"MAINTENANCE_MODE",
    reason:String(control.maintenance_message||"Sistema em manutenção. Tente novamente mais tarde."),
    company:{...company,managerControl:control},
  };
  return { ok:true, company:{...company,managerControl:control||null} };
}

async function validateFinancialAccess(company:Record<string,unknown>): Promise<CompanyAccessResult> {
  if (String(company.plan_code||"trial")==="trial") return { ok:true, company };
  const response=await supabaseRest(`proar_manager_receivables?select=id,company_id,amount,due_date,status,paid_at&company_id=eq.${encodeURIComponent(String(company.id||""))}&status=eq.open&order=due_date.asc`);
  // Compatibilidade: se a estrutura financeira ainda não foi aplicada, o acesso não é bloqueado.
  if (!response.ok) return { ok:true, company };
  const rows=await response.json();
  const state=financialAccessState(company as any,rows as any,new Date());
  if (state.blocked) return {
    ok:false,
    code:"FINANCIAL_BLOCKED",
    reason:"Sistema bloqueado por pendência financeira. Entre em contato com a equipe da ProAR.",
    company:{...company,billing:state},
  };
  return validateOperationalControl({...company,billing:state});
}

export async function validateCompanyAccess(companyId?: string | null): Promise<CompanyAccessResult> {
  if (!companyId) return { ok: true };
  if (!supabaseConfigured()) return { ok: false, code:"MANAGER_UNAVAILABLE", reason: "Banco mestre não configurado." };
  const response = await supabaseRest(`proar_companies?select=id,slug,status,trade_name,trial_expires_at,plan_code,modules,billing_auto_block,billing_grace_days& id=eq.${encodeURIComponent(companyId)}&limit=1`.replace("& id", "&id"));
  if (!response.ok) return { ok: false, code:"MANAGER_UNAVAILABLE", reason: "Não foi possível validar a empresa no ProAR Manager." };
  const rows = await response.json();
  const company = rows?.[0];
  if (!company) return { ok: false, code:"COMPANY_NOT_FOUND", reason: "Empresa não cadastrada no ProAR Manager." };
  if (company.status !== "active") return { ok: false, code:"SYSTEM_BLOCKED", reason: "Sistema bloqueado. Entre em contato com a equipe da ProAR.", company };
  if (company.trial_expires_at && new Date(String(company.trial_expires_at)).getTime() < Date.now()) {
    return { ok: false, code:"TRIAL_EXPIRED", reason: "O período de teste desta empresa terminou.", company };
  }
  return validateFinancialAccess(company);
}

export async function validateCompanyAccessBySlug(slug?: string | null): Promise<CompanyAccessResult> {
  const normalized=String(slug||"").trim().toLowerCase();
  if (!normalized) return { ok:true };
  if (!supabaseConfigured()) return { ok:false, code:"MANAGER_UNAVAILABLE", reason:"Banco mestre não configurado." };
  const response=await supabaseRest(`proar_companies?select=id,slug,status,trade_name,trial_expires_at,plan_code,modules,billing_auto_block,billing_grace_days&slug=eq.${encodeURIComponent(normalized)}&limit=1`);
  if (!response.ok) return { ok:false, code:"MANAGER_UNAVAILABLE", reason:"Não foi possível validar a empresa no ProAR Manager." };
  const rows=await response.json(); const company=rows?.[0];
  if (!company) return { ok:false, code:"COMPANY_NOT_FOUND", reason:"Empresa não cadastrada no ProAR Manager." };
  if (company.status !== "active") return { ok:false, code:"SYSTEM_BLOCKED", reason:"Sistema bloqueado. Entre em contato com a equipe da ProAR.", company };
  if (company.trial_expires_at && new Date(String(company.trial_expires_at)).getTime() < Date.now()) return { ok:false, code:"TRIAL_EXPIRED", reason:"O período de teste desta empresa terminou.", company };
  return validateFinancialAccess(company);
}
