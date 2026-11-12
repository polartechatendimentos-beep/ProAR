export type EvolutionConfig = { base: URL; key: string; instance: string };
export class EvolutionError extends Error {
  status: number;
  constructor(status: number) { super(`Servidor WhatsApp indisponível (${status}).`); this.status = status; }
}

export function evolutionConfig(companyId: string): EvolutionConfig | null {
  const env = process.env;
  if (!companyId || companyId !== env.PROAR_EVOLUTION_COMPANY_ID) return null;
  if (!env.PROAR_EVOLUTION_URL || !env.PROAR_EVOLUTION_API_KEY || !env.PROAR_EVOLUTION_INSTANCE) return null;
  const base = new URL(env.PROAR_EVOLUTION_URL);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash ||
      !/^[A-Za-z0-9_-]+$/.test(env.PROAR_EVOLUTION_INSTANCE)) {
    throw new Error("Configuração do servidor WhatsApp inválida.");
  }
  return { base, key: env.PROAR_EVOLUTION_API_KEY, instance: env.PROAR_EVOLUTION_INSTANCE };
}

export async function evolutionRequest(companyId: string, path: string, body?: unknown) {
  const config = evolutionConfig(companyId);
  if (!config) throw new Error("WhatsApp indisponível para esta empresa.");
  return evolutionRequestWithConfig(config, path, body);
}

export async function evolutionRequestWithConfig(config: EvolutionConfig, path: string, body?: unknown) {
  const url = new URL(`${path}/${encodeURIComponent(config.instance)}`, `${config.base.href.replace(/\/$/, "")}/`);
  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { apikey: config.key, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new EvolutionError(response.status);
  return response.json();
}

export async function sendEvolutionText(companyId: string, to: string, text: string) {
  const config = evolutionConfig(companyId);
  if (!config) throw new Error("WhatsApp indisponível para esta empresa.");
  return sendEvolutionTextWithConfig(config, to, text);
}

export async function sendEvolutionTextWithConfig(config: EvolutionConfig, to: string, text: string) {
  const number = to.replace(/\D/g, "");
  if (!/^[1-9]\d{9,14}$/.test(number)) throw new Error("Informe o telefone com código do país e DDD.");
  if (!text.trim() || text.length > 4000) throw new Error("A mensagem deve ter entre 1 e 4.000 caracteres.");
  const state = await evolutionRequestWithConfig(config, "instance/connectionState");
  if (state?.instance?.state !== "open") throw new Error("WhatsApp desconectado. Faça o pareamento pelo QR Code.");
  const result = await evolutionRequestWithConfig(config, "message/sendText", { number, text });
  if (typeof result?.key?.id !== "string" || !result.key.id.trim()) {
    throw new Error("O servidor não confirmou a aceitação da mensagem. Confira o histórico antes de reenviar.");
  }
  // Acceptance is not a delivery receipt. Never report this result as delivered.
  return { status: "accepted" as const, messageId: result.key.id as string };
}

export function evolutionAutomationEnabled(companyId: string) {
  return process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED === "true" && Boolean(evolutionConfig(companyId));
}
