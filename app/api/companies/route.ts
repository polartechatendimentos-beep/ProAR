import { NextResponse } from "next/server";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { desc, eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    }

    let list = [];
    if (session.role === "superadmin" || session.role === "manager") {
      list = await db.select().from(companies).orderBy(desc(companies.criadoEm));
    } else {
      const companyId = session.companyId || 1;
      list = await db.select().from(companies).where(eq(companies.id, companyId));
    }

    if (list.length === 0) {
      list = [
        {
          id: 1,
          cnpj: "44.378.865/0001-61",
          razaoSocial: "ProAR Climatização & Engenharia Térmica LTDA",
          nomeFantasia: "ProAR Climatização (Matriz Mirassol)",
          subdomain: "matriz",
          emailContato: "contato@proarclimatizacao.com.br",
          telefone: "(17) 3279-3299",
          cidade: "Mirassol",
          uf: "SP",
          plano: "proar_complete",
          status: "ativo",
          ativo: true,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        } as any,
      ];
    }

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session || (session.role !== "superadmin" && session.role !== "manager")) {
      return NextResponse.json({ success: false, error: "Acesso restrito ao Administrador do Sistema." }, { status: 403 });
    }

    const body = await request.json();
    if (!body.cnpj || !body.razaoSocial) {
      return NextResponse.json({ success: false, error: "CNPJ e Razão Social são obrigatórios." }, { status: 400 });
    }

    const [newCompany] = await db
      .insert(companies)
      .values({
        cnpj: body.cnpj,
        razaoSocial: body.razaoSocial,
        nomeFantasia: body.nomeFantasia || body.razaoSocial,
        subdomain: body.subdomain || null,
        emailContato: body.emailContato || null,
        telefone: body.telefone || null,
        cidade: body.cidade || "Mirassol",
        uf: body.uf || "SP",
        plano: body.plano || "proar_standard",
        status: "ativo",
        ativo: true,
      })
      .returning();

    return NextResponse.json({ success: true, data: newCompany });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
