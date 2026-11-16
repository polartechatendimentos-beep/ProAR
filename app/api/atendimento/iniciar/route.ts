import { NextRequest, NextResponse } from "next/server";
import { chatAccess, readChat, changeChat } from "../../../../lib/chatdesk-store";
import { canReadChat, type ChatConversation } from "../../../../lib/chatdesk-local";
import { assertActiveWhatsAppCompany, evolutionConnection } from "../../../../lib/evolution-tenant";
import { evolutionRequestWithConfig } from "../../../../lib/proar-evolution";
import { normalizeWhatsAppPhone, whatsappNumberExists } from "../../../../lib/chatdesk-phone";

export const runtime = "nodejs";
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") !== "same-origin" ||
      (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin))
    return response({ error: "Origem inválida." }, 403);
  const access = chatAccess(request);
  if (!access || (!access.actor.admin && !access.actor.writeSectors.includes("Geral")))
    return response({ error: "Sem permissão para iniciar atendimentos." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 1000) return response({ error: "Solicitação muito grande." }, 413);
    const input = JSON.parse(raw) as { phone?: unknown };
    if (!input || typeof input !== "object" || typeof input.phone !== "string")
      return response({ error: "Informe um telefone." }, 400);
    const phone = normalizeWhatsAppPhone(input.phone);
    await assertActiveWhatsAppCompany(access.companyId);
    const connection = await evolutionConnection(access.companyId);
    if (!connection) return response({ error: "WhatsApp desta empresa não está configurado." }, 409);
    const status = await evolutionRequestWithConfig(connection.config, "instance/connectionState");
    if (status?.instance?.state !== "open")
      return response({ error: "WhatsApp desconectado. Conecte a instância antes de verificar o número." }, 409);
    const checked = await evolutionRequestWithConfig(connection.config, "chat/whatsappNumbers", { numbers: [phone] });
    if (!whatsappNumberExists(checked, phone))
      return response({ error: "O provedor informou que este número não possui WhatsApp.", exists: false }, 422);

    const previous = await readChat(access.companyId, phone);
    if (previous) {
      if (!canReadChat(access.actor, previous)) return response({ error: "Conversa existente vinculada a outro setor. Solicite acesso ao responsável." }, 403);
      return response({ phone, exists: true, created: false, optOut: previous.optOut, message: "Número confirmado. Conversa existente localizada." });
    }
    // Start only a conversation record. Never send unsolicited outbound messages here.
    const now = new Date().toISOString();
    await changeChat(access.companyId, phone, current => current ? null : ({
      companyId: access.companyId, phone, name: phone, sector: "Geral", stage: "Novo contato",
      assignee: "", revision: 0, botPaused: true, optOut: false, messages: [], requests: [], updatedAt: now,
    } satisfies ChatConversation));
    return response({ phone, exists: true, created: true, message: "WhatsApp confirmado. Atendimento pronto para escrever; nenhuma mensagem foi enviada." });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Não foi possível validar este telefone." }, 400);
  }
}
