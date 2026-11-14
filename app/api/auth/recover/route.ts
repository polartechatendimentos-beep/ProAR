import { AuthRequestError, readAuthBody, authString } from "../../../../lib/auth-request-security";
import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { tenantSlugFromHost } from "../../../../lib/tenant-host";

const generic = { accepted: true, message: "Se os dados corresponderem a uma conta ativa, as instruções de recuperação serão enviadas." };
const hash = (value:string) => createHash("sha256").update(value).digest("hex");

async function handlePost(request: NextRequest) {
  const body = await readAuthBody(request);
  if (!supabaseConfigured()) return NextResponse.json(generic);
  const identifier = authString(body, "identifier", 180).trim().toLowerCase();
  const tenant = tenantSlugFromHost(request.headers.get("host")) || authString(body, "tenant", 80).trim().toLowerCase();
  if (!identifier || !tenant) return NextResponse.json(generic);

  const companyResponse = await supabaseRest(`proar_companies?select=id,slug,email,status&slug=eq.${encodeURIComponent(tenant)}&limit=1`);
  const companies = companyResponse.ok ? await companyResponse.json() : [];
  const company = companies[0];
  if (!company || company.status !== "active") return NextResponse.json(generic);

  let userResponse = await supabaseRest(`proar_trial_users?select=username,active,role&company_id=eq.${encodeURIComponent(company.id)}&username=eq.${encodeURIComponent(identifier)}&limit=1`);
  let users = userResponse.ok ? await userResponse.json() : [];
  if (!users.length && identifier.includes("@") && String(company.email || "").toLowerCase() === identifier) {
    userResponse = await supabaseRest(`proar_trial_users?select=username,active,role&company_id=eq.${encodeURIComponent(company.id)}&role=eq.Administrador&active=eq.true&limit=1`);
    users = userResponse.ok ? await userResponse.json() : [];
  }
  const user = users[0];
  if (!user?.active) return NextResponse.json(generic);

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hash(token);
  const expiresAt = new Date(Date.now()+30*60*1000).toISOString();
  const id = `password-reset-${tokenHash}`;
  const saved = await supabaseRest("proar_state?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id,payload:{companyId:company.id,companySlug:company.slug,username:user.username,tokenHash,expiresAt,used:false,createdAt:new Date().toISOString()},updated_at:new Date().toISOString()})});
  if (!saved.ok) return NextResponse.json(generic);

  const webhook = process.env.PROAR_PASSWORD_RESET_WEBHOOK_URL?.trim();
  if (webhook) {
    const origin = `https://${tenant}.${process.env.PROAR_ROOT_DOMAIN || "proar.online"}`;
    await fetch(webhook,{method:"POST",headers:{"Content-Type":"application/json",...(process.env.PROAR_PASSWORD_RESET_WEBHOOK_TOKEN?{Authorization:`Bearer ${process.env.PROAR_PASSWORD_RESET_WEBHOOK_TOKEN}`}:{})},body:JSON.stringify({to:identifier.includes("@")?identifier:company.email,company:company.slug,username:user.username,resetUrl:`${origin}/redefinir-senha?token=${encodeURIComponent(token)}`,expiresAt}),cache:"no-store"}).catch(()=>null);
  }
  return NextResponse.json(generic);
}

export async function POST(request: NextRequest) {
  try { return await handlePost(request); }
  catch (error) {
    if (error instanceof AuthRequestError) return NextResponse.json({error:error.message}, {status:error.status});
    return NextResponse.json({error:"Não foi possível processar a solicitação."}, {status:500});
  }
}
