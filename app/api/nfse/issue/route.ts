import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";

export async function POST(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const body = await request.json();
  const providerUrl = process.env.MIRASSOL_NFSE_API_URL;
  const providerToken = process.env.MIRASSOL_NFSE_API_TOKEN;
  if (!providerUrl || !providerToken) {
    return NextResponse.json({ error: "Integração NFS-e de Mirassol ainda não configurada no servidor. Defina MIRASSOL_NFSE_API_URL e MIRASSOL_NFSE_API_TOKEN." }, { status: 428 });
  }
  if (!body?.serviceOrderId || !body?.customer?.document || !body?.service?.description || Number(body?.service?.value || 0) <= 0) {
    return NextResponse.json({ error: "Dados obrigatórios da NFS-e incompletos." }, { status: 400 });
  }
  const response = await fetch(providerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}` },
    body: JSON.stringify({ ...body, municipality: "Mirassol", state: "SP", requestedBy: user.username }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) return NextResponse.json({ error: result?.error || "A Prefeitura/Provedor não confirmou a emissão da NFS-e.", provider: result }, { status: 502 });
  return NextResponse.json({ issued: true, result });
}
