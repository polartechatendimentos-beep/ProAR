import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user || !(user.permissions.includes("*") || user.permissions.includes("Financeiro") || user.permissions.includes("Vendas"))) {
    return NextResponse.json({ error: "Sem permissão para emitir NFC-e." }, { status: 403 });
  }
  const body = await request.json();
  if (!body?.saleId || !Array.isArray(body.items) || !body.items.length || Number(body.total || 0) <= 0) {
    return NextResponse.json({ error: "Venda sem dados fiscais suficientes para NFC-e." }, { status: 400 });
  }
  const providerUrl = process.env.SEFAZ_SP_NFCE_API_URL;
  const providerToken = process.env.SEFAZ_SP_NFCE_API_TOKEN;
  if (!providerUrl || !providerToken) {
    return NextResponse.json({ error: "Emissão NFC-e ainda não habilitada no servidor. Configure o adaptador SEFAZ-SP e o CSC antes da primeira emissão." }, { status: 428 });
  }
  const idempotencyKey = String(body.idempotencyKey || createHash("sha256").update(`${user.companyId}:${body.saleId}:${body.total}`).digest("hex"));
  const response = await fetch(providerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}`, "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ ...body, model: 65, state: "SP", companyId: user.companyId, requestedBy: user.username, idempotencyKey }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: result?.error || "A SEFAZ/provedor não autorizou a NFC-e.", provider: result }, { status: 502 });
  return NextResponse.json({ issued: true, idempotencyKey, result });
}
