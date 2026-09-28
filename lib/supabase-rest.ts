import { neon } from "@neondatabase/serverless";

const supabaseBaseUrl = () =>
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tnjkdurifalrdnttsova.supabase.co").replace(/\/$/, "");
const supabaseServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const databaseProvider = () => (process.env.PROAR_DATABASE_PROVIDER ?? "supabase").toLowerCase();
export const neonEnabled = () => databaseProvider() === "neon";
export const PRIMARY_DATABASE_URL = "neon://proar-primary";
const neonDatabaseUrl = () =>
  process.env.PROAR_NEON_DATABASE_URL ??
  process.env.PROAR_NEON_POSTGRES_URL ??
  process.env.PROAR_NEON_POSTGRES_URL_NON_POOLING ??
  process.env.PROAR_NEON_DATABASE_URL_UNPOOLED;

export function supabaseConfigured() {
  if (databaseProvider() === "neon") return Boolean(neonDatabaseUrl());
  return Boolean(supabaseBaseUrl() && supabaseServiceKey());
}

export function masterDatabaseConfig() {
  if (neonEnabled()) return { url: PRIMARY_DATABASE_URL, key: neonDatabaseUrl() ? "configured" : "" };
  return { url: supabaseBaseUrl(), key: supabaseServiceKey() ?? "" };
}

/** Routes for dedicated Supabase tenants keep their original HTTP connection. */
export async function databaseFetch(input: string, init: RequestInit = {}): Promise<Response> {
  if (input.startsWith(`${PRIMARY_DATABASE_URL}/rest/v1/`)) {
    return supabaseRest(input.slice(`${PRIMARY_DATABASE_URL}/rest/v1/`.length), init) as Promise<Response>;
  }
  return fetch(input, init);
}

class NeonResponse {
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

async function neonRest(path: string, init: RequestInit) {
  const connectionString = neonDatabaseUrl();
  if (!connectionString) throw new Error("Neon não configurado");
  const sql = neon(connectionString);
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
    throw new Error(`Método ${method} não suportado pelo adaptador Neon`);
  }

  const rows = await sql.query(query, values);
  return new NeonResponse(rows);
}

export async function supabaseRest(path: string, init: RequestInit = {}) {
  if (databaseProvider() === "neon") return neonRest(path, init);
  const key = supabaseServiceKey();
  if (!supabaseBaseUrl() || !key) throw new Error("Supabase não configurado");
  return fetch(`${supabaseBaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
}
