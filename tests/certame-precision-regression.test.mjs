import assert from "node:assert/strict";
import test from "node:test";
import { createCertameMovement, CertameBalanceError } from "../lib/public-contracts.ts";

const input = {
  id: "movement-1",
  item: { id: "item-1", certameId: "certame-1", description: "Serviço", unit: "un", contractedQuantity: 10, unitValue: 10 },
  type: "Reserva", userId: "user-1", origin: "test", existingMovements: [],
};

test("certame: rejects positive quantities that round to zero", () => {
  assert.throws(() => createCertameMovement({ ...input, quantity: 0.0001 }), CertameBalanceError);
});

test("certame: accepts representable positive quantities", () => {
  assert.equal(createCertameMovement({ ...input, quantity: 0.001 }).reservedDelta, 0.001);
});
