import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";
const source=fs.readFileSync(new URL("../components/BiddingOperationsWorkspace.tsx",import.meta.url),"utf8");
test("licitacoes does not invent estimated values or bidding floor",()=>{assert.doesNotMatch(source,/91800|125000|104500|310000|480000/);assert.match(source,/Não informado pela fonte/);assert.match(source,/Sem feed oficial/);});
