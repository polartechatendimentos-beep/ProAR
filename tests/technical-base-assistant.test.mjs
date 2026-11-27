import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const intake=readFileSync("lib/field/technical-diagnosis.ts","utf8");
const route=readFileSync("app/api/technical-base/assistant/route.ts","utf8");
const panel=readFileSync("components/TechnicalBasePanel.tsx","utf8");
test("technical diagnostic never confirms repair without verified evidence",()=>{assert.match(intake,/canConfirmFailure:false/);assert.match(intake,/canAuthorizeRepair:false/);});
test("assistant uses structured brand/model/code intake",()=>{assert.match(route,/assessTechnicalEvidence/);assert.match(route,/nextQuestions/);assert.match(panel,/code:errorCode/);});
test("assistant remains authenticated",()=>{assert.match(route,/readSession\(request\)/);assert.match(route,/status:401/);});
