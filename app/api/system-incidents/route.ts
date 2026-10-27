import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../lib/permissions";
import { supabaseRest } from "../../../lib/supabase-rest";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = requirePermission(request, "integridade.visualizar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const scope = sessionCompany(access.session);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  const limit = Math.max(10, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || 40)));
  try {
    const response = await supabaseRest(`proar_system_incidents?company_id=eq.${encodeURIComponent(scope.companyId)}&select=*&order=created_at.desc&limit=${limit}`);
    if (!response.ok) return NextResponse.json({ incidents: [], storageReady: false });
    return NextResponse.json({ incidents: await response.json(), storageReady: true });
  } catch {
    return NextResponse.json({ incidents: [], storageReady: false });
  }
}
