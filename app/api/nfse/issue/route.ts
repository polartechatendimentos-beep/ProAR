import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";

export const runtime = "nodejs";

const allowed = (request: NextRequest) => {
  const user = readSession(request.cookies.get("proar_session")?.value);
  return user && (user.permissions.includes("*") || user.permissions.includes("Financeiro") || user.permissions.includes("Ordens de serviço")) ? user : null;
};

export async function POST(request: NextRequest) {
  const user = allowed(request);
  if (!user) return NextResponse.json({ error: "Sem permissão para emitir NFS-e." }, { status: 403 });
  const body = await request.json();
  const providerUrl = process.env.MIRASSOL_NFSE_API_URL;
  const providerToken = process.env.MIRASSOL_NFSE_API_TOKEN;
  if (!providerUrl || !providerToken) {
    return NextResponse.json({ error: "Integração NFS-e de Mirassol ainda não habilitada no servidor. Configure o adaptador fiscal antes da primeira emissão." }, { status: 428 });
  }
  if (!body?.serviceOrderId || !body?.customer?.document || !body?.service?.description || Number(body?.service?.value || 0) <= 0) {
    return NextResponse.json({ error: "Dados obrigatórios da NFS-e incompletos." }, { status: 400 });
  }
  const idempotencyKey = String(body.idempotencyKey || createHash("sha256").update(`${user.companyId}:${body.serviceOrderId}:${body.service.value}`).digest("hex"));
  const response = await fetch(providerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}`, "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ ...body, municipality: "Mirassol", municipalityCode: "3530300", state: "SP", requestedBy: user.username, companyId: user.companyId, idempotencyKey }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: result?.error || "A Prefeitura/Provedor não confirmou a emissão da NFS-e.", provider: result }, { status: 502 });
  return NextResponse.json({ issued: true, idempotencyKey, result });
}
