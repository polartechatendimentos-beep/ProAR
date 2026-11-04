import test from "node:test";
import assert from "node:assert/strict";
import { formatBrazilDate } from "../lib/date-format.ts";

test("preserva data civil ISO sem conversão para UTC", () => {
  assert.equal(formatBrazilDate("2026-06-01"), "01/06/2026");
  assert.equal(formatBrazilDate("2026-06-01T12:00:00"), "01/06/2026");
});

test("converte timestamps reais para o fuso de São Paulo", () => {
  assert.equal(formatBrazilDate("2026-06-01T00:00:00.000Z"), "31/05/2026");
});

test("usa fallback para datas inválidas", () => {
  assert.equal(formatBrazilDate("not-a-date"), "—");
  assert.equal(formatBrazilDate(""), "—");
});
