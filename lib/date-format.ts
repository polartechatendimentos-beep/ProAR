export function formatBrazilDate(value: unknown, fallback = "—"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const y = Number(year), m = Number(month), d = Number(day);
    const calendar = new Date(Date.UTC(y, m - 1, d));
    if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== m - 1 || calendar.getUTCDate() !== d) return fallback;
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}
