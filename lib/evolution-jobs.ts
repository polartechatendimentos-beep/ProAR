import { createHash } from "node:crypto";
import { databaseFetch } from "./supabase-rest";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";
import { evolutionConnection } from "./evolution-tenant";
import { evolutionRequestWithConfig, sendEvolutionTextWithConfig } from "./proar-evolution";

export const evolutionJobPrefix = (companyId: string) => `whatsapp-send:${createHash("sha256").update(companyId).digest("hex")}:`;
export const evolutionJobId = (companyId: string, sourceId: string) => evolutionJobPrefix(companyId) + createHash("sha256").update(sourceId).digest("hex");
export async function dispatchEvolutionJob(companyId: string, sourceId: string, to: string, text: string) {
  const stored = await evolutionConnection(companyId);
  if (!stored) throw new Error("WhatsApp não configurado.");
  const state = await evolutionRequestWithConfig(stored.config, "instance/connectionState");
  if (state.instance?.state !== "open") return { status: "disconnected" };
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) throw new Error("Base da empresa indisponível.");
  const id = evolutionJobId(companyId, sourceId);
  const endpoint = `${db.url}/rest/v1/proar_state`;
  const createdAt = new Date().toISOString();
  const payload = { companyId, status: "processing", sourceId, recipient: `••••${to.replace(/\D/g, "").slice(-4)}`, createdAt,
    fingerprint: createHash("sha256").update(JSON.stringify({ to, text })).digest("hex") };
  const claim = await databaseFetch(`${endpoint}?on_conflict=id`, {
    method: "POST", headers: { ...tenantHeaders(db.key), Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ id, payload, updated_at: createdAt }),
  });
  if (!claim.ok) throw new Error("Não foi possível registrar o envio.");
  const claimed = await claim.json();
  if (!claimed.length) return { status: "duplicate" };
  let accepted: { messageId: string };
  try {
    accepted = await sendEvolutionTextWithConfig(stored.config, to, text);
  } catch {
    // A timeout can occur after provider acceptance. No blind retry is allowed.
    const uncertain = await databaseFetch(`${endpoint}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: tenantHeaders(db.key),
      body: JSON.stringify({ payload: { ...payload, status: "unknown", error: "Envio sem confirmação. Confira o WhatsApp antes de reenviar." }, updated_at: new Date().toISOString() }) });
    if (!uncertain.ok) throw new Error("Envio sem confirmação; registro pendente de conferência.");
    return { status: "unknown" };
  }
  const saved = await databaseFetch(`${endpoint}?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: tenantHeaders(db.key),
    body: JSON.stringify({ payload: { ...payload, status: "accepted", providerMessageId: accepted.messageId }, updated_at: new Date().toISOString() }) });
  if (!saved.ok) throw new Error("Mensagem aceita pelo servidor, mas o histórico precisa de conferência.");
  return { status: "accepted", messageId: accepted.messageId };
}

export async function evolutionSendHistory(companyId: string) {
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) throw new Error("Base da empresa indisponível.");
  const response = await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=like.${evolutionJobPrefix(companyId)}*&order=updated_at.desc&limit=30`, { headers: tenantHeaders(db.key), cache: "no-store" });
  if (!response.ok) throw new Error("Histórico de envio indisponível.");
  const rows = await response.json() as { payload: Record<string, unknown> }[];
  return rows.filter(row => row.payload?.companyId === companyId).map(({ payload }) => ({ status: payload.status, recipient: payload.recipient, createdAt: payload.createdAt, error: payload.error }));
}
