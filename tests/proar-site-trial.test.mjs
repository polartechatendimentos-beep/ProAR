import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("official ProAR site presents 30-day trial and product portfolio",async()=>{
  const site=await readFile(new URL("../app/site/page.tsx",import.meta.url),"utf8");
  assert.ok(site.includes("Criar teste grátis por 30 dias"));
  assert.ok(site.includes("Portfólio ProAR"));
  assert.ok(site.includes("Planos ProAR"));
  assert.ok(site.includes("Arquitetura multiempresa"));
  assert.ok(site.includes("https://teste.proar.online"));
});

test("trial registration expires after 30 days on the server",async()=>{
  const route=await readFile(new URL("../app/api/trial/register/route.ts",import.meta.url),"utf8");
  assert.ok(route.includes("30 * 24 * 60 * 60 * 1000"));
  assert.ok(route.includes("trialDays: 30"));
});

test("trial page offers PWA installation after environment creation",async()=>{
  const page=await readFile(new URL("../app/teste/page.tsx",import.meta.url),"utf8");
  const install=await readFile(new URL("../components/InstallProARButton.tsx",import.meta.url),"utf8");
  assert.ok(page.includes("TESTE GRATUITO • 30 DIAS"));
  assert.ok(page.includes("Criar meu teste de 30 dias"));
  assert.ok(page.includes("InstallProARButton"));
  assert.ok(install.includes("beforeinstallprompt"));
  assert.ok(install.includes("Instalar ProAR"));
});

test("terms and legacy institutional route agree on 30-day trial",async()=>{
  const terms=await readFile(new URL("../app/termos/page.tsx",import.meta.url),"utf8");
  const institutional=await readFile(new URL("../app/institucional/page.tsx",import.meta.url),"utf8");
  assert.ok(terms.includes("30 dias"));
  assert.ok(institutional.includes("30 dias"));
  assert.ok(!terms.includes("por 7 dias"));
});

console.log("proar-site-trial.test.mjs: ok");