import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import { isReadOnlyRequest, resilientDatabaseFetch, retryDatabaseOperation } from "./database-resilience";

const supabaseBaseUrl = () =>
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tnjkdurifalrdnttsova.supabase.co").replace(/\/$/, "");
const supabaseServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

export const PRIMARY_DATABASE_URL = "neon://proar-primary";

const neonDatabaseUrl = () =>
  process.env.PROAR_NEON_DATABASE_URL ??
  process.env.PROAR_NEON_POSTGRES_URL ??
  process.env.PROAR_NEON_POSTGRES_URL_NON_POOLING ??
  process.env.PROAR_NEON_DATABASE_URL_UNPOOLED;

const prismaDatabaseUrl = () =>
  process.env.PROAR_PRISMA_DATABASE_URL ??
  process.env.DATABASE_URL;

type PrimaryDatabaseProvider = "neon" | "prisma" | "supabase";

function explicitDatabaseProvider(): PrimaryDatabaseProvider | "" {
  const configured=String(process.env.PROAR_DATABASE_PROVIDER||"").trim().toLowerCase();
  return configured==="neon"||configured==="prisma"||configured==="supabase" ? configured : "";
}

/**
 * Resolve the primary provider defensively.
 *
 * Prisma Postgres is exposed by the Vercel integration through DATABASE_URL.
 * The explicit provider always wins when its credentials are available, but
 * a missing credential falls back to another configured provider instead of
 * taking the whole ERP offline.
 */
export function databaseProvider(): PrimaryDatabaseProvider {
  const explicit=explicitDatabaseProvider();
  const hasPrisma=Boolean(prismaDatabaseUrl());
  const hasNeon=Boolean(neonDatabaseUrl());
  const hasSupabase=Boolean(supabaseBaseUrl()&&supabaseServiceKey());

  if(explicit==="prisma") return hasPrisma ? "prisma" : hasNeon ? "neon" : hasSupabase ? "supabase" : "prisma";
  if(explicit==="neon") return hasNeon ? "neon" : hasPrisma ? "prisma" : hasSupabase ? "supabase" : "neon";
  if(explicit==="supabase") return hasSupabase ? "supabase" : hasPrisma ? "prisma" : hasNeon ? "neon" : "supabase";

  if(hasPrisma) return "prisma";
  if(hasNeon) return "neon";
  return "supabase";
}

export const neonEnabled = () => databaseProvider() === "neon";
export const prismaEnabled = () => databaseProvider() === "prisma";

export function databaseRuntimeConfig() {
  const explicit=explicitDatabaseProvider();
  const resolved=databaseProvider();
  return {
    explicitProvider:explicit||null,
    resolvedProvider:resolved,
    prismaConfigured:Boolean(prismaDatabaseUrl()),
    neonConfigured:Boolean(neonDatabaseUrl()),
    supabaseConfigured:Boolean(supabaseBaseUrl()&&supabaseServiceKey()),
    autoFallback:Boolean(explicit&&explicit!==resolved),
  };
}

export function supabaseConfigured() {
  if (databaseProvider() === "prisma") return Boolean(prismaDatabaseUrl());
  if (databaseProvider() === "neon") return Boolean(neonDatabaseUrl());
  return Boolean(supabaseBaseUrl() && supabaseServiceKey());
}

export function masterDatabaseConfig() {
  if (databaseProvider() === "prisma") return { url: PRIMARY_DATABASE_URL, key: prismaDatabaseUrl() ? "configured" : "" };
  if (neonEnabled()) return { url: PRIMARY_DATABASE_URL, key: neonDatabaseUrl() ? "configured" : "" };
  return { url: supabaseBaseUrl(), key: supabaseServiceKey() ?? "" };
}

/** Routes for dedicated Supabase tenants keep their original HTTP connection. */
export async function databaseFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (input.startsWith(`${PRIMARY_DATABASE_URL}/rest/v1/`)) {
    const path=input.slice(`${PRIMARY_DATABASE_URL}/rest/v1/`.length);
    return retryDatabaseOperation(
      () => supabaseRest(path, init) as Promise<Response>,
      { enabled:isReadOnlyRequest(init), attempts:3, baseDelayMs:120 },
    );
  }
  return resilientDatabaseFetch(input, init, { attempts:3, baseDelayMs:120, timeoutMs:6500 });
}

class DatabaseResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  private readonly payload: unknown;

  constructor(payload: unknown, status = 200, statusText = "OK") {
    this.payload = payload;
    this.status = status;
    this.statusText = statusText;
    this.ok = status >= 200 && status < 300;
  }

  async json() {
    return this.payload;
  }

  async text() {
    return typeof this.payload === "string" ? this.payload : JSON.stringify(this.payload);
  }
}

let prismaSqlClient: ReturnType<typeof postgres> | null = null;

