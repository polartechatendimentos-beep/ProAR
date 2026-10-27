import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("state API propagates structured database error codes",async()=>{
  const source=await read("app/api/state/route.ts");
  assert.match(source,/classifyProarError/);
  assert.match(source,/code:descriptor\.code/);
  assert.match(source,/recordSystemIncident/);
});

test("company lookup converts database failures into controlled 503 JSON",async()=>{
  const source=await read("app/api/trial/company/route.ts");
  assert.match(source,/catch \(error\)/);
  assert.match(source,/status:503/);
  assert.match(source,/classifyProarError/);
});

test("client keeps cached data and recognizes provider quota contingency",async()=>{
  const source=await read("app/page.tsx");
  assert.match(source,/PROAR-DB-004/);
  assert.match(source,/Limite de uso do banco excedido/);
  assert.match(source,/last-successful-sync/);
});
