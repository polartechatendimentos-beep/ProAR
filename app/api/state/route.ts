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
    const payload = await request.json();
    const company = companyKey(request);
    const { url, key } = supabaseConfig();
    const response = await fetch(`${url}/rest/v1/proar_state?on_conflict=id`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: company, payload, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error(await response.text());
    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível sincronizar os dados." }, { status: 503 });
  }
}
