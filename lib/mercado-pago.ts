import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.mercadopago.com";

function accessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado");
  return token;
}

export type MercadoPagoOrderInput = {
  amount: number;
  externalReference: string;
  payerEmail: string;
  payment: { kind: "pix" } | { kind: "credit_card"; paymentMethodId: string; token: string; installments: number };
};

export async function createMercadoPagoOrder(input: MercadoPagoOrderInput, idempotencyKey: string) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Valor de pagamento inválido");
  if (!input.externalReference.trim()) throw new Error("Referência externa obrigatória");
  if (!input.payerEmail.trim()) throw new Error("E-mail do pagador obrigatório");
  const payment = input.payment.kind === "pix"
    ? { amount: input.amount.toFixed(2), payment_method: { id: "pix", type: "bank_transfer" } }
    : { amount: input.amount.toFixed(2), payment_method: { id: input.payment.paymentMethodId, type: "credit_card", token: input.payment.token, installments: input.payment.installments } };
  const response = await fetch(`${API}/v1/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json", "X-Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ type: "online", processing_mode: "automatic", total_amount: input.amount.toFixed(2), external_reference: input.externalReference, payer: { email: input.payerEmail }, transactions: { payments: [payment] } }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mercado Pago: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

export async function getMercadoPagoOrder(orderId: string) {
  const response = await fetch(`${API}/v1/orders/${encodeURIComponent(orderId)}`, { headers: { Authorization: `Bearer ${accessToken()}` }, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mercado Pago: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

export async function refundMercadoPagoOrder(orderId: string, amount?: number, idempotencyKey?: string) {
  const response = await fetch(`${API}/v1/orders/${encodeURIComponent(orderId)}/refund`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken()}`, "Content-Type": "application/json", ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}) },
    body: amount == null ? "{}" : JSON.stringify({ amount: amount.toFixed(2) }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Mercado Pago: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

export function verifyMercadoPagoWebhook(request: Request, dataId: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(xSignature.split(",").map(p => p.trim().split("=")).filter(x => x.length === 2));
  const ts = parts.ts || "";
  const received = parts.v1 || "";
  if (!ts || !received || !xRequestId || !dataId) return false;
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
