import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.cancelar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await request.json() as {
      documentId?: string;
      documentType?: string;
      accessKey?: string;
      verificationCode?: string;
      protocol?: string;
      reason?: string;
    };
    const reason = String(body.reason || "").trim();
    if (!body.documentId || !body.protocol || !(body.accessKey || body.verificationCode)) {
      return NextResponse.json({ error: "Documento, protocolo e chave/código de verificação são obrigatórios." }, { status: 400 });
    }
    if (reason.length < 15) return NextResponse.json({ error: "Informe uma justificativa de cancelamento com pelo menos 15 caracteres." }, { status: 400 });

    const baseUrl = String(process.env.PROAR_FISCAL_BRIDGE_URL || "").replace(/\/$/, "");
    const token = String(process.env.PROAR_FISCAL_BRIDGE_TOKEN || "");
    if (!baseUrl || !token) {
      return NextResponse.json({ error: "A ponte fiscal real ainda não está configurada no servidor." }, { status: 503 });
    }

    const response = await fetch(`${baseUrl}/v1/documents/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-ProAR-Company": access.session.companyId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    const provider = await response.json().catch(() => ({}));
    if (!response.ok || provider?.status !== "cancelled") {
      return NextResponse.json({ status: "rejected", error: provider?.message || "Cancelamento não autorizado.", provider }, { status: 422 });
    }
    return NextResponse.json({ status: "cancelled", cancelledAt: provider.cancelledAt || new Date().toISOString(), protocol: provider.protocol || body.protocol, provider });
  } catch (error) {
    console.error("Fiscal cancellation error", error);
    return NextResponse.json({ error: "Falha ao solicitar o cancelamento fiscal." }, { status: 500 });
  }
}
