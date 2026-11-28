export const pdvMethods = ["PIX", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Boleto", "Outros"] as const;
export type PdvPayment = { method: string; amount: number };

function cents(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return -1;
  const scaled = value * 100;
  const rounded = Math.round(scaled);
  return Number.isSafeInteger(rounded) && Math.abs(scaled - rounded) < 0.002 ? rounded : -1;
}

export function summarizePdvPayments(raw: unknown, total: number) {
  const totalCents = cents(total);
  const rows: PdvPayment[] = [];
  const seen = new Set<string>();
  let valid = Array.isArray(raw) && raw.length <= pdvMethods.length && totalCents >= 0;
  let paid = 0, nonCash = 0;
  for (const row of Array.isArray(raw) ? raw.slice(0, pdvMethods.length) : []) {
    const method = pdvMethods.find(option => option === row?.method);
    const amount = cents(row?.amount);
    if (!method || amount < 0 || seen.has(method)) { valid = false; continue; }
    seen.add(method);
    if (!amount) continue;
    paid += amount;
    if (method !== "Dinheiro") nonCash += amount;
    rows.push({ method, amount: amount / 100 });
  }
  valid = valid && Number.isSafeInteger(paid);
  const remaining = Math.max(0, totalCents - paid) / 100;
  const overpaid = nonCash > totalCents;
  const change = overpaid ? 0 : Math.max(0, paid - totalCents) / 100;
  const net = rows.flatMap(row => {
    const amount = row.method === "Dinheiro" ? (cents(row.amount) - cents(change)) / 100 : row.amount;
    return amount > 0 ? [{ method: row.method, amount }] : [];
  });
  return { valid, paid: paid / 100, remaining, overpaid, change, net, complete: valid && !remaining && !overpaid };
}
