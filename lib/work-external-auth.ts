import crypto from "crypto";

export interface WorkExternalSession {
  accessId: number;
  workId: number;
  companyId: number;
  tipo: "engenharia" | "fiscalizacao";
  nome: string;
  funcao: string;
  tokenVersion: string;
  exp?: number;
}

const SECRET = process.env.WORK_EXTERNAL_AUTH_SECRET || process.env.AUTH_SECRET || "work-external-secret-2026";

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return Buffer.from(base64, "base64").toString("utf8");
}

export function signWorkExternalToken(
  payload: Omit<WorkExternalSession, "exp">,
  expiresInSeconds: number = 12 * 60 * 60
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = { ...payload, exp };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function validateWorkExternalToken(token: string): WorkExternalSession | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as WorkExternalSession;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readWorkExternalSession(request: Request): WorkExternalSession | null {
  const fromHeader = request.headers.get("x-work-external-auth") || "";
  if (fromHeader) {
    return validateWorkExternalToken(fromHeader.trim());
  }

  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("External ")) {
    return validateWorkExternalToken(auth.slice(9).trim());
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/proar_work_access=([^;]+)/);
  if (match?.[1]) {
    return validateWorkExternalToken(decodeURIComponent(match[1]));
  }

  return null;
}
