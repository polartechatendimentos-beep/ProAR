import { NextResponse } from "next/server";
import { db } from "@/db";
import { works, workExternalAccess } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/password";
import { signWorkExternalToken } from "@/lib/work-external-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, senha, accessTokenId } = body;

    if (!token || !senha) {
      return NextResponse.json(
        { success: false, error: "Token da obra e credencial são obrigatórios." },
        { status: 400 }
      );
    }

    const [work] = await db.select().from(works).where(eq(works.tokenPublico, token)).limit(1);
    if (!work) {
      return NextResponse.json({ success: false, error: "Obra não localizada." }, { status: 404 });
    }

    if (accessTokenId) {
      const [access] = await db
        .select()
        .from(workExternalAccess)
        .where(and(eq(workExternalAccess.workId, work.id), eq(workExternalAccess.accessTokenId, String(accessTokenId))))
        .limit(1);

      if (!access || !access.enabled || !access.allowLinkAccess) {
        return NextResponse.json(
          { success: false, error: "Acesso externo bloqueado ou inválido para esta obra." },
          { status: 403 }
        );
      }

      if (!verifyPassword(String(senha), access.passwordHash)) {
        return NextResponse.json(
          { success: false, error: "Credencial inválida. Verifique a senha fornecida pela PolarTech." },
          { status: 401 }
        );
      }

      await db
        .update(workExternalAccess)
        .set({ lastAccessAt: new Date(), atualizadoEm: new Date() })
        .where(eq(workExternalAccess.id, access.id));

      const externalAuthToken = signWorkExternalToken({
        accessId: access.id,
        workId: work.id,
        companyId: work.companyId,
        tipo: access.tipo as "engenharia" | "fiscalizacao",
        nome: access.nome,
        funcao: access.funcao,
        tokenVersion: access.atualizadoEm?.toISOString?.() || String(access.id),
      });

      return NextResponse.json({
        success: true,
        authorized: true,
        obra: { id: work.id, nome: work.nome, codigo: work.codigo },
        ator: { nome: access.nome, funcao: access.funcao, tipo: access.tipo },
        externalAuthToken,
        message: "Acesso autorizado para Engenharia/Fiscalização.",
      });
    }

    if (work.acessoApontamentosAtivo === false) {
      return NextResponse.json(
        { success: false, error: "Acesso externo da obra temporariamente bloqueado pela PolarTech." },
        { status: 403 }
      );
    }

    const validPass = work.senhaApontamentos || "123456";
    if (String(senha).trim() !== validPass.trim()) {
      return NextResponse.json(
        { success: false, error: "Senha incorreta. Informe a senha fornecida pela PolarTech para esta obra." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      authorized: true,
      obra: { id: work.id, nome: work.nome, codigo: work.codigo },
      ator: { nome: "Acesso legado", funcao: "Fiscalização", tipo: "fiscalizacao" },
      externalAuthToken: null,
      message: "Acesso legado autorizado. Cadastre credenciais individuais para rastreabilidade completa.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao validar credencial externa." },
      { status: 500 }
    );
  }
}
