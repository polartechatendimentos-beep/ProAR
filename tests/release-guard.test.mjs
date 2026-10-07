import assert from "node:assert/strict";
import fs from "node:fs";

const release = JSON.parse(fs.readFileSync("proar-release.json","utf8"));
assert.equal(release.product,"ProAR");
assert.equal(release.edition,"complete");
assert.equal(release.productionBranch,"production");
assert.equal(release.minimumModuleContract,26);
assert.equal(release.policy.rejectReducedBuilds,true);
assert.equal(release.policy.requireValidation,true);
assert.equal(release.policy.requireRuntimeSmoke,true);
assert.equal(release.policy.preserveTenantData,true);

const contract = fs.readFileSync("tests/module-contracts.test.mjs","utf8");
assert.ok(contract.length > 500, "Contrato de módulos ausente ou reduzido");
console.log("Release guard: ProAR completo validado.");
