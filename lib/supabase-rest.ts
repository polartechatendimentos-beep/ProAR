import { neon } from "@neondatabase/serverless";

const supabaseBaseUrl = () =>
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://tnjkdurifalrdnttsova.supabase.co").replace(/\/$/, "");
const supabaseServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const databaseProvider = () => (process.env.PROAR_DATABASE_PROVIDER ?? "supabase").toLowerCase();
const neonDatabaseUrl = () =>
  process.env.PROAR_NEON_DATABASE_URL ??
  process.env.PROAR_NEON_POSTGRES_URL ??
  process.env.PROAR_NEON_POSTGRES_URL_NON_POOLING ??
  process.env.PROAR_NEON_DATABASE_URL_UNPOOLED;

export function supabaseConfigured() {
  if (databaseProvider() === "neon") return Boolean(neonDatabaseUrl());
  return Boolean(supabaseBaseUrl() && supabaseServiceKey());
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
  const decoded = decodeURIComponent(raw);
  if (decoded === "null") return null;
  if (decoded === "true") return true;
  if (decoded === "false") return false;
  return decoded;
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
      const inner = decodeURIComponent(raw).replace(/^\(|\)$/g, "").split(",");
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
    const match = raw.match(/^(eq|gte|lte|gt|lt|neq)\.(.*)$/);
    if (!match) continue;
    const [, operator, value] = match;
    const sqlOperator = { eq: "=", gte: ">=", lte: "<=", gt: ">", lt: "<", neq: "<>" }[operator];
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
  const table = identifier(resource);
  const values: unknown[] = [];
  const method = (init.method ?? "GET").toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) : undefined;
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
    const rowSql = records.map((record) => `(${columns.map((column) => addParam(values, record[column])).join(", ")})`).join(", ");
    query = `INSERT INTO ${table} (${columnSql}) VALUES ${rowSql}`;
    const conflict = urlParams.get("on_conflict");
    const prefer = String(init.headers instanceof Headers ? init.headers.get("Prefer") : (init.headers as Record<string, string> | undefined)?.Prefer ?? "");
    if (conflict && prefer.includes("resolution=merge-duplicates")) {
      const conflictColumns = conflict.split(",").map(identifier).join(", ");
      query += ` ON CONFLICT (${conflictColumns}) DO UPDATE SET ${columns.filter((column) => !conflict.split(",").includes(column)).map((column) => `${identifier(column)} = EXCLUDED.${identifier(column)}`).join(", ")}`;
    } else if (conflict) {
      query += ` ON CONFLICT (${conflict.split(",").map(identifier).join(", ")}) DO NOTHING`;
    }
    query += " RETURNING *";
  } else if (method === "PATCH") {
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Payload de atualização inválido");
    const assignments = Object.keys(body).map((column) => `${identifier(column)} = ${addParam(values, body[column])}`).join(", ");
    query = `UPDATE ${table} SET ${assignments}${buildWhere(urlParams, values)} RETURNING *`;
  } else if (method === "DELETE") {
    query = `DELETE FROM ${table}${buildWhere(urlParams, values)} RETURNING *`;
  } else {
    throw new Error(`Método ${method} não suportado pelo adaptador Neon`);
  }

  const rows = await sql.query(query, values);
  return new NeonResponse(rows, method === "DELETE" ? 200 : 200);
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
