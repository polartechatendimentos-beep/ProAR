import assert from "node:assert/strict";
import test from "node:test";
import { validateEmpenhoAllocations, CertameBalanceError } from "../lib/public-contracts.ts";

const allocation = (id, amount) => ({ id, empenhoId: "emp-1", serviceOrderId: "os-1", amount });

test("empenho allocations cannot exceed available value", () => {
  assert.deepEqual(validateEmpenhoAllocations(100, [allocation("a", 40), allocation("b", 60)]), { allocated: 100, remaining: 0 });
  assert.throws(() => validateEmpenhoAllocations(100, [allocation("a", 101)]), CertameBalanceError);
});

test("empenho allocations reject duplicate identifiers", () => {
  assert.throws(() => validateEmpenhoAllocations(100, [allocation("a", 10), allocation("a", 20)]), CertameBalanceError);
});

test("empenho allocations reject invalid values", () => {
  assert.throws(() => validateEmpenhoAllocations(100, [allocation("a", Number.NaN)]), CertameBalanceError);
  assert.throws(() => validateEmpenhoAllocations(100, [{ ...allocation("a", 10), quantity: 0 }]), CertameBalanceError);
});
