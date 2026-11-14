import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { requiredSecret } from "./security-env.ts";

export const MANAGER_COOKIE = "proar_manager_session";
const ttlSeconds = 8 * 60 * 60;

const secret = () => requiredSecret("PROAR_MANAGER_SESSION_SECRET");
const BOOTSTRAP_MANAGER_USER = "admin";
const managerUser = () => process.env.PROAR_MANAGER_USER?.trim() || BOOTSTRAP_MANAGER_USER;
const managerPassword = () => process.env.PROAR_MANAGER_PASSWORD || "";


function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}
function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}
export function validateManagerCredentials(username: string, password: string) {
  const a = Buffer.from(username);
  const b = Buffer.from(managerUser());
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const configured = managerPassword();
  if (configured) {
    const c = Buffer.from(password);
    const d = Buffer.from(configured);
    return c.length === d.length && crypto.timingSafeEqual(c, d);
  }
  return false; // No shared bootstrap credential: missing configuration fails closed.
}
export function createManagerSession() {
  const data = JSON.stringify({ username: managerUser(), role: "TAVS_MANAGER", exp: Math.floor(Date.now()/1000) + ttlSeconds });
  const payload = b64url(data);
  return `${payload}.${sign(payload)}`;
}
export function readManagerSession(request: NextRequest) {
  const token = request.cookies.get(MANAGER_COOKIE)?.value || "";
  const parts = token.split(".");
  if (parts.length !== 2 || token.length > 4096) return null;
  const [payload, signature] = parts;
  if (!payload || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed?.role !== "TAVS_MANAGER" || parsed.username !== managerUser() || typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp <= Math.floor(Date.now()/1000)) return null;
    return parsed as {username:string;role:string;exp:number};
  } catch { return null; }
}
