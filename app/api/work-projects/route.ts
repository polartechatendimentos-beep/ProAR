import { databaseFetch } from "../../../lib/supabase-rest";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";
import { mutateWorkExternalAccess, type WorkExternalAccessMutation } from "../../../lib/work-external-access";
const safeCompany = (value: unknown) => String(value || "polartech-principal").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "polartech-principal";
const stateId = (company: string, dedicated: boolean) => dedicated ? "workprojects" : `workprojects-${safeCompany(company)}`;
export async function GET(request: NextRequest) {
  const auth=requirePermission(request,"obras.visualizar"); if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
  const scope=sessionCompany(auth.session,request.nextUrl.searchParams.get("company")); if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status});
  const company=scope.companyId; const db=await resolveTenantDb(company); if(!db.url||!db.key)return NextResponse.json({error:"Base de dados indisponível."},{status:503});
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId(company,db.dedicated))}&select=payload`,{headers:tenantHeaders(db.key),cache:"no-store"}); if(!response.ok)return NextResponse.json({error:"Não foi possível carregar as obras."},{status:502});
  const rows=await response.json() as {payload?:Record<string,unknown>}[]; return NextResponse.json({state:rows[0]?.payload??null,dedicatedDatabase:db.dedicated});
}
export async function PUT(request: NextRequest) {
  const auth=requirePermission(request,"obras.editar"); if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status}); const body=await request.json(); const scope=sessionCompany(auth.session,body.companyId); if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status}); const company=scope.companyId; const db=await resolveTenantDb(company); if(!db.url||!db.key)return NextResponse.json({error:"Base de dados indisponível."},{status:503});
  const id=stateId(company,db.dedicated), h=tenantHeaders(db.key); const currentResponse=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`,{headers:h,cache:"no-store"}); const currentRows=currentResponse.ok?await currentResponse.json() as {payload?:{revision?:number;projects?:unknown[]}}[]:[]; const current=currentRows[0]?.payload; const currentRevision=Number(current?.revision||0); const baseRevision=Number(body.baseRevision||0);
  if(current&&baseRevision!==currentRevision)return NextResponse.json({error:"A lista de obras possui uma versão mais recente.",conflict:true,state:current},{status:409}); const payload={companyId:company,projects:Array.isArray(body.projects)?body.projects:[],revision:currentRevision+1,updatedAt:new Date().toISOString(),updatedBy:auth.session.username};
  const saveResponse=await databaseFetch(`${db.url}/rest/v1/proar_state?on_conflict=id`,{method:"POST",headers:{...h,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id,payload,updated_by:auth.session.username,updated_at:new Date().toISOString()})}); return saveResponse.ok?NextResponse.json({saved:true,state:payload,dedicatedDatabase:db.dedicated}):NextResponse.json({error:"Não foi possível salvar as obras."},{status:502});
}

export async function PATCH(request: NextRequest) {
  const auth = requirePermission(request, "obras.editar");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as (WorkExternalAccessMutation & { companyId?: string; baseRevision?: number }) | null;
  if (!body || !["external_access_add", "external_access_toggle"].includes(String(body.action))) {
    return NextResponse.json(
      { error: "Ação de acesso externo inválida.", code: "WORK_EXTERNAL_ACCESS_ACTION_INVALID" },
      { status: 400 },
    );
  }

  const scope = sessionCompany(auth.session, body.companyId);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const company = scope.companyId;
  const tenantDb = await resolveTenantDb(company);
  if (!tenantDb.url || !tenantDb.key) {
    return NextResponse.json(
      { error: "Base de dados indisponível.", code: "WORK_PROJECTS_DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const id = stateId(company, tenantDb.dedicated);
  const h = tenantHeaders(tenantDb.key);
  const currentResponse = await databaseFetch(
    `${tenantDb.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`,
    { headers: h, cache: "no-store" },
  );

  if (!currentResponse.ok) {
    return NextResponse.json(
      { error: "Não foi possível carregar a obra para atualizar o acesso.", code: "WORK_PROJECTS_LOAD_FAILED" },
      { status: 502 },
    );
  }

  const currentRows = await currentResponse.json() as { payload?: { revision?: number; projects?: unknown[]; [key: string]: unknown } }[];
  const current = currentRows[0]?.payload;
  if (!current || !Array.isArray(current.projects)) {
    return NextResponse.json(
      { error: "Cadastro de obras não encontrado.", code: "WORK_PROJECTS_NOT_FOUND" },
      { status: 404 },
    );
  }

  const currentRevision = Number(current.revision || 0);
  const baseRevision = Number(body.baseRevision || 0);
  if (baseRevision !== currentRevision) {
    return NextResponse.json(
      {
        error: "A lista de obras possui uma versão mais recente.",
        code: "WORK_PROJECTS_REVISION_CONFLICT",
        conflict: true,
        revision: currentRevision,
      },
      { status: 409 },
    );
  }

  const mutation = mutateWorkExternalAccess(current.projects, body as WorkExternalAccessMutation);
  if (!mutation.ok) {
    return NextResponse.json(
      { error: mutation.error, code: mutation.code },
      { status: mutation.status },
    );
  }

  if (!mutation.changed) {
    return NextResponse.json({
      saved: true,
      unchanged: true,
      revision: currentRevision,
      workId: body.workId,
      externalAccess: mutation.externalAccess,
      dedicatedDatabase: tenantDb.dedicated,
    });
  }

  const nextRevision = currentRevision + 1;
  const now = new Date().toISOString();
  const payload = {
    ...current,
    companyId: company,
    projects: mutation.projects,
    revision: nextRevision,
    updatedAt: now,
    updatedBy: auth.session.username,
  };

  const saveResponse = await databaseFetch(
    `${tenantDb.url}/rest/v1/proar_state?on_conflict=id`,
    {
      method: "POST",
      headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id, payload, updated_by: auth.session.username, updated_at: now }),
    },
  );

  if (!saveResponse.ok) {
    return NextResponse.json(
      {
        error: "Não foi possível salvar o acesso externo da obra.",
        code: "WORK_EXTERNAL_ACCESS_SAVE_FAILED",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    saved: true,
    revision: nextRevision,
    workId: body.workId,
    externalAccess: mutation.externalAccess,
    dedicatedDatabase: tenantDb.dedicated,
  });
}

