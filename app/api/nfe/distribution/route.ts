import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../lib/permissions";

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.consultar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { cnpj = "", companyId = "" } = await request.json().catch(() => ({}));
  const scope = sessionCompany(access.session, companyId);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const document = String(cnpj).replace(/\D/g, "");
  if (document.length !== 14) return NextResponse.json({ error: "Cadastre o CNPJ da empresa antes da consulta." }, { status: 400 });
  const providerUrl = process.env.NFE_DISTRIBUTION_API_URL;
  const providerToken = process.env.NFE_DISTRIBUTION_API_TOKEN;
  if (!providerUrl || !providerToken) return NextResponse.json({ error: "Configure o certificado A1 e o provedor de Distribuição DF-e nas Configurações Fiscais." }, { status: 428 });
  const response = await fetch(providerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}` },
    body: JSON.stringify({ cnpj: document, companyId: scope.companyId, requestedBy: access.session.username }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) return NextResponse.json({ error: "A SEFAZ não respondeu à consulta de documentos destinados." }, { status: 502 });
  const result = await response.json();
  return NextResponse.json(result);
}
