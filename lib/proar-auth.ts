import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type ProARUser = { username: string; displayName: string; passwordHash: string };
const SESSION_SECONDS = 60 * 60 * 12;

function users(): ProARUser[] {
  try { return JSON.parse(process.env.PROAR_USERS_JSON ?? "[]") as ProARUser[]; }
  catch { return []; }
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authenticate(username: string, password: string) {
  const normalized = username.trim().toLocaleLowerCase("pt-BR");
  const user = users().find(item => item.username.toLocaleLowerCase("pt-BR") === normalized);
  if (!user) return null;
  const passwordHash = createHash("sha256").update(password).digest("hex");
  return safeEqual(passwordHash, user.passwordHash) ? user : null;
}

export function createSession(username: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${encodeURIComponent(username)}.${expiresAt}`;
  const signature = createHmac("sha256", process.env.PROAR_SESSION_SECRET ?? "").update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function readSession(token?: string | null) {
  if (!token) return null;
  const [encodedUsername, expiresAt, signature] = token.split(".");
  if (!encodedUsername || !expiresAt || !signature || Number(expiresAt) < Date.now() / 1000) return null;
  const payload = `${encodedUsername}.${expiresAt}`;
  const expected = createHmac("sha256", process.env.PROAR_SESSION_SECRET ?? "").update(payload).digest("hex");
  if (!safeEqual(signature, expected)) return null;
  const username = decodeURIComponent(encodedUsername);
  return users().find(item => item.username === username) ?? null;
}
