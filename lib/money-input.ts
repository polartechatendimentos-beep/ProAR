export function parseBrazilianMoney(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  let normalized = raw.replace(/[^\d,.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ",") return 0;
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round((parsed + Number.EPSILON) * 100) / 100 : 0;
}

export function moneyToCents(value: unknown): number {
  const amount = parseBrazilianMoney(value);
  return Math.round((amount + Number.EPSILON) * 100);
}

export function centsToMoney(cents: number): number {
  return Math.round(Number.isFinite(cents) ? cents : 0) / 100;
}

export function parseMoneyInput(raw: string): number {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  const cents = Number(digits);
  return Number.isFinite(cents) ? centsToMoney(cents) : 0;
}

export function formatMoneyInput(value: unknown): string {
  const amount = centsToMoney(moneyToCents(value));
  return `R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
