import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";

export async function POST(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  if (!user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const { cnpj = "" } = await request.json();
  const document = String(cnpj).replace(/\D/g, "");
  if (document.length !== 14) return NextResponse.json({ error: "Cadastre o CNPJ da empresa antes da consulta." }, { status: 400 });
  const providerUrl = process.env.NFE_DISTRIBUTION_API_URL;
  const providerToken = process.env.NFE_DISTRIBUTION_API_TOKEN;
  if (!providerUrl || !providerToken) return NextResponse.json({ error: "Configure o certificado A1 e o provedor de Distribuição DF-e nas Configurações Fiscais." }, { status: 428 });
  const response = await fetch(providerUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}` }, body: JSON.stringify({ cnpj: document }) });
  if (!response.ok) return NextResponse.json({ error: "A SEFAZ não respondeu à consulta de documentos destinados." }, { status: 502 });
  const result = await response.json();
  return NextResponse.json(result);
}
