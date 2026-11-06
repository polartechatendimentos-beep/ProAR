import { test } from "node:test";
import assert from "node:assert/strict";
import { inboundRecord, inboxQuery } from "../lib/whatsapp-inbox.ts";

const message = { id: "wamid.123", from: "5517999998888", timestamp: "1793966400", text: { body: "Meu ar não gela" } };
test("CRM preserva texto e gera identidade estável para reentregas sem misturar empresas", () => {
  const first = inboundRecord("empresa-a", message);
  assert.equal(first.payload.text, message.text.body);
  assert.equal(first.id, inboundRecord("empresa-a", { ...message }).id);
  assert.notEqual(first.id, inboundRecord("empresa-b", message).id);
  assert.notEqual(first.id, inboundRecord("empresa-a", { ...message, id: "wamid.456" }).id);
});
test("CRM rejeita remetentes e datas inválidos antes de persistir", () => {
  for (const patch of [{ from: "abc" }, { from: "+55(17)9999" }, { id: "" }, { timestamp: "NaN" }, { timestamp: "-1" }, { timestamp: "99999999999999999" }]) {
    assert.equal(inboundRecord("empresa-a", { ...message, ...patch }), null);
  }
  assert.equal(inboundRecord("", message), null);
});
test("CRM preserva resposta interativa e sinaliza anexos sem inventar conteúdo", () => {
  assert.equal(inboundRecord("a", { ...message, text: undefined, interactive: { button_reply: { title: "Confirmar" } } }).payload.text, "Confirmar");
  const attachment = inboundRecord("a", { ...message, text: undefined, type: "audio" });
  assert.equal(attachment.payload.type, "audio");
  assert.match(attachment.payload.text, /sem texto/);
  assert.equal(inboundRecord("a", { ...message, text: { body: "x".repeat(9000) } }).payload.text.length, 8000);
});
test("consulta do CRM restringe empresa e pagina histórico com desempate estável", () => {
  const query = inboxQuery("empresa-a", 100);
  assert.equal(query.get("payload->>companyId"), "eq.empresa-a");
  assert.equal(query.get("offset"), "100");
  assert.equal(query.get("limit"), "101");
  assert.equal(query.get("order"), "updated_at.desc,id.desc");
});
