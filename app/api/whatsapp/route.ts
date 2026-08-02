import { NextRequest, NextResponse } from "next/server";
import { readSession } from "../../../lib/proar-auth";
import { loadWhatsAppConfig, publicWhatsAppConfig, saveWhatsAppConfig, testWhatsAppConnection, type WhatsAppConfig } from "../../../lib/proar-whatsapp";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const user = readSession(request.cookies.get("proar_session")?.value);
  return user && (user.permissions.includes("*") || user.permissions.includes("Configurações")) ? user : null;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try { return NextResponse.json(publicWhatsAppConfig(await loadWhatsAppConfig())); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao carregar a configuração" }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  const user = authorized(request);
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const body = await request.json() as Partial<WhatsAppConfig>;
    const current = await loadWhatsAppConfig();
    const config: WhatsAppConfig = { ...current, ...body, accessToken: body.accessToken?.trim() || current.accessToken, updatedAt: new Date().toISOString(), updatedBy: user.displayName };
    await saveWhatsAppConfig(config);
    return NextResponse.json(publicWhatsAppConfig(config));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao guardar a configuração" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const config = await loadWhatsAppConfig();
    const result = await testWhatsAppConnection(config);
    return NextResponse.json({ connected: true, ...result });
  } catch (error) { return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : "Falha ao testar a conexão" }, { status: 400 }); }
}
