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

const fullSelect="id,slug,status,trade_name,trial_expires_at,plan_code,modules,access_block_source,suspended_reason";
const compatibleSelect="id,slug,status,trade_name,trial_expires_at,plan_code,modules";
const minimalSelect="id,slug,status,trade_name";

async function readCompany(queryForSelect:(select:string)=>string) {
  let lastError: unknown = null;

  for (const select of [fullSelect, compatibleSelect, minimalSelect]) {
    try {
      const response = await supabaseRest(queryForSelect(select));
      if (!response.ok) {
        lastError = new Error(`Manager respondeu HTTP ${response.status}`);
        continue;
      }
      const rows = await response.json().catch(() => null);
      if (!Array.isArray(rows)) {
        lastError = new Error("Resposta inválida do ProAR Manager.");
        continue;
      }
      return { rows, degraded: select !== fullSelect };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    console.error("COMPANY_ACCESS_QUERY_FAILED", {
      message:lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
  return null;
}

export async function validateCompanyAccess(companyId?: string | null): Promise<CompanyAccessResult> {
  if (!companyId) return { ok: true };
  if (!supabaseConfigured()) return { ok: false, code:"MANAGER_UNAVAILABLE", reason: "Banco mestre não configurado." };

  const result = await readCompany(select => `proar_companies?select=${select}&id=eq.${encodeURIComponent(companyId)}&limit=1`);
  if (!result) return { ok: false, code:"MANAGER_UNAVAILABLE", reason: "Não foi possível validar a empresa no ProAR Manager." };

  const company = result.rows[0] as Record<string,unknown> | undefined;
  if (!company) return { ok: false, code:"COMPANY_NOT_FOUND", reason: "Empresa não cadastrada no ProAR Manager." };
  return evaluateCompany(company);
}

export async function validateCompanyAccessBySlug(slug?: string | null): Promise<CompanyAccessResult> {
  const normalized=String(slug||"").trim().toLowerCase();
  if (!normalized) return { ok:true };
  if (!supabaseConfigured()) return { ok:false, code:"MANAGER_UNAVAILABLE", reason:"Banco mestre não configurado." };

  const result = await readCompany(select => `proar_companies?select=${select}&slug=eq.${encodeURIComponent(normalized)}&limit=1`);
  if (!result) return { ok:false, code:"MANAGER_UNAVAILABLE", reason:"Não foi possível validar a empresa no ProAR Manager." };

  const company=result.rows[0] as Record<string,unknown> | undefined;
  if (!company) return { ok:false, code:"COMPANY_NOT_FOUND", reason:"Empresa não cadastrada no ProAR Manager." };
  return evaluateCompany(company);
}
