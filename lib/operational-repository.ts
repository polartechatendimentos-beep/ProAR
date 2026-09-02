import { supabaseRest } from "./supabase-rest";

type OperationalUser = {
  companyId?: string;
  username?: string;
  displayName?: string;
};

const ALLOWED_TABLES = new Set([
  "proar_attachments",
  "proar_audit_events",
  "proar_work_contacts",
  "proar_work_change_requests",
  "proar_work_consumptions",
]);

function assertTable(table: string) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Tabela operacional não permitida: ${table}`);
  }
}

function companyIdFor(user: OperationalUser) {
  const companyId = user.companyId || process.env.PROAR_PRIMARY_COMPANY_ID;
  if (!companyId) {
    throw new Error("Empresa não identificada na sessão.");
  }
  return companyId;
}

function appendCompanyFilter(query: string, companyId: string) {
  const companyFilter = `company_id=eq.${encodeURIComponent(companyId)}`;
  if (!query) return companyFilter;
  return `${companyFilter}&${query}`;
}

export async function listOperational<T = Record<string, unknown>>(
  user: OperationalUser,
  table: string,
  query = "",
): Promise<T[]> {
  assertTable(table);
  const companyId = companyIdFor(user);
  const path = `${table}?select=*&${appendCompanyFilter(query, companyId)}`;
  const response = await supabaseRest(path, { method: "GET" });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha ao consultar ${table}: ${response.status} ${detail}`.trim());
  }

  return (await response.json()) as T[];
}

export async function insertOperational<T = Record<string, unknown>>(
  user: OperationalUser,
  table: string,
  data: Record<string, unknown>,
): Promise<T[]> {
  assertTable(table);
  const companyId = companyIdFor(user);
  const response = await supabaseRest(table, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...data,
      company_id: companyId,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha ao inserir em ${table}: ${response.status} ${detail}`.trim());
  }

  return (await response.json()) as T[];
}
