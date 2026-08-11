import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";

function safeCompany(value: unknown) { return String(value || "main").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "main"; }
function sessionFor(request: NextRequest) { return readSession(request.cookies.get("proar_session")?.value); }
function companyKey(request: NextRequest, session: ReturnType<typeof sessionFor>) {
  if (session?.companyId) return session.companyId;
  return safeCompany(request.nextUrl.searchParams.get("company") || "main");
}

export async function GET(request: NextRequest) {
  const session = sessionFor(request); if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const company = companyKey(request, session); const db = await resolveTenantDb(session.companyId); if (!db.url || !db.key) throw new Error("Banco indisponível");
    const id = db.dedicated ? "main" : company;
    const response = await fetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: tenantHeaders(db.key), cache: "no-store" });
    if (!response.ok) throw new Error(await response.text()); const rows = await response.json();
    return NextResponse.json({ state: rows[0]?.payload ?? null, dedicatedDatabase: db.dedicated });
  } catch { return NextResponse.json({ error: "Não foi possível carregar a base compartilhada." }, { status: 503 }); }
}

export async function PUT(request: NextRequest) {
  const session = sessionFor(request); if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json(); const company = companyKey(request, session); const db = await resolveTenantDb(session.companyId); if (!db.url || !db.key) throw new Error("Banco indisponível");
    const id = db.dedicated ? "main" : company; const authHeaders = tenantHeaders(db.key);
    const currentResponse = await fetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: authHeaders, cache: "no-store" });
    const currentRows = currentResponse.ok ? await currentResponse.json() as { payload?: Record<string, unknown> }[] : []; const current = currentRows[0]?.payload; const currentRevision = Number(current?._revision || 0); const baseRevision = Number(body._baseRevision || 0);
    if (current && !body._force && baseRevision !== currentRevision) return NextResponse.json({ error: "A base online possui uma versão mais recente.", conflict: true, state: current }, { status: 409 });
    const { _baseRevision: _ignoredBase, _force: _ignoredForce, companyId: _ignoredCompany, ...cleanBody } = body; const payload = { ...cleanBody, _revision: currentRevision + 1, _updatedAt: new Date().toISOString(), _companyId: company };
    const response = await fetch(`${db.url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { ...authHeaders, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id, payload, updated_at: new Date().toISOString() }) });
    if (!response.ok) throw new Error(await response.text()); return NextResponse.json({ saved: true, state: payload, dedicatedDatabase: db.dedicated });
  } catch { return NextResponse.json({ error: "Não foi possível sincronizar os dados." }, { status: 503 }); }
}
