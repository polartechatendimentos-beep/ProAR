import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readSession, signToken } from "@/lib/proar-auth";
import { verifyPassword } from "@/lib/password";
import { enforceRateLimit } from "@/lib/request-security";

export async function POST(request: Request) {
  const rateLimitResponse = enforceRateLimit(request, "auth-login", 10);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const senha = String(body?.senha || "");
    const remember = body?.remember !== false;

    if (!email || !senha) {
      return NextResponse.json(
        { success: false, message: "Email e senha são obrigatórios." },
        { status: 400 },
      );
    }

    let user = null;
    try {
      const userList = await db.select().from(users).where(eq(users.email, email)).limit(1);
      user = userList[0] ?? null;
    } catch {
      // A indisponibilidade do banco não deve revelar detalhes internos ao cliente.
    }

    let isValid = false;
    let authUser: { id: number; email: string; nome: string; role: string; companyId: number } | null = null;

    if (user && user.ativo) {
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
    } else if (process.env.ALLOW_BOOTSTRAP_ADMIN === "true") {
      const defaultAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const defaultAdminPass = process.env.ADMIN_PASSWORD;
      if (defaultAdminEmail && defaultAdminPass && email === defaultAdminEmail && senha === defaultAdminPass) {
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
        { status: 401 },
      );
    }

    const token = signToken(authUser, 7 * 24 * 60 * 60);
    const response = NextResponse.json({
      success: true,
      user: authUser,
      token,
      message: "Autenticação realizada com sucesso.",
    });

    response.cookies.set("proar_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      ...(remember ? { maxAge: 7 * 24 * 60 * 60 } : {}),
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json(
      { success: false, message: "Não foi possível concluir a autenticação." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ success: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ success: true, user: session }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("proar_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
