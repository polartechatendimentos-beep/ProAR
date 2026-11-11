/** Optional unofficial WhatsApp Web adapter. Never use as an implicit fallback from Meta. */
export type EvolutionSettings = { baseUrl: string; instance: string; apiKey: string };
export function validateEvolutionSettings(input: EvolutionSettings): EvolutionSettings {
  const base = new URL(input.baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error("Evolution requer URL HTTPS sem credenciais na URL");
  if (!/^[a-zA-Z0-9_-]{3,80}$/.test(input.instance)) throw new Error("Instância inválida");
  if (!input.apiKey || input.apiKey.length < 20) throw new Error("Chave da Evolution ausente ou fraca");
  return { ...input, baseUrl: base.origin };
}
export async function evolutionRequest(settings: EvolutionSettings, path: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const config = validateEvolutionSettings(settings);
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Caminho inválido");
  const response = await fetch(config.baseUrl + path, {
    method, headers: { apikey: config.apiKey, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Evolution indisponível (HTTP ${response.status})`);
  return data;
}
export async function evolutionConnectionState(settings: EvolutionSettings) {
  return evolutionRequest(settings, `/instance/connectionState/${encodeURIComponent(settings.instance)}`);
}
export async function evolutionPairingQr(settings: EvolutionSettings) {
  // A live QR must originate from the persistent Evolution service, never from a QR generator.
  return evolutionRequest(settings, `/instance/connect/${encodeURIComponent(settings.instance)}`);
}
