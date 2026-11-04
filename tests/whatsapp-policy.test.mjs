import test from "node:test";
import assert from "node:assert/strict";
import { validateWhatsAppMessageInput, whatsappAttemptRecordId } from "../lib/whatsapp-message-policy.ts";

test("WhatsApp sends require explicit consent confirmation and an allowed purpose", () => {
  const valid = { originId:"OS-1284", kind:"appointment", eventKey:"appointment:2026-11-04:09:00", consentConfirmed:true, parameters:["Cliente","OS-1284","Manutenção","Unidade","04/11 às 09:00"] };
  assert.equal(validateWhatsAppMessageInput(valid), null);
  assert.match(validateWhatsAppMessageInput({ ...valid, consentConfirmed:false }) || "", /autorização/i);
  assert.match(validateWhatsAppMessageInput({ ...valid, kind:"marketing" }) || "", /não suportado/i);
  assert.match(validateWhatsAppMessageInput({ ...valid, parameters:Array(11).fill("x") }) || "", /Parâmetros/i);
  assert.match(validateWhatsAppMessageInput({ ...valid, parameters:["x".repeat(501)] }) || "", /500 caracteres/i);
});

test("WhatsApp attempt IDs are stable, tenant scoped, and event scoped", () => {
  const id = whatsappAttemptRecordId("empresa-a","OS-1284","appointment","appointment:2026-11-04:09:00");
  assert.equal(id, whatsappAttemptRecordId("empresa-a","OS-1284","appointment","appointment:2026-11-04:09:00"));
  assert.notEqual(id, whatsappAttemptRecordId("empresa-b","OS-1284","appointment","appointment:2026-11-04:09:00"));
  assert.notEqual(id, whatsappAttemptRecordId("empresa-a","OS-1284","pmoc","appointment:2026-11-04:09:00"));
  assert.match(id, /^whatsapp-send:[a-f0-9]{48}$/);
});
