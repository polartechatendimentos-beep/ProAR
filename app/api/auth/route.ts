import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession, readSession } from "../../../lib/proar-auth";

const COOKIE_NAME = "proar_session";

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get(COOKIE_NAME)?.value);
  return user
    ? NextResponse.json({ authenticated: true, username: user.username, displayName: user.displayName })
    : NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const { username = "", password = "" } = await request.json();
  const user = authenticate(String(username), String(password));
  if (!user) return NextResponse.json({ error: "Utilizador ou senha inválidos." }, { status: 401 });
  const response = NextResponse.json({ authenticated: true, username: user.username, displayName: user.displayName });
  response.cookies.set(COOKIE_NAME, createSession(user.username), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
