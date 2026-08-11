import { randomBytes } from "node:crypto";
import { encryptTenantSecret } from "./tenant-crypto";
import { supabaseRest } from "./supabase-rest";

const MANAGEMENT_API = "https://api.supabase.com/v1";
const operationalSchema = `
create table if not exists public.proar_state (
  id text primary key default 'main',
  payload jsonb not null default '{"customers":[],"serviceOrders":[],"moduleRecords":{}}'::jsonb,
  updated_by text,
  updated_at timestamptz not null default now()
);
create table if not exists public.proar_work_projects (
  id text primary key,
  revision bigint not null default 0,
  projects jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.proar_public_work_maps (
  work_id text primary key,
  work_name text,
  title text,
  token text unique,
  revision bigint not null default 0,
  houses jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
`;

async function management(path: string, init: RequestInit = {}) {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  if (!token) throw new Error("SUPABASE_MANAGEMENT_TOKEN não configurado.");
  return fetch(`${MANAGEMENT_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
}

export async function provisionTenant(company: { id: string; slug: string; tradeName: string }) {
  const organizationSlug = process.env.SUPABASE_ORGANIZATION_SLUG;
  if (!organizationSlug || !process.env.SUPABASE_MANAGEMENT_TOKEN) {
    await supabaseRest(`proar_tenant_instances?on_conflict=company_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ company_id: company.id, provider: "supabase", provisioning_status: "manual", provisioning_error: "Configure SUPABASE_MANAGEMENT_TOKEN e SUPABASE_ORGANIZATION_SLUG para provisionamento automático.", updated_at: new Date().toISOString() }),
    });
    return { mode: "manual" as const };
  }

  await supabaseRest(`proar_tenant_instances?on_conflict=company_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ company_id: company.id, provider: "supabase", provisioning_status: "creating", updated_at: new Date().toISOString() }),
  });

  try {
    const dbPass = randomBytes(24).toString("base64url");
    const projectName = `proar-${company.slug}`.slice(0, 48);
    const created = await management("/projects", { method: "POST", body: JSON.stringify({ name: projectName, organization_slug: organizationSlug, db_pass: dbPass }) });
    const project = await created.json();
    if (!created.ok) throw new Error(project?.message || project?.error || "Falha ao criar projeto Supabase.");
    const ref = String(project.ref || project.id || "");
    if (!ref) throw new Error("Supabase não retornou referência do projeto.");

    let status = String(project.status || "");
    for (let attempt = 0; attempt < 3 && !status.includes("HEALTHY"); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 1200));
      const check = await management(`/projects/${ref}`);
      if (check.ok) status = String((await check.json()).status || status);
    }
    if (!status.includes("HEALTHY")) {
      await supabaseRest(`proar_tenant_instances?company_id=eq.${encodeURIComponent(company.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ project_ref: ref, project_name: projectName, provisioning_status: "creating", provisioning_error: null, updated_at: new Date().toISOString() }) });
      return { mode: "creating" as const, projectRef: ref };
    }

    const query = await management(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query: operationalSchema, read_only: false }) });
    if (!query.ok) {
      const body = await query.json().catch(() => ({}));
      throw new Error(body?.message || body?.error || "Projeto criado, mas a estrutura inicial não pôde ser aplicada.");
    }

    const keysResponse = await management(`/projects/${ref}/api-keys?reveal=true`);
    const keys = keysResponse.ok ? await keysResponse.json() : [];
    const secretKey = Array.isArray(keys) ? keys.find((item: { name?: string; type?: string; api_key?: string }) => item.name === "service_role" || item.type === "secret")?.api_key : "";
    if (!secretKey) throw new Error("Projeto criado, mas a chave de servidor não pôde ser obtida.");
    const apiUrl = `https://${ref}.supabase.co`;

    await supabaseRest(`proar_tenant_instances?on_conflict=company_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ company_id: company.id, provider: "supabase", project_ref: ref, project_name: projectName, api_url: apiUrl, encrypted_secret: encryptTenantSecret(String(secretKey)), provisioning_status: "ready", provisioning_error: null, last_health_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    });
    return { mode: "automatic" as const, projectRef: ref, apiUrl };
  } catch (error) {
    await supabaseRest(`proar_tenant_instances?company_id=eq.${encodeURIComponent(company.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ provisioning_status: "error", provisioning_error: error instanceof Error ? error.message : "Falha no provisionamento", updated_at: new Date().toISOString() }),
    });
    throw error;
  }
}

export async function resumeTenantProvisioning(companyId: string) {
  const response = await supabaseRest(`proar_tenant_instances?select=project_ref,project_name&company_id=eq.${encodeURIComponent(companyId)}&limit=1`);
  const rows = response.ok ? await response.json() : []; const instance = rows[0];
  if (!instance?.project_ref) throw new Error("Projeto dedicado ainda não foi criado.");
  const ref = String(instance.project_ref);
  const check = await management(`/projects/${ref}`); const project = check.ok ? await check.json() : null;
  if (!check.ok || !String(project?.status || "").includes("HEALTHY")) return { mode: "creating" as const, projectRef: ref };
  const query = await management(`/projects/${ref}/database/query`, { method: "POST", body: JSON.stringify({ query: operationalSchema, read_only: false }) });
  if (!query.ok) { const body = await query.json().catch(()=>({})); throw new Error(body?.message || body?.error || "Não foi possível inicializar o banco dedicado."); }
  const keysResponse = await management(`/projects/${ref}/api-keys?reveal=true`); const keys = keysResponse.ok ? await keysResponse.json() : [];
  const secretKey = Array.isArray(keys) ? keys.find((item: { name?: string; type?: string; api_key?: string }) => item.name === "service_role" || item.type === "secret")?.api_key : "";
  if (!secretKey) throw new Error("Chave de servidor do banco dedicado não localizada.");
  const apiUrl = `https://${ref}.supabase.co`;
  await supabaseRest(`proar_tenant_instances?company_id=eq.${encodeURIComponent(companyId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ api_url: apiUrl, encrypted_secret: encryptTenantSecret(String(secretKey)), provisioning_status: "ready", provisioning_error: null, last_health_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
  return { mode: "automatic" as const, projectRef: ref, apiUrl };
}
