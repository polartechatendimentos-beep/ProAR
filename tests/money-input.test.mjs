import test from "node:test";
import assert from "node:assert/strict";
import { centsToMoney, formatMoneyInput, moneyToCents, parseMoneyInput } from "../lib/money-input.ts";

test("calcula saldo liquidado em centavos sem erro de ponto flutuante", () => {
  const remainingCents = moneyToCents(984.70) - moneyToCents(500.00);
  assert.equal(remainingCents, 48470);
  assert.equal(centsToMoney(remainingCents), 484.70);
});

test("interpreta a digitação mascarada em centavos", () => {
  assert.equal(parseMoneyInput("484,70"), 484.70);
  assert.equal(parseMoneyInput("R$ 1.234,56"), 1234.56);
  assert.equal(parseMoneyInput(""), 0);
});

test("formata valor monetário brasileiro com duas casas", () => {
  assert.equal(formatMoneyInput(484.7), "R$ 484,70");
  assert.equal(formatMoneyInput(984.70000000000005), "R$ 984,70");
});
