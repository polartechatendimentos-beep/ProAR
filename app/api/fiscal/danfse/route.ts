import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";

export const runtime = "nodejs";

type DanfseRequest = {
  documentId?: string;
  accessKey?: string;
  verificationCode?: string;
  xmlUrl?: string;
  environment?: string;
};

type DanfseBridgeResponse = {
  status?: "generated" | "processing" | "rejected";
  pdfUrl?: string;
  documentUrl?: string;
  layoutVersion?: string;
  pageCount?: number;
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
    const body = await request.json() as DanfseRequest;
    const accessKey = String(body.accessKey || "").replace(/\D/g, "");

    if (!body.documentId) return NextResponse.json({ error: "Documento fiscal não informado." }, { status: 400 });
    if (accessKey.length !== 50) {
      return NextResponse.json({ error: "A chave de acesso da NFS-e deve possuir 50 dígitos para geração do DANFSe." }, { status: 400 });
    }
    if (!body.xmlUrl) {
      return NextResponse.json({ error: "O XML autorizado da NFS-e é obrigatório para gerar o DANFSe." }, { status: 400 });
    }

    const bridge = bridgeConfiguration();
    if (!bridge.configured) {
      return NextResponse.json({
        status: "integration_required",
        error: "A ponte fiscal homologada ainda não está configurada para gerar o DANFSe.",
      }, { status: 503 });
    }

    const response = await fetch(`${bridge.baseUrl}/v1/documents/danfse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${bridge.token}`,
        "X-ProAR-Company": String(access.session.companyId || ""),
      },
      body: JSON.stringify({
        documentId: body.documentId,
        accessKey,
        verificationCode: body.verificationCode,
        xmlUrl: body.xmlUrl,
        layout: {
          standard: "NFS-e Nacional",
          technicalNote: "NT 008/2026",
          version: "1.02",
          documentLabel: "DANFSe v2.0",
          paper: "A4",
          orientation: "portrait",
          singlePage: true,
          marginsCm: { min: 0.15, max: 0.20 },
          borderPt: 1,
          dividerPt: 0.5,
          qrCodeRequired: true,
          accessKeyLength: 50,
          homologationWatermark: "NFS-e SEM VALIDADE JURÍDICA",
          sourceOfTruth: "authorized-xml",
          requiredBlocks: [
            "identificacao-nfse",
            "prestador-fornecedor",
            "tomador-adquirente",
            "destinatario-operacao",
            "intermediario-operacao",
            "servico-prestado",
            "tributacao-municipal-issqn",
            "tributacao-federal-exceto-cbs",
            "tributacao-ibs-cbs",
            "valor-total-nfse",
            "informacoes-complementares"
          ],
          optionalBlocks: ["canhoto"],
        },
        environment: body.environment,
      }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });

    const provider = await response.json().catch(() => ({})) as DanfseBridgeResponse;
    if (!response.ok || provider.status === "rejected") {
      return NextResponse.json({
        status: "rejected",
        code: provider.code || "DANFSE_REJECTED",
        error: provider.message || "Não foi possível gerar o DANFSe no leiaute nacional.",
        provider,
      }, { status: 422 });
    }

    if (provider.status === "processing") {
      return NextResponse.json({ status: "processing", provider }, { status: 202 });
    }

    const pdfUrl = provider.pdfUrl || provider.documentUrl;
    if (provider.status !== "generated" || !pdfUrl) {
      return NextResponse.json({
        status: "invalid_danfse_response",
        error: "O gerador fiscal não devolveu um PDF válido do DANFSe.",
        provider,
      }, { status: 502 });
    }

    if (provider.pageCount && provider.pageCount !== 1) {
      return NextResponse.json({
        status: "invalid_layout",
        error: "DANFSe rejeitado pelo ProAR: a NT 008/2026 v1.02 exige documento em uma única página.",
        provider,
      }, { status: 422 });
    }

    return NextResponse.json({
      status: "generated",
      pdfUrl,
      layoutVersion: provider.layoutVersion || "NT 008/2026 v1.02",
      pageCount: provider.pageCount || 1,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("DANFSe generation error", error);
    return NextResponse.json({ status: "error", error: "Falha ao gerar o DANFSe." }, { status: 500 });
  }
}
