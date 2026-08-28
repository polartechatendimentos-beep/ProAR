import { decryptTenantSecret } from "./tenant-crypto";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";

type StoredIntegration = { encrypted_api_key?: string; key_last4?: string; enabled?: boolean };
export type OpenAiCredential = { apiKey: string; source: "company" | "environment" };
export const safeCompanyId = (value: unknown) => String(value || process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "polartech-principal";
export const openAiIntegrationId = (companyId: string) => `secure-integration-${safeCompanyId(companyId)}-openai`;

export async function readStoredOpenAiIntegration(companyId: string): Promise<StoredIntegration | null> {
  const db = await resolveTenantDb(safeCompanyId(companyId));
  if (!db.url || !db.key) return null;
  const response = await fetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(openAiIntegrationId(companyId))}&select=payload`, { headers: tenantHeaders(db.key), cache: "no-store" });
  if (!response.ok) return null;
  const rows = await response.json() as { payload?: StoredIntegration }[];
  return rows[0]?.payload ?? null;
}

export async function getOpenAiCredential(companyId: string): Promise<OpenAiCredential | null> {
  const stored = await readStoredOpenAiIntegration(companyId);
  if (stored?.enabled && stored.encrypted_api_key) {
    try { return { apiKey: decryptTenantSecret(stored.encrypted_api_key), source: "company" }; } catch {}
  }
  const fallback = process.env.OPENAI_API_KEY?.trim();
  return fallback ? { apiKey: fallback, source: "environment" } : null;
}
