import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado.");
  return { url, key };
}

function authorized(request: NextRequest) {
  return Boolean(readSession(request.cookies.get("proar_session")?.value));
}

function companyKey(request: NextRequest) {
  return (request.nextUrl.searchParams.get("company") || "main").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "main";
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const { url, key } = supabaseConfig();
    const company = companyKey(request);
    const response = await fetch(`${url}/rest/v1/proar_state?id=eq.${encodeURIComponent(company)}&select=payload`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    return NextResponse.json({ state: rows[0]?.payload ?? null });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar a base compartilhada." }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  try {
    const body = await request.json();
    const company = companyKey(request);
    const { url, key } = supabaseConfig();
    const authHeaders = { apikey: key, Authorization: `Bearer ${key}` };
    const currentResponse = await fetch(`${url}/rest/v1/proar_state?id=eq.${encodeURIComponent(company)}&select=payload`, { headers: authHeaders, cache: "no-store" });
    const currentRows = currentResponse.ok ? await currentResponse.json() as { payload?: Record<string, unknown> }[] : [];
    const current = currentRows[0]?.payload;
    const currentRevision = Number(current?._revision || 0);
    const baseRevision = Number(body._baseRevision || 0);
    if (current && !body._force && baseRevision !== currentRevision) return NextResponse.json({ error: "A base online possui uma versão mais recente.", conflict: true, state: current }, { status: 409 });
    const { _baseRevision: _ignoredBase, _force: _ignoredForce, ...cleanBody } = body;
    const payload = { ...cleanBody, _revision: currentRevision + 1, _updatedAt: new Date().toISOString() };
    const response = await fetch(`${url}/rest/v1/proar_state?on_conflict=id`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: company, payload, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ saved: true, state: payload });
  } catch {
    return NextResponse.json({ error: "Não foi possível sincronizar os dados." }, { status: 503 });
  }
}
