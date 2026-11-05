import test from "node:test";
import assert from "node:assert/strict";
import { validateEvolutionSettings } from "../lib/whatsapp-evolution.ts";

test("Evolution requires secure endpoint and valid instance", () => {
  const valid = { baseUrl: "https://whatsapp.example.org", instance: "polartech_dev", apiKey: "a".repeat(32) };
  assert.equal(validateEvolutionSettings(valid).baseUrl, valid.baseUrl);
  assert.throws(() => validateEvolutionSettings({ ...valid, baseUrl: "http://whatsapp.example.org" }), /HTTPS/);
  assert.throws(() => validateEvolutionSettings({ ...valid, instance: "../other" }), /Instância/);
  assert.throws(() => validateEvolutionSettings({ ...valid, apiKey: "short" }), /Chave/);
});
