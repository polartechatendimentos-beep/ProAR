import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type ProARUser = {
  username: string;
  displayName: string;
  passwordHash: string;
  role: string;
  permissions: string[];
  active: boolean;
  companyId?: string;
  companySlug?: string;
  trialExpiresAt?: string;
};
const SESSION_SECONDS = 60 * 60 * 12;

function users(): ProARUser[] {
  const systemUsers: ProARUser[] = [{
    username: "jhonnatam.reis", displayName: "Jhonnatam Reis", passwordHash: "5994471abb01112afcc18159f6cc74b4f511b99806da59b3caf5a9c173cacfc5",
    role: "Técnico", permissions: ["Painel inicial", "Agenda", "Clientes", "Equipamentos", "Ordens de serviço", "Serviços"], active: true,
  }];
  try {
    const environmentUsers = (JSON.parse(process.env.PROAR_USERS_JSON ?? "[]") as Partial<ProARUser>[]).map(user => ({
      username: user.username ?? "", displayName: user.displayName ?? user.username ?? "", passwordHash: user.passwordHash ?? "", role: user.role ?? "Administrador", permissions: user.permissions ?? ["*"], active: user.active ?? true,
    }));
    return [...environmentUsers, ...systemUsers.filter(systemUser => !environmentUsers.some(user => user.username.toLocaleLowerCase("pt-BR") === systemUser.username))];
  } catch { return systemUsers; }
}
function safeEqual(left: string, right: string) { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
export function authenticate(username: string, password: string) {
  const normalized = username.trim().toLocaleLowerCase("pt-BR"); const user = users().find(item => item.active && item.username.toLocaleLowerCase("pt-BR") === normalized); if (!user) return null;
  const passwordHash = createHash("sha256").update(password).digest("hex"); return safeEqual(passwordHash, user.passwordHash) ? user : null;
}

function sign(payload: string) { return createHmac("sha256", process.env.PROAR_SESSION_SECRET ?? "").update(payload).digest("hex"); }
export function createSession(username: string) {
  const user = users().find(item => item.username === username); if (!user) return ""; return createSessionForUser(user);
}
export function createSessionForUser(user: Omit<ProARUser, "passwordHash" | "active">) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const data = Buffer.from(JSON.stringify({ ...user, exp: expiresAt }), "utf8").toString("base64url");
  return `v2.${data}.${sign(`v2.${data}`)}`;
}
export function readSession(token?: string | null): Omit<ProARUser, "passwordHash" | "active"> | null {
  if (!token) return null;
  if (token.startsWith("v2.")) {
    const [, data, signature] = token.split("."); if (!data || !signature || !safeEqual(signature, sign(`v2.${data}`))) return null;
    try { const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")); if (!parsed.exp || parsed.exp < Date.now() / 1000) return null; if (parsed.trialExpiresAt && new Date(parsed.trialExpiresAt).getTime() < Date.now()) return null; return { username: parsed.username, displayName: parsed.displayName, role: parsed.role, permissions: parsed.permissions ?? [], companyId: parsed.companyId, companySlug: parsed.companySlug, trialExpiresAt: parsed.trialExpiresAt }; } catch { return null; }
  }
  const [encodedUsername, expiresAt, signature] = token.split("."); if (!encodedUsername || !expiresAt || !signature || Number(expiresAt) < Date.now() / 1000) return null;
  const payload = `${encodedUsername}.${expiresAt}`; if (!safeEqual(signature, sign(payload))) return null; const username = decodeURIComponent(encodedUsername); const user = users().find(item => item.username === username); if (!user) return null;
  return { username: user.username, displayName: user.displayName, role: user.role, permissions: user.permissions };
}