function getPrismaSqlClient() {
  const connectionString=prismaDatabaseUrl();
  if(!connectionString) throw new Error("Prisma Postgres não configurado");
  if(!prismaSqlClient) {
    prismaSqlClient=postgres(connectionString,{
      max:5,
      idle_timeout:20,
      connect_timeout:10,
      prepare:false,
      onnotice:()=>{},
    });
  }
  return prismaSqlClient;
}

async function primarySqlQuery(query:string,params:unknown[]) {
  const provider=databaseProvider();
  if(provider==="neon") {
    const connectionString=neonDatabaseUrl();
    if(!connectionString) throw new Error("Neon não configurado");
    const sql=neon(connectionString);
    return await sql.query(query,params);
  }
  if(provider==="prisma") {
    const sql=getPrismaSqlClient();
    const safeParams=params as Array<string|number|boolean|null|Date|Uint8Array>;
    return await sql.unsafe(query,safeParams);
  }
  throw new Error("Consulta SQL direta indisponível para o provedor Supabase REST");
}

/** Conditional write and normalized ERP records in one PostgreSQL statement.
 * Keeps the legacy export name so existing routes do not need a risky cutover.
 */
export async function commitNeonOperationalState(stateId: string, expectedRevision: number | null, payload: Record<string, unknown>, rows: { id: string; payload: Record<string, unknown> }[]) {
  const provider=databaseProvider();
  if(provider!=="neon"&&provider!=="prisma") throw new Error("Commit transacional requer PostgreSQL direto");
  const now = new Date().toISOString();
  const query = expectedRevision === null
    ? `WITH committed AS (
        INSERT INTO proar_state (id,payload,updated_at) VALUES ($1,$2::jsonb,$3::timestamptz)
        ON CONFLICT (id) DO NOTHING RETURNING payload
      ), entities AS (
        INSERT INTO proar_state (id,payload,updated_at)
        SELECT item->>'id',item->'payload',$3::timestamptz
        FROM jsonb_array_elements($4::jsonb) item WHERE EXISTS (SELECT 1 FROM committed)
        ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at RETURNING id
      ) SELECT payload FROM committed`
    : `WITH committed AS (
        UPDATE proar_state SET payload=$2::jsonb,updated_at=$3::timestamptz
        WHERE id=$1 AND COALESCE((payload->>'_revision')::bigint,0)=$5::bigint RETURNING payload
      ), entities AS (
        INSERT INTO proar_state (id,payload,updated_at)
        SELECT item->>'id',item->'payload',$3::timestamptz
        FROM jsonb_array_elements($4::jsonb) item WHERE EXISTS (SELECT 1 FROM committed)
        ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at RETURNING id
      ) SELECT payload FROM committed`;
  const params = [stateId, JSON.stringify(payload), now, JSON.stringify(rows), ...(expectedRevision === null ? [] : [expectedRevision])];
  const result = await primarySqlQuery(query, params) as { payload: Record<string, unknown> }[];
  return result[0]?.payload || null;
}

const identifier = (value: string) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error("Identificador SQL inválido");
  return `"${value}"`;
};

