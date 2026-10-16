import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync("app/page.tsx","utf8");
const css=readFileSync("app/globals.css","utf8");
test("full-system sidebar preserves all ten module routes",()=>{
  for(const tab of ["dashboard","clientes","os","obras","orcamento","pdv","financeiro","contratos","pmoc","base-tecnica"]) assert.match(page,new RegExp('navigateTab\\("'+tab+'"\\)'));
  assert.match(page,/Menu principal do ProAR/);
  assert.match(page,/sidebarOpen/);
});
test("density CSS is scoped to full workspace",()=>{
  assert.match(page,/data-density=/);
  assert.match(css,/#conteudo-principal\[data-density="compact"\]/);
});
