import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("budget workspace exposes the new operational layout",async()=>{
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  const css=await readFile(new URL("../app/budget-pdv.css",import.meta.url),"utf8");

  assert.ok(page.includes('className="budget-workspace-tabs"'));
  assert.ok(page.includes("Novo orçamento"));
  assert.ok(page.includes("Adicionar produto ou serviço"));
  assert.ok(page.includes("Finalizar orçamento"));
  assert.ok(page.includes("Salvar rascunho"));
  assert.ok(page.includes("discountPercent?: number"));
  assert.ok(page.includes("unitOfMeasure?: string"));
  assert.ok(css.includes("Orçamentos — workspace operacional"));
  assert.ok(css.includes(".budget-line-items table"));
  assert.ok(css.includes(".budget-summary-bar"));
});

console.log("budget-layout.test.mjs: ok");
