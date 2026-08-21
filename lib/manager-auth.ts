import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { requiredSecret } from "./security-env";

export const MANAGER_COOKIE = "proar_manager_session";
const ttlSeconds = 8 * 60 * 60;

const secret = () => requiredSecret("PROAR_MANAGER_SESSION_SECRET");
const managerUser = () => requiredSecret("PROAR_MANAGER_USER", 3);
// A senha continua sendo administrada pela Vercel; a exigência de comprimento
// não é aplicada aqui para não invalidar credenciais legadas antes da troca.
const managerPassword = () => requiredSecret("PROAR_MANAGER_PASSWORD", 1);

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}
function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}
export function validateManagerCredentials(username: string, password: string) {
  const a = Buffer.from(username);
  const b = Buffer.from(managerUser());
  const c = Buffer.from(password);
  const d = Buffer.from(managerPassword());
  return a.length === b.length && c.length === d.length && crypto.timingSafeEqual(a, b) && crypto.timingSafeEqual(c, d);
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
