import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/request-security";

export async function GET(request: Request, context: { params: Promise<{ cnpj: string }> }) {
  const rateLimitResponse = enforceRateLimit(request, "cnpj", 20);
  if (rateLimitResponse) return rateLimitResponse;

  const { cnpj } = await context.params;
  const cleanCnpj = (cnpj || "").replace(/\D/g, "");

  if (cleanCnpj.length !== 14) {
    return NextResponse.json(
      { success: false, error: "CNPJ inválido. O documento deve conter exatamente 14 dígitos." },
      { status: 400 },
    );
  }

  try {
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
        headers: { "User-Agent": "ProAR-System/1.0" },
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          success: true,
          fonte: "BrasilAPI",
          cnpj: cleanCnpj,
          razaoSocial: data.razao_social,
          nomeFantasia: data.nome_fantasia || data.razao_social,
          situacaoCadastral: data.descricao_situacao_cadastral,
          dataSituacao: data.data_situacao_cadastral,
          cnaeFiscal: data.cnae_fiscal,
          cnaeDescricao: data.cnae_fiscal_descricao,
          endereco: `${data.descricao_tipo_de_logradouro || ""} ${data.logradouro || ""}, ${data.numero || "S/N"}`.trim(),
          bairro: data.bairro,
          cidade: data.municipio,
          uf: data.uf,
          cep: data.cep,
          telefone: data.ddd_telefone_1,
          email: data.email,
        });
      }
    } catch {}

    try {
      const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK") {
          return NextResponse.json({
            success: true,
            fonte: "ReceitaWS",
            cnpj: cleanCnpj,
            razaoSocial: data.nome,
            nomeFantasia: data.fantasia || data.nome,
            situacaoCadastral: data.situacao,
            endereco: `${data.logradouro}, ${data.numero}`,
            bairro: data.bairro,
            cidade: data.municipio,
            uf: data.uf,
            cep: data.cep,
            telefone: data.telefone,
            email: data.email,
          });
        }
      }
    } catch {}

    return NextResponse.json(
      { success: false, error: "CNPJ não localizado nas bases públicas ou indisponibilidade momentânea." },
      { status: 404 },
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Falha na consulta." }, { status: 500 });
  }
}
