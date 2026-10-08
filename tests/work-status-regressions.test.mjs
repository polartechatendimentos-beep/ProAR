import test from "node:test";
import assert from "node:assert/strict";
import {
  WORK_STATUSES,
  UNKNOWN_WORK_STATUS,
  normalizeWorkStatus,
  getWorkProgress,
  getWorkStatusColor,
} from "../lib/work-status.ts";

test("every canonical work status is preserved and progress is monotonic", () => {
  let previous = -1;
  for (const status of WORK_STATUSES) {
    assert.equal(normalizeWorkStatus(status), status);
    const progress = getWorkProgress(status);
    assert.ok(progress >= previous, `progress regressed for ${status}`);
    assert.ok(progress >= 0 && progress <= 100);
    previous = progress;
  }
  assert.equal(getWorkProgress(WORK_STATUSES[0]), 0);
  assert.equal(getWorkProgress(WORK_STATUSES.at(-1)), 100);
});

test("legacy spellings normalize to the current work stages", () => {
  const examples = [
    ["inicio de obra", "INÍCIO DE OBRA"],
    ["ag frigorígena", "AG. FRIGORÍGENA"],
    ["AG VENTO KIT", "AG. TUBULAÇÃO FORÇADA"],
    ["ventokit e frigorígena ok", "AG. TUBULAÇÃO FORÇADA"],
    ["AG. EXAUTOR", "AG. EXAUSTOR"],
    ["ag tampa frigorigena", "AG. TAMPA FRIGORÍGENA"],
    ["fim", "SERVIÇO CONCLUÍDO"],
    ["servico concluido", "SERVIÇO CONCLUÍDO"],
  ];
  for (const [input, expected] of examples) {
    assert.equal(normalizeWorkStatus(input), expected, `status: ${input}`);
  }
});

test("unrecognized statuses never imply work completion", () => {
  for (const value of [null, undefined, "", "status inventado", "concluído parcialmente", 123]) {
    assert.equal(normalizeWorkStatus(value), UNKNOWN_WORK_STATUS);
    assert.equal(getWorkProgress(value), 0);
    assert.equal(getWorkStatusColor(value), "#64748b");
  }
});

test("completed work has a distinct success color", () => {
  assert.equal(getWorkStatusColor("fim"), "#16a34a");
});
