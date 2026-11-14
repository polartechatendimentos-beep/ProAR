import { AuthRequestError, assertAuthOrigin, readAuthBody, authString } from "../../../../lib/auth-request-security";
import { NextRequest, NextResponse } from "next/server";
import { createManagerSession, MANAGER_COOKIE, readManagerSession, validateManagerCredentials } from "../../../../lib/manager-auth";

export async function GET(request: NextRequest) {
  const session = readManagerSession(request);
  return NextResponse.json({ authenticated: Boolean(session), username: session?.username || null });
}

async function handlePost(request: NextRequest) {
  const body = await readAuthBody(request);
  const username = authString(body, "username").trim();
  const password = authString(body, "password", 1024);
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

export async function DELETE(request: NextRequest) {
  try { assertAuthOrigin(request); } catch { return NextResponse.json({error:"Origem da solicitação não autorizada."}, {status:403}); }

  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(MANAGER_COOKIE, "", { httpOnly:true, secure:process.env.NODE_ENV==="production", sameSite:"strict", path:"/", maxAge:0 });
  return response;
}

export async function POST(request: NextRequest) {
  try { return await handlePost(request); }
  catch (error) {
    if (error instanceof AuthRequestError) return NextResponse.json({error:error.message}, {status:error.status});
    return NextResponse.json({error:"Não foi possível processar a solicitação."}, {status:500});
  }
}
