import test from "node:test";
import assert from "node:assert/strict";
import { mobileFieldOrders, mobileFieldSummary, isOpenMobileOrder } from "../lib/mobile-field.ts";

const tech = { username: "tecnico", displayName: "Técnico Um", role: "Técnico" };
const manager = { username: "gestor", displayName: "Gestor", role: "Gestor" };
const os = (id, overrides = {}) => ({ id, tech: "Técnico Um", status: "Aberta", date: "2026-10-13", ...overrides });

test("mobile: role does not grant access when it only contains admin substring", () => {
  assert.deepEqual(mobileFieldOrders([os("1", { tech: "Outro" })], { ...tech, role: "subadministrador" }), []);
});

test("mobile: duplicate OS identifiers are returned once", () => {
  assert.deepEqual(mobileFieldOrders([os("1"), os("1")], tech).map(o => o.id), ["1"]);
});

test("mobile: closed statuses with suffix are filtered", () => {
  for (const status of ["Concluída (faturada)", "Finalizado - entregue", "Cancelada: cliente"]) {
    assert.equal(isOpenMobileOrder(status), false);
  }
});

test("mobile: projected fields exclude secrets and bound equipment list", () => {
  const result = mobileFieldOrders([os("1", { token: "secret", total: 3000, equipmentIds: Array.from({length: 25}, (_, i) => "EQ-" + i) })], tech);
  assert.equal(result[0].equipmentIds.length, 20);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.equal(JSON.stringify(result).includes("3000"), false);
});

test("mobile: limit counts only accessible open orders", () => {
  const result = mobileFieldOrders([os("closed", { status: "Cancelada" }), os("other", { tech: "Outro" }), os("allowed")], tech, 1);
  assert.deepEqual(result.map(o => o.id), ["allowed"]);
  assert.deepEqual(mobileFieldSummary(result, "2026-10-13"), { today: 1, inProgress: 0, pending: 1 });
});

test("mobile: manager still cannot see cancelled orders", () => {
  assert.deepEqual(mobileFieldOrders([os("closed", {status:"Encerrada"}), os("open", {tech:"Outro"})], manager).map(o => o.id), ["open"]);
});
