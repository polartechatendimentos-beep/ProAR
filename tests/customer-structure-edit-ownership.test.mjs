import test from "node:test";
import assert from "node:assert/strict";
import { prepareCustomerStructureSave } from "../lib/customer-structure.ts";

const customerA = { id: "customer-A", name: "Cliente A" };
const customerB = { id: "customer-B", name: "Cliente B" };

test("reject editing a structure belonging to another customer", () => {
  const original = { id: "unit-1", name: "Unidade B", client: customerB.name, customerId: customerB.id };
  assert.throws(() => prepareCustomerStructureSave(customerA, { id: original.id, name: "Unidade tomada" }, [original]), /outro cliente/);
  assert.equal(original.name, "Unidade B");
});

test("reject cross-customer overwrite even with the same display name", () => {
  const original = { id: "unit-1", name: "Unidade B", client: customerA.name, customerId: customerB.id };
  assert.throws(() => prepareCustomerStructureSave(customerA, { id: original.id, name: "Unidade tomada" }, [original]), /outro cliente/);
});

test("allow edits of own structure and preserve its customer ID", () => {
  const original = { id: "unit-1", name: "Unidade A", client: customerA.name, customerId: customerA.id };
  const result = prepareCustomerStructureSave(customerA, { id: original.id, name: "Unidade A editada" }, [original]);
  assert.equal(result.record.name, "Unidade A editada");
  assert.equal(result.record.customerId, customerA.id);
  assert.equal(result.nextStructures.length, 1);
});
