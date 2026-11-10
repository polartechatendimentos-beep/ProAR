/** Eligibility rules for outbound customer reminders. No consent means no automatic send. */
export type CustomerReminder = Record<string, unknown>;
export function reminderTodaySaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function eligibleCustomerReminder(reminder: CustomerReminder, today: string): boolean {
  if (reminder.status !== "Agendado") return false;
  if (reminder.whatsappConsent !== true || reminder.whatsappOptOut === true) return false;
  if (reminder.whatsappSentAt || reminder.whatsappMessageId) return false;
  const due = String(reminder.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due > today) return false;
  const phone = String(reminder.phone ?? reminder.whatsappPhone ?? reminder.category ?? "").replace(/\D/g, "");
  // Brazilian mobile and landline E.164 (with or without country prefix).
  return /^(?:55)?[1-9][0-9]9?[0-9]{8}$/.test(phone);
}
