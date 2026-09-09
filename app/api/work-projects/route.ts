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
    if (request.headers.get("x-work-external-auth")) {
      return NextResponse.json(
        { success: false, error: "Acesso externo não pode alterar cadastro operacional da obra." },
        { status: 403 }
      );
    }

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
        senhaApontamentos: body.senhaApontamentos || "123456",
        acessoApontamentosAtivo: body.acessoApontamentosAtivo !== undefined ? Boolean(body.acessoApontamentosAtivo) : true,
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

export async function PATCH(request: Request) {
  try {
    if (request.headers.get("x-work-external-auth")) {
      return NextResponse.json(
        { success: false, error: "Acesso externo não pode alterar cadastro operacional da obra." },
        { status: 403 }
      );
    }

    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: "ID da obra é obrigatório." }, { status: 400 });
    }

    const [existing] = await db.select().from(works).where(eq(works.id, Number(body.id))).limit(1);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Obra não encontrada." }, { status: 404 });
    }

    const companyId = assertCompanyAccess(session, existing.companyId);
    const updateData: any = { atualizadoEm: new Date() };

    if (body.nome !== undefined) updateData.nome = body.nome;
    if (body.descricao !== undefined) updateData.descricao = body.descricao;
    if (body.clienteNome !== undefined) updateData.clienteNome = body.clienteNome;
    if (body.clienteCnpj !== undefined) updateData.clienteCnpj = body.clienteCnpj;
    if (body.endereco !== undefined) updateData.endereco = body.endereco;
    if (body.cidade !== undefined) updateData.cidade = body.cidade;
    if (body.uf !== undefined) updateData.uf = body.uf;
    if (body.dataInicio !== undefined) updateData.dataInicio = body.dataInicio ? new Date(body.dataInicio) : null;
    if (body.previsaoTermino !== undefined) updateData.previsaoTermino = body.previsaoTermino ? new Date(body.previsaoTermino) : null;
    if (body.valorContrato !== undefined) updateData.valorContrato = String(body.valorContrato || "0.00");
    if (body.engenheiroResponsavel !== undefined) updateData.engenheiroResponsavel = body.engenheiroResponsavel;
    if (body.equipe !== undefined) updateData.equipe = body.equipe;
    if (body.acessoApontamentosAtivo !== undefined) updateData.acessoApontamentosAtivo = Boolean(body.acessoApontamentosAtivo);

    const [updated] = await db.update(works).set(updateData).where(eq(works.id, existing.id)).returning();

    await db.insert(auditEvents).values({
      companyId,
      userId: session.id,
      acao: "UPDATE_WORK",
      entidade: "works",
      entidadeId: String(existing.id),
      detalhes: { before: existing.nome, after: updated.nome, fields: Object.keys(updateData) },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
