import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";

const COOKIE_NAME = "proar_session";
const config = () => ({ url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const safeCompany = (value: unknown) => String(value || "polartech-principal").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "polartech-principal";
const safeWork = (value: unknown) => String(value || "reserva-imperial").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100) || "reserva-imperial";
const mapId = (company: unknown, work: unknown) => { const companyId=safeCompany(company); const workId=safeWork(work); return workId === "reserva-imperial" ? `workmap-${companyId}` : `workmap-${companyId}-${workId}`; };
const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });

export async function GET(request: NextRequest) {
  const requestedCompany = request.nextUrl.searchParams.get("company");
  if (requestedCompany) {
    if (!readSession(request.cookies.get(COOKIE_NAME)?.value)) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    const { url, key } = config();
    if (!url || !key) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503 });
    const id = mapId(requestedCompany, request.nextUrl.searchParams.get("work"));
    const response = await fetch(`${url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: headers(key), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar o mapa compartilhado." }, { status: 502 });
    const rows = await response.json() as { payload?: Record<string, unknown> }[];
    return NextResponse.json({ map: rows[0]?.payload ?? null });
  }
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token || token.length < 20) return NextResponse.json({ error: "Link de acompanhamento inválido." }, { status: 400 });
  const { url, key } = config();
  if (!url || !key) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503 });
  const response = await fetch(`${url}/rest/v1/proar_state?id=like.workmap-*&select=payload`, { headers: headers(key), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar o mapa." }, { status: 502 });
  const rows = await response.json() as { payload?: Record<string, unknown> }[];
  const map = rows.find(row => row.payload?.token === token)?.payload;
  return map ? NextResponse.json({ map }) : NextResponse.json({ error: "Link não localizado ou desativado." }, { status: 404 });
}

export async function PUT(request: NextRequest) {
  if (!readSession(request.cookies.get(COOKIE_NAME)?.value)) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const { url, key } = config();
  if (!url || !key) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503 });
  const body = await request.json();
  const companyId = safeCompany(body.companyId);
  const workId = safeWork(body.workId);
  const id = mapId(companyId, workId);
  const currentResponse = await fetch(`${url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: headers(key), cache: "no-store" });
  const currentRows = currentResponse.ok ? await currentResponse.json() as { payload?: { token?: string } }[] : [];
  const token = currentRows[0]?.payload?.token || randomBytes(24).toString("base64url");
  const payload = { companyId, workId, token, title: String(body.title || "Acompanhamento da obra"), houses: Array.isArray(body.houses) ? body.houses : [], updatedAt: new Date().toISOString() };
  const saveResponse = await fetch(`${url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { ...headers(key), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id, payload, updated_at: new Date().toISOString() }) });
  return saveResponse.ok ? NextResponse.json({ saved: true, token }) : NextResponse.json({ error: "Não foi possível publicar o mapa." }, { status: 502 });
}
