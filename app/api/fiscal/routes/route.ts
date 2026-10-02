import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { publicFiscalRoutes } from "../../../../lib/fiscal-routing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = requirePermission(request, "fiscal.consultar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const environment = request.nextUrl.searchParams.get("environment") || "Homologação";
  return NextResponse.json({
    environment,
    routes: publicFiscalRoutes(environment),
    bridgeConfigured: Boolean(process.env.PROAR_FISCAL_BRIDGE_URL && process.env.PROAR_FISCAL_BRIDGE_TOKEN),
    mirassol: {
      municipality: "Mirassol/SP",
      ibgeCode: "3530300",
      provider: "GOVBR/Cidade360 - ISS Digital",
      homologationOverrideConfigured: Boolean(process.env.PROAR_NFSE_MIRASSOL_HOMOLOG_URL),
      productionOverrideConfigured: Boolean(process.env.PROAR_NFSE_MIRASSOL_PROD_URL),
    },
  });
}
