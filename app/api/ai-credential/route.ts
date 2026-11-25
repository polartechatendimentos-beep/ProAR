import { databaseFetch } from "../../../lib/supabase-rest";
import { NextRequest, NextResponse } from "next/server";
import { encryptTenantSecret } from "../../../lib/tenant-crypto";
import { getOpenAiCredential, openAiIntegrationId, readStoredOpenAiIntegration, safeCompanyId } from "../../../lib/openai-credential";
import { readSession } from "../../../lib/proar-auth";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";

async function adminContext(request: NextRequest) {
  const session = await readSession(request.cookies.get("proar_session")?.value);
  if (!session) return { error: NextResponse.json({ error: "Sessão inválida." }, { status: 401 }) };
  if (session.role !== "Administrador") return { error: NextResponse.json({ error: "Apenas administradores podem configurar a IA." }, { status: 403 }) };
  const requested = safeCompanyId(request.nextUrl.searchParams.get("company") || session.companyId);
  if (session.companyId && safeCompanyId(session.companyId) !== requested) return { error: NextResponse.json({ error: "Empresa não autorizada." }, { status: 403 }) };
  return { session, companyId: requested };
}
async function save(companyId: string, payload: Record<string, unknown>) {
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) return false;
  const response = await databaseFetch(`${db.url}/rest/v1/proar_state?on_conflict=id`, {
    method: "POST",
    headers: { ...tenantHeaders(db.key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: openAiIntegrationId(companyId), payload, updated_at: new Date().toISOString() })
  });
  return response.ok;
}
export async function GET(request: NextRequest) {
  const context = await adminContext(request);
  if ("error" in context) return context.error;
  const stored = await readStoredOpenAiIntegration(context.companyId);
  return NextResponse.json({
    configured: Boolean(stored?.enabled && stored.encrypted_api_key),
    last4: stored?.key_last4 || null,
    fallbackConfigured: Boolean(process.env.OPENAI_API_KEY),
    source: stored?.enabled ? "company" : process.env.OPENAI_API_KEY ? "environment" : "none",
    validationStatus: stored?.validation_status || "pending",
    validationMessage: stored?.validation_message || null,
    validatedAt: stored?.validated_at || null,
    validationSource: stored?.validation_source || null
  }, { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(request: NextRequest) {
  const context = await adminContext(request);
  if ("error" in context) return context.error;
  const body = await request.json().catch(() => ({}));
  const apiKey = String(body.apiKey || "").trim();
  if (apiKey.length < 20) return NextResponse.json({ error: "Informe uma chave de API válida." }, { status: 400 });
  const now = new Date().toISOString();
  const ok = await save(context.companyId, {
    provider: "openai",
    encrypted_api_key: encryptTenantSecret(apiKey),
    key_last4: apiKey.slice(-4),
    enabled: true,
    validation_status: "pending",
    validation_message: "Chave salva. Teste a conexão para validar o acesso.",
    validated_at: null,
    validation_source: null,
    created_at: now,
    updated_at: now,
    updated_by: context.session.displayName || context.session.username
  });
  return ok
    ? NextResponse.json({ configured: true, last4: apiKey.slice(-4), validationStatus: "pending", validatedAt: null })
    : NextResponse.json({ error: "Não foi possível salvar a credencial." }, { status: 502 });
}
export async function POST(request: NextRequest) {
  const context = await adminContext(request);
  if ("error" in context) return context.error;
  const existing = await readStoredOpenAiIntegration(context.companyId);
  const credential = await getOpenAiCredential(context.companyId);
  if (existing?.enabled && credential?.source !== "company") return NextResponse.json({ error:"Não foi possível abrir a credencial da empresa. Não foi usada outra chave.", validationStatus:"failed" }, { status: 503 });
  if (!credential) return NextResponse.json({ error: "Configure a IA em Configurações → Inteligência Artificial.", validationStatus: "pending" }, { status: 503 });

  let connected = false;
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${credential.apiKey}` },
      cache: "no-store", signal: AbortSignal.timeout(10000)
    });
    connected = response.ok;
  } catch {}

  const validatedAt = connected ? new Date().toISOString() : null;
  const validationStatus = connected ? "valid" : "failed";
  const validationMessage = connected
    ? "Conexão validada. A credencial foi aceita pela OpenAI."
    : "A OpenAI recusou a credencial ou não foi possível alcançar o serviço. Confira a chave, o projeto e a conexão.";
  const stored = await readStoredOpenAiIntegration(context.companyId);
  if (existing?.encrypted_api_key !== stored?.encrypted_api_key) return NextResponse.json({ error:"A credencial mudou durante o teste. Atualize a tela e teste novamente." }, { status: 409 });
  const persisted = await save(context.companyId, {
    ...(stored || {}),
    provider: "openai",
    enabled: Boolean(stored?.enabled),
    validation_status: validationStatus,
    validation_message: validationMessage,
    validated_at: validatedAt,
    validation_source: credential.source,
    updated_at: new Date().toISOString(),
    updated_by: context.session.displayName || context.session.username
  }).catch(() => false);

  if (!persisted) return NextResponse.json({error:"Não foi possível registrar o resultado do teste na base da empresa.", validationStatus:"pending"}, {status:502});
  if (!connected) return NextResponse.json({ error: validationMessage, validationStatus, validatedAt: null, persisted }, { status: 400 });
  return NextResponse.json({
    connected: true,
    message: validationMessage,
    validationStatus,
    validatedAt,
    source: credential.source,
    persisted
  });
}
export async function DELETE(request: NextRequest) {
  const context = await adminContext(request);
  if ("error" in context) return context.error;
  const current = await readStoredOpenAiIntegration(context.companyId);
  const now = new Date().toISOString();
  const ok = await save(context.companyId, {
    provider: "openai",
    encrypted_api_key: "",
    key_last4: null,
    enabled: false,
    validation_status: "pending",
    validation_message: "Credencial removida.",
    validated_at: null,
    validation_source: null,
    created_at: current?.created_at || now,
    updated_at: now,
    updated_by: context.session.displayName || context.session.username
  });
  return ok
    ? NextResponse.json({ configured: false, last4: null, validationStatus: "pending", validatedAt: null })
    : NextResponse.json({ error: "Não foi possível remover a credencial." }, { status: 502 });
}
