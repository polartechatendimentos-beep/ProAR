import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { licitacaoDocuments } from "@/db/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const licitacaoId = searchParams.get("licitacao_id") ? Number(searchParams.get("licitacao_id")) : null;
    const companyId = searchParams.get("company_id") ? Number(searchParams.get("company_id")) : 1;

    const list = await db
      .select()
      .from(licitacaoDocuments)
      .where(licitacaoId ? and(eq(licitacaoDocuments.companyId, companyId), eq(licitacaoDocuments.licitacaoId, licitacaoId)) : eq(licitacaoDocuments.companyId, companyId))
      .orderBy(desc(licitacaoDocuments.criadoEm));

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.tipo || !body.empresa || !body.cnpj) {
      return NextResponse.json({ success: false, error: "Campos obrigatórios: tipo, empresa e cnpj." }, { status: 400 });
    }

    const [saved] = await db
      .insert(licitacaoDocuments)
      .values({
        companyId: body.companyId ? Number(body.companyId) : 1,
        licitacaoId: body.licitacaoId ? Number(body.licitacaoId) : null,
        tipo: body.tipo,
        empresa: body.empresa,
        cnpj: body.cnpj,
        emissao: body.emissao ? new Date(body.emissao) : null,
        validade: body.validade ? new Date(body.validade) : null,
        orgaoEmissor: body.orgaoEmissor || null,
        situacao: body.situacao || "valido",
        arquivoNome: body.arquivoNome || null,
        arquivoUrl: body.arquivoUrl || null,
        iaValidou: Boolean(body.iaValidou),
        ultimaUtilizacao: body.ultimaUtilizacao || null,
        metadadosIa: body.metadadosIa || {},
      })
      .returning();

    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
