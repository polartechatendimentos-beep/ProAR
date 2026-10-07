import { decryptTenantSecret } from "./tenant-crypto";
import { databaseProvider, masterDatabaseConfig, supabaseRest } from "./supabase-rest";

export type TenantDb = { url: string; key: string; dedicated: boolean; companyId?: string; provider?: string; projectName?: string; provisioningStatus?: string; source?: "registry"|"primary-fallback"|"master" };
export async function resolveTenantDb(companyId?: string): Promise<TenantDb> {
  const { url: masterUrl, key: masterKey } = masterDatabaseConfig();
  if (!companyId) return { url: masterUrl, key: masterKey, dedicated: false, source:"master" };

  const primaryCompanyId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";

  // Fonte de verdade: registro central da instância do tenant.
  try {
    const response = await supabaseRest(`proar_tenant_instances?select=company_id,provider,project_name,api_url,encrypted_secret,provisioning_status&company_id=eq.${encodeURIComponent(companyId)}&limit=1`);
    const rows = response.ok ? await response.json() : [];
    const instance = rows[0];
    if (instance?.provisioning_status === "ready") {
      // Instâncias dedicadas carregam sua própria credencial.
      if (instance.api_url && instance.encrypted_secret) {
        return {
          url: String(instance.api_url),
          key: decryptTenantSecret(String(instance.encrypted_secret)),
          dedicated: true,
          companyId,
          provider: String(instance.provider || "supabase"),
          projectName: String(instance.project_name || ""),
          provisioningStatus: "ready",
          source:"registry",
        };
      }
      // A empresa piloto pode registrar a base principal no Manager sem duplicar segredo.
      if (companyId === primaryCompanyId && masterUrl && masterKey) {
        return {
          url: masterUrl,
          key: masterKey,
          dedicated: false,
          companyId,
          provider: databaseProvider(),
          projectName: String(instance.project_name || "proar-polartech"),
          provisioningStatus: "ready",
          source:"registry",
        };
      }
    }
    // Se existe uma instância para outro tenant, mas ela ainda não está pronta,
    // não há fallback silencioso para a base mestre.
    if (instance && companyId !== primaryCompanyId) {
      return { url:"", key:"", dedicated:true, companyId, provider:String(instance.provider||""), projectName:String(instance.project_name||""), provisioningStatus:String(instance.provisioning_status||"pending"), source:"registry" };
    }
  } catch {}

  // Compatibilidade temporária do Tenant 1 enquanto o registro principal é consolidado no Manager.
  if (companyId === primaryCompanyId && masterUrl && masterKey) {
    return { url: masterUrl, key: masterKey, dedicated: false, companyId, provider:databaseProvider(), projectName:"proar-polartech", provisioningStatus:"legacy-ready", source:"primary-fallback" };
  }

  // Nenhum cliente alugado pode acessar silenciosamente a base da PolarTech.
  return { url: "", key: "", dedicated: true, companyId, provisioningStatus:"not-ready", source:"registry" };
}
export function tenantHeaders(key: string) { return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }
