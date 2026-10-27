import assert from "node:assert/strict";
import test from "node:test";
import { municipalityDistances, municipalityNameDistances } from "../lib/municipality-distances.ts";

test("índice de distâncias cobre a base e municípios próximos de Mirassol", () => {
  assert.equal(municipalityDistances["3530300"], 0);
  assert.ok((municipalityNameDistances["sao jose do rio preto|SP"] ?? 999) <= 20);
  assert.ok((municipalityNameDistances["olimpia|SP"] ?? 999) < 100);
});

test("índice suporta o raio operacional de até 1000 km", () => {
  const values = Object.values(municipalityDistances);
  assert.ok(values.length > 2000);
  assert.ok(Math.max(...values) >= 900);
  assert.ok(values.every(value => Number.isFinite(value) && value >= 0 && value <= 1000));
});

test("fallback por nome e UF possui a mesma cobertura do índice IBGE", () => {
  assert.equal(Object.keys(municipalityNameDistances).length, Object.keys(municipalityDistances).length);
  assert.equal(municipalityNameDistances["mirassol|SP"], 0);
});
