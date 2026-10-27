import { NextRequest, NextResponse } from "next/server";
import { createManagerSession, MANAGER_COOKIE, readManagerSession, validateManagerCredentials } from "../../../../lib/manager-auth";

export async function GET(request: NextRequest) {
  const session = readManagerSession(request);
  return NextResponse.json({ authenticated: Boolean(session), username: session?.username || null });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(()=>({}));
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (!validateManagerCredentials(username, password)) {
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true, username });
  response.cookies.set(MANAGER_COOKIE, createManagerSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(MANAGER_COOKIE, "", { httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"strict", path:"/", maxAge:0 });
  return response;
}
