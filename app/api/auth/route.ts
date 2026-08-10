import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { authenticate, createSession, readSession, type ProARUser } from "../../../lib/proar-auth";

const COOKIE_NAME = "proar_session";

function safeHashEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authenticateEmployee(username: string, password: string): Promise<ProARUser | null> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url}/rest/v1/proar_state?select=id,payload`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!response.ok) return null;
  const normalized = username.trim().toLocaleLowerCase("pt-BR");
  const suppliedHash = createHash("sha256").update(password).digest("hex");
  const rows = await response.json() as { id: string; payload?: { moduleRecords?: Record<string, Array<Record<string, unknown>>> } }[];
  for (const row of rows) {
    const employees = row.payload?.moduleRecords?.["Funcionários"] ?? [];
    const employee = employees.find(item => item.status !== "Inativo" && String(item.employeeUsername ?? "").trim().toLocaleLowerCase("pt-BR") === normalized);
    if (!employee || !employee.employeePasswordHash || !safeHashEqual(suppliedHash, String(employee.employeePasswordHash))) continue;
    const permissionsMap = (employee.employeePermissions ?? {}) as Record<string, string[]>;
    const permissions = Object.entries(permissionsMap).flatMap(([module, actions]) => actions.includes("Visualizar") ? [module, ...actions.map(action => `${module}:${action}`)] : []);
    return { username: normalized, displayName: String(employee.name || normalized), passwordHash: String(employee.employeePasswordHash), role: String(employee.employeeRole || "Utilizador"), permissions, active: true, companyId: row.id };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const user = readSession(request.cookies.get(COOKIE_NAME)?.value);
  return user
    ? NextResponse.json({ authenticated: true, username: user.username, displayName: user.displayName, role: user.role, permissions: user.permissions })
    : NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const { username = "", password = "" } = await request.json();
  const user = authenticate(String(username), String(password)) ?? await authenticateEmployee(String(username), String(password));
  if (!user) return NextResponse.json({ error: "Utilizador ou senha inválidos." }, { status: 401 });
  const response = NextResponse.json({ authenticated: true, username: user.username, displayName: user.displayName, role: user.role, permissions: user.permissions, companyId: user.companyId });
  response.cookies.set(COOKIE_NAME, createSession(user), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
