import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = readFileSync("app/api/health/route.ts","utf8");
const page = readFileSync("app/page.tsx","utf8");
test("liveness never claims DB readiness",()=>{assert.match(route,/database: "not_checked"/);assert.match(route,/"Cache-Control": "no-store"/);});
test("dashboard labels demonstration values",()=>{assert.match(page,/modo demonstrativo/);assert.match(page,/Banco não verificado/);});
