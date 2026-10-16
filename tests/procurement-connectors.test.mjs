import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pncp = readFileSync("lib/procurement/pncp.ts", "utf8");
const api = readFileSync("app/api/licitacoes/search/route.ts", "utf8");
const bll = readFileSync("lib/procurement/bll-via-pncp.ts", "utf8");
const compras = readFileSync("lib/procurement/compras-gov-via-pncp.ts", "utf8");

test("PNCP pagination must expose truncation and source coverage", () => {
  assert.match(pncp, /truncatedModalities/);
  assert.match(pncp, /modalityCoverage/);
  assert.match(pncp, /coverageWarning/);
  assert.match(pncp, /hasNextPage\(payload, page, rows\)/);
});

test("BLL and Compras.gov filters must be explicit", () => {
  assert.match(api, /filterBllViaPncp/);
  assert.match(api, /filterComprasGovViaPncp/);
  assert.match(api, /sourceFilter/);
});

test("No third-party platform inferred solely from tender title", () => {
  assert.doesNotMatch(bll, /row\.objetoContratacao/);
  assert.doesNotMatch(compras, /row\.objetoContratacao/);
  assert.match(bll, /platformEvidence/);
  assert.match(compras, /platformEvidence/);
});

test("Only official PNCP is queried in these adapters", () => {
  assert.match(pncp, /pncp\.gov\.br\/api\/consulta/);
  assert.doesNotMatch(bll, /fetch\(/);
  assert.doesNotMatch(compras, /fetch\(/);
});
