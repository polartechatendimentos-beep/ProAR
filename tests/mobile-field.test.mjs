import test from "node:test";
import assert from "node:assert/strict";
import { assignedToSession, canSeeAllMobileOrders, mobileFieldOrders, mobileFieldSummary } from "../lib/mobile-field.ts";

const technician = { username:"tiago.viana", displayName:"Tiago Viana", role:"Técnico" };
const manager = { username:"gerente", displayName:"Gerente", role:"Gerência" };
const records = [
  { id:"OS-100", client:"Cliente A", customerId:"private-id", tech:"Tiago Viana", service:"Higienização", date:"2026-10-13", time:"08:00", status:"Em andamento", total:900, privateNote:"sigilo", address:"Rua Exemplo", equipmentIds:["EQ-1"] },
  { id:"OS-101", client:"Cliente B", tech:"João Souza", service:"Manutenção", date:"2026-10-13", time:"09:00", status:"Aberta", total:8000 },
  { id:"OS-102", client:"Cliente C", tech:"Não definido", service:"Manutenção", date:"2026-10-14", time:"10:00", status:"Aberta" },
  { id:"OS-103", client:"Cliente D", tech:"tiago.viana", service:"Reparo", date:"2026-10-13", time:"11:00", status:"Concluída", passwordHash:"must never leak" },
];

test("field technician only sees assigned OS and not unrelated tenants or users", () => {
  const orders = mobileFieldOrders(records, technician);
  assert.deepEqual(orders.map(item=>item.id), ["OS-100","OS-103"]);
  assert.ok(!JSON.stringify(orders).includes("private-id"));
  assert.ok(!JSON.stringify(orders).includes("sigilo"));
  assert.ok(!JSON.stringify(orders).includes("900"));
  assert.ok(!JSON.stringify(orders).includes("passwordHash"));
  assert.ok(!JSON.stringify(orders).includes("must never leak"));
});

test("manager can see all OS but only allowlisted fields", () => {
  assert.equal(canSeeAllMobileOrders(manager), true);
  assert.equal(canSeeAllMobileOrders(technician), false);
  const orders = mobileFieldOrders(records, manager);
  assert.equal(orders.length, 4);
  assert.deepEqual(Object.keys(orders[0]).sort(), [
    "address","checkInAt","client","date","equipmentIds","id","service","status","tech","time","unit",
  ]);
});

test("assignment requires exact normalized match, not substring", () => {
  assert.equal(assignedToSession({ tech:"Tiago Viana" }, technician), true);
  assert.equal(assignedToSession({ tech:"Tíago Viana" }, technician), true);
  assert.equal(assignedToSession({ tech:"Tiago Viana e João" }, technician), false);
  assert.equal(assignedToSession({ tech:"Não definido" }, technician), false);
  assert.equal(assignedToSession({ tech:"" }, technician), false);
});

test("field summary counts current date and distinguishes active, pending and completed", () => {
  const orders = mobileFieldOrders(records, manager);
  assert.deepEqual(mobileFieldSummary(orders,"2026-10-13"), {
    today:3, inProgress:1, pending:2, completedToday:1,
  });
});

test("invalid data cannot crash mobile projection", () => {
  assert.deepEqual(mobileFieldOrders(null, technician), []);
  assert.deepEqual(mobileFieldOrders([null, false, "test", {}, {id:"OS-9",tech:"Tiago Viana"}], technician).map(x=>x.id), ["OS-9"]);
});
