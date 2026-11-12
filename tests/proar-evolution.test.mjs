import assert from "node:assert/strict";
import { test } from "node:test";
import { evolutionConfig, evolutionAutomationEnabled, sendEvolutionText } from "../lib/proar-evolution.ts";

test("Evolution isolates companies, rejects disconnected sends and requires provider acceptance", async () => {
  const keys = ["PROAR_EVOLUTION_COMPANY_ID", "PROAR_EVOLUTION_URL", "PROAR_EVOLUTION_INSTANCE", "PROAR_EVOLUTION_API_KEY", "PROAR_EVOLUTION_AUTOMATION_ENABLED"];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { PROAR_EVOLUTION_COMPANY_ID: "tenant-a", PROAR_EVOLUTION_URL: "https://whatsapp.example.test", PROAR_EVOLUTION_INSTANCE: "proar", PROAR_EVOLUTION_API_KEY: "test-only-key" });
  delete process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED;
  const calls = [];
  let connected = false;
  let accept = true;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("connectionState")) return Response.json({ instance: { state: connected ? "open" : "close" } });
    return Response.json(accept ? { key: { id: "provider-id" } } : { success: true });
  };
  try {
    assert.equal(evolutionConfig("tenant-b"), null);
    assert.equal(evolutionAutomationEnabled("tenant-a"), false);
    await assert.rejects(sendEvolutionText("tenant-b", "5517999990000", "Olá"), /indisponível/);
    assert.equal(calls.length, 0);
    await assert.rejects(sendEvolutionText("tenant-a", "5517999990000", "Olá"), /desconectado/);
    assert.equal(calls.length, 1);
    connected = true;
    assert.deepEqual(await sendEvolutionText("tenant-a", "5517999990000", "Olá"), { status: "accepted", messageId: "provider-id" });
    assert.equal(calls.at(-1).url, "https://whatsapp.example.test/message/sendText/proar");
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), { number: "5517999990000", text: "Olá" });
    assert.equal(calls.at(-1).options.redirect, "error");
    accept = false;
    await assert.rejects(sendEvolutionText("tenant-a", "5517999990000", "Olá"), /não confirmou/);
    const before = calls.length;
    await assert.rejects(sendEvolutionText("tenant-a", "123", "Olá"), /telefone/);
    await assert.rejects(sendEvolutionText("tenant-a", "5517999990000", " "), /mensagem/);
    assert.equal(calls.length, before);
    process.env.PROAR_EVOLUTION_URL = "http://whatsapp.example.test";
    assert.throws(() => evolutionConfig("tenant-a"), /inválida/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
