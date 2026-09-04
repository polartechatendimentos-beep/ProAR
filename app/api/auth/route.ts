import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signToken } from "@/lib/proar-auth";
import { verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, senha } = body;

    if (!email || !senha) {
      return NextResponse.json(
        { success: false, message: "Email e senha são obrigatórios." },
        { status: 400 }
      );
    }

    // 1. Busca usuário no banco de dados
    let user = null;
    try {
      const userList = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
      if (userList.length > 0) {
        user = userList[0];
      }
    } catch (dbErr) {
      console.warn("[Auth API] Consulta ao banco indisponível, avaliando credenciais de ambiente.");
    }

    // 2. Validação segura
    let isValid = false;
    let authUser = null;

    if (user) {
      isValid = verifyPassword(senha, user.senhaHash);
      if (isValid) {
        authUser = {
          id: user.id,
          email: user.email,
          nome: user.nome,
          role: user.role,
          companyId: user.companyId || 1,
        };
      }
    } else {
      // Fallback seguro de primeiro acesso para o administrador da matriz (Mirassol/SP)
      // Se não cadastrado no banco, permite login com as credenciais padrão configuradas
      const defaultAdminEmail = process.env.ADMIN_EMAIL || "admin@proar.com.br";
      const defaultAdminPass = process.env.ADMIN_PASSWORD || "admin123";

      if (email.toLowerCase().trim() === defaultAdminEmail.toLowerCase() && senha === defaultAdminPass) {
        isValid = true;
        authUser = {
          id: 1,
          email: defaultAdminEmail,
          nome: "Administrador ProAR",
          role: "admin",
          companyId: 1,
        };
      }
    }

    if (!isValid || !authUser) {
      return NextResponse.json(
        { success: false, message: "Credenciais inválidas. Verifique seu e-mail e senha." },
        { status: 401 }
      );
    }

    // 3. Emissão de Token JWT Seguro (Validade 7 dias)
    const token = signToken(authUser, 7 * 24 * 60 * 60);

    const response = NextResponse.json({
      success: true,
      user: authUser,
      token,
      message: "Autenticação realizada com sucesso.",
    });

    // 4. Define cookie HttpOnly para segurança extra contra XSS
    response.cookies.set("proar_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Erro interno no processo de autenticação." },
      { status: 500 }
    );
  }
}
