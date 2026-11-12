import { NextRequest, NextResponse } from "next/server";
import { databaseFetch, supabaseRest } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { tenantEvolutionAutomationEnabled } from "../../../../lib/evolution-tenant";
import { dispatchEvolutionJob, evolutionJobId, evolutionJobPrefix } from "../../../../lib/evolution-jobs";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED !== "true") return NextResponse.json({ enabled: false });
  const started = Date.now();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const summary = { companies: 0, accepted: 0, duplicate: 0, unknown: 0, errors: 0, deferred: false };
  try {
    const cursorResponse = await supabaseRest("proar_state?select=payload&id=eq.evolution-cron-cursor&limit=1");
    if (!cursorResponse.ok) throw new Error("Fila indisponível.");
    const cursorRows = await cursorResponse.json();
    const after = String(cursorRows[0]?.payload?.after || "");
    const saveCursor = async (companyId: string) => {
      const response = await supabaseRest("proar_state?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: "evolution-cron-cursor", payload: { after: companyId }, updated_at: new Date().toISOString() }) });
      if (!response.ok) throw new Error("Não foi possível avançar a fila.");
    };
    // Pages are explicit so the Data API's default row limit cannot omit tenants.
    for (let offset = 0; ; offset += 100) {
      const response = await supabaseRest(`proar_companies?select=id,trade_name,legal_name&status=eq.active&order=id.asc&limit=100&offset=${offset}${after ? `&id=gt.${encodeURIComponent(after)}` : ""}`);
      if (!response.ok) throw new Error("Não foi possível consultar empresas ativas.");
      const companies = await response.json() as { id: string; trade_name?: string; legal_name?: string }[];
      for (const company of companies) {
        if (Date.now() - started > 80000) { summary.deferred = true; return NextResponse.json(summary); }
        try {
          if (!await tenantEvolutionAutomationEnabled(company.id)) { await saveCursor(company.id); continue; }
          summary.companies++;
          const db = await resolveTenantDb(company.id);
          if (!db.url || !db.key) throw new Error("Base indisponível.");
          const stateId = db.dedicated ? "main" : company.id;
          const stateResponse = await databaseFetch(`${db.url}/rest/v1/proar_state?select=payload&id=eq.${encodeURIComponent(stateId)}&limit=1`, { headers: tenantHeaders(db.key), cache: "no-store" });
          if (!stateResponse.ok) throw new Error("Lembretes indisponíveis.");
          const states = await stateResponse.json();
          const state = states[0]?.payload;
          if (state?._companyId && state._companyId !== company.id) throw new Error("Base de outra empresa recusada.");
          const reminders = (state?.moduleRecords?.Lembretes || []) as Record<string, unknown>[];
          const attempted = new Set<string>();
          for (let jobOffset = 0; ; jobOffset += 1000) {
            if (Date.now() - started > 80000) { await saveCursor(company.id); summary.deferred = true; return NextResponse.json(summary); }
            const jobs = await databaseFetch(`${db.url}/rest/v1/proar_state?select=id&id=like.${evolutionJobPrefix(company.id)}*&limit=1000&offset=${jobOffset}`, { headers: tenantHeaders(db.key), cache: "no-store" });
            if (!jobs.ok) throw new Error("Histórico indisponível.");
            const rows = await jobs.json() as { id: string }[];
            rows.forEach(row => attempted.add(row.id));
            if (rows.length < 1000) break;
          }
          let companySent = 0;
          for (const reminder of reminders) {
            if (Date.now() - started > 80000 || summary.accepted + summary.unknown >= 20) { await saveCursor(company.id); summary.deferred = true; return NextResponse.json(summary); }
            if (companySent >= 5) break;
            if (reminder.whatsappConsent !== true || reminder.whatsappOptOut === true || reminder.status !== "Agendado" || typeof reminder.id !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(String(reminder.date || "")) || String(reminder.date) > today) continue;
            const sourceId = `reminder:${reminder.id}:${reminder.date}`;
            if (attempted.has(evolutionJobId(company.id, sourceId))) continue;
            let to = String(reminder.category || "").replace(/\D/g, "");
            if (/^\d{10,11}$/.test(to)) to = `55${to}`;
            if (!/^[1-9]\d{9,14}$/.test(to)) continue;
            const message = String(reminder.reminderMessage || reminder.description || "Está na hora da higienização.").slice(0, 300);
            const text = `Olá, ${String(reminder.client || "cliente").slice(0, 100)}!\n\n${message}\n\n${company.trade_name || company.legal_name || "Equipe de atendimento"}`;
            const result = await dispatchEvolutionJob(company.id, sourceId, to, text);
            if (result.status === "disconnected") break;
            if (result.status === "accepted") summary.accepted++;
            if (result.status === "duplicate") summary.duplicate++;
            if (result.status === "unknown") summary.unknown++;
            if (result.status === "accepted" || result.status === "unknown") companySent++;
          }
        } catch { summary.errors++; }
        await saveCursor(company.id);
      }
      if (companies.length < 100) { await saveCursor(""); break; }
    }
    return NextResponse.json(summary);
  } catch { return NextResponse.json({ error: "Falha ao processar o WhatsApp.", ...summary }, { status: 502 }); }
}
