import { NextResponse } from "next/server";
import { db } from "@/db";
import { fiscalConfig } from "@/db/schema";

export async function GET() {
  try {
    const config = await db.select().from(fiscalConfig).limit(1);
    
    // Dados padrão da empresa cadastrada (PolarTech / ProAR Mirassol)
    const defaultData = {
      id: 1,
      cnpj: "44.378.865/0001-61",
      razaoSocial: "PolarTech Mirassol Ar Condicionado Ltda.",
      nomeFantasia: "POLARTECH AR CONDICIONADO",
      regimeTributario: "Simples Nacional",
      inscricaoEstadual: "451.467.248.110",
      endereco: "Rua São Pedro, 2184",
      bairro: "Centro",
      cidade: "Mirassol",
      uf: "SP",
      cep: "15130-000",
      telefone: "(17) 2122-2806",
      whatsapp: "(17) 99156-7798",
      email: "contato@polartechsolucoes.com.br",
      site: "polartechsolucoes.com.br",
      slogan: "Mais conforto, mais qualidade de vida!",
      logoUrl: "", // Vazio usará o SVG/Logo institucional estilizado idêntico ao modelo
      aliquotaEfetiva: "4.5%",
      certidoesValidas: {
        cndt: true,
        fgts: true,
        receitaFederal: true,
        crea: true,
      },
    };

    return NextResponse.json({
      success: true,
      data: config[0] ? { ...defaultData, ...config[0] } : defaultData,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = await db
      .insert(fiscalConfig)
      .values({
        cnpj: body.cnpj,
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia || body.razaoSocial,
        regimeTributario: body.regimeTributario || "Simples Nacional",
        inscricaoEstadual: body.inscricaoEstadual,
        endereco: body.endereco,
        bairro: body.bairro,
        cidade: body.cidade || "Mirassol",
        uf: body.uf || "SP",
        cep: body.cep || "15130-000",
        telefone: body.telefone,
        whatsapp: body.whatsapp,
        email: body.email,
        site: body.site || "polartechsolucoes.com.br",
        logoUrl: body.logoUrl,
        slogan: body.slogan || "Mais conforto, mais qualidade de vida!",
        aliquotaEfetiva: body.aliquotaEfetiva,
        certidoesValidas: body.certidoesValidas,
      })
      .returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
