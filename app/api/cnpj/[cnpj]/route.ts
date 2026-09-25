import { NextResponse } from "next/server";
import { isValidCnpj } from "@/lib/br-documents";

export async function GET(request: Request, context: { params: Promise<{ cnpj: string }> }) {
  const { cnpj } = await context.params;
  const cleanCnpj = (cnpj || "").replace(/\D/g, "");

  if (!isValidCnpj(cleanCnpj)) {
    return NextResponse.json(
      { success: false, error: "CNPJ inválido. Confira os dígitos verificadores." },
      { status: 400 }
    );
  }

  try {
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
        headers: { "User-Agent": "ProAR-System/1.0" },
      });
      if (res.ok) {
        const data = await res.json();
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
      const res2 = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`);
      if (res2.ok) {
        const data = await res2.json();
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
      { status: 404 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Falha inesperada na consulta." }, { status: 500 });
  }
}
