import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { supabaseConfigured, supabaseRest } from "../../../lib/supabase-rest";

const COOKIE_NAME = "proar_session";
const cnpjDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "").slice(0, 14);

function admin(request: NextRequest) {
  const user = readSession(request.cookies.get(COOKIE_NAME)?.value);
  return user && (user.role === "Administrador" || user.permissions.includes("*")) ? user : null;
}

export async function GET(request: NextRequest) {
  if (!admin(request)) return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  const response = await supabaseRest("proar_companies?select=*&order=trade_name.asc");
  return response.ok ? NextResponse.json({ companies: await response.json() }) : NextResponse.json({ error: "Falha ao consultar empresas." }, { status: 502 });
}

export async function POST(request: NextRequest) {
  if (!admin(request)) return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  const body = await request.json();
  const cnpj = cnpjDigits(body.cnpj);
  if (cnpj.length !== 14) return NextResponse.json({ error: "CNPJ inválido." }, { status: 400 });
  const now = new Date().toISOString();
  const lookup = await supabaseRest(`proar_companies?select=id,slug&cnpj=eq.${encodeURIComponent(cnpj)}&limit=1`);
  const existing = lookup.ok ? (await lookup.json())?.[0] : null;
  const id = existing?.id || cnpj;
  const rawSlug = String(body.slug || body.tradeName || body.legalName || "empresa").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  const company = { id, cnpj, legal_name: String(body.legalName || ""), trade_name: String(body.tradeName || body.legalName || ""), city: String(body.city || ""), state: String(body.state || "SP").slice(0, 2), phone: String(body.phone || ""), email: String(body.email || ""), address: String(body.address || ""), slug: existing?.slug || rawSlug || undefined, status: body.status === "Bloqueada" ? "blocked" : "active", auto_registered: true, last_seen_at: now, updated_at: now };
  const response = await supabaseRest("proar_companies?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(company) });
  return response.ok ? NextResponse.json({ saved: true, id }) : NextResponse.json({ error: "Falha ao salvar empresa." }, { status: 502 });
}

export async function PATCH(request: NextRequest) {
  if (!admin(request)) return NextResponse.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  const body = await request.json();
  const id = cnpjDigits(body.id);
  const response = await supabaseRest(`proar_companies?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: body.status === "Bloqueada" ? "blocked" : "active", updated_at: new Date().toISOString() }) });
  return response.ok ? NextResponse.json({ saved: true }) : NextResponse.json({ error: "Falha ao alterar bloqueio." }, { status: 502 });
}
