import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BrasilApiCnpj = {
  razao_social?: string; nome_fantasia?: string; email?: string; ddd_telefone_1?: string;
  cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string;
  municipio?: string; uf?: string; descricao_situacao_cadastral?: string;
  cnae_fiscal?: number | string; cnae_fiscal_descricao?: string;
};

export async function GET(_: Request, context: { params: Promise<{ cnpj: string }> }) {
  const { cnpj: raw } = await context.params;
  const cnpj = raw.replace(/\D/g, "");
  if (!/^\d{14}$/.test(cnpj)) return NextResponse.json({ error: "Informe um CNPJ válido com 14 dígitos." }, { status: 400 });
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      cache: "no-store",
      headers: { "Accept": "application/json", "User-Agent": "ProAR-Gestao-de-Servicos/1.0" },
    });
    const data = await response.json().catch(() => ({})) as BrasilApiCnpj & { message?: string };
    if (!response.ok) return NextResponse.json({ error: data.message || "CNPJ não encontrado na base de consulta." }, { status: response.status === 404 ? 404 : 502 });
    const addressNumber = data.numero || "";
    return NextResponse.json({
      cnpj,
      legalName: data.razao_social || "",
      tradeName: data.nome_fantasia || data.razao_social || "",
      email: data.email || "",
      phone: data.ddd_telefone_1 || "",
      zipCode: data.cep || "",
      street: data.logradouro || "",
      addressNumber,
      complement: data.complemento || "",
      neighborhood: data.bairro || "",
      city: data.municipio || "",
      state: data.uf || "",
      stateRegistration: "",
      cnaeMain: [data.cnae_fiscal, data.cnae_fiscal_descricao].filter(Boolean).join(" - "),
      taxStatus: data.descricao_situacao_cadastral || "",
      source: "BrasilAPI / Minha Receita",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Serviço de consulta de CNPJ temporariamente indisponível. Os campos continuam liberados para preenchimento manual." }, { status: 503 });
  }
}
