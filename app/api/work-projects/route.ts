import { NextResponse } from "next/server";
import { db } from "@/db";
import { works, auditEvents } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { desc, eq } from "drizzle-orm";
import crypto from "crypto";

export async function GET(request: Request) {
  try {
    const session = await readSession(request);
    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get("company_id") ? Number(searchParams.get("company_id")) : null;

    let companyId = 1;
    if (session) {
      companyId = getEffectiveCompanyId(session, requestedCompanyId);
    }

    const list = await db
      .select()
      .from(works)
      .where(eq(works.companyId, companyId))
      .orderBy(desc(works.criadoEm));

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const companyId = assertCompanyAccess(session, body.companyId);

    if (!body.nome || !body.endereco || !body.clienteNome) {
      return NextResponse.json(
        { success: false, error: "Campos obrigatórios: nome, clienteNome e endereco." },
        { status: 400 }
      );
    }

    const tokenPublico = crypto.randomBytes(16).toString("hex");
    const codigo = body.codigo || `OBR-${Date.now().toString().slice(-6)}`;

    const [newWork] = await db
      .insert(works)
      .values({
        companyId,
        codigo,
        nome: body.nome,
        descricao: body.descricao || "Instalação e Adequação de Climatização / PMOC",
        clienteNome: body.clienteNome,
        clienteCnpj: body.clienteCnpj || null,
        endereco: body.endereco,
        cidade: body.cidade || "Mirassol",
        uf: body.uf || "SP",
        dataInicio: body.dataInicio ? new Date(body.dataInicio) : new Date(),
        previsaoTermino: body.previsaoTermino ? new Date(body.previsaoTermino) : null,
        valorContrato: body.valorContrato ? String(body.valorContrato) : "0.00",
        progresso: body.progresso ? Number(body.progresso) : 0,
        status: body.status || "em_andamento",
        engenheiroResponsavel: body.engenheiroResponsavel || "Eng. Responsável Técnico ProAR",
        equipe: body.equipe || "TEAM 11",
        tokenPublico,
      })
      .returning();

    try {
      await db.insert(auditEvents).values({
        companyId,
        userId: session.id,
        acao: "CREATE_WORK",
        entidade: "works",
        entidadeId: String(newWork.id),
        detalhes: { nome: newWork.nome, codigo: newWork.codigo },
      });
    } catch (e) {}

    return NextResponse.json({ success: true, data: newWork });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
