import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.mercadopago.com";

function accessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado");
  return token;
}

export function mercadoPagoConfigured() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim());
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

export type ManagerBillingMethod = "pix" | "boleto";
export type ManagerBillingPayer = {
  email:string;
  documentType:"CPF"|"CNPJ";
  documentNumber:string;
  firstName?:string;
  lastName?:string;
  address?:{
    zipCode:string;
    streetName:string;
    streetNumber:string;
    neighborhood:string;
    city:string;
    state:string;
  };
};

const digits = (value:string) => value.replace(/\D/g, "");

function payerPayload(payer:ManagerBillingPayer, method:ManagerBillingMethod) {
  const documentNumber = digits(payer.documentNumber);
  if (!payer.email?.includes("@")) throw new Error("E-mail do pagador é obrigatório.");
  if (payer.documentType === "CPF" && documentNumber.length !== 11) throw new Error("CPF do pagador inválido.");
  if (payer.documentType === "CNPJ" && documentNumber.length !== 14) throw new Error("CNPJ do pagador inválido.");
  const normalized:Record<string,unknown> = {
    email:payer.email.trim(),
    first_name:(payer.firstName || "Cliente").trim(),
    last_name:(payer.lastName || "ProAR").trim(),
    identification:{ type:payer.documentType, number:documentNumber },
  };
  if (method === "boleto") {
    const address = payer.address;
    if (!address) throw new Error("Endereço do pagador é obrigatório para boleto.");
    if ([address.zipCode,address.streetName,address.streetNumber,address.neighborhood,address.city,address.state].some(value=>!String(value || "").trim())) {
      throw new Error("Preencha CEP, logradouro, número, bairro, cidade e UF para emitir boleto.");
    }
    normalized.address = {
      zip_code:digits(address.zipCode),
      street_name:address.streetName.trim(),
      street_number:address.streetNumber.trim(),
      neighborhood:address.neighborhood.trim(),
      city:address.city.trim(),
      federal_unit:address.state.trim().toUpperCase().slice(0,2),
    };
  }
  return normalized;
}

function expirationIso(dueDate:string, method:ManagerBillingMethod) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("Vencimento inválido.");
  const due = new Date(`${dueDate}T23:59:59-03:00`);
  const remaining = due.getTime() - Date.now();
  const minimum = method === "boleto" ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
  const maximum = 30 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(remaining) || remaining < minimum) throw new Error(method === "boleto" ? "O boleto precisa vencer a partir do próximo dia." : "O Pix precisa vencer pelo menos 30 minutos à frente.");
  if (remaining > maximum) throw new Error("O vencimento da cobrança não pode ultrapassar 30 dias.");
  return due.toISOString();
}

function apiError(payload:unknown, status:number) {
  if (!payload || typeof payload !== "object") return `Mercado Pago recusou a cobrança (HTTP ${status}).`;
  const row = payload as Record<string,unknown>;
  const cause = Array.isArray(row.cause) ? row.cause[0] as Record<string,unknown> | undefined : undefined;
  return String(cause?.description || cause?.code || row.message || row.error || `Mercado Pago recusou a cobrança (HTTP ${status}).`);
}

export async function createManagerBillingPayment(input:{
  amountCents:number;
  description:string;
  method:ManagerBillingMethod;
  dueDate:string;
  externalReference:string;
  idempotencyKey:string;
  payer:ManagerBillingPayer;
}) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Valor da cobrança inválido.");
  const managerBase = (process.env.PROAR_MANAGER_BASE_URL || "https://manager.proar.online").replace(/\/$/,"");
  const response = await fetch(`${API}/v1/payments`, {
    method:"POST",
    headers:{
      Authorization:`Bearer ${accessToken()}`,
      "Content-Type":"application/json",
      "X-Idempotency-Key":input.idempotencyKey,
    },
    body:JSON.stringify({
      transaction_amount:input.amountCents / 100,
      description:input.description.slice(0,150),
      payment_method_id:input.method === "pix" ? "pix" : "bolbradesco",
      external_reference:input.externalReference,
      date_of_expiration:expirationIso(input.dueDate,input.method),
      notification_url:process.env.MERCADO_PAGO_MANAGER_NOTIFICATION_URL || `${managerBase}/api/manager/billing/webhook`,
      payer:payerPayload(input.payer,input.method),
    }),
    cache:"no-store",
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(apiError(data,response.status));
  const row = data as Record<string,unknown>;
  const point = row.point_of_interaction as Record<string,unknown> | undefined;
  const transaction = point?.transaction_data as Record<string,unknown> | undefined;
  const details = row.transaction_details as Record<string,unknown> | undefined;
  return {
    id:String(row.id || ""),
    status:String(row.status || "pending"),
    statusDetail:String(row.status_detail || ""),
    paymentUrl:String(transaction?.ticket_url || details?.external_resource_url || ""),
    pixQrCode:String(transaction?.qr_code || ""),
    pixQrCodeBase64:String(transaction?.qr_code_base64 || ""),
  };
}

export async function getMercadoPagoPayment(paymentId:string) {
  if (!/^\d+$/.test(paymentId)) throw new Error("Identificador de pagamento inválido.");
  const response = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers:{ Authorization:`Bearer ${accessToken()}` },
    cache:"no-store",
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(apiError(data,response.status));
  return data as Record<string,unknown>;
}

export function verifyMercadoPagoWebhook(request: Request, dataId: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(xSignature.split(",").map(p => p.trim().split("=",2)).filter(x => x.length === 2));
  const ts = parts.ts || "";
  const received = parts.v1 || "";
  if (!ts || !received || !xRequestId || !dataId) return false;
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected); const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
