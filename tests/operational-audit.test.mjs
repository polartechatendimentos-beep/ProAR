import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareOperationalState } from "../lib/operational-ledger.ts";
import { mergeOperationalView, projectOperationalState } from "../lib/state-access.ts";

test("exclusão registra a sessão autenticada e ignora eventos forjados pelo cliente", () => {
  const previous = { customers: [], serviceOrders: [], moduleRecords: { Lembretes: [{ id: "L1", name: "Visita" }] } };
  const actor = { username: "tiago", displayName: "Tiago Viana", role: "Administrador", permissions: ["*"] };
  const incoming = { moduleRecords: { Lembretes: [], "Auditoria operacional": [{ id: "forjado", user: "outro" }] } };
  const can = () => true;
  const now = "2026-11-05T16:00:00.000Z";
  const result = prepareOperationalState(previous, mergeOperationalView(previous, incoming, actor, can), { ...actor, can }, now);
  const events = result.moduleRecords["Auditoria operacional"];
  assert.ok(events.every(event => event.user === actor.username));
  assert.ok(events.every(event => event.id !== "forjado"));
  assert.equal(events.find(event => event.recordId === "L1").action, "Exclusão");
  assert.equal(events.find(event => event.recordId === "L1").recordId, "L1");
  assert.equal(events.find(event => event.recordId === "L1").user, actor.username);
  assert.equal(events.find(event => event.recordId === "L1").createdAt, now);
  assert.equal(projectOperationalState(result, { ...actor, role: "Operador", permissions: [] }, () => false).moduleRecords["Auditoria operacional"], undefined);
});
