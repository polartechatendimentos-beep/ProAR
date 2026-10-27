import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";
import { IMPORTED_SERVICES } from "../../../../lib/imported-services";

export async function GET(request: NextRequest) {
  const session = readSession(request.cookies.get("proar_session")?.value);
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  return NextResponse.json({ services: IMPORTED_SERVICES }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" }
  });
}
