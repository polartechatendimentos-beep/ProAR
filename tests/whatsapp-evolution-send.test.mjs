import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBrazilianWhatsApp, validateReminderMessage } from "../lib/whatsapp-evolution-send.ts";

test("accepts Brazilian mobile and landline, with or without country code", () => {
  assert.equal(normalizeBrazilianWhatsApp("(17) 99156-7798"), "5517991567798");
  assert.equal(normalizeBrazilianWhatsApp("5517991567798"), "5517991567798");
  assert.equal(normalizeBrazilianWhatsApp("(17) 3253-5688"), "551732535688");
});
test("rejects invalid phone numbers", () => {
  assert.throws(() => normalizeBrazilianWhatsApp("123"));
  assert.throws(() => normalizeBrazilianWhatsApp("00000000000"));
});
test("rejects empty or oversized reminder text", () => {
  assert.throws(() => validateReminderMessage(" "));
  assert.throws(() => validateReminderMessage("a".repeat(1001)));
  assert.equal(validateReminderMessage(" Lembrete de OS "), "Lembrete de OS");
});
