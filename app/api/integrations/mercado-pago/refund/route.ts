import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { refundMercadoPagoOrder } from "@/lib/mercado-pago";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await refundMercadoPagoOrder(String(body.orderId || ""), body.amount == null ? undefined : Number(body.amount), String(body.idempotencyKey || randomUUID()));
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Falha no reembolso" }, { status: 400 });
  }
}
