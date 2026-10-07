import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { resolveTenantDb } from "../../../lib/tenant-rest";
import { databaseFetch, commitNeonOperationalState, PRIMARY_DATABASE_URL, supabaseRest } from "../../../lib/supabase-rest";
import { managerPlan } from "../../../lib/manager-plans";
import { tenantHeaders } from "../../../lib/tenant-rest";

import { hasPermission, type Permission } from "../../../lib/permissions";
import { prepareOperationalState, independentOperationalRows, OperationError } from "../../../lib/operational-ledger";
import { createStateSnapshot } from "../../../lib/state-snapshots";
import { recordSystemIncident } from "../../../lib/system-observability";
import { classifyProarError } from "../../../lib/system-errors";

function stateRest(db: { url: string; key: string }, path: string, init: RequestInit = {}) {
  return databaseFetch(`${db.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...tenantHeaders(db.key), ...init.headers },
    cache: "no-store",
  });
}

function safeCompany(value: unknown) { return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80); }
function sessionFor(request: NextRequest) { return readSession(request.cookies.get("proar_session")?.value); }
const PRIMARY_COMPANY_ID = safeCompany(process.env.PROAR_PRIMARY_COMPANY_ID || "polartech-principal") || "polartech-principal";
const PRIMARY_COMPANY_SLUG = String(process.env.PROAR_PRIMARY_COMPANY_SLUG || "polartech").trim().toLowerCase();

function employeeUsernames(state:StatePayload|null|undefined){
  const usernames=new Set<string>();
  const employees=state?.moduleRecords?.["Funcionários"]||[];
  for(const employee of employees){
    if(String(employee.status||"").toLowerCase()==="inativo")continue;
    const username=String(employee.employeeUsername||employee.username||employee.email||employee.id||"").trim().toLowerCase();
    if(username)usernames.add(username);
  }
  return usernames;
}

async function masterActiveUsernames(companyId:string){
  const usernames=new Set<string>();
  const response=await supabaseRest(`proar_trial_users?select=username,active&company_id=eq.${encodeURIComponent(companyId)}`);
  if(!response.ok)return usernames;
  const rows=await response.json() as Array<{username?:string;active?:boolean}>;
  for(const row of rows){
    if(row.active===false)continue;
    const username=String(row.username||"").trim().toLowerCase();
    if(username)usernames.add(username);
  }
  return usernames;
}

async function companyUserLimit(companyId:string){
  if(companyId===PRIMARY_COMPANY_ID)return null;
  const response=await supabaseRest(`proar_companies?select=plan_code&id=eq.${encodeURIComponent(companyId)}&limit=1`);
  if(!response.ok)return managerPlan("basico").limits.users;
  const rows=await response.json() as Array<{plan_code?:string}>;
  return managerPlan(rows[0]?.plan_code||"trial").limits.users;
}

function requestedCompany(request: NextRequest) { return safeCompany(request.nextUrl.searchParams.get("company")); }
function companyKey(request: NextRequest, session: ReturnType<typeof sessionFor>) {
  // A PolarTech sempre aponta para a base histórica principal, inclusive para sessões antigas
  // emitidas com UUID do cadastro empresarial em vez do identificador canônico.
  if (String(session?.companySlug || "").trim().toLowerCase() === PRIMARY_COMPANY_SLUG) return PRIMARY_COMPANY_ID;
  if (session?.companyId === PRIMARY_COMPANY_ID) return PRIMARY_COMPANY_ID;
  // Outros tenants usam exclusivamente o companyId presente na sessão.
  if (session?.companyId) return session.companyId;
  // Instalações legadas de uma única empresa usam o identificador canônico do servidor.
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
  const response = await stateRest(db, `proar_state?id=eq.${encodeURIComponent(id)}&select=payload`);
  if (!response.ok) return null;
  const rows = await response.json() as { payload?: StatePayload }[];
  return rows[0]?.payload ?? null;
}

async function readOperationalStates(db: { url: string; key: string }) {
  const response = await stateRest(db, "proar_state?select=payload&limit=200");
  if (!response.ok) return [] as StatePayload[];
  const rows = await response.json() as { payload?: StatePayload }[];
  return rows.map(row => row.payload).filter((payload): payload is StatePayload => Boolean(
    payload && (Array.isArray(payload.customers) || Array.isArray(payload.serviceOrders) || payload.moduleRecords)
  ));
}

async function writeState(db: { url: string; key: string }, id: string, payload: StatePayload) {
  const response = await stateRest(db, "proar_state?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id, payload, updated_at: new Date().toISOString() }),
  });
  return response.ok;
}

export async function GET(request: NextRequest) {
  const session = sessionFor(request); if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const company = companyKey(request, session); const db = await resolveTenantDb(company); if (!db.url || !db.key) throw new Error("Banco indisponível");
    const id = db.dedicated ? "main" : company;

    // A empresa principal possui instalações históricas que podem ter usado
    // `main` antes da adoção do identificador canônico. Leia ambas as chaves
    // somente para recuperar os dados existentes; não há escrita neste fluxo.
    if (session.companyId && company === PRIMARY_COMPANY_ID && !db.dedicated) {
      const candidates = Array.from(new Set([company, "main", "polartech"].filter(Boolean)));
      const states: StatePayload[] = [];
      for (const candidate of candidates) {
        const state = await readState(db, candidate);
        if (state) states.push(state);
      }
      return NextResponse.json({ state: mergeStates(states), dedicatedDatabase: false, canonicalCompanyId: company, recoveredLegacyStates: states.length });
    }
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
  } catch (error) {
    const descriptor=classifyProarError(error);
    const company=companyKey(request,session);
    void recordSystemIncident({companyId:company,module:"Sincronização",operation:"Carregar estado operacional",error,code:descriptor.code,route:"/api/state"});
    return NextResponse.json({ error: descriptor.userMessage, code:descriptor.code }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const session = sessionFor(request); if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json(); const company = companyKey(request, session); const db = await resolveTenantDb(company); if (!db.url || !db.key) throw new Error("Banco indisponível");
    const id = db.dedicated ? "main" : company;
    const currentResponse = await stateRest(db, `proar_state?id=eq.${encodeURIComponent(id)}&select=payload`);
    if (!currentResponse.ok) throw new Error("Falha ao ler a versão vigente");
    const currentRows = currentResponse.ok ? await currentResponse.json() as { payload?: StatePayload }[] : []; const current = currentRows[0]?.payload; const currentRevision = Number(current?._revision || 0); const baseRevision = Number(body._baseRevision || 0);
    if (current && baseRevision !== currentRevision) return NextResponse.json({ error: "A base online possui uma versão mais recente.", conflict: true, state: current }, { status: 409 });
    const { _baseRevision: _ignoredBase, _force: _ignoredForce, companyId: _ignoredCompany, ...cleanBody } = body;
    const validated = prepareOperationalState(current || null, cleanBody, { username: session.username, displayName: session.displayName, can: permission => hasPermission(session, permission as Permission) });
    const userLimit=await companyUserLimit(company);
    if(userLimit!==null){
      const masterUsers=await masterActiveUsernames(company);
      const currentUsers=new Set([...masterUsers,...employeeUsernames(current)]);
      const nextUsers=new Set([...masterUsers,...employeeUsernames(validated as StatePayload)]);
      if(nextUsers.size>userLimit&&nextUsers.size>currentUsers.size){
        throw new OperationError(`Limite do plano atingido: este plano permite ${userLimit} usuários ativos. Inative um usuário ou faça upgrade do plano.`,409);
      }
    }
    const payload = { ...validated, _revision: currentRevision + 1, _updatedAt: new Date().toISOString(), _companyId: company };
    const updatedAt = new Date().toISOString();
    if (current) {
      const previousUpdatedAt=Date.parse(String(current._updatedAt||""));
      const checkpointDue=currentRevision%10===0 || !Number.isFinite(previousUpdatedAt) || Date.now()-previousUpdatedAt>60*60*1000;
      if(checkpointDue) {
        await createStateSnapshot({companyId:company,stateId:id,payload:current,reason:"automatic-checkpoint",createdBy:session.username}).catch(()=>false);
      }
    }
    let response: Response;
    if (db.url === PRIMARY_DATABASE_URL) {
      const confirmed = await commitNeonOperationalState(id, current ? currentRevision : null, payload, independentOperationalRows(company, payload, current));
      if (!confirmed) return NextResponse.json({ error: "A base online foi alterada durante esta gravação.", conflict: true, state: await readState(db, id) }, { status: 409 });
      return NextResponse.json({ saved: true, state: confirmed, dedicatedDatabase: db.dedicated, canonicalCompanyId: company, transactionalRecords: true });
    }
    if (current) {
      const revisionFilter = current._revision === undefined ? "payload->>_revision=is.null" : `payload->>_revision=eq.${currentRevision}`;
      response = await stateRest(db, `proar_state?id=eq.${encodeURIComponent(id)}&${revisionFilter}&select=payload`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ payload, updated_at: updatedAt }),
      }) as Response;
    } else {
      response = await stateRest(db, "proar_state?on_conflict=id&select=payload", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ id, payload, updated_at: updatedAt }),
      }) as Response;
    }
    if (!response.ok) throw new Error(await response.text());
    const confirmedRows = await response.json() as { payload?: StatePayload }[];
    const confirmed = confirmedRows[0]?.payload;
    if (!confirmed || Number(confirmed._revision || 0) !== currentRevision + 1) {
      const latest = await readState(db, id);
      return NextResponse.json({ error: "A base online foi alterada durante esta gravação.", conflict: true, state: latest }, { status: 409 });
    }
    return NextResponse.json({ saved: true, state: confirmed, dedicatedDatabase: db.dedicated, canonicalCompanyId: company });
  } catch (error) {
    if (error instanceof OperationError) return NextResponse.json({ error: error.message }, { status: error.status });
    const company=companyKey(request,session);
    const descriptor=classifyProarError(error);
    void recordSystemIncident({companyId:company,module:"Sincronização",operation:"Gravar estado operacional",error,code:descriptor.code,route:"/api/state"});
    return NextResponse.json({ error: descriptor.userMessage, code:descriptor.code }, { status: 503 });
  }
}
