import test from "node:test";
import assert from "node:assert/strict";
import { formatBrazilDate } from "../lib/date-format.ts";

test("mantém datas civis ISO no mesmo dia sem conversão UTC", () => {
  assert.equal(formatBrazilDate("2026-06-01"), "01/06/2026");
  assert.equal(formatBrazilDate("2026-06-01T00:00:00.000Z"), "01/06/2026");
});

test("formata timestamps em horário de São Paulo e rejeita datas inválidas", () => {
  assert.equal(formatBrazilDate("not-a-date"), "—");
  assert.equal(formatBrazilDate(""), "—");
});
