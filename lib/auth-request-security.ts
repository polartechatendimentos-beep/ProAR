/** Browser mutation checks and bounded parsing, before credential/database work. */
export class AuthRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function assertAuthOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  if (site === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    throw new AuthRequestError("Origem da solicitação não autorizada.", 403);
  }
}

export async function readAuthBody(request: Request): Promise<Record<string, unknown>> {
  assertAuthOrigin(request);
  const maxBytes = 8192;
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
    throw new AuthRequestError("Solicitação muito grande.", 413);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AuthRequestError("Envie os dados em JSON.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AuthRequestError("Dados inválidos.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AuthRequestError("Solicitação muito grande.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("object required");
    return body as Record<string, unknown>;
  } catch { throw new AuthRequestError("Dados inválidos.", 400); }
}

export function authString(body: Record<string, unknown>, field: string, max = 256): string {
  const value = body[field] ?? "";
  if (typeof value !== "string" || value.length > max) {
    throw new AuthRequestError("Dados de autenticação inválidos.", 400);
  }
  return value;
}
