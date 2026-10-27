import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseRest } from "./supabase-rest";
import { classifyProarError, type ProARErrorCode } from "./system-errors";

export type IncidentSeverity = "info" | "warning" | "error" | "critical";

export type SystemIncidentInput = {
  companyId?: string;
  module: string;
  operation: string;
  error?: unknown;
  code?: ProARErrorCode;
  severity?: IncidentSeverity;
  requestId?: string;
  route?: string;
  metadata?: Record<string, unknown>;
};

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") {
    const text = typeof value === "string" ? value : value;
    if (typeof text === "string" && text.length > 500) return `${text.slice(0, 500)}…`;
    return text;
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/password|secret|token|authorization|cookie|certificate|private|key/i.test(key)) continue;
    out[key] = sanitize(item, depth + 1);
  }
  return out;
}

function technicalMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 700);
  if (typeof error === "string") return error.slice(0, 700);
  try { return JSON.stringify(sanitize(error)).slice(0, 700); }
  catch { return "Falha não serializável"; }
}

export async function recordSystemIncident(input: SystemIncidentInput) {
  const descriptor = input.code ? classifyProarError(input.code) : classifyProarError(input.error);
  const id = `INC-${randomUUID()}`;
  const payload = {
    id,
    company_id: input.companyId || null,
    module: input.module.slice(0, 80),
    operation: input.operation.slice(0, 120),
    code: input.code || descriptor.code,
    severity: input.severity || descriptor.severity,
    user_message: descriptor.userMessage,
    technical_message: technicalMessage(input.error),
    request_id: input.requestId?.slice(0, 120) || null,
    route: input.route?.slice(0, 240) || null,
    metadata: sanitize(input.metadata || {}),
    created_at: new Date().toISOString(),
  };

  console.error("[PROAR_INCIDENT]", payload);
  try {
    const response = await supabaseRest("proar_system_incidents", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(payload),
    });
    return { id, persisted: response.ok };
  } catch {
    return { id, persisted: false };
  }
}
