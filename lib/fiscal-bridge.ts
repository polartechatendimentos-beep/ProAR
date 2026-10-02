import { createHash } from "node:crypto";

export function fiscalBridgeConfiguration() {
  const baseUrl = String(process.env.PROAR_FISCAL_BRIDGE_URL || "").replace(/\/$/, "");
  const token = String(process.env.PROAR_FISCAL_BRIDGE_TOKEN || "");
  return { baseUrl, token, configured: Boolean(baseUrl && token) };
}

export function fiscalIdempotencyKey(companyId: string, action: string, documentId: string, payload: unknown) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ companyId, action, documentId, payload }))
    .digest("hex");
  return `proar-${action}-${fingerprint.slice(0, 48)}`;
}

export async function callFiscalBridge(input: {
  companyId: string;
  action: string;
  documentId: string;
  path: string;
  body: unknown;
  timeoutMs?: number;
}) {
  const bridge = fiscalBridgeConfiguration();
  if (!bridge.configured) {
    return {
      configured: false as const,
      response: null,
      data: { status: "integration_required", error: "A ponte fiscal homologada ainda não está configurada no servidor." },
      idempotencyKey: "",
    };
  }

  const idempotencyKey = fiscalIdempotencyKey(input.companyId, input.action, input.documentId, input.body);
  const response = await fetch(`${bridge.baseUrl}${input.path.startsWith("/") ? "" : "/"}${input.path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${bridge.token}`,
      "X-ProAR-Company": input.companyId,
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(input.timeoutMs ?? 45_000),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  return { configured: true as const, response, data, idempotencyKey };
}
