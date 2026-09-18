import crypto from "crypto";

export interface UserSession {
  id: number;
  email: string;
  nome: string;
  role: string;
  companyId?: number;
  exp?: number;
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET/AUTH_SECRET não configurado.");
  return "proar-development-only-secret";
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function signToken(payload: Omit<UserSession, "exp">, expiresInSeconds = 7 * 24 * 60 * 60): string {
  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = crypto.createHmac("sha256", jwtSecret()).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function validateAuthToken(token: string): Promise<UserSession | null> {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto.createHmac("sha256", jwtSecret()).update(`${encodedHeader}.${encodedPayload}`).digest("base64url");
  if (!signaturesMatch(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as UserSession;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readSession(request: Request): Promise<UserSession | null> {
  let token: string | null = null;
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) token = authorization.substring(7).trim();
  if (!token) {
    const cookieHeader = request.headers.get("cookie");
    const match = cookieHeader?.match(/(?:^|;\s*)proar_session=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return null;
  return validateAuthToken(token);
}

export async function requireAuth(request: Request): Promise<UserSession> {
  const session = await readSession(request);
  if (!session) throw new Error("Não autorizado: Sessão inválida ou expirada");
  return session;
}
