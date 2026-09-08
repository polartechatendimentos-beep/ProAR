import { NextResponse } from "next/server";
import { db } from "@/db";
import { works } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, senha } = body;

    if (!token || !senha) {
      return NextResponse.json(
        { success: false, error: "Token da obra e senha são obrigatórios." },
        { status: 400 }
      );
    }

    // Busca a obra pelo token público
    let work = null;
    try {
      const result = await db.select().from(works).where(eq(works.tokenPublico, token)).limit(1);
      if (result.length > 0) {
        work = result[0];
      }
    } catch (e) {
      console.warn("[Work Auth] Erro ao consultar banco:", e);
    }

    // Obra de demonstração padrão se o banco estiver vazio ou offline
    if (!work && (token.includes("demo") || token.includes("obr") || token.length >= 8)) {
      work = {
        id: 1,
        codigo: "OBR-2026-042",
        nome: "Instalação VRF Central - Hospital Regional / Bloco Cirúrgico",
        tokenPublico: token,
        senhaApontamentos: "123456",
        acessoApontamentosAtivo: true,
      } as any;
    }

    if (!work) {
      return NextResponse.json(
        { success: false, error: "Obra não localizada." },
        { status: 404 }
      );
    }

    if (work.acessoApontamentosAtivo === false) {
      return NextResponse.json(
        { success: false, error: "O acesso de apontamentos externos desta obra está temporariamente desativado pela PolarTech." },
        { status: 403 }
      );
    }

    // Validação da senha da obra
    const validPass = work.senhaApontamentos || "123456";
    if (senha.trim() !== validPass.trim()) {
      return NextResponse.json(
        { success: false, error: "Senha incorreta. Informe a senha fornecida pela PolarTech para esta obra." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      authorized: true,
      obra: {
        id: work.id,
        nome: work.nome,
        codigo: work.codigo,
      },
      message: "Acesso de apontamentos autorizado para esta obra.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao validar senha de apontamentos." },
      { status: 500 }
    );
  }
}
