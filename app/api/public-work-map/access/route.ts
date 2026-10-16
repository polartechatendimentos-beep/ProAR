import { databaseFetch, masterDatabaseConfig } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const config = masterDatabaseConfig;
const headers = (key: string) => ({ apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" });
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const publicView = (map: Record<string, unknown>) => ({ ...map, externalAccess: undefined });
const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("pt-BR");
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000, MAX_ATTEMPTS = 8;
const origin = (r: NextRequest) => (r.headers.get("x-forwarded-for")?.split(",")[0] || r.headers.get("x-real-ip") || "unknown").trim().slice(0,80);
const attemptKey = (r: NextRequest,t:string,u:string) => hash(`${origin(r)}:${t}:${u}`);
function limited(k:string){const n=Date.now(),e=attempts.get(k);if(!e||e.resetAt<=n){attempts.set(k,{count:0,resetAt:n+WINDOW_MS});return false}return e.count>=MAX_ATTEMPTS}
function fail(k:string){const n=Date.now(),e=attempts.get(k);attempts.set(k,e&&e.resetAt>n?{...e,count:e.count+1}:{count:1,resetAt:n+WINDOW_MS})}
function equalHash(a:string,b:string){try{const x=Buffer.from(a,"hex"),y=Buffer.from(b,"hex");return x.length===y.length&&timingSafeEqual(x,y)}catch{return false}}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token ?? "").trim();
  const username = normalize(body.username);
  const password = String(body.password ?? "");
  if (!token || !username || !password) return NextResponse.json({ error: "Informe o link, login e senha." }, { status: 400 });
  const rateKey=attemptKey(request,token,username);
  if(limited(rateKey)) return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429, headers: { "Retry-After": "900" } });
  const { url, key } = config();
  if (!url || !key) return NextResponse.json({ error: "Base de dados indisponível." }, { status: 503 });
  const response = await databaseFetch(`${url}/rest/v1/proar_state?id=like.workmap-*&select=payload`, { headers: headers(key), cache: "no-store" });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível consultar a obra." }, { status: 502 });
  const rows = await response.json() as { payload?: Record<string, unknown> }[];
  const current = rows.find(row => row.payload?.token === token)?.payload;
  if (!current) return NextResponse.json({ error: "Link da obra não localizado." }, { status: 404 });
  // A fonte oficial de credenciais é a mesma utilizada no cadastro interno.
  // O mapa público é somente uma projeção de acompanhamento e pode estar desatualizado.
  const companyId = String(current.companyId || "polartech-principal");
  const workId = String(current.workId || "reserva-imperial");
  const tenantDb = await resolveTenantDb(companyId).catch(() => null);
  if (!tenantDb?.url || !tenantDb.key) return NextResponse.json({ error: "Base de acessos externos indisponível." }, { status: 503 });
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0,100);
  const accessId = tenantDb.dedicated ? `work-access-${safe(workId)}` : `work-access-${safe(companyId)}-${safe(workId)}`;
  let accessResponse: Response;
  try {
    accessResponse = await databaseFetch(`${tenantDb.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(accessId)}&select=payload`, { headers: tenantHeaders(tenantDb.key), cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar as credenciais da obra." }, { status: 503 });
  }
  if (!accessResponse.ok) return NextResponse.json({ error: "Não foi possível consultar as credenciais da obra." }, { status: 502 });
  const accessRows = await accessResponse.json() as {payload?:{externalAccess?:Record<string,unknown>[]}}[];
  const stored = accessRows[0]?.payload;
  // Compatibilidade com registros anteriores à migração do cadastro dedicado.
  const accesses = stored
    ? (Array.isArray(stored.externalAccess) ? stored.externalAccess : [])
    : (Array.isArray(current.externalAccess) ? current.externalAccess as Record<string, unknown>[] : []);
  const access = accesses.find(item => normalize(item.username) === username && item.active === true && equalHash(String(item.passwordHash ?? ""), hash(password)));
  if (!access) { fail(rateKey); return NextResponse.json({ error: "Login inválido ou acesso inativo." }, { status: 401 }); }
  attempts.delete(rateKey);
  const houses = Array.isArray(current.houses) ? current.houses as Record<string, unknown>[] : [];
  const houseId = String(body.houseId ?? "").trim();
  const description = String(body.description ?? "").trim();
  let next = current;
  if (description) {
    const house = houses.find(item => String(item.id) === houseId);
    if (!house) return NextResponse.json({ error: "Casa, lote ou área não localizado." }, { status: 404 });
    const observation = { id: `external-${Date.now()}-${randomBytes(4).toString("hex")}`, author: String(access.name), role: String(access.role), houseId, environment: String(body.environment ?? "").trim() || undefined, stage: String(body.stage ?? "").trim() || undefined, description, photos: Array.isArray(body.photos) ? body.photos.filter((photo: unknown) => typeof photo === "string").slice(0, 8) : [], createdAt: new Date().toISOString(), status: "Aberto" };
    const updatedHouses = houses.map(item => item.id === houseId ? { ...item, externalObservations: [observation, ...(Array.isArray(item.externalObservations) ? item.externalObservations : [])] } : item);
    const id = String(current.workId ?? "reserva-imperial");
    const companyId = String(current.companyId ?? "polartech-principal");
    const mapId = id === "reserva-imperial" ? `workmap-${companyId}` : `workmap-${companyId}-${id}`;
    const payload = { ...current, houses: updatedHouses, revision: Number(current.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
    const save = await databaseFetch(`${url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { ...headers(key), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: mapId, payload, updated_at: new Date().toISOString() }) });
    if (!save.ok) return NextResponse.json({ error: "Não foi possível salvar o apontamento." }, { status: 502 });
    next = payload;
  }
  return NextResponse.json({ authenticated: true, access: { name: access.name, role: access.role }, map: publicView(next) });
}
