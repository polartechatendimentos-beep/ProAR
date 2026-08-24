import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";

function safeCompany(value: unknown) { return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80); }
function sessionFor(request: NextRequest) { return readSession(request.cookies.get("proar_session")?.value); }
const PRIMARY_COMPANY_ID = safeCompany(process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal") || "polartech-principal";

function requestedCompany(request: NextRequest) { return safeCompany(request.nextUrl.searchParams.get("company")); }
function companyKey(request: NextRequest, session: ReturnType<typeof sessionFor>) {
  // Tenant autenticado sempre usa exclusivamente o companyId presente na sessão.
  if (session?.companyId) return session.companyId;
  // Instalações legadas de uma única empresa usam um identificador canônico no servidor.
  // Nunca dependemos do localStorage do dispositivo para escolher a base principal.
  return PRIMARY_COMPANY_ID;
}

type StatePayload = Record<string, unknown> & {
  customers?: Array<Record<string, unknown>>;
  serviceOrders?: Array<Record<string, unknown>>;
  moduleRecords?: Record<string, Array<Record<string, unknown>>>;
  _revision?: number;
  _updatedAt?: string;
};

function recordIdentity(record: Record<string, unknown>, fallback: string) {
  const id = String(record.id || "").trim();
  if (id) return `id:${id}`;
  const doc = String(record.doc || record.cnpj || record.cpf || "").replace(/\D/g, "");
  if (doc) return `doc:${doc}`;
  const name = String(record.name || record.client || record.description || fallback).trim().toLocaleLowerCase("pt-BR");
  return `name:${name}`;
}

function mergeArray(base: Array<Record<string, unknown>> = [], extras: Array<Record<string, unknown>> = []) {
  const result = [...base];
  const seen = new Set(result.map((item, index) => recordIdentity(item, String(index))));
  for (const item of extras) {
    const key = recordIdentity(item, String(result.length));
    if (!seen.has(key)) { result.push(item); seen.add(key); }
  }
  return result;
}

function mergeStates(states: StatePayload[]) {
  if (!states.length) return null;
  const sorted = [...states].sort((a, b) => Number(b._revision || 0) - Number(a._revision || 0));
  const base = { ...sorted[0] } as StatePayload;
  let customers = Array.isArray(base.customers) ? [...base.customers] : [];
  let serviceOrders = Array.isArray(base.serviceOrders) ? [...base.serviceOrders] : [];
  const moduleRecords: Record<string, Array<Record<string, unknown>>> = { ...(base.moduleRecords || {}) };
  for (const extra of sorted.slice(1)) {
    customers = mergeArray(customers, Array.isArray(extra.customers) ? extra.customers : []);
    serviceOrders = mergeArray(serviceOrders, Array.isArray(extra.serviceOrders) ? extra.serviceOrders : []);
    for (const [module, records] of Object.entries(extra.moduleRecords || {})) {
      moduleRecords[module] = mergeArray(moduleRecords[module] || [], Array.isArray(records) ? records : []);
    }
  }
  return { ...base, customers, serviceOrders, moduleRecords, _legacyMerged: states.length > 1 };
}

async function readState(db: { url: string; key: string }, id: string) {
  if (!id) return null;
  const response = await fetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: tenantHeaders(db.key), cache: "no-store" });
  if (!response.ok) return null;
  const rows = await response.json() as { payload?: StatePayload }[];
  return rows[0]?.payload ?? null;
}

async function writeState(db: { url: string; key: string }, id: string, payload: StatePayload) {
  const response = await fetch(`${db.url}/rest/v1/proar_state?on_conflict=id`, {
    method: "POST",
    headers: { ...tenantHeaders(db.key), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id, payload, updated_at: new Date().toISOString() }),
  });
  return response.ok;
}

