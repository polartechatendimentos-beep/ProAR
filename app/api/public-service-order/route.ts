import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";

const config = () => ({ url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });
const safe = (value: unknown, fallback: string) => String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) || fallback;
const snapshotId = (company: unknown, order: unknown) => `osmap-${safe(company,"company")}-${safe(order,"order")}`;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  if (!token || token.length < 20) return NextResponse.json({ error: "Link de acompanhamento inválido." }, { status: 400 });
  const { url, key } = config();
  if (!url || !key) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503 });
  const response = await fetch(`${url}/rest/v1/proar_state?id=like.osmap-*&select=payload`, { headers: headers(key), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar o acompanhamento." }, { status: 502 });
  const rows = await response.json() as { payload?: Record<string, unknown> }[];
  const order = rows.find(row => row.payload?.token === token)?.payload;
  return order ? NextResponse.json({ order }) : NextResponse.json({ error: "Link não localizado ou desativado." }, { status: 404 });
}

export async function PUT(request: NextRequest) {
  if (!readSession(request.cookies.get("proar_session")?.value)) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const { url, key } = config();
  if (!url || !key) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503 });
  const body = await request.json(); const id = snapshotId(body.companyId, body.orderId);
  const response = await fetch(`${url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: headers(key), cache: "no-store" });
  const rows = response.ok ? await response.json() as { payload?: { token?: string } }[] : [];
  const token = body.token || rows[0]?.payload?.token || randomBytes(24).toString("base64url");
  const payload = { token, orderId:String(body.orderId || ""), companyId:safe(body.companyId,"company"), client:String(body.client || ""), service:String(body.service || ""), date:String(body.date || ""), time:String(body.time || ""), status:String(body.status || ""), timeline:Array.isArray(body.timeline) ? body.timeline : [], updatedAt:new Date().toISOString() };
  const save = await fetch(`${url}/rest/v1/proar_state?on_conflict=id`, { method:"POST", headers:{ ...headers(key), Prefer:"resolution=merge-duplicates,return=minimal" }, body:JSON.stringify({id,payload,updated_at:payload.updatedAt}) });
  return save.ok ? NextResponse.json({ saved:true, token }) : NextResponse.json({ error:"Não foi possível publicar o acompanhamento." }, { status:502 });
}
