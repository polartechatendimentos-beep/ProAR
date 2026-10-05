import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../lib/manager-auth";
import { databaseFetch, neonEnabled, supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";
import { resumeTenantProvisioning } from "../../../../lib/tenant-provisioning";
import { tenantIdentity } from "../../../../lib/tenant-identity";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { managerPlatformInfo } from "../../../../lib/manager-platform";
import { ALL_MANAGER_MODULES, MANAGER_PLANS, managerPlan } from "../../../../lib/manager-plans";
import { getBillingCompany, setCompanyModuleEntitlements, syncCompanyBillingAccess, syncPlanEntitlements } from "../../../../lib/manager-billing";

const isAdmin = (request: NextRequest) => readManagerSession(request);

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) return NextResponse.json({ error: "Acesso restrito ao ProAR Manager." }, { status: 403 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Banco mestre não configurado." }, { status: 503 });
  const companies = await supabaseRest("proar_companies?select=*&order=created_at.desc");
  const instances = await supabaseRest("proar_tenant_instances?select=*&order=created_at.desc");
  const audit = await supabaseRest("proar_manager_audit?select=*&order=created_at.desc&limit=60");
  const entitlementsResponse = await supabaseRest("proar_manager_module_entitlements?select=*&order=module_name.asc").catch(()=>null);
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
  const auditRows = audit.ok ? await audit.json() : [];
  const entitlementRows = entitlementsResponse?.ok ? await entitlementsResponse.json() : [];
  const now = Date.now();
  const summary = {
    total: enrichedCompanies.length,
    active: enrichedCompanies.filter((company: Record<string,unknown>) => company.status === "active").length,
    blocked: enrichedCompanies.filter((company: Record<string,unknown>) => company.status !== "active").length,
    billingBlocked: enrichedCompanies.filter((company: Record<string,unknown>) => company.access_block_source === "billing").length,
    manualBlocked: enrichedCompanies.filter((company: Record<string,unknown>) => company.access_block_source === "manual").length,
    trials: enrichedCompanies.filter((company: Record<string,unknown>) => !company.plan_code || company.plan_code === "trial").length,
    expiringTrials: enrichedCompanies.filter((company: Record<string,unknown>) => {
      if (!company.trial_expires_at) return false;
      const remaining = new Date(String(company.trial_expires_at)).getTime() - now;
      return remaining >= 0 && remaining <= 3 * 86400000;
    }).length,
    readyDatabases: instanceRows.filter((instance: Record<string,unknown>) => instance.provisioning_status === "ready").length,
    databaseErrors: instanceRows.filter((instance: Record<string,unknown>) => instance.provisioning_status === "error" || Boolean(instance.provisioning_error)).length,
    pendingDatabases: instanceRows.filter((instance: Record<string,unknown>) => !["ready","error"].includes(String(instance.provisioning_status || ""))).length,
    staleHealth: instanceRows.filter((instance: Record<string,unknown>) => {
      if (!instance.last_health_at) return true;
      return now - new Date(String(instance.last_health_at)).getTime() > 24 * 60 * 60 * 1000;
    }).length,
  };
  return NextResponse.json({ companies: enrichedCompanies, instances: instanceRows, audit: auditRows, entitlements: entitlementRows, moduleCatalog: ALL_MANAGER_MODULES, summary, platform: managerPlatformInfo(), plans: MANAGER_PLANS });
}

export async function PATCH(request: NextRequest) {
  const user = isAdmin(request);
  if (!user) return NextResponse.json({ error: "Acesso restrito ao ProAR Manager." }, { status: 403 });
  const body = await request.json();
  const companyId = String(body.companyId || "").trim();
  if (!companyId) return NextResponse.json({ error: "Empresa não informada." }, { status: 400 });

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
    try {
      const result = await resumeTenantProvisioning(companyId);
      return NextResponse.json({ saved:true, provisioning:result });
    } catch (error) {
      return NextResponse.json({ error:error instanceof Error ? error.message : "Falha ao finalizar banco dedicado." }, { status:502 });
    }
  }

  const current = await getBillingCompany(companyId).catch(()=>null);
  const targetPlan = typeof body.planCode === "string" ? managerPlan(body.planCode).code : String(current?.plan_code || "trial");
  if (body.status === "active" && targetPlan === "trial" && current?.trial_expires_at && new Date(current.trial_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error:"O trial está vencido. Converta a empresa para um plano pago ou prorrogue o período de teste antes de liberar." }, { status:409 });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

  if (body.status === "blocked") {
    patch.status = "blocked";
    patch.access_block_source = "manual";
    patch.access_blocked_at = now;
    patch.suspended_reason = String(body.suspendedReason || "Bloqueio manual realizado pelo ProAR Manager.").slice(0,240);
  } else if (body.status === "active") {
    patch.status = "active";
    patch.access_block_source = null;
    patch.access_blocked_at = null;
    patch.suspended_reason = null;
  }

  if (typeof body.planCode === "string") {
    const plan=managerPlan(body.planCode);
    patch.plan_code=plan.code;
    if (body.keepCustomModules !== true) patch.modules=plan.modules;
  }
  if (typeof body.extendTrialDays === "number" && body.extendTrialDays > 0) {
    const anchor = current?.trial_expires_at && new Date(current.trial_expires_at).getTime() > Date.now()
      ? new Date(current.trial_expires_at).getTime()
      : Date.now();
    patch.trial_expires_at = new Date(anchor + Math.min(body.extendTrialDays,365) * 86400000).toISOString();
    if (current?.access_block_source === "trial") {
      patch.status = "active";
      patch.access_block_source = null;
      patch.access_blocked_at = null;
      patch.suspended_reason = null;
    }
  }
  if (Array.isArray(body.modules)) patch.modules = body.modules;

  if (typeof body.billingEnabled === "boolean") patch.billing_enabled = body.billingEnabled;
  if (typeof body.monthlyFeeCents === "number" && Number.isFinite(body.monthlyFeeCents)) patch.monthly_fee_cents = Math.max(0,Math.round(body.monthlyFeeCents));
  if (typeof body.billingDay === "number" && Number.isInteger(body.billingDay)) patch.billing_day = Math.max(1,Math.min(28,body.billingDay));
  if (typeof body.billingIssueLeadDays === "number" && Number.isInteger(body.billingIssueLeadDays)) patch.billing_issue_lead_days = Math.max(0,Math.min(20,body.billingIssueLeadDays));
  if (body.billingMethod === "pix" || body.billingMethod === "boleto" || body.billingMethod === "card") patch.billing_method = body.billingMethod;
  if (typeof body.billingAutoBlock === "boolean") patch.billing_auto_block = body.billingAutoBlock;
  if (typeof body.billingEmail === "string") patch.billing_email = body.billingEmail.trim().slice(0,160) || null;

  const response = await supabaseRest(`proar_companies?id=eq.${encodeURIComponent(companyId)}`, {
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify(patch),
  });
  if (!response.ok) return NextResponse.json({ error:"Falha ao atualizar empresa." }, { status:502 });

  await supabaseRest("proar_manager_audit", {
    method:"POST",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({company_id:companyId,action:"MANAGER_UPDATE",actor:user.username,details:patch}),
  });

  if (Array.isArray(body.moduleEntitlements)) {
    const planCode=String(body.planCode || patch.plan_code || current?.plan_code || "trial");
    await setCompanyModuleEntitlements(companyId,body.moduleEntitlements.map((item:Record<string,unknown>)=>({
      moduleName:String(item.moduleName||"").trim(),
      enabled:Boolean(item.enabled),
      monthlyPriceCents:Math.max(0,Math.round(Number(item.monthlyPriceCents)||0)),
    })).filter((item:{moduleName:string})=>ALL_MANAGER_MODULES.includes(item.moduleName)),planCode,user.username);
  } else if (typeof body.planCode === "string") {
    const plan=managerPlan(body.planCode);
    await syncPlanEntitlements(companyId,plan.code,plan.modules,user.username);
  }

  const touchesBilling = ["billingEnabled","monthlyFeeCents","billingDay","billingIssueLeadDays","billingMethod","billingAutoBlock","billingEmail","status","planCode","extendTrialDays"].some(key=>Object.prototype.hasOwnProperty.call(body,key));
  let access = null;
  if (touchesBilling) access = await syncCompanyBillingAccess(companyId,user.username).catch(()=>null);

  return NextResponse.json({ saved:true, access });
}
