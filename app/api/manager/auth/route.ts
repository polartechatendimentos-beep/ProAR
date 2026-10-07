import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createManagerSession, MANAGER_COOKIE, readManagerSession, validateManagerCredentials } from "../../../../lib/manager-auth";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";


const clientIp=(request:NextRequest)=>String(request.headers.get("x-forwarded-for")||request.headers.get("x-real-ip")||"unknown").split(",")[0].trim();
const ipHash=(request:NextRequest)=>createHash("sha256").update(clientIp(request)).digest("hex");

async function tooManyRecentFailures(request:NextRequest){
  if(!supabaseConfigured())return false;
  const since=new Date(Date.now()-15*60*1000).toISOString();
  const r=await supabaseRest(`proar_manager_login_attempts?select=id&ip_hash=eq.${encodeURIComponent(ipHash(request))}&success=eq.false&created_at=gte.${encodeURIComponent(since)}&limit=5`);
  if(!r.ok)return false;
  const rows=await r.json();
  return Array.isArray(rows)&&rows.length>=5;
}

async function recordAttempt(request:NextRequest,username:string,success:boolean){
  if(!supabaseConfigured())return;
  await supabaseRest("proar_manager_login_attempts",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({ip_hash:ipHash(request),username:username.slice(0,120),success})}).catch(()=>null);
  await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:null,action:success?"MANAGER_LOGIN_SUCCESS":"MANAGER_LOGIN_FAILED",actor:username||"unknown",details:{ipHash:ipHash(request)}})}).catch(()=>null);
}

export async function GET(request: NextRequest) {
  const session = readManagerSession(request);
  return NextResponse.json({ authenticated: Boolean(session), username: session?.username || null });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(()=>({}));
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");
  if (await tooManyRecentFailures(request)) return NextResponse.json({ error:"Muitas tentativas de acesso. Aguarde 15 minutos e tente novamente." }, { status:429 });
  if (!validateManagerCredentials(username, password)) {
    await recordAttempt(request,username,false);
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }
  await recordAttempt(request,username,true);
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
