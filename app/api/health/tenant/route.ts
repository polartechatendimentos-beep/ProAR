import { NextRequest, NextResponse } from "next/server";
import { tenantSlugFromHost } from "../../../../lib/tenant-host";
import { supabaseConfigured, supabaseRest } from "../../../../lib/supabase-rest";

export async function GET(request: NextRequest) {
  const tenant = tenantSlugFromHost(request.headers.get("host"));
  if (!tenant) return NextResponse.json({ ok: true, scope: "platform", login: "/" }, { headers: { "Cache-Control": "no-store" } });

  let registered: boolean | null = null;
  let status: string | null = null;
  if (supabaseConfigured()) {
    try {
      const response = await supabaseRest(`proar_companies?select=slug,status&slug=eq.${encodeURIComponent(tenant)}&limit=1`);
      const rows = response.ok ? await response.json() : [];
      registered = Boolean(rows[0]);
      status = rows[0]?.status || null;
    } catch { registered = null; }
  }

  return NextResponse.json({
    ok: true,
    tenant,
    registered,
    status,
    publicEntry: "/",
    aliases: ["/login", "/auth", "/signin"],
    checkedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
