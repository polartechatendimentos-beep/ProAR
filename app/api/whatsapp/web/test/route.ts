import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../../lib/proar-auth";
import { assertActiveWhatsAppCompany } from "../../../../../lib/evolution-tenant";
import { dispatchEvolutionJob } from "../../../../../lib/evolution-jobs";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store, private" };
  if (request.headers.get("sec-fetch-site") !== "same-origin" || (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin)) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
  const user = readSession(request.cookies.get("proar_session")?.value);
  const expected = request.headers.get("x-proar-company-id");
  if (!user?.companyId || (expected && expected !== user.companyId) || (!user.permissions.includes("*") && !user.permissions.includes("Configurações"))) return NextResponse.json({ error: "Não autorizado." }, { status: 403, headers });
  try {
    const body = await request.json();
    if (typeof body.to !== "string" || typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.requestId)) return NextResponse.json({ error: "Informe o destinatário e a identificação do teste." }, { status: 400, headers });
    let to = body.to.replace(/\D/g, "");
    if (/^\d{10,11}$/.test(to)) to = `55${to}`;
    if (!/^[1-9]\d{9,14}$/.test(to)) return NextResponse.json({ error: "Informe o telefone com DDD e código do país." }, { status: 400, headers });
    await assertActiveWhatsAppCompany(user.companyId);
    const result = await dispatchEvolutionJob(user.companyId, `test:${body.requestId}`, to, "Mensagem de teste do ProAR. A conexão do WhatsApp desta empresa está sendo validada.");
    return NextResponse.json(result, { headers });
  } catch { return NextResponse.json({ error: "Teste sem confirmação. Consulte o histórico antes de repetir." }, { status: 502, headers }); }
}
