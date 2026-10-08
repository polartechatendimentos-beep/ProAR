import { NextRequest, NextResponse } from "next/server";
import { databaseFetch } from "../../../lib/supabase-rest";
import { requirePermission, sessionCompany } from "../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";
import { mutateWorkExternalAccess, type WorkExternalAccessMutation, type WorkExternalAccessRecord } from "../../../lib/work-external-access";

const safe = (value: unknown, fallback: string) =>
  String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || fallback;

const projectsStateId = (company: string, dedicated: boolean) =>
  dedicated ? "workprojects" : `workprojects-${safe(company, "company")}`;

const accessStateId = (company: string, workId: string, dedicated: boolean) =>
  dedicated
    ? `work-access-${safe(workId, "work")}`
    : `work-access-${safe(company, "company")}-${safe(workId, "work")}`;

type AccessStatePayload = {
  companyId: string;
  workId: string;
  externalAccess: WorkExternalAccessRecord[];
  revision: number;
  updatedAt: string;
  updatedBy: string;
};

async function readState(url: string, key: string, id: string) {
  try {
    const response = await databaseFetch(
      `${url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`,
      { headers: tenantHeaders(key), cache: "no-store" },
    );
    if (!response.ok) {
      console.error("WORK_EXTERNAL_ACCESS_STATE_READ_FAILED", { id, status: response.status });
      return { ok: false as const, payload: null };
    }
    const rows = await response.json() as { payload?: Record<string, unknown> }[];
    return { ok: true as const, payload: rows[0]?.payload ?? null };
  } catch (error) {
    console.error("WORK_EXTERNAL_ACCESS_STATE_READ_EXCEPTION", { id, message: error instanceof Error ? error.message : String(error) });
    return { ok: false as const, payload: null };
  }
}

