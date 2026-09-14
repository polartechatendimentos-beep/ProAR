import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { readSession, signToken } from "@/lib/proar-auth";
import { verifyPassword } from "@/lib/password";

type AuthenticatedUser = {
  id: number;
  email: string;
  nome: string;
  role: string;
  companyId: number;
};

type UserLookupResult = {
  user: (typeof users.$inferSelect) | null;
  ambiguous: boolean;
};

function normalizeIdentifier(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function hasTrustedOrigin(request: Request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin) return origin === requestOrigin;

  const referer = request.headers.get("referer");
  if (!referer) return true;

  try {
    return new URL(referer).origin === requestOrigin;
  } catch {
    return false;
  }
}

async function findUserByIdentifier(identifier: string): Promise<UserLookupResult> {
  if (!identifier) return { user: null, ambiguous: false };
  try {
    if (identifier.includes("@")) {
      const userList = await db.select().from(users).where(and(eq(users.email, identifier), eq(users.ativo, true))).limit(1);
      return { user: userList[0] || null, ambiguous: false };
    }

    const userList = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.ativo, true),
          sql`lower(split_part(${users.email}, '@', 1)) = ${identifier}`
        )
      )
      .limit(2);
    return {
      user: userList.length === 1 ? userList[0] : null,
      ambiguous: userList.length > 1,
    };
  } catch {
    console.warn("[Auth API] Consulta ao banco indisponível, avaliando credenciais de ambiente.");
    return { user: null, ambiguous: false };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = normalizeIdentifier(body.email || body.usuario || body.identifier);
    const senha = String(body.senha || "");

    if (!identifier || !senha) {
      return NextResponse.json(
        { success: false, message: "Usuário/e-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const { user, ambiguous } = await findUserByIdentifier(identifier);

    if (ambiguous) {
      return NextResponse.json(
        { success: false, message: "Este usuário está associado a mais de um e-mail ativo. Use o e-mail completo para entrar." },
        { status: 400 }
      );
    }

    let isValid = false;
    let authUser: AuthenticatedUser | null = null;

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
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Erro interno no processo de autenticação." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: session,
    });
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, error: error instanceof Error ? error.message : "Não foi possível validar a sessão." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ success: false, error: "Origem inválida para encerrar a sessão." }, { status: 403 });
  }

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
