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

export type MercadoPagoPayer = {
  firstName?:string;
  lastName?:string;
  identification?:{type:"CPF"|"CNPJ";number:string};
  address?:{
    zipCode:string;
    streetName:string;
    streetNumber:string;
    neighborhood:string;
    city:string;
    state:string;
  };
};

export type MercadoPagoOrderInput = {
  amount: number;
  externalReference: string;
  payerEmail: string;
  description?:string;
  expirationDays?:number;
  payer?:MercadoPagoPayer;
  payment:
    | { kind: "pix" }
    | { kind: "boleto" }
    | { kind: "credit_card"; paymentMethodId: string; token: string; installments: number };
};

const digits = (value:string) => value.replace(/\D/g, "");

function normalizedPayer(input:MercadoPagoOrderInput) {
  const payer:Record<string,unknown> = { email:input.payerEmail.trim() };
  if (input.payer?.firstName) payer.first_name = input.payer.firstName.trim();
  if (input.payer?.lastName) payer.last_name = input.payer.lastName.trim();
  if (input.payer?.identification) {
    const number = digits(input.payer.identification.number);
    if (input.payer.identification.type === "CPF" && number.length !== 11) throw new Error("CPF do pagador inválido");
    if (input.payer.identification.type === "CNPJ" && number.length !== 14) throw new Error("CNPJ do pagador inválido");
    payer.identification = { type:input.payer.identification.type, number };
  }
  if (input.payment.kind === "boleto") {
    const address = input.payer?.address;
    const identification = input.payer?.identification;
    if (!identification) throw new Error("CPF/CNPJ do pagador é obrigatório para boleto");
    if (!address || [address.zipCode,address.streetName,address.streetNumber,address.neighborhood,address.city,address.state].some(value=>!String(value||"").trim())) {
      throw new Error("CEP, logradouro, número, bairro, cidade e UF são obrigatórios para boleto");
    }
    payer.address = {
      zip_code:digits(address.zipCode),
      street_name:address.streetName.trim(),
      street_number:address.streetNumber.trim() || "S/N",
      neighborhood:address.neighborhood.trim(),
      city:address.city.trim(),
      state:address.state.trim().toUpperCase().slice(0,2),
    };
  }
  return payer;
}

function expirationTime(days?:number) {
  if (days == null) return undefined;
  const safe = Math.max(1,Math.min(30,Math.floor(days)));
  return `P${safe}D`;
}

export async function createMercadoPagoOrder(input: MercadoPagoOrderInput, idempotencyKey: string) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Valor de pagamento inválido");
  if (!input.externalReference.trim()) throw new Error("Referência externa obrigatória");
  if (!input.payerEmail.trim()) throw new Error("E-mail do pagador obrigatório");
  if (!idempotencyKey.trim()) throw new Error("Chave de idempotência obrigatória");

  const method = input.payment.kind === "pix"
    ? { id:"pix", type:"bank_transfer" }
    : input.payment.kind === "boleto"
      ? { id:"boleto", type:"ticket" }
      : { id:input.payment.paymentMethodId, type:"credit_card", token:input.payment.token, installments:input.payment.installments };

  const payment:Record<string,unknown> = {
    amount:input.amount.toFixed(2),
    payment_method:method,
  };
  const expiry = expirationTime(input.expirationDays);
  if (expiry) payment.expiration_time = expiry;

  const response = await fetch(`${API}/v1/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      type:"online",
      processing_mode:"automatic",
      total_amount:input.amount.toFixed(2),
      external_reference:input.externalReference,
      ...(input.description ? {description:input.description.slice(0,150)} : {}),
      payer:normalizedPayer(input),
      transactions:{ payments:[payment] },
    }),
    cache:"no-store",
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    const row = data as Record<string,unknown>;
    throw new Error(String(row.message || row.error || `Mercado Pago: HTTP ${response.status}`));
  }
  return data as Record<string,unknown>;
}

export async function getMercadoPagoOrder(orderId: string) {
  const response = await fetch(`${API}/v1/orders/${encodeURIComponent(orderId)}`, {
    headers:{ Authorization:`Bearer ${accessToken()}` },
    cache:"no-store",
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`Mercado Pago: ${response.status} ${JSON.stringify(data)}`);
  return data as Record<string,unknown>;
}

export async function refundMercadoPagoOrder(orderId: string, amount?: number, idempotencyKey?: string) {
  const response = await fetch(`${API}/v1/orders/${encodeURIComponent(orderId)}/refund`, {
    method:"POST",
    headers:{ Authorization:`Bearer ${accessToken()}`, "Content-Type":"application/json", ...(idempotencyKey ? {"X-Idempotency-Key":idempotencyKey} : {}) },
    body:amount == null ? "{}" : JSON.stringify({amount:amount.toFixed(2)}),
    cache:"no-store",
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(`Mercado Pago: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

export function mercadoPagoOrderPaymentInfo(order:Record<string,unknown>) {
  const transactions = order.transactions as Record<string,unknown> | undefined;
  const payments = Array.isArray(transactions?.payments) ? transactions?.payments as Record<string,unknown>[] : [];
  const payment = payments[0] || {};
  const method = payment.payment_method as Record<string,unknown> | undefined;
  return {
    orderId:String(order.id || ""),
    transactionId:String(payment.id || ""),
    status:String(order.status || payment.status || ""),
    statusDetail:String(order.status_detail || payment.status_detail || ""),
    ticketUrl:String(method?.ticket_url || ""),
    qrCode:String(method?.qr_code || ""),
    qrCodeBase64:String(method?.qr_code_base64 || ""),
    digitableLine:String(method?.digitable_line || ""),
    barcodeContent:String(method?.barcode_content || ""),
    externalReference:String(order.external_reference || ""),
  };
}

export function mercadoPagoOrderPaid(order:Record<string,unknown>) {
  const info = mercadoPagoOrderPaymentInfo(order);
  return info.status === "processed" && info.statusDetail === "accredited";
}

export function verifyMercadoPagoWebhook(request: Request, dataId: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(xSignature.split(",").map(p=>p.trim().split("=",2)).filter(x=>x.length===2));
  const ts = parts.ts || "";
  const received = parts.v1 || "";
  if (!ts || !received || !xRequestId || !dataId) return false;
  const normalizedId = /[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalizedId};request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256",secret).update(manifest).digest("hex");
  const a=Buffer.from(expected), b=Buffer.from(received);
  return a.length===b.length && timingSafeEqual(a,b);
}