async function legacyAccess(
  url: string,
  key: string,
  company: string,
  dedicated: boolean,
  workId: string,
): Promise<WorkExternalAccessRecord[]> {
  const state = await readState(url, key, projectsStateId(company, dedicated));
  const projects = Array.isArray(state.payload?.projects) ? state.payload?.projects as Record<string, unknown>[] : [];
  const project = projects.find(item => String(item.id || "") === workId);
  return Array.isArray(project?.externalAccess)
    ? project.externalAccess as WorkExternalAccessRecord[]
    : [];
}

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, "obras.visualizar");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const workId = String(request.nextUrl.searchParams.get("workId") || "").trim();
  if (!workId) {
    return NextResponse.json(
      { error: "Informe a obra.", code: "WORK_EXTERNAL_ACCESS_WORK_REQUIRED" },
      { status: 400 },
    );
  }

  const scope = sessionCompany(auth.session, request.nextUrl.searchParams.get("company"));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const db = await resolveTenantDb(scope.companyId).catch(error => { console.error("WORK_EXTERNAL_ACCESS_TENANT_RESOLUTION_FAILED", error); return null; });
  if (!db?.url || !db.key) {
    return NextResponse.json(
      { error: "Base de dados indisponível.", code: "WORK_EXTERNAL_ACCESS_DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const id = accessStateId(scope.companyId, workId, db.dedicated);
  const state = await readState(db.url, db.key, id);
  if (!state.ok) {
    return NextResponse.json(
      { error: "Não foi possível consultar os acessos externos.", code: "WORK_EXTERNAL_ACCESS_LOAD_FAILED" },
      { status: 502 },
    );
  }

  if (state.payload) {
    return NextResponse.json({
      workId,
      externalAccess: Array.isArray(state.payload.externalAccess) ? state.payload.externalAccess : [],
      revision: Number(state.payload.revision || 0),
      dedicatedDatabase: db.dedicated,
      source: "dedicated",
    });
  }

  const fallback = await legacyAccess(db.url, db.key, scope.companyId, db.dedicated, workId);
  return NextResponse.json({
    workId,
    externalAccess: fallback,
    revision: 0,
    dedicatedDatabase: db.dedicated,
    source: fallback.length ? "legacy" : "empty",
  });
}

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, "obras.editar");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as (WorkExternalAccessMutation & { companyId?: string }) | null;
  if (!body || !["external_access_add", "external_access_toggle"].includes(String(body.action))) {
    return NextResponse.json(
      { error: "Ação de acesso externo inválida.", code: "WORK_EXTERNAL_ACCESS_ACTION_INVALID" },
      { status: 400 },
    );
  }

  const workId = String(body.workId || "").trim();
  if (!workId) {
    return NextResponse.json(
      { error: "Obra não identificada.", code: "WORK_EXTERNAL_ACCESS_WORK_REQUIRED" },
      { status: 400 },
    );
  }

  const scope = sessionCompany(auth.session, body.companyId);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const db = await resolveTenantDb(scope.companyId);
  if (!db.url || !db.key) {
    return NextResponse.json(
      { error: "Base de dados indisponível.", code: "WORK_EXTERNAL_ACCESS_DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const id = accessStateId(scope.companyId, workId, db.dedicated);
  const state = await readState(db.url, db.key, id);
  if (!state.ok) {
    return NextResponse.json(
      { error: "Não foi possível carregar os acessos antes de salvar.", code: "WORK_EXTERNAL_ACCESS_LOAD_FAILED" },
      { status: 502 },
    );
  }

  const existing = state.payload
    ? (Array.isArray(state.payload.externalAccess) ? state.payload.externalAccess as WorkExternalAccessRecord[] : [])
    : await legacyAccess(db.url, db.key, scope.companyId, db.dedicated, workId);

  const mutation = mutateWorkExternalAccess(
    [{ id: workId, externalAccess: existing }],
    body as WorkExternalAccessMutation,
  );

  if (!mutation.ok) {
    return NextResponse.json(
      { error: mutation.error, code: mutation.code },
      { status: mutation.status },
    );
  }

  const currentRevision = Number(state.payload?.revision || 0);
  if (!mutation.changed) {
    return NextResponse.json({
      saved: true,
      unchanged: true,
      workId,
      externalAccess: mutation.externalAccess,
      revision: currentRevision,
      dedicatedDatabase: db.dedicated,
    });
  }

  const now = new Date().toISOString();
  const payload: AccessStatePayload = {
    companyId: scope.companyId,
    workId,
    externalAccess: mutation.externalAccess,
    revision: currentRevision + 1,
    updatedAt: now,
    updatedBy: auth.session.username,
  };

  let saveResponse: Response;
  try {
    saveResponse = await databaseFetch(
      `${db.url}/rest/v1/proar_state?on_conflict=id`,
      {
        method: "POST",
        headers: {
          ...tenantHeaders(db.key),
          Prefer: "resolution=merge-duplicates,return=minimal",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id,
          payload,
          updated_by: auth.session.username,
          updated_at: now,
        }),
      },
    );
  } catch (error) {
    console.error("WORK_EXTERNAL_ACCESS_DATABASE_WRITE_EXCEPTION", {
      companyId: scope.companyId, workId,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      error: "A conexão com o banco falhou ao cadastrar o acesso. Nenhuma alteração foi confirmada.",
      code: "WORK_EXTERNAL_ACCESS_DATABASE_WRITE_EXCEPTION",
    }, { status: 503 });
  }

  if (!saveResponse.ok) {
    const detail = await saveResponse.text().catch(() => "");
    console.error("WORK_EXTERNAL_ACCESS_SAVE_FAILED", {
      companyId: scope.companyId,
      workId,
      status: saveResponse.status,
      detail: detail.slice(0, 500),
    });
    return NextResponse.json(
      {
        error: "Não foi possível salvar o acesso externo no banco de dados.",
        code: "WORK_EXTERNAL_ACCESS_SAVE_FAILED",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    saved: true,
    workId,
    externalAccess: mutation.externalAccess,
    revision: payload.revision,
    dedicatedDatabase: db.dedicated,
  });
}
