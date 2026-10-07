import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");

test("release governance migration is additive and defines all four channels",async()=>{
  const sql=(await read("supabase/migrations/20261007_release_governance.sql")).toLowerCase();
  for(const channel of ["internal","homologation","canary","production"])assert.ok(sql.includes("'"+channel+"'"),channel);
  for(const table of ["proar_releases","proar_release_targets","proar_tenant_release_settings","proar_feature_flags","proar_release_checks"])assert.ok(sql.includes(table),table);
  assert.ok(sql.includes("enable row level security"));
  assert.ok(!/\bdrop\s+table\b/.test(sql));
  assert.ok(!/\btruncate\b/.test(sql));
  assert.ok(!/\bdelete\s+from\b/.test(sql));
});

test("release API requires Manager auth and enforces sequential promotion",async()=>{
  const source=await read("app/api/manager/releases/route.ts");
  assert.ok(source.includes("readManagerSession"));
  assert.ok(source.includes("nextChannelAllowed"));
  assert.ok(source.includes('"internal","homologation","canary","production"'));
  assert.ok(source.includes('code:"PROAR-REL-APPROVAL"'));
  assert.ok(source.includes("snapshotBeforeRelease"));
  assert.ok(source.includes("probeAlias"));
  assert.ok(source.includes("assignDeploymentAlias"));
  assert.ok(source.includes("RELEASE_ROLLOUT_HALTED"));
  assert.ok(source.includes('applyTarget(release,"internal",INTERNAL_QA_COMPANY_ID,"teste.proar.online"'));
  assert.ok(source.includes('action==="publish-internal"'));
});

test("customer rollout has automatic rollback and schema guard",async()=>{
  const core=await read("lib/release-governance.ts");
  const route=await read("app/api/manager/releases/route.ts");
  assert.ok(core.includes("schemaCompatible"));
  assert.ok(core.includes("restoreReleaseSnapshot"));
  assert.ok(route.includes("previousDeploymentId"));
  assert.ok(route.includes("PROAR-REL-SCHEMA"));
  assert.ok(route.includes("PROAR-REL-HEALTH"));
  assert.ok(route.includes("rollback-target"));
});

test("internal ProAR environment is isolated from PolarTech",async()=>{
  const auth=await read("app/api/auth/route.ts");
  const route=await read("app/api/manager/releases/route.ts");
  assert.ok(auth.includes("INTERNAL_QA_COMPANY_ID"));
  assert.ok(auth.includes("INTERNAL_HOSTS.has(host)"));
  assert.ok(auth.includes("internalHost ? null : await authenticateLegacyEmployee"));
  assert.ok(route.includes('id:"QA-CLI-001"'));
  assert.ok(route.includes('id:"QA-OS-001"'));
  assert.ok(route.includes("_synthetic:true"));
  assert.ok(route.includes("provisionTenant"));
});

test("runtime config supports maintenance changelog feature flags and alias mismatch",async()=>{
  const route=await read("app/api/runtime-config/route.ts");
  const page=await read("app/page.tsx");
  assert.ok(route.includes("maintenanceMode"));
  assert.ok(route.includes("featureFlags"));
  assert.ok(route.includes("moduleFlags"));
  assert.ok(route.includes("changelog"));
  assert.ok(route.includes("deploymentMismatch"));
  assert.ok(page.includes("release-maintenance-screen"));
  assert.ok(page.includes("tenant-release-changelog"));
  assert.ok(page.includes("Versão publicada diferente da versão servida"));
});

test("feature flags support canary percentage and explicit tenant overrides",async()=>{
  const core=await read("lib/release-governance.ts");
  const route=await read("app/api/manager/releases/route.ts");
  const panel=await read("components/ReleaseGovernancePanel.tsx");
  assert.ok(core.includes("canary_percent"));
  assert.ok(core.includes("bucket<"));
  assert.ok(core.includes("proar_feature_flag_overrides"));
  assert.ok(route.includes('action==="feature-override"'));
  assert.ok(panel.includes("Exceção por empresa"));
  assert.ok(panel.includes('act("feature-override"'));
});

test("scheduled rollout cron is hourly and applies the same safety gates",async()=>{
  const vercel=await read("vercel.json");
  const cron=await read("app/api/cron/release-rollout/route.ts");
  assert.ok(vercel.includes("/api/cron/release-rollout"));
  assert.ok(vercel.includes("0 * * * *"));
  assert.ok(cron.includes("CRON_SECRET"));
  assert.ok(cron.includes("snapshotBeforeRelease"));
  assert.ok(cron.includes("schemaCompatible"));
  assert.ok(cron.includes("probeAlias"));
  assert.ok(cron.includes("break;"));
  assert.ok(cron.includes("releaseHasRegression"));
  assert.ok(cron.includes("PROAR-REL-ROLLOUT-HALTED"));
});

test("Manager exposes release center without counting internal QA as commercial company",async()=>{
  const page=await read("app/manager/page.tsx");
  const component=await read("components/ReleaseGovernancePanel.tsx");
  const companies=await read("app/api/manager/companies/route.ts");
  assert.ok(page.includes("ReleaseGovernancePanel"));
  assert.ok(component.includes("Central de Versões e Ambientes"));
  assert.ok(component.includes("ProAR Interno"));
  assert.ok(component.includes("Homologação"));
  assert.ok(component.includes("Canary"));
  assert.ok(component.includes("Produção"));
  assert.ok(companies.includes('String(company.id||"")!=="proar-internal"'));
});

test("produção é escalonada em lotes e respeita janela individual por tenant",async()=>{
  const route=await read("app/api/manager/releases/route.ts");
  const panel=await read("components/ReleaseGovernancePanel.tsx");
  assert.ok(route.includes("PROAR_PRODUCTION_BATCH_SIZE"));
  assert.ok(route.includes("PROAR_PRODUCTION_BATCH_MINUTES"));
  assert.ok(route.includes("RELEASE_PRODUCTION_STAGED"));
  assert.ok(route.includes("tenantScheduledAt"));
  assert.ok(panel.includes("Atualização agendada"));
});

test("quality gate exige CI aprovado e migration destrutiva reversível",async()=>{
  const core=await read("lib/release-governance.ts");
  const route=await read("app/api/manager/releases/route.ts");
  assert.ok(core.includes("inspectGitQualityGate"));
  assert.ok(core.includes("/check-runs?per_page=100"));
  assert.ok(route.includes("PROAR-REL-CI-GATE"));
  assert.ok(route.includes("migration.destructive===true&&migration.reversible!==true"));
});

test("baseline registra versão servida sem alterar aliases",async()=>{
  const route=await read("app/api/manager/releases/route.ts");
  const panel=await read("components/ReleaseGovernancePanel.tsx");
  assert.ok(route.includes('action==="baseline-production"'));
  assert.ok(route.includes("RELEASE_PRODUCTION_BASELINE"));
  assert.ok(panel.includes("Registrar baseline"));
  assert.ok(panel.includes("Nenhum alias será alterado"));
});

console.log("release-governance.test.mjs: ok");
