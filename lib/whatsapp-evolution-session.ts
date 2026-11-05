import { evolutionConnectionState, evolutionPairingQr, type EvolutionSettings } from "./whatsapp-evolution";

export function evolutionSettingsForCompany(companyId: string): EvolutionSettings {
  // This bootstrap is intentionally single-tenant. Multi-tenant provisioning requires
  // separate encrypted per-company credentials and isolated instances before enablement.
  const allowed = process.env.PROAR_EVOLUTION_COMPANY_ID;
  if (!allowed || companyId !== allowed) throw new Error("Evolution não habilitada para esta empresa");
  const baseUrl = process.env.PROAR_EVOLUTION_URL || "";
  const instance = process.env.PROAR_EVOLUTION_INSTANCE || "";
  const apiKey = process.env.PROAR_EVOLUTION_API_KEY || "";
  if (!baseUrl || !instance || !apiKey) throw new Error("Servidor Evolution não configurado");
  return { baseUrl, instance, apiKey };
}
export async function readEvolutionStatus(companyId: string) {
  const result = await evolutionConnectionState(evolutionSettingsForCompany(companyId));
  return { provider: "evolution", state: result };
}
export async function requestEvolutionQr(companyId: string) {
  const result = await evolutionPairingQr(evolutionSettingsForCompany(companyId));
  // Return only provider-generated pairing data, not arbitrary provider metadata.
  const data = result as { base64?: unknown; code?: unknown; pairingCode?: unknown; count?: unknown } | null;
  const base64 = typeof data?.base64 === "string" && data.base64.startsWith("data:image/png;base64,") && data.base64.length < 100000 ? data.base64 : null;
  const pairingCode = typeof data?.pairingCode === "string" ? data.pairingCode.slice(0, 100) : null;
  return { provider: "evolution", base64, pairingCode, connected: !base64 && !pairingCode };
}
