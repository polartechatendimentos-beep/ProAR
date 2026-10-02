import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { validateFiscalPayload, type FiscalValidationPayload } from "../../../../lib/fiscal-validation";
import { resolveFiscalRoute } from "../../../../lib/fiscal-routing";

export const runtime = "nodejs";

type FiscalBridgeResponse = {
  status?: "authorized" | "rejected" | "processing";
  documentNumber?: string;
  series?: string;
  accessKey?: string;
  verificationCode?: string;
  protocol?: string;
  authorizedAt?: string;
  xmlUrl?: string;
  danfeUrl?: string;
  message?: string;
  code?: string;
};

function bridgeConfiguration() {
  const baseUrl = String(process.env.PROAR_FISCAL_BRIDGE_URL || "").replace(/\/$/, "");
  const token = String(process.env.PROAR_FISCAL_BRIDGE_TOKEN || "");
  return { baseUrl, token, configured: Boolean(baseUrl && token) };
}

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await request.json() as { documentId?: string; payload?: FiscalValidationPayload };
    if (!body.payload) return NextResponse.json({ error: "Payload fiscal não informado." }, { status: 400 });

    const preflight = validateFiscalPayload(body.payload);
    if (!preflight.valid) {
      return NextResponse.json({ status: "rejected", error: "Documento possui pendências fiscais.", preflight }, { status: 422 });
    }

    let routing;
    try {
      routing = resolveFiscalRoute(body.payload);
    } catch (error) {
      if (error instanceof Error && error.message === "NFSE_MUNICIPALITY_NOT_CONFIGURED") {
        return NextResponse.json({
          status: "rejected",
          code: "NFSE_MUNICIPALITY_NOT_CONFIGURED",
          error: "O município da NFS-e ainda não possui rota fiscal configurada no ProAR.",
          preflight,
        }, { status: 422 });
      }
      throw error;
    }

    const bridge = bridgeConfiguration();
    if (!bridge.configured) {
      return NextResponse.json({
        status: "integration_required",
        error: "A ponte fiscal real ainda não está configurada no servidor. Configure PROAR_FISCAL_BRIDGE_URL e PROAR_FISCAL_BRIDGE_TOKEN para transmitir à SEFAZ/NFS-e por um adaptador homologado.",
        preflight,
        routing,
      }, { status: 503 });
    }

    const response = await fetch(`${bridge.baseUrl}/v1/documents/authorize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bridge.token}`,
        "X-ProAR-Company": String(access.session.companyId || ""),
      },
      body: JSON.stringify({ documentId: body.documentId, payload: body.payload, routing }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });

    const provider = await response.json().catch(() => ({})) as FiscalBridgeResponse;
    if (!response.ok || provider.status === "rejected") {
      return NextResponse.json({
        status: "rejected",
        code: provider.code || "FISCAL_PROVIDER_REJECTION",
        error: provider.message || "Documento rejeitado pelo autorizador fiscal.",
        provider,
        preflight,
        routing,
      }, { status: 422 });
    }

    if (provider.status === "processing") {
      return NextResponse.json({ status: "processing", provider, preflight, routing }, { status: 202 });
    }

    const fiscalIdentifier = provider.accessKey || provider.verificationCode;
    if (provider.status !== "authorized" || !provider.documentNumber || !provider.protocol || !fiscalIdentifier) {
      return NextResponse.json({
        status: "invalid_authorization_response",
        error: "O autorizador não devolveu número, protocolo e chave/código de verificação. O ProAR não marcará o documento como autorizado.",
        provider,
      }, { status: 502 });
    }

    return NextResponse.json({
      status: "authorized",
      documentNumber: provider.documentNumber,
      series: provider.series,
      accessKey: provider.accessKey,
      verificationCode: provider.verificationCode,
      protocol: provider.protocol,
      authorizedAt: provider.authorizedAt || new Date().toISOString(),
      xmlUrl: provider.xmlUrl,
      danfeUrl: provider.danfeUrl,
      preflight,
      routing,
    });
  } catch (error) {
    console.error("Fiscal transmission error", error);
    return NextResponse.json({ status: "error", error: "Falha ao transmitir o documento fiscal." }, { status: 500 });
  }
}
