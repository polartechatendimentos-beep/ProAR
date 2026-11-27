import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const stock = readFileSync("lib/field/vehicle-stock.ts", "utf8");
const hvac = readFileSync("lib/field/hvac-thermodynamics.ts", "utf8");
const plate = readFileSync("lib/field/equipment-plate.ts", "utf8");
test("Vehicle stock isolates tenant and vehicle", () => {
  assert.match(stock, /movement\.companyId !== companyId/);
  assert.match(stock, /movement\.vehicleId !== vehicleId/);
  assert.match(stock, /INSUFFICIENT_VEHICLE_STOCK/);
  assert.match(stock, /DUPLICATE_REFERENCE/);
});
test("HVAC rejects invalid table or pressure and requires provenance", () => {
  assert.match(hvac, /PRESSURE_OUTSIDE_TABLE/);
  assert.match(hvac, /TABLE_PROVENANCE_REQUIRED/);
  assert.match(hvac, /REFRIGERANT_MISMATCH/);
});
test("OCR proposals require human confirmation", () => {
  assert.match(plate, /requiresHumanConfirmation: true/);
  assert.match(plate, /IMAGE_REQUIRED/);
});
