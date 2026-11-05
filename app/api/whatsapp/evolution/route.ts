import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { readEvolutionStatus, requestEvolutionQr } from "../../../../lib/whatsapp-evolution-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: NextRequest) {
  const access = requirePermission(request, "configuracoes.editar");
  if (!access.ok) return { error: NextResponse.json({ error: access.error }, { status: access.status }) };
  if (!access.session.companyId) return { error: NextResponse.json({ error: "Empresa não identificada" }, { status: 403 }) };
  return { companyId: access.session.companyId };
}
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha na conexão Evolution";
  const configured = message.includes("não configurado") || message.includes("não habilitada");
  return NextResponse.json({ error: message }, { status: configured ? 503 : 502, headers: { "Cache-Control": "no-store" } });
}
export async function GET(request: NextRequest) {
  const auth = authorize(request);
  if (auth.error) return auth.error;
  try { return NextResponse.json(await readEvolutionStatus(auth.companyId!), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: NextRequest) {
  const auth = authorize(request);
  if (auth.error) return auth.error;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  try { return NextResponse.json(await requestEvolutionQr(auth.companyId!), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return failure(error); }
}
