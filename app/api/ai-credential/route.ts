import { NextRequest, NextResponse } from "next/server";
import { encryptTenantSecret } from "../../../lib/tenant-crypto";
import { getOpenAiCredential, openAiIntegrationId, readStoredOpenAiIntegration, safeCompanyId } from "../../../lib/openai-credential";
import { readSession } from "../../../lib/proar-auth";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";

const COOKIE_NAME = "proar_session";
function adminContext(request: NextRequest) {
  const session = readSession(request.cookies.get(COOKIE_NAME)?.value);
  if (!session) return { error: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }) };
  if (session.role !== "Administrador" && !session.permissions?.includes("*")) return { error: NextResponse.json({ error: "Apenas administradores podem configurar a IA." }, { status: 403 }) };
  const requested = safeCompanyId(request.nextUrl.searchParams.get("company") || session.companyId);
  if (session.companyId && safeCompanyId(session.companyId) !== requested) return { error: NextResponse.json({ error: "Empresa não autorizada." }, { status: 403 }) };
  return { session, companyId: requested };
}
async function save(companyId: string, payload: Record<string, unknown>) {
  const db = await resolveTenantDb(companyId); if (!db.url || !db.key) return false;
  const response = await fetch(`${db.url}/rest/v1/proar_state?on_conflict=id`, { method:"POST", headers:{...tenantHeaders(db.key), Prefer:"resolution=merge-duplicates,return=minimal"}, body:JSON.stringify({id:openAiIntegrationId(companyId),payload,updated_at:new Date().toISOString()}) });
  return response.ok;
}
export async function GET(request: NextRequest) {
  const context=adminContext(request); if("error" in context)return context.error;
  const stored=await readStoredOpenAiIntegration(context.companyId);
  return NextResponse.json({configured:Boolean(stored?.enabled&&stored.encrypted_api_key),last4:stored?.key_last4||null,fallbackConfigured:Boolean(process.env.OPENAI_API_KEY),source:stored?.enabled?"company":process.env.OPENAI_API_KEY?"environment":"none"});
}
export async function PUT(request: NextRequest) {
  const context=adminContext(request); if("error" in context)return context.error;
  const body=await request.json().catch(()=>({})); const apiKey=String(body.apiKey||"").trim();
  if(apiKey.length<20)return NextResponse.json({error:"Informe uma chave de API válida."},{status:400});
  const now=new Date().toISOString(); const ok=await save(context.companyId,{provider:"openai",encrypted_api_key:encryptTenantSecret(apiKey),key_last4:apiKey.slice(-4),enabled:true,created_at:now,updated_at:now,updated_by:context.session.displayName||context.session.username});
  return ok?NextResponse.json({configured:true,last4:apiKey.slice(-4)}):NextResponse.json({error:"Não foi possível salvar a credencial."},{status:502});
}
export async function POST(request: NextRequest) {
  const context=adminContext(request); if("error" in context)return context.error;
  const credential=await getOpenAiCredential(context.companyId); if(!credential)return NextResponse.json({error:"Configure a IA em Configurações → Inteligência Artificial."},{status:503});
  const response=await fetch("https://api.openai.com/v1/models",{headers:{Authorization:`Bearer ${credential.apiKey}`},cache:"no-store"});
  return response.ok?NextResponse.json({connected:true,message:"✓ Conexão realizada",source:credential.source}):NextResponse.json({error:"A OpenAI recusou a credencial. Confira a chave e o projeto."},{status:400});
}
export async function DELETE(request: NextRequest) {
  const context=adminContext(request); if("error" in context)return context.error;
  const current=await readStoredOpenAiIntegration(context.companyId); const now=new Date().toISOString();
  const ok=await save(context.companyId,{provider:"openai",encrypted_api_key:"",key_last4:current?.key_last4||null,enabled:false,created_at:now,updated_at:now,updated_by:context.session.displayName||context.session.username});
  return ok?NextResponse.json({configured:false,last4:null}):NextResponse.json({error:"Não foi possível remover a credencial."},{status:502});
}
