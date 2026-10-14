import test from "node:test";
import assert from "node:assert/strict";
import { prepareCustomerStructureSave } from "../lib/customer-structure.ts";
import { mobileFieldOrders } from "../lib/mobile-field.ts";

const customer = { id: "company-A", name: "Prefeitura A", organizationType: "Prefeitura" };
const draft = { id: "unit-1", name: "UBS Centro", hierarchyLevel: "Unidade", parentId: "department-1" };

test("hierarchy: cannot link unit to another customer's department", () => {
  const parent = { id: "department-1", name: "Saúde", customerId: "company-B", hierarchyLevel: "Secretaria" };
  assert.throws(() => prepareCustomerStructureSave(customer, draft, [parent]), /outro cliente/);
});

test("hierarchy: valid parent persists customer ID", () => {
  const parent = { id: "department-1", name: "Saúde", customerId: "company-A", hierarchyLevel: "Secretaria" };
  const saved = prepareCustomerStructureSave(customer, draft, [parent]);
  assert.equal(saved.record.customerId, "company-A");
  assert.equal(saved.record.parentId, "department-1");
});

test("hierarchy: prevents self-reference and cycles", () => {
  assert.throws(() => prepareCustomerStructureSave(customer, { ...draft, parentId: "unit-1" }, []));
  const parent = { id: "department-1", name: "Saúde", customerId: "company-A", hierarchyLevel: "Secretaria", parentId: "unit-1" };
  assert.throws(() => prepareCustomerStructureSave(customer, draft, [parent]), /ciclo/);
});

test("mobile: technician cannot see unrelated orders or private fields", () => {
  const orders = [
    { id: "os-1", tech: "João", status: "Aberta", client: "Cliente A", secretToken: "private", total: 999 },
    { id: "os-2", tech: "Maria", status: "Aberta", client: "Cliente B" },
  ];
  const visible = mobileFieldOrders(orders, { username: "joao", displayName: "João", role: "Técnico" });
  assert.deepEqual(visible.map(order => order.id), ["os-1"]);
  assert.equal(JSON.stringify(visible).includes("private"), false);
  assert.equal(JSON.stringify(visible).includes("999"), false);
});
