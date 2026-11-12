import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../../lib/proar-auth";
import { assertActiveWhatsAppCompany, ensureEvolutionConnection, evolutionConnection, managedEvolutionAvailable, setEvolutionAutomation } from "../../../../lib/evolution-tenant";
import { evolutionRequestWithConfig } from "../../../../lib/proar-evolution";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private" };
function operator(request: NextRequest) {
  const session = readSession(request.cookies.get("proar_session")?.value);
  return session?.companyId && (session.permissions.includes("*") || session.permissions.includes("Configurações")) ? { ...session, companyId: session.companyId } : null;
}
function sameOrigin(request: NextRequest) {
  return request.headers.get("sec-fetch-site") === "same-origin" &&
    (!request.headers.get("origin") || request.headers.get("origin") === request.nextUrl.origin);
}
async function connection(request: NextRequest, pair: boolean) {
  const session = operator(request);
  if (!session) return NextResponse.json({ error: "Acesso restrito à configuração da empresa." }, { status: 403, headers });
  try {
    await assertActiveWhatsAppCompany(session.companyId);
    const stored = pair ? await ensureEvolutionConnection(session.companyId) : await evolutionConnection(session.companyId);
    if (!stored) return NextResponse.json({ configured: managedEvolutionAvailable(), needsProvisioning: true, state: "close", automationEnabled: false }, { headers });
    const status = await evolutionRequestWithConfig(stored.config, "instance/connectionState");
    const state = status.instance?.state;
    if (!["open", "connecting", "close"].includes(state)) throw new Error("Estado de conexão não reconhecido.");
    const result = { configured: true, state, automationEnabled: stored.automationEnabled, automationAvailable: process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED === "true" };
    if (!pair || state === "open") return NextResponse.json(result, { headers });
    const connected = await evolutionRequestWithConfig(stored.config, "instance/connect");
    const qr = connected.base64;
    if (typeof qr !== "string" || qr.length > 150_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(qr)) {
      return NextResponse.json({ ...result, error: "O QR Code ainda não está pronto. Aguarde e tente novamente." }, { status: 502, headers });
    }
    return NextResponse.json({ ...result, state: "connecting", qr }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível consultar o WhatsApp." }, { status: 502, headers });
  }
}
export const GET = (request: NextRequest) => connection(request, false);
export function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
  return connection(request, true);
}
export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403, headers });
  const session = operator(request);
  if (!session) return NextResponse.json({ error: "Acesso restrito à configuração da empresa." }, { status: 403, headers });
  try {
    const body = await request.json();
    if (typeof body.automationEnabled !== "boolean") return NextResponse.json({ error: "Informe se deseja ativar os envios." }, { status: 400, headers });
    await setEvolutionAutomation(session.companyId, body.automationEnabled);
    return connection(request, false);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível salvar a configuração." }, { status: 400, headers });
  }
}
