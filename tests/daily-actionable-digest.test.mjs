import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dailyActionableDigest, digestDayStart } from "../lib/daily-actionable-digest.ts";

const now = new Date("2026-11-26T01:04:00Z"); // 22h04 of Nov 25 in Brasília
const inMsg = (id, text, at = "2026-11-25T17:00:00Z") => ({ id, text, at, direction: "in" });
const outMsg = (status, extra = {}) => ({ id: "out", text: "Resposta", at: "2026-11-25T18:00:00Z", direction: "out", status, actor: "local-assistant", ...extra });
const chat = (number, messages, extra = {}) => ({ phone: `551790000${number}`, stage: "Em atendimento", sector: "Comercial", messages, name: `Cliente ${number}`, ...extra });
const create = patch => dailyActionableDigest({ chats: [], quotes: [], orders: [], complete: true, ...patch }, now);

test("digest window follows Brasília rather than the UTC day", () => {
  assert.equal(digestDayStart(now), "2026-11-25T03:00:00.000Z");
  assert.equal(create({}).today, "2026-11-25");
  assert.equal(create({}).tomorrow, "2026-11-26");
  assert.equal(digestDayStart(new Date("2026-11-26T03:00:00Z")), "2026-11-26T03:00:00.000Z");
});

test("only actionable new incoming without a later recorded reply, including provider failures", () => {
  const base = inMsg("original", "Meu ar não gela");
  const digest = create({ pilotPhone: "5517900000007", chats: [
    chat("0001", [base, outMsg("accepted")]),
    chat("0002", [base, outMsg("accepted", { deliveryStatus: "failed" })]),
    chat("0003", [base, outMsg("processing")]),
    chat("0004", [base, outMsg("accepted"), inMsg("followup", "Pode me retornar?", "2026-11-25T19:00:00Z")]),
    chat("0005", [inMsg("old", "Preciso agendar", "2026-11-25T02:59:00Z")]),
    chat("0006", [inMsg("ok", "Boa 👍🏻"), inMsg("media", "Mensagem sem texto. Consulte o anexo no WhatsApp.")]),
    chat("0007", [base]),
    chat("0008", [base], { optOut: true }),
    chat("0009", [base], { stage: "Concluído" }),
    chat("0010", [base, outMsg("accepted", { deliveryStatus: "delivered" })]),
    chat("0011", [inMsg("danger", "O ar está com cheiro de queimado"), inMsg("thanks", "Obrigado!", "2026-11-25T18:20:00Z")]),
    chat("0012", [base, outMsg("accepted"), inMsg("same-ts", "É urgente a visita", "2026-11-25T18:00:00Z")]),
  ] });
  assert.deepEqual(digest.conversations.items.map(item => item.title), ["Cliente 0011", "Cliente 0002", "Cliente 0003", "Cliente 0012", "Cliente 0004"]);
  assert.equal(digest.conversations.total, 5);
  assert.equal(digest.conversations.items[0].urgent, true);
  assert.doesNotMatch(JSON.stringify(digest), /551790000|Meu ar não gela|Pode me retornar/);
});

test("only unresolved quotes with explicit expired validity and tomorrow's planned unconfirmed visits", () => {
  const quote = (id, endDate, extra = {}) => ({ id, endDate, status: "Enviado", client: "Comércio", ...extra });
  const visit = (id, extra = {}) => ({ id, date: "2026-11-26", time: "14:00", status: "Agendada", client: "Pessoa", service: "Instalação", ...extra });
  const digest = create({
    quotes: [
      quote("ORC-1", "2026-11-24"), quote("ORC-2", "2026-11-25"), quote("ORC-3", "2026-11-24", { status: "Em elaboração" }),
      quote("ORC-4", "2026-11-24"), quote("ORC-5", "2026-11-24"), quote("ORC-6", "2026-11-24", { status: "Aprovado" }),
      quote("ORC-7", "2026-10-32"), quote("ORC-8", ""),
    ],
    sales: [{ id: "VENDA-1", budgetId: "ORC-4" }],
    orders: [
      visit("OS-A"), visit("OS-B", { status: "Cliente confirmado" }), visit("OS-C", { appointmentConfirmation: "Confirmado" }),
      visit("OS-D", { status: "Cancelada" }), visit("OS-E", { date: "2026-11-27" }), visit("OS-F", { time: "A definir" }),
      visit("OS-G", { status: "Cliente confirmado", appointmentConfirmation: "Reagendamento solicitado" }),
      visit("OS-H", { status: "Concluída", sourceBudgetId: "ORC-5" }),
    ],
  });
  assert.deepEqual(digest.quotes.items.map(item => item.reference), ["ORC-1"]);
  assert.deepEqual(digest.visits.items.map(item => item.reference), ["OS-A", "OS-G"]);
  assert.match(digest.visits.items[1].detail, /pediu reagendamento/);
});

test("bounded output keeps accurate totals and never hides an incomplete scan", () => {
  const digest = create({ complete: false, chats: Array.from({ length: 30 }, (_, n) => chat(String(n).padStart(4, "0"), [inMsg("sameId", "Preciso de instalação")])) });
  assert.equal(digest.complete, false);
  assert.equal(digest.conversations.total, 30);
  assert.equal(digest.conversations.items.length, 20);
  assert.equal(create({}).conversations.total, 0);
});

test("digest integration exposes only the tenant-authenticated production GET and the safe UI entry", () => {
  const route = readFileSync(new URL("../app/api/atendimento/pendencias/route.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/atendimento/pendencias/page.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../app/atendimento/page.tsx", import.meta.url), "utf8");
  assert.match(route, /access\?\.actor\.admin.*access\.session\.companyId/);
  assert.match(route, /chatDb\(companyId\)/);
  assert.match(route, /row\.payload\?\.companyId !== companyId/);
  assert.match(route, /"Cache-Control": "private, no-store"/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(page, /fetch\("\/api\/atendimento\/pendencias"/);
  assert.match(page, /!hasItems && data\.complete/);
  assert.match(home, /queue\?\.actor\.admin && <Link href="\/atendimento\/pendencias"/);
});
