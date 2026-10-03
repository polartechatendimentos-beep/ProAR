import { NextResponse } from "next/server";
import { getMercadoPagoOrder, verifyMercadoPagoWebhook } from "@/lib/mercado-pago";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const dataId = String(body?.data?.id || url.searchParams.get("data.id") || "");
  if (!verifyMercadoPagoWebhook(request, dataId)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const order = await getMercadoPagoOrder(dataId);
    // A persistência/baixa financeira deve usar external_reference como chave única.
    // Nunca dar baixa a partir do payload recebido: consultar a Order no Mercado Pago primeiro.
    return NextResponse.json({ ok: true, orderId: order?.id, status: order?.status, externalReference: order?.external_reference });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
