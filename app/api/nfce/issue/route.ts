import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const user = access.session;
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
  if (!response.ok) return NextResponse.json({ error: result?.error || result?.message || "A SEFAZ/provedor não autorizou a NFC-e.", status:"Rejeitada", provider:result }, { status:502 });
  const provider = result?.result ?? result?.data ?? result;
  const cStat = Number(provider?.cStat ?? provider?.statusCode ?? provider?.code ?? 0);
  const statusText = String(provider?.status ?? provider?.situacao ?? provider?.state ?? "").toLocaleLowerCase("pt-BR");
  const accessKey = provider?.accessKey ?? provider?.chave ?? provider?.chNFe ?? provider?.key;
  const protocol = provider?.protocol ?? provider?.protocolo ?? provider?.nProt;
  const authorized = (cStat === 100 || provider?.authorized === true || provider?.autorizada === true || ["autorizada","autorizado","authorized"].includes(statusText)) && Boolean(accessKey) && Boolean(protocol);
  if (!authorized) {
    const processing = ["processando","processing","pendente","pending","recebida","received"].includes(statusText) || [103,105].includes(cStat);
    return NextResponse.json({ issued:false, status:processing ? "Processando" : "Rejeitada", idempotencyKey, provider:result, error:processing ? undefined : "A resposta não contém autorização válida da NFC-e." }, { status:processing ? 202 : 422 });
  }
  return NextResponse.json({ issued:true, status:"Autorizada", idempotencyKey, result });
}
