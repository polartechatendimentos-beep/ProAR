import assert from "node:assert/strict";
import test from "node:test";
import { validateEmpenhoAllocations, CertameBalanceError } from "../lib/public-contracts.ts";

const allocation = [{ id: "v1", empenhoId: "e1", serviceOrderId: "os1", amount: 10 }];

test("empenho: rejects nonfinite or negative limit", () => {
  for (const limit of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1]) {
    assert.throws(() => validateEmpenhoAllocations(limit, allocation), CertameBalanceError);
  }
});

test("empenho: valid limit still accepts allocations", () => {
  assert.deepEqual(validateEmpenhoAllocations(20, allocation), { allocated: 10, remaining: 10 });
});