function parseResource(path: string) {
  const [resourcePart, queryString = ""] = path.split("?", 2);
  const resource = resourcePart.replace(/^\/+|\/+$/g, "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(resource)) throw new Error("Recurso SQL inválido");
  return { resource, params: new URLSearchParams(queryString) };
}

function parseValue(raw: string) {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return raw;
}

function addParam(params: unknown[], value: unknown) {
  params.push(value);
  return `$${params.length}`;
}

function buildWhere(paramsUrl: URLSearchParams, values: unknown[]) {
  const clauses: string[] = [];
  for (const [key, raw] of paramsUrl.entries()) {
    if (["select", "limit", "order", "on_conflict"].includes(key)) continue;
    if (key === "or") {
      const inner = raw.replace(/^\(|\)$/g, "").split(",");
      const orClauses = inner.map((part) => {
        const match = part.match(/^([A-Za-z_][A-Za-z0-9_]*)\.(eq|gte|lte|gt|lt)\.(.*)$/);
        if (!match) throw new Error("Filtro OR inválido");
        const [, column, operator, value] = match;
        const sqlOperator = { eq: "=", gte: ">=", lte: "<=", gt: ">", lt: "<" }[operator];
        return `${identifier(column)} ${sqlOperator} ${addParam(values, parseValue(value))}`;
      });
      clauses.push(`(${orClauses.join(" OR ")})`);
      continue;
    }
    const match = raw.match(/^(eq|gte|lte|gt|lt|neq|like|is)\.(.*)$/);
    if (!match) throw new Error("Filtro SQL inválido");
    const [, operator, value] = match;
    if (key === "payload->>_revision") {
      const expression = `(payload->>'_revision')`;
      clauses.push(operator === "is" && value === "null" ? `${expression} IS NULL` : `${expression} = ${addParam(values, value)}`);
      continue;
    }
    if (operator === "is" && value === "null") { clauses.push(`${identifier(key)} IS NULL`); continue; }
    if (operator === "like") { clauses.push(`${identifier(key)} LIKE ${addParam(values, value.replace(/\*/g, "%"))}`); continue; }
    const sqlOperator = { eq: "=", gte: ">=", lte: "<=", gt: ">", lt: "<", neq: "<>" }[operator];
    if (!sqlOperator) throw new Error("Filtro SQL inválido");
    clauses.push(`${identifier(key)} ${sqlOperator} ${addParam(values, parseValue(value))}`);
  }
  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

function selectColumns(params: URLSearchParams) {
  const select = params.get("select") ?? "*";
  if (select === "*") return "*";
  return select.split(",").map((column) => identifier(column.trim())).join(", ");
}

async function postgresRest(path: string, init: RequestInit) {
  const { resource, params: urlParams } = parseResource(path);
  if (!resource.startsWith("proar_")) throw new Error("Tabela fora do escopo do ProAR");
  const table = identifier(resource);
  const values: unknown[] = [];
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
  const jsonColumns = new Set(["payload", "details", "brand_config", "modules", "permissions"]);
  const parameter = (column: string, value: unknown) => {
    if (jsonColumns.has(column)) return `${addParam(values, JSON.stringify(value))}::jsonb`;
    return addParam(values, value);
  };
  let query = "";

  if (method === "GET") {
    query = `SELECT ${selectColumns(urlParams)} FROM ${table}${buildWhere(urlParams, values)}`;
    const order = urlParams.get("order");
    if (order) {
      const [column, direction = "asc"] = order.split(".");
      query += ` ORDER BY ${identifier(column)} ${direction.toLowerCase() === "desc" ? "DESC" : "ASC"}`;
    }
    const limit = urlParams.get("limit");
    if (limit && /^\d+$/.test(limit)) query += ` LIMIT ${Number(limit)}`;
  } else if (method === "POST") {
    const records = Array.isArray(body) ? body : [body];
    if (!records.length || !records[0] || typeof records[0] !== "object") throw new Error("Payload de inserção inválido");
    const columns = Object.keys(records[0]);
    const columnSql = columns.map(identifier).join(", ");
    const rowSql = records.map((record) => `(${columns.map((column) => parameter(column, record[column])).join(", ")})`).join(", ");
    query = `INSERT INTO ${table} (${columnSql}) VALUES ${rowSql}`;
    const conflict = urlParams.get("on_conflict");
    const prefer = String(init.headers instanceof Headers ? init.headers.get("Prefer") : (init.headers as Record<string, string> | undefined)?.Prefer ?? "");
    if (conflict && prefer.includes("resolution=merge-duplicates")) {
      const conflictColumns = conflict.split(",").map(identifier).join(", ");
      const updates = columns.filter((column) => !conflict.split(",").includes(column));
      query += updates.length ? ` ON CONFLICT (${conflictColumns}) DO UPDATE SET ${updates.map((column) => `${identifier(column)} = EXCLUDED.${identifier(column)}`).join(", ")}` : ` ON CONFLICT (${conflictColumns}) DO NOTHING`;
    } else if (conflict) {
      query += ` ON CONFLICT (${conflict.split(",").map(identifier).join(", ")}) DO NOTHING`;
    }
    query += " RETURNING *";
  } else if (method === "PATCH") {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Payload de atualização inválido");
    const assignments = Object.keys(body).map((column) => `${identifier(column)} = ${parameter(column, body[column])}`).join(", ");
    const where = buildWhere(urlParams, values);
    if (!where) throw new Error("Atualização sem filtro bloqueada");
    query = `UPDATE ${table} SET ${assignments}${where} RETURNING *`;
  } else if (method === "DELETE") {
    const where = buildWhere(urlParams, values);
    if (!where) throw new Error("Exclusão sem filtro bloqueada");
    query = `DELETE FROM ${table}${where} RETURNING *`;
  } else {
    throw new Error(`Método ${method} não suportado pelo adaptador PostgreSQL`);
  }

  const rows = await primarySqlQuery(query, values);
  return new DatabaseResponse(rows);
}

export async function supabaseRest(path: string, init: RequestInit = {}) {
  const provider=databaseProvider();
  if (provider === "neon" || provider === "prisma") {
    return retryDatabaseOperation(
      () => postgresRest(path, init),
      { enabled:isReadOnlyRequest(init), attempts:3, baseDelayMs:120 },
    );
  }
  const key = supabaseServiceKey();
  if (!supabaseBaseUrl() || !key) throw new Error("Supabase não configurado");
  return resilientDatabaseFetch(`${supabaseBaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  }, { attempts:3, baseDelayMs:120, timeoutMs:6500 });
}
