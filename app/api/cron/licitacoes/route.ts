import { NextRequest, NextResponse } from "next/server";
import { searchAutomaticTenders, type PncpTender } from "../../licitacoes/route";
import { loadWhatsAppConfig, sendWhatsAppTemplate } from "../../../../lib/proar-whatsapp";

export const runtime = "nodejs";
export const maxDuration = 120;

type TenderStore = { items: (PncpTender & { discoveredAt: string; whatsappStatus?: string })[]; lastScan?: string; lastError?: string };

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase não configurado");
  return { url, key };
}

async function loadStore(): Promise<TenderStore> {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/proar_state?id=eq.licitacoes&select=payload`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  return rows[0]?.payload ?? { items: [] };
}

async function saveStore(store: TenderStore) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "licitacoes", payload: store, updated_at: new Date().toISOString() }) });
  if (!response.ok) throw new Error(await response.text());
}

async function notifyWhatsApp(items: PncpTender[]) {
  const config = await loadWhatsAppConfig();
  if (!config.active || !config.accessToken || !config.phoneNumberId || !items.length) return "Aguardando configuração da API oficial do WhatsApp";
  const first = items[0];
  const url = first.orgaoEntidade?.cnpj && first.anoCompra && first.sequencialCompra ? `https://pncp.gov.br/app/editais/${first.orgaoEntidade.cnpj}/${first.anoCompra}/${first.sequencialCompra}` : "https://pncp.gov.br/app/editais";
  await sendWhatsAppTemplate(config, config.tenderTo, config.tenderTemplate, [String(items.length), (first.objetoCompra ?? "Nova oportunidade").slice(0, 180), url]);
  return "Enviado";
}

async function processCustomerReminders() {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/proar_state?id=eq.main&select=payload`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!response.ok) throw new Error(await response.text());
  const rows = await response.json();
  const state = rows[0]?.payload;
  if (!state?.moduleRecords?.Lembretes) return { sent: 0, pending: 0 };
  const today = new Date().toISOString().slice(0, 10);
  const due = state.moduleRecords.Lembretes.filter((item: Record<string, unknown>) => item.status === "Agendado" && String(item.date ?? "") <= today);
  let sent = 0;
  for (const reminder of due) {
    const config = await loadWhatsAppConfig();
    const to = String(reminder.category ?? "").replace(/\D/g, "");
    if (!config.active || !to) continue;
    try { await sendWhatsAppTemplate(config, to, config.reminderTemplate, [String(reminder.client ?? "cliente"), String(reminder.reminderMessage ?? reminder.description ?? "Está na hora da higienização.").slice(0, 300)]); reminder.status = "Enviado"; reminder.description = `${reminder.description} • WhatsApp enviado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`; sent += 1; } catch (error) { console.error("Reminder WhatsApp failed", error); }
  }
  if (sent) {
    const save = await fetch(`${url}/rest/v1/proar_state?on_conflict=id`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "main", payload: state, updated_at: new Date().toISOString() }) });
    if (!save.ok) throw new Error(await save.text());
  }
  return { sent, pending: due.length - sent };
}

export async function runTenderMonitor() {
  const store = await loadStore();
  const result = await searchAutomaticTenders({ radius: 300 });
  const known = new Set(store.items.map(item => item.numeroControlePNCP));
  const newItems = result.data.filter(item => item.numeroControlePNCP && !known.has(item.numeroControlePNCP));
  let whatsappStatus = "Nenhuma nova oportunidade";
  if (newItems.length) {
    try { whatsappStatus = await notifyWhatsApp(newItems); }
    catch (error) { whatsappStatus = error instanceof Error ? error.message : "Falha no WhatsApp"; }
  }
  const discoveredAt = new Date().toISOString();
  const items = [...newItems.map(item => ({ ...item, discoveredAt, whatsappStatus })), ...store.items]
    .filter((item, index, list) => list.findIndex(candidate => candidate.numeroControlePNCP === item.numeroControlePNCP) === index)
    .slice(0, 500);
  const updated: TenderStore = { items, lastScan: discoveredAt, lastError: result.failed ? `${result.failed} consulta(s) parcial(is)` : "" };
  await saveStore(updated);
  return { newItems: newItems.length, total: items.length, lastScan: discoveredAt, whatsappStatus };
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try { const tenders = await runTenderMonitor(); const reminders = await processCustomerReminders(); return NextResponse.json({ success: true, ...tenders, reminders }); }
  catch (error) { console.error("Tender monitor failed", error); return NextResponse.json({ error: "Falha no monitor diário" }, { status: 500 }); }
}
