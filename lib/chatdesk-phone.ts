/** Normalize a Brazilian telephone for a single, operator-initiated WhatsApp check. */
export function normalizeWhatsAppPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const number = digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
    ? digits : digits.length === 10 || digits.length === 11 ? "55" + digits : digits;
  if (!/^55[1-9][0-9][2-9][0-9]{7,8}$/.test(number) || ![12,13].includes(number.length))
    throw new Error("Informe um celular ou telefone brasileiro válido com DDD (10 ou 11 dígitos).");
  return number;
}
/** Providers may return arrays or unexpected responses; never claim existence without explicit true. */
export function whatsappNumberExists(response: unknown, number: string): boolean {
  if (!Array.isArray(response)) throw new Error("O WhatsApp não confirmou a consulta. Tente novamente.");
  const result = response.find(item => item && typeof item === "object" &&
    String(item.number || "").replace(/\D/g, "") === number);
  if (!result || typeof result.exists !== "boolean") throw new Error("Não foi possível confirmar este número no WhatsApp.");
  return result.exists;
}
