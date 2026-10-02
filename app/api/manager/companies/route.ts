import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../lib/manager-auth";
import { databaseFetch, neonEnabled, supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { resumeTenantProvisioning } from "../../../../lib/tenant-provisioning";
import { tenantIdentity } from "../../../../lib/tenant-identity";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
const isAdmin = (request: NextRequest) => readManagerSession(request);

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Acesso restrito ao ProAR Manager." }, { status: 403 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Banco mestre não configurado." }, { status: 503 });
  const companies = await supabaseRest("proar_companies?select=*&order=created_at.desc");
  const instances = await supabaseRest("proar_tenant_instances?select=*&order=created_at.desc");
  if (!companies.ok) return NextResponse.json({ error: "Falha ao consultar empresas." }, { status: 502 });
  const companyRows = await companies.json();
  const instanceRows = instances.ok ? await instances.json() : [];
  const primaryCompanyId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
  const primarySlug = process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech";
  const enrichedCompanies = companyRows.map((company: Record<string,unknown>) => ({
    ...company,
    tenant: tenantIdentity({
      companyId:String(company.id||""),
      slug:String(company.slug||""),
      tradeName:String(company.trade_name||company.legal_name||""),
      primaryCompanyId,
      primarySlug,
    }),
  }));
  return NextResponse.json({ companies: enrichedCompanies, instances: instanceRows });
}

export async function PATCH(request: NextRequest) {
  const user = isAdmin(request); if (!user) return NextResponse.json({ error: "Acesso restrito ao ProAR Manager." }, { status: 403 });
  const body = await request.json(); const companyId = String(body.companyId || "").trim(); if (!companyId) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });
  if (body.registerPrimaryPilot === true) {
    const primaryCompanyId = process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal";
    const primarySlug = process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech";
    if (companyId !== primaryCompanyId) return NextResponse.json({ error:"Somente a empresa principal pode ser consolidada como Tenant 1." }, { status:400 });
    const identity = tenantIdentity({ companyId, slug:primarySlug, tradeName:"PolarTech", primaryCompanyId, primarySlug });
    const provider = neonEnabled() ? "neon" : "supabase";
    const response = await supabaseRest("proar_tenant_instances?on_conflict=company_id", {
      method:"POST",
      headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
      body:JSON.stringify({
        company_id:companyId,
        provider,
        project_name:identity.projectName,
        provisioning_status:"ready",
        provisioning_error:null,
        last_health_at:new Date().toISOString(),
        updated_at:new Date().toISOString(),
      }),
    });
    if (!response.ok) return NextResponse.json({ error:"Não foi possível consolidar o Tenant 1 no registro central." }, { status:502 });
    await supabaseRest("proar_manager_audit", { method:"POST", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({ company_id:companyId, action:"PRIMARY_TENANT_REGISTERED", actor:user.username, details:{ provider, projectName:identity.projectName, databaseName:identity.databaseName } }) });
    return NextResponse.json({ saved:true, tenant:identity });
  }
  if (body.checkTenantHealth === true) {
    const db = await resolveTenantDb(companyId);
    if (!db.url || !db.key) return NextResponse.json({ error:`Banco do tenant ainda não está pronto (${db.provisioningStatus || "indisponível"}).` }, { status:503 });
    try {
      const response = await databaseFetch(`${db.url}/rest/v1/proar_state?select=id&limit=1`, { headers:tenantHeaders(db.key), cache:"no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const checkedAt = new Date().toISOString();
      await supabaseRest(`proar_tenant_instances?company_id=eq.${encodeURIComponent(companyId)}`, { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({ last_health_at:checkedAt, provisioning_error:null, updated_at:checkedAt }) });
      return NextResponse.json({ healthy:true, checkedAt, source:db.source, provider:db.provider, projectName:db.projectName });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao consultar o banco do tenant.";
      await supabaseRest(`proar_tenant_instances?company_id=eq.${encodeURIComponent(companyId)}`, { method:"PATCH", headers:{ Prefer:"return=minimal" }, body:JSON.stringify({ provisioning_error:message, updated_at:new Date().toISOString() }) }).catch(()=>null);
      return NextResponse.json({ error:message }, { status:502 });
    }
  }
  if (body.retryProvisioning === true) {
    try { const result = await resumeTenantProvisioning(companyId); return NextResponse.json({ saved: true, provisioning: result }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao finalizar banco dedicado." }, { status: 502 }); }
  }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (["active","blocked"].includes(body.status)) patch.status = body.status;
  if (typeof body.planCode === "string") patch.plan_code = body.planCode.slice(0, 40);
  if (typeof body.extendTrialDays === "number" && body.extendTrialDays > 0) patch.trial_expires_at = new Date(Date.now() + Math.min(body.extendTrialDays, 365) * 86400000).toISOString();
  if (Array.isArray(body.modules)) patch.modules = body.modules;
  const response = await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(companyId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
  if (!response.ok) return NextResponse.json({ error: "Falha ao atualizar empresa." }, { status: 502 });
  await supabaseRest("proar_manager_audit", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ company_id: companyId, action: "MANAGER_UPDATE", actor: user.username, details: patch }) });
  return NextResponse.json({ saved: true });
}
