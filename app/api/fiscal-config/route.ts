import { NextResponse } from "next/server";
import { db } from "@/db";
import { fiscalConfig } from "@/db/schema";

export async function GET() {
  try {
    const config = await db.select().from(fiscalConfig).limit(1);
    return NextResponse.json({ success: true, data: config[0] || null });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = await db.insert(fiscalConfig).values({
      cnpj: body.cnpj,
      razaoSocial: body.razaoSocial,
      regimeTributario: body.regimeTributario,
      inscricaoEstadual: body.inscricaoEstadual,
      aliquotaEfetiva: body.aliquotaEfetiva,
      certidoesValidas: body.certidoesValidas,
    }).returning();

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
