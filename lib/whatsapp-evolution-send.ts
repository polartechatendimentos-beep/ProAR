/** Safe outbound payload for a configured, explicitly enabled Evolution instance. */
import { evolutionConnectionState, evolutionRequest, type EvolutionSettings } from "./whatsapp-evolution";

export function normalizeBrazilianWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  if (!/^[1-9][0-9](?:9[0-9]{8}|[2-8][0-9]{7})$/.test(local)) {
    throw new Error("Número brasileiro inválido");
  }
  return "55" + local;
}
export function validateReminderMessage(text: string): string {
  const message = text.trim();
  if (!message || message.length > 1000) throw new Error("Mensagem vazia ou extensa demais");
  return message;
}
export async function sendEvolutionReminder(settings: EvolutionSettings, input: {
  phone: string; message: string; consent: boolean; optedOut?: boolean;
}) {
  if (!input.consent || input.optedOut) throw new Error("Cliente não autorizou mensagens WhatsApp");
  const number = normalizeBrazilianWhatsApp(input.phone);
  const text = validateReminderMessage(input.message);
  const status = await evolutionConnectionState(settings) as { instance?: { state?: string }; state?: string };
  if ((status.instance?.state ?? status.state) !== "open") throw new Error("WhatsApp desconectado");
  // This function must only be called by a trusted server-side queue after
  // idempotency reservation; do not expose directly to a public route.
  return evolutionRequest(settings, `/message/sendText/${encodeURIComponent(settings.instance)}`, "POST", { number, text });
}
