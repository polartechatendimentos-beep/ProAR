import { databaseFetch, supabaseRest } from "./supabase-rest";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";
import { encryptTenantSecret, decryptTenantSecret } from "./tenant-crypto";
import { requiredSecret } from "./security-env";
import { evolutionTenantIdentity } from "./evolution-identity";
import { evolutionConfig, EvolutionError, evolutionRequestWithConfig, type EvolutionConfig } from "./proar-evolution";

type StoredConnection = { companyId: string; instance: string; key: string; automationEnabled: boolean; updatedAt: string };
export function managedEvolutionAvailable() {
  return Boolean(process.env.PROAR_EVOLUTION_URL && process.env.PROAR_EVOLUTION_ADMIN_KEY);
}
function identity(companyId: string) {
  return evolutionTenantIdentity(companyId, requiredSecret("PROAR_TENANT_MASTER_KEY"));
}
function baseUrl() {
  const base = new URL(process.env.PROAR_EVOLUTION_URL || "");
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("URL do WhatsApp inválida.");
  return base;
}
export async function assertActiveWhatsAppCompany(companyId: string) {
  if (!companyId) throw new Error("Empresa não identificada.");
  const response = await supabaseRest(`proar_companies?select=id,status&id=eq.${encodeURIComponent(companyId)}&limit=1`);
  if (!response.ok) throw new Error("Não foi possível validar a empresa.");
  const rows = await response.json();
  if (rows[0]?.id !== companyId || rows[0]?.status !== "active") throw new Error("WhatsApp indisponível para esta empresa.");
}
export async function evolutionConnection(companyId: string): Promise<{ config: EvolutionConfig; automationEnabled: boolean; legacy?: boolean } | null> {
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) throw new Error("Base da empresa ainda não está pronta.");
  const response = await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${identity(companyId).recordId}&limit=1`, { headers: tenantHeaders(db.key), cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível consultar a conexão da empresa.");
  const rows = await response.json();
  const payload = rows[0]?.payload;
  if (!payload) {
    const legacy = evolutionConfig(companyId);
    return legacy ? { config: legacy, automationEnabled: false, legacy: true } : null;
  }
  if (payload.companyId !== companyId || typeof payload.encrypted !== "string") throw new Error("Conexão da empresa inválida.");
  const stored = JSON.parse(decryptTenantSecret(payload.encrypted)) as StoredConnection;
  const legacy = evolutionConfig(companyId);
  if (stored.companyId !== companyId || !stored.key ||
      ![identity(companyId).instance, legacy?.instance].includes(stored.instance)) throw new Error("Conexão da empresa inválida.");
  return { config: { base: baseUrl(), instance: stored.instance, key: stored.key }, automationEnabled: stored.automationEnabled === true };
}
async function persistConnection(companyId: string, config: EvolutionConfig, automationEnabled: boolean, insertOnly = false) {
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) throw new Error("Base da empresa ainda não está pronta.");
  const updatedAt = new Date().toISOString();
  const encrypted = encryptTenantSecret(JSON.stringify({ companyId, instance: config.instance, key: config.key, automationEnabled, updatedAt } satisfies StoredConnection));
  const response = await databaseFetch(`${db.url}/rest/v1/proar_state?on_conflict=id`, {
    method: "POST", headers: { ...tenantHeaders(db.key), Prefer: `resolution=${insertOnly ? "ignore" : "merge"}-duplicates,return=minimal` },
    body: JSON.stringify({ id: identity(companyId).recordId, payload: { companyId, encrypted, kind: "evolution-connection" }, updated_at: updatedAt }),
  });
  if (!response.ok) throw new Error("Não foi possível guardar a conexão da empresa.");
}
export async function ensureEvolutionConnection(companyId: string) {
  await assertActiveWhatsAppCompany(companyId);
  let stored = await evolutionConnection(companyId);
  if (stored?.legacy) {
    await persistConnection(companyId, stored.config, true, true);
    stored = await evolutionConnection(companyId);
  } else if (!stored) {
    if (!managedEvolutionAvailable()) throw new Error("Servidor de WhatsApp ainda não configurado.");
    const tenant = identity(companyId);
    await persistConnection(companyId, { base: baseUrl(), instance: tenant.instance, key: tenant.key }, true, true);
    stored = await evolutionConnection(companyId);
  }
  if (!stored) throw new Error("Não foi possível preparar a conexão.");
  try {
    await evolutionRequestWithConfig(stored.config, "instance/connectionState");
  } catch (error) {
    if (!(error instanceof EvolutionError) || error.status !== 404 || !managedEvolutionAvailable()) throw error;
    const adminKey = process.env.PROAR_EVOLUTION_ADMIN_KEY!;
    const created = await fetch(new URL("instance/create", baseUrl()), {
      method: "POST", headers: { apikey: adminKey, "Content-Type": "application/json" },
      body: JSON.stringify({ instanceName: stored.config.instance, token: stored.config.key, integration: "WHATSAPP-BAILEYS", qrcode: false }),
      redirect: "error", signal: AbortSignal.timeout(15000), cache: "no-store",
    });
    // Concurrent requests use the same deterministic identity and credential.
    // A conflict is accepted only after the instance-scoped credential works.
    if (!created.ok && ![403, 409].includes(created.status)) throw new EvolutionError(created.status);
    await evolutionRequestWithConfig(stored.config, "instance/connectionState");
  }
  return stored;
}
export async function setEvolutionAutomation(companyId: string, enabled: boolean) {
  await assertActiveWhatsAppCompany(companyId);
  const stored = await evolutionConnection(companyId);
  if (!stored) throw new Error("Conecte o WhatsApp antes de configurar os envios.");
  if (enabled) {
    const state = await evolutionRequestWithConfig(stored.config, "instance/connectionState");
    if (state.instance?.state !== "open") throw new Error("Conecte o WhatsApp antes de ativar os envios.");
  }
  await persistConnection(companyId, stored.config, enabled);
}
export async function tenantEvolutionAutomationEnabled(companyId: string) {
  if (process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED !== "true") return false;
  const stored = await evolutionConnection(companyId);
  return stored?.automationEnabled === true;
}
