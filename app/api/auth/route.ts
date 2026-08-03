import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, senha } = body;

    if (email === "admin@proar.com.br" && senha === "admin") {
      return NextResponse.json({
        success: true,
        user: { id: 1, email, nome: "Administrador ProAR", role: "admin" },
        token: "proar-dummy-session-token",
      });
    }

    return NextResponse.json({ success: false, message: "Credenciais inválidas" }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
