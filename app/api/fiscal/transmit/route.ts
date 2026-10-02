import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { validateFiscalPayload, type FiscalValidationPayload } from "../../../../lib/fiscal-validation";
import { resolveFiscalRoute } from "../../../../lib/fiscal-routing";
import { callFiscalBridge } from "../../../../lib/fiscal-bridge";
import { calculateFiscalTotals } from "../../../../lib/fiscal-domain";

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

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const body = await request.json() as { documentId?: string; payload?: FiscalValidationPayload };
    if (!body.documentId || !body.payload) return NextResponse.json({ error: "Documento e payload fiscal são obrigatórios." }, { status: 400 });

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

    const totals = calculateFiscalTotals({
      items: (body.payload.items || []).map(item => ({ ...item, kind: "Produto" })),
      retentions: body.payload.retentions,
      payments: body.payload.payments,
      change: body.payload.change,
    });
    if (body.payload.kind === "NFSE" && body.payload.service?.value) {
      totals.services = Number(body.payload.service.value);
      totals.gross = Number(body.payload.service.value);
      totals.net = Math.round((totals.gross - totals.withheld) * 100) / 100;
    }

    const bridgePayload = { documentId: body.documentId, payload: body.payload, routing, totals };
    const result = await callFiscalBridge({
      companyId: String(access.session.companyId || ""),
      action: "authorize",
      documentId: body.documentId,
      path: "/v1/documents/authorize",
      body: bridgePayload,
    });

    if (!result.configured) {
      return NextResponse.json({
        ...result.data,
        preflight,
        routing,
        totals,
        error: "A ponte fiscal real ainda não está configurada. Configure PROAR_FISCAL_BRIDGE_URL e PROAR_FISCAL_BRIDGE_TOKEN para transmitir ao autorizador homologado.",
      }, { status: 503 });
    }

    const provider = result.data as FiscalBridgeResponse;
    if (!result.response.ok || provider.status === "rejected") {
      return NextResponse.json({
        status: "rejected",
        code: provider.code || "FISCAL_PROVIDER_REJECTION",
        error: provider.message || "Documento rejeitado pelo autorizador fiscal.",
        provider,
        preflight,
        routing,
        totals,
        idempotencyKey: result.idempotencyKey,
      }, { status: 422 });
    }

    if (provider.status === "processing") {
      return NextResponse.json({ status: "processing", provider, preflight, routing, totals, idempotencyKey: result.idempotencyKey }, { status: 202 });
    }

    const fiscalIdentifier = provider.accessKey || provider.verificationCode;
    if (provider.status !== "authorized" || !provider.documentNumber || !provider.protocol || !fiscalIdentifier) {
      return NextResponse.json({
        status: "invalid_authorization_response",
        error: "O autorizador não devolveu número, protocolo e chave/código de verificação. O ProAR não marcará o documento como autorizado.",
        provider,
        idempotencyKey: result.idempotencyKey,
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
      totals,
      idempotencyKey: result.idempotencyKey,
    });
  } catch (error) {
    console.error("Fiscal transmission error", error);
    return NextResponse.json({ status: "error", error: "Falha ao transmitir o documento fiscal." }, { status: 500 });
  }
}
