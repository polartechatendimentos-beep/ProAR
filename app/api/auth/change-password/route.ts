import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";
import { supabaseRest } from "../../../../lib/supabase-rest";
import { hashPassword } from "../../../../lib/password";
import { tenantSlugFromHost } from "../../../../lib/tenant-host";

export async function POST(request: NextRequest) {
  const session = readSession(request.cookies.get("proar_session")?.value);
  if (!session?.companyId) return NextResponse.json({ error: "Sessão de empresa inválida." }, { status: 401 });
  const hostTenant = tenantSlugFromHost(request.headers.get("host"));
  if (hostTenant && session.companySlug && hostTenant !== session.companySlug) return NextResponse.json({ error: "Sessão não pertence a esta empresa." }, { status: 403 });
  const { password = "" } = await request.json();
  const raw = String(password);
  if (raw.length < 10 || !/[A-Z]/.test(raw) || !/[a-z]/.test(raw) || !/\d/.test(raw)) {
    return NextResponse.json({ error: "Use pelo menos 10 caracteres, com maiúscula, minúscula e número." }, { status: 400 });
  }
  const response = await supabaseRest(`proar_trial_users?company_id=eq.${encodeURIComponent(session.companyId)}&username=eq.${encodeURIComponent(session.username)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ password_hash: hashPassword(raw), must_change_password: false, updated_at: new Date().toISOString() }),
  });
  return response.ok ? NextResponse.json({ saved: true }) : NextResponse.json({ error: "Não foi possível alterar a senha." }, { status: 502 });
}
