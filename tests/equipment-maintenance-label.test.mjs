import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { createEquipmentLabel, verifyEquipmentLabel, publicMaintenanceHistory } from "../lib/equipment-maintenance-label.ts";
import { qrMatrix, qrSvg } from "../lib/qr-svg.ts";

const secret = "test-secret-not-for-production";
const sample = createEquipmentLabel("polartech-principal", "EQ-000001", secret);

test("one permanent label survives multiple service orders", () => {
  assert.deepEqual(sample, createEquipmentLabel("polartech-principal", "EQ-000001", secret));
  assert.notEqual(sample.token, createEquipmentLabel("polartech-principal", "EQ-000002", secret).token);
  assert.notEqual(sample.token, createEquipmentLabel("other-company", "EQ-000001", secret).token);
  assert.match(sample.code, /^PT-[A-F0-9]{12}$/);
  assert.deepEqual(verifyEquipmentLabel(sample.token, secret), { companyId:"polartech-principal", equipmentId:"EQ-000001" });
});

test("signed labels reject tampering and invalid identifiers", () => {
  assert.equal(verifyEquipmentLabel(sample.token + "a", secret), null);
  assert.equal(verifyEquipmentLabel(sample.token, "wrong-secret"), null);
  assert.equal(verifyEquipmentLabel("bad-token", secret), null);
  assert.throws(() => createEquipmentLabel("company", "../../escape", secret));
});

test("public history includes only completed visits linked to the exact equipment and customer", () => {
  const equipment = { id:"EQ-000001", customerId:"client-1" };
  const orders = [
    { id:"os1", equipmentIds:["EQ-000001"], customerId:"client-1", date:"2026-08-15", service:"Higienização", status:"Concluída", total:200, internalNote:"segredo", tech:"Técnico A", client:"Cliente privado" },
    { id:"os2", equipmentId:"EQ-000001", customerId:"client-1", date:"2026-10-01", service:"Manutenção corretiva", status:"Finalizada" },
    { id:"os3", equipmentIds:["EQ-000001"], customerId:"client-1", date:"2026-10-03", service:"Manutenção preventiva", status:"Agendada" },
    { id:"os4", equipmentIds:["EQ-000002"], customerId:"client-1", date:"2026-10-04", service:"Manutenção", status:"Concluída" },
    { id:"os5", equipmentIds:["EQ-000001"], customerId:"client-2", date:"2026-10-05", service:"Manutenção", status:"Concluída" },
  ];
  const history = publicMaintenanceHistory(equipment, orders);
  assert.deepEqual(history, [
    { date:"2026-10-01", service:"Manutenção corretiva", status:"Concluída" },
    { date:"2026-08-15", service:"Higienização", status:"Concluída" },
  ]);
  const serialized = JSON.stringify(history);
  for (const secretValue of ["segredo", "Cliente privado", "Técnico A", "200", "client-1"]) {
    assert.ok(!serialized.includes(secretValue), `private value leaked: ${secretValue}`);
  }
});

test("QR matrix is deterministic and matches a known version 10-L reference", () => {
  const value = "https://example.com/equipamento/abc123";
  const matrix = qrMatrix(value);
  assert.equal(matrix.length, 57);
  assert.ok(matrix.every(row => row.length === 57));
  const fingerprint = createHash("sha256").update(matrix.flat().map(bit => bit ? "1" : "0").join("")).digest("hex");
  assert.equal(fingerprint, "ffd3412a806a9c080454f2300f53f84e2fbc1aad5d7427d156702e209fcdbd2f");
  assert.match(qrSvg(value), /^<svg /);
  assert.throws(() => qrMatrix("x".repeat(272)), /capacidade/);
});
