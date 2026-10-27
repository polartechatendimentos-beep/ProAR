import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { requiredSecret } from "./security-env";
import { verifyPassword } from "./password";

export const MANAGER_COOKIE = "proar_manager_session";
const ttlSeconds = 8 * 60 * 60;

const secret = () => requiredSecret("PROAR_MANAGER_SESSION_SECRET");
const BOOTSTRAP_MANAGER_USER = "admin";
const BOOTSTRAP_MANAGER_PASSWORD_HASH = "scrypt$1a7f50bae6faa16d36ac069d7ac78e76$5929029064442a06249c315add6203757af6839e458abc53b8c2cb95e95be191207ce629e2a38a49cb420cd64a93ea03cc4a6162649ea93ee644eaec4ae46503";
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
  return username === BOOTSTRAP_MANAGER_USER && verifyPassword(password, BOOTSTRAP_MANAGER_PASSWORD_HASH);
}
export function createManagerSession() {
  const data = JSON.stringify({ username: managerUser(), role: "TAVS_MANAGER", exp: Math.floor(Date.now()/1000) + ttlSeconds });
  const payload = b64url(data);
  return `${payload}.${sign(payload)}`;
}
export function readManagerSession(request: NextRequest) {
  const token = request.cookies.get(MANAGER_COOKIE)?.value || "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed?.role !== "TAVS_MANAGER" || Number(parsed?.exp || 0) <= Math.floor(Date.now()/1000)) return null;
    return parsed as {username:string;role:string;exp:number};
  } catch { return null; }
}
