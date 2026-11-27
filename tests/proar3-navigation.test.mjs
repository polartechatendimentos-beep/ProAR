import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync("app/page.tsx","utf8");
test("desktop modules have URL-addressable navigation",()=>{assert.match(page,/url\.searchParams\.set\("tab", tab\)/);assert.match(page,/window\.addEventListener\("popstate", syncFromUrl\)/);});
test("all currently exposed desktop tabs have labels",()=>{for(const id of ["dashboard","clientes","os","obras","orcamento","pdv","financeiro","contratos","pmoc","base-tecnica"])assert.ok(page.includes(id));});
test("desktop does not route automatically into mobile",()=>{assert.doesNotMatch(page,/router\.push\(["']\/mobile/);});