export async function GET(request: NextRequest) {
  const session = sessionFor(request); if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const company = companyKey(request, session); const db = await resolveTenantDb(session.companyId); if (!db.url || !db.key) throw new Error("Banco indisponível");
    const id = db.dedicated ? "main" : company;

    if (session.companyId || db.dedicated) {
      const state = await readState(db, id);
      return NextResponse.json({ state, dedicatedDatabase: db.dedicated, canonicalCompanyId: company });
    }

    // Recuperação compatível de instalações legadas: alguns aparelhos gravavam em IDs diferentes.
    // A leitura une os dados sem excluir nada e consolida no identificador canônico.
    const candidates = Array.from(new Set([id, requestedCompany(request), "main", "polartech-principal"].filter(Boolean)));
    const states: StatePayload[] = [];
    for (const candidate of candidates) {
      const state = await readState(db, candidate);
      if (state) states.push(state);
    }
    const merged = mergeStates(states);
    if (merged && states.length > 1) {
      const revision = Math.max(...states.map(state => Number(state._revision || 0)), 0) + 1;
      const consolidated = { ...merged, _revision: revision, _updatedAt: new Date().toISOString(), _companyId: company, _legacyMerged: true };
      await writeState(db, id, consolidated);
      return NextResponse.json({ state: consolidated, dedicatedDatabase: false, canonicalCompanyId: company, recoveredLegacyStates: states.length });
    }
    return NextResponse.json({ state: merged, dedicatedDatabase: false, canonicalCompanyId: company });
  } catch { return NextResponse.json({ error: "Não foi possível carregar a base compartilhada." }, { status: 503 }); }
}

export async function PUT(request: NextRequest) {
  const session = sessionFor(request); if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json(); const company = companyKey(request, session); const db = await resolveTenantDb(session.companyId); if (!db.url || !db.key) throw new Error("Banco indisponível");
    const id = db.dedicated ? "main" : company; const authHeaders = tenantHeaders(db.key);
    const currentResponse = await fetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: authHeaders, cache: "no-store" });
    const currentRows = currentResponse.ok ? await currentResponse.json() as { payload?: StatePayload }[] : []; const current = currentRows[0]?.payload; const currentRevision = Number(current?._revision || 0); const baseRevision = Number(body._baseRevision || 0);
    if (current && !body._force && baseRevision !== currentRevision) return NextResponse.json({ error: "A base online possui uma versão mais recente.", conflict: true, state: current }, { status: 409 });
    const { _baseRevision: _ignoredBase, _force: _ignoredForce, companyId: _ignoredCompany, ...cleanBody } = body;
    const payload = { ...cleanBody, _revision: currentRevision + 1, _updatedAt: new Date().toISOString(), _companyId: company };
    const updatedAt = new Date().toISOString();
    let response: Response;
    if (current) {
      const revisionFilter = current._revision === undefined ? "payload->>_revision=is.null" : `payload->>_revision=eq.${currentRevision}`;
      response = await fetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&${revisionFilter}&select=payload`, {
        method: "PATCH",
        headers: { ...authHeaders, Prefer: "return=representation" },
        body: JSON.stringify({ payload, updated_at: updatedAt }),
      });
    } else {
      response = await fetch(`${db.url}/rest/v1/proar_state?on_conflict=id&select=payload`, {
        method: "POST",
        headers: { ...authHeaders, Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ id, payload, updated_at: updatedAt }),
      });
    }
    if (!response.ok) throw new Error(await response.text());
    const confirmedRows = await response.json() as { payload?: StatePayload }[];
    const confirmed = confirmedRows[0]?.payload;
    if (!confirmed || Number(confirmed._revision || 0) !== currentRevision + 1) {
      const latest = await readState(db, id);
      return NextResponse.json({ error: "A base online foi alterada durante esta gravação.", conflict: true, state: latest }, { status: 409 });
    }
    return NextResponse.json({ saved: true, state: confirmed, dedicatedDatabase: db.dedicated, canonicalCompanyId: company });
  } catch { return NextResponse.json({ error: "Não foi possível sincronizar os dados." }, { status: 503 }); }
}
