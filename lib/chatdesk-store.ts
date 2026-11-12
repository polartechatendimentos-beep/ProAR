import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { sessionFromRequest, hasPermission } from "./permissions";
import { assertActiveWhatsAppCompany } from "./evolution-tenant";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";
import { databaseFetch, supabaseRest } from "./supabase-rest";
import { commitJsonState } from "./state-commit";
import { chatSectors, canReadChat, type ChatActor, type ChatConversation, type ChatSector, type LocalChatSettings } from "./chatdesk-local";

export function chatAccess(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (!session?.companyId) return null;
  const expected = request.headers.get("x-proar-company-id");
  if (expected && expected !== session.companyId) return null;
  const admin = session.role === "Administrador" || session.permissions.includes("*");
  const sectors: ChatSector[] = [], writeSectors: ChatSector[] = [];
  if (admin) { sectors.push(...chatSectors); writeSectors.push(...chatSectors); }
  else {
    if (hasPermission(session, "clientes.visualizar")) sectors.push("Geral", "Comercial");
    if (hasPermission(session, "os.visualizar")) sectors.push("Técnico", "PMOC");
    if (hasPermission(session, "financeiro.visualizar")) sectors.push("Financeiro");
    if (hasPermission(session, "clientes.editar")) writeSectors.push("Geral");
    if (hasPermission(session, "comercial.editar")) writeSectors.push("Comercial");
    if (hasPermission(session, "os.editar")) writeSectors.push("Técnico", "PMOC");
    if (hasPermission(session, "financeiro.editar")) writeSectors.push("Financeiro");
  }
  if (!sectors.length) return null;
  const actor: ChatActor = { username: session.username, displayName: session.displayName, role: session.role, sectors, writeSectors, canWrite: writeSectors.length > 0, admin };
  return { companyId: session.companyId, actor, session };
}
export const chatPrefix = (companyId: string) => `chatdesk:${createHash("sha256").update(companyId).digest("hex")}:`;
export const chatRecordId = (companyId: string, phone: string) => {
  if (!/^[1-9]\d{9,14}$/.test(phone)) throw new Error("Telefone inválido.");
  return chatPrefix(companyId) + phone;
};
export async function chatDb(companyId: string) {
  const db = await resolveTenantDb(companyId);
  if (!db.url || !db.key) throw new Error("Base da empresa indisponível.");
  return db;
}
export async function readChat(companyId: string, phone: string) {
  const db = await chatDb(companyId);
  const response = await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${encodeURIComponent(chatRecordId(companyId, phone))}&limit=1`, { headers: tenantHeaders(db.key), cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível consultar o atendimento.");
  const rows = await response.json() as { payload: ChatConversation }[];
  const chat = rows[0]?.payload;
  if (chat && (chat.companyId !== companyId || chat.phone !== phone)) throw new Error("Registro de outra empresa recusado.");
  return chat || null;
}
export async function changeChat(companyId: string, phone: string, transform: (chat: ChatConversation | null) => ChatConversation | null) {
  const db = await chatDb(companyId);
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = await readChat(companyId, phone);
    const next = transform(previous);
    if (!next) return { chat: previous, changed: false };
    if (next.companyId !== companyId || next.phone !== phone) throw new Error("Atendimento inválido.");
    next.revision = (previous?.revision || 0) + 1;
    const result = await commitJsonState(databaseFetch, db.url, tenantHeaders(db.key), chatRecordId(companyId, phone), previous as unknown as Record<string, unknown> | null, next as unknown as Record<string, unknown>);
    if (result.ok) return { chat: next, changed: true };
    if (!result.conflict) throw new Error("Não foi possível salvar o atendimento.");
  }
  throw new Error("Outro colaborador atualizou este atendimento. Atualize e tente novamente.");
}
export async function listChats(companyId: string, actor: ChatActor, offset: number) {
  const db = await chatDb(companyId);
  const response = await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=like.${chatPrefix(companyId)}*&order=updated_at.desc&limit=101&offset=${offset}`, { headers: tenantHeaders(db.key), cache: "no-store" });
  if (!response.ok) throw new Error("Fila indisponível.");
  const rows = await response.json() as { payload: ChatConversation }[];
  return { items: rows.slice(0, 100).map(row => row.payload).filter(chat => chat.companyId === companyId && canReadChat(actor, chat)).map(chat => ({ ...chat, messages: chat.messages.slice(-1), requests: [] })), hasMore: rows.length > 100, nextOffset: offset + Math.min(rows.length, 100) };
}
const settingsId = (companyId: string) => `chatdesk-settings:${createHash("sha256").update(companyId).digest("hex")}`;
export async function chatSettings(companyId: string): Promise<LocalChatSettings> {
  const db = await chatDb(companyId);
  const response = await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${settingsId(companyId)}&limit=1`, { headers: tenantHeaders(db.key), cache: "no-store" });
  if (!response.ok) throw new Error("Configuração do assistente indisponível.");
  const rows = await response.json();
  const stored = rows[0]?.payload;
  if (stored && stored.companyId !== companyId) throw new Error("Configuração inválida.");
  if (stored) return stored;
  const companyResponse = await supabaseRest(`proar_companies?select=id,trade_name,legal_name&id=eq.${encodeURIComponent(companyId)}&limit=1`);
  if (!companyResponse.ok) throw new Error("Não foi possível carregar a identificação da empresa.");
  const companies = await companyResponse.json();
  if (companies[0]?.id !== companyId) throw new Error("Empresa não identificada.");
  return { companyId, revision: 0, botEnabled: false, companyName: String(companies[0].trade_name || companies[0].legal_name || "").slice(0, 100), greeting: "" };
}
export async function saveChatSettings(companyId: string, input: { revision: number; botEnabled: boolean; companyName: string; greeting: string }) {
  await assertActiveWhatsAppCompany(companyId);
  const db = await chatDb(companyId);
  const previous = await chatSettings(companyId);
  if (input.revision !== previous.revision) throw new Error("Configuração alterada por outro administrador. Atualize a página.");
  const payload = { companyId, revision: previous.revision + 1, botEnabled: input.botEnabled === true, companyName: String(input.companyName || "").trim().slice(0, 100), greeting: String(input.greeting || "").trim().slice(0, 500) };
  const result = await commitJsonState(databaseFetch, db.url, tenantHeaders(db.key), settingsId(companyId), previous.revision ? previous as unknown as Record<string, unknown> : null, payload);
  if (!result.ok) throw new Error("Não foi possível salvar. Atualize a configuração e tente novamente.");
  return payload;
}
