import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createMercadoPagoOrder } from "@/lib/mercado-pago";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idempotencyKey = String(body.idempotencyKey || randomUUID());
    const order = await createMercadoPagoOrder({
      amount: Number(body.amount),
      externalReference: String(body.externalReference || ""),
      payerEmail: String(body.payerEmail || ""),
      payment: body.payment,
    }, idempotencyKey);
    return NextResponse.json({ ok: true, idempotencyKey, order });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha ao processar pagamento" }, { status: 400 });
  }
}
