import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { works } from "@/db/schema";
import { readSession } from "@/lib/proar-auth";
import { assertCompanyAccess, getEffectiveCompanyId } from "@/lib/company-access";
import { getWorkMapProgress, normalizeWorkStatus, UNKNOWN_WORK_STATUS } from "@/lib/work-status";

const config = () => ({ url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY });
const safe = (value: unknown, max = 120) => String(value ?? "").trim().slice(0, max);
const safeCompany = (value: unknown) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
const safeWork = (value: unknown) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
const mapId = (company: unknown, work: unknown) => `workmap-${safeCompany(company)}-${safeWork(work)}`;
const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });
const responseHeaders = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
type PublicMap = { companyId?: string; workId?: string; workName?: string; token?: string; revision?: number; title?: string; houses?: unknown[]; updatedAt?: string };

async function databaseConfig(): Promise<{ url: string; key: string } | null> {
  const value = config();
  return value.url && value.key ? { url: value.url, key: value.key } : null;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim();
  const database = await databaseConfig();
  if (!database) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503, headers: responseHeaders });

  if (token) {
    if (token.length < 20) return NextResponse.json({ error: "Link de acompanhamento inválido." }, { status: 400, headers: responseHeaders });
    const [work] = await db.select({ id: works.id, companyId: works.companyId, tokenPublico: works.tokenPublico }).from(works).where(eq(works.tokenPublico, token)).limit(1);
    if (!work) return NextResponse.json({ error: "Obra não localizada." }, { status: 404, headers: responseHeaders });
    const id = mapId(work.companyId, work.id);
    const response = await fetch(`${database.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: headers(database.key), cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar o mapa da obra." }, { status: 502, headers: responseHeaders });
    const rows = await response.json() as { payload?: PublicMap }[];
    return NextResponse.json({ map: rows[0]?.payload ?? null }, { headers: responseHeaders });
  }

  const session = await readSession(request);
  if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: responseHeaders });
  const companyParam = request.nextUrl.searchParams.get("company");
  let companyId: number;
  try { companyId = companyParam ? assertCompanyAccess(session, Number(companyParam)) : getEffectiveCompanyId(session); }
  catch { return NextResponse.json({ error: "Empresa não autorizada." }, { status: 403, headers: responseHeaders }); }
  const workParam = request.nextUrl.searchParams.get("work");
  if (!workParam || !/^\d+$/.test(workParam)) return NextResponse.json({ error: "Informe uma obra válida." }, { status: 400, headers: responseHeaders });
  const [work] = await db.select({ id: works.id, companyId: works.companyId }).from(works).where(and(eq(works.id, Number(workParam)), eq(works.companyId, companyId))).limit(1);
  if (!work) return NextResponse.json({ error: "Obra não encontrada nesta empresa." }, { status: 404, headers: responseHeaders });
  const response = await fetch(`${database.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(mapId(companyId, work.id))}&select=payload`, { headers: headers(database.key), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível carregar o mapa compartilhado." }, { status: 502, headers: responseHeaders });
  const rows = await response.json() as { payload?: PublicMap }[];
  return NextResponse.json({ map: rows[0]?.payload ?? null }, { headers: responseHeaders });
}

export async function PUT(request: NextRequest) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ error: "Sessão inválida." }, { status: 401, headers: responseHeaders });
  const database = await databaseConfig();
  if (!database) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503, headers: responseHeaders });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !/^\d+$/.test(String(body.workId ?? ""))) return NextResponse.json({ error: "Informe uma obra válida." }, { status: 400, headers: responseHeaders });

  let companyId: number;
  try { companyId = assertCompanyAccess(session, body.companyId ? Number(body.companyId) : null); }
  catch { return NextResponse.json({ error: "Empresa não autorizada." }, { status: 403, headers: responseHeaders }); }
  const [work] = await db.select({ id: works.id, companyId: works.companyId, tokenPublico: works.tokenPublico, nome: works.nome }).from(works).where(and(eq(works.id, Number(body.workId)), eq(works.companyId, companyId))).limit(1);
  if (!work) return NextResponse.json({ error: "Obra não encontrada nesta empresa." }, { status: 404, headers: responseHeaders });

  const housesInput = Array.isArray(body.houses) ? body.houses : [];
  if (housesInput.length > 2_000) return NextResponse.json({ error: "O mapa ultrapassa o limite de 2.000 unidades." }, { status: 413, headers: responseHeaders });
  const houses = housesInput.map((item, index) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const normalized = normalizeWorkStatus(row.status ?? row.statusPolartech);
    return { id: safe(row.id, 100) || `unit-${index + 1}`, quadra: safe(row.quadra, 100), casa: safe(row.casa ?? row.numero, 100), status: normalized === UNKNOWN_WORK_STATUS ? "INÍCIO DE OBRA" : normalized, substatus: safe(row.substatus, 100) };
  }).filter((row) => row.quadra && row.casa);
  if (houses.length !== housesInput.length) return NextResponse.json({ error: "Cada unidade precisa ter quadra e identificação preenchidas." }, { status: 400, headers: responseHeaders });
  const unique = new Set(houses.map((row) => `${row.quadra.toLocaleLowerCase("pt-BR")}\u0000${row.casa.toLocaleLowerCase("pt-BR")}`));
  if (unique.size !== houses.length) return NextResponse.json({ error: "Há unidades duplicadas na mesma quadra." }, { status: 409, headers: responseHeaders });

  const id = mapId(companyId, work.id);
  const currentResponse = await fetch(`${database.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(id)}&select=payload`, { headers: headers(database.key), cache: "no-store" });
  if (!currentResponse.ok) return NextResponse.json({ error: "Não foi possível conferir a versão atual do mapa." }, { status: 502, headers: responseHeaders });
  const currentRows = await currentResponse.json() as { payload?: PublicMap }[];
  const currentMap = currentRows[0]?.payload;
  const currentRevision = Number(currentMap?.revision || 0);
  const baseRevision = Number(body.baseRevision ?? 0);
  if (!Number.isInteger(baseRevision) || baseRevision < 0) return NextResponse.json({ error: "Versão base do mapa inválida." }, { status: 400, headers: responseHeaders });
  if (currentMap && baseRevision !== currentRevision) return NextResponse.json({ error: "Outro usuário atualizou o mapa. Recarregue antes de salvar.", conflict: true, map: currentMap }, { status: 409, headers: responseHeaders });

  const progress = getWorkMapProgress(houses);
  const map: PublicMap = { companyId: String(companyId), workId: String(work.id), workName: work.nome, token: work.tokenPublico || currentMap?.token || randomBytes(24).toString("base64url"), revision: currentRevision + 1, title: safe(body.title, 160) || "Acompanhamento da obra", houses, updatedAt: new Date().toISOString() };
  const saveResponse = await fetch(`${database.url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { ...headers(database.key), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id, payload: map, updated_at: new Date().toISOString() }) });
  if (!saveResponse.ok) return NextResponse.json({ error: "Não foi possível salvar o mapa da obra." }, { status: 502, headers: responseHeaders });
  const [updatedWork] = await db.update(works).set({ progresso: progress, atualizadoEm: new Date() }).where(and(eq(works.id, work.id), eq(works.companyId, companyId))).returning({ id: works.id, progresso: works.progresso }).catch(() => []);
  return NextResponse.json({ saved: true, progress, map, work: updatedWork ?? null }, { headers: responseHeaders });
}
