import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { validateFiscalPayload, type FiscalValidationPayload } from "../../../../lib/fiscal-validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const user = access.session;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Payload da NFS-e inválido." }, { status: 400 });
  }

  const payload = (body.payload && typeof body.payload === "object" ? body.payload : body) as FiscalValidationPayload;
  const preflight = validateFiscalPayload({ ...payload, kind: "NFSE" });
  if (!preflight.valid) {
    return NextResponse.json({
      error: "Pré-validação fiscal reprovada. Corrija os campos indicados antes de transmitir.",
      status: "Pendente",
      preflight,
    }, { status: 422 });
  }

  const providerUrl = process.env.MIRASSOL_NFSE_API_URL;
  const providerToken = process.env.MIRASSOL_NFSE_API_TOKEN;
  if (!providerUrl || !providerToken) {
    return NextResponse.json({ error: "Integração NFS-e de Mirassol ainda não habilitada no servidor. Configure o adaptador fiscal antes da primeira emissão." }, { status: 428 });
  }
  const serviceOrderId = String(body.serviceOrderId || body.originId || "");
  if (!serviceOrderId || !payload.customer?.document || !payload.service?.description || Number(payload.service?.value || 0) <= 0) {
    return NextResponse.json({ error: "Informe a OS de origem, o destinatário e os dados do serviço." }, { status: 400 });
  }
  const idempotencyKey = String(body.idempotencyKey || createHash("sha256").update(`${user.companyId}:${serviceOrderId}:${payload.service.value}`).digest("hex"));
  const response = await fetch(providerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}`, "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      ...body,
      ...payload,
      municipality: "Mirassol",
      municipalityCode: payload.service?.municipalityCode || "3530300",
      state: "SP",
      requestedBy: user.username,
      companyId: user.companyId,
      idempotencyKey,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: result?.error || result?.message || "A Prefeitura/Provedor não confirmou a emissão da NFS-e.", status: "Rejeitada", provider: result, preflight }, { status: 502 });
  const provider = result?.result ?? result?.data ?? result;
  const statusText = String(provider?.status ?? provider?.situacao ?? provider?.state ?? "").toLocaleLowerCase("pt-BR");
  const fiscalIdentifier = provider?.number ?? provider?.numero ?? provider?.nfseNumber ?? provider?.chave ?? provider?.key ?? provider?.protocol ?? provider?.protocolo ?? provider?.verificationCode ?? provider?.codigoVerificacao;
  const authorized = Boolean(provider?.authorized === true || provider?.autorizada === true || provider?.issued === true || ["autorizada", "autorizado", "authorized", "aprovada", "aprovado"].includes(statusText)) && Boolean(fiscalIdentifier);
  if (!authorized) {
    const processing = ["processando", "processing", "pendente", "pending", "recebida", "received"].includes(statusText);
    return NextResponse.json({ issued: false, status: processing ? "Processando" : "Rejeitada", idempotencyKey, provider: result, preflight, error: processing ? undefined : "O provedor respondeu, mas não retornou autorização fiscal válida." }, { status: processing ? 202 : 422 });
  }
  return NextResponse.json({ issued: true, status: "Autorizada", idempotencyKey, preflight, result });
}
