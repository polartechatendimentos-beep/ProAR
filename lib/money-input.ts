export function moneyToCents(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) : 0;
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
