import { decryptTenantSecret } from "./tenant-crypto";
import { supabaseRest } from "./supabase-rest";

export type TenantDb = { url: string; key: string; dedicated: boolean; companyId?: string };
export async function resolveTenantDb(companyId?: string): Promise<TenantDb> {
  const masterUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const masterKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!companyId) return { url: masterUrl, key: masterKey, dedicated: false };
  try {
    const response = await supabaseRest(`proar_tenant_instances?select=api_url,encrypted_secret,provisioning_status&company_id=eq.${encodeURIComponent(companyId)}&limit=1`);
    const rows = response.ok ? await response.json() : [];
    const instance = rows[0];
    if (instance?.provisioning_status === "ready" && instance.api_url && instance.encrypted_secret) return { url: instance.api_url, key: decryptTenantSecret(instance.encrypted_secret), dedicated: true, companyId };
  } catch {}
  // Uma empresa/tenant NUNCA pode cair silenciosamente no banco mestre.
  // Enquanto o banco dedicado não estiver pronto, o acesso operacional fica indisponível.
  return { url: "", key: "", dedicated: true, companyId };
}
export function tenantHeaders(key: string) { return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }
