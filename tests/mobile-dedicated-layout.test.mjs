import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("/mobile owns a dedicated touch shell",async()=>{
  const mobile=await readFile(new URL("../components/ProARMobile.tsx",import.meta.url),"utf8");
  const today=await readFile(new URL("../components/MobileToday.tsx",import.meta.url),"utf8");
  const responsive=await readFile(new URL("../app/responsive-hardening.css",import.meta.url),"utf8");
  const routes=await readFile(new URL("../components/work-routes.css",import.meta.url),"utf8");
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");

  assert.ok(mobile.includes('dataset.proarExperience="mobile"'));
  assert.ok(mobile.includes('classList.add("proar-mobile-route")'));
  assert.ok(!mobile.includes("<MobileRouteControls/>"));

  assert.ok(today.includes('className="mobile-route-summary'));
  assert.ok(today.includes("<MobileRouteControls/>"));
  assert.ok(today.includes('className="mobile-quick-actions"'));
  assert.ok(!today.includes('className="mobile-context-nav"'));

  assert.ok(responsive.includes('html[data-proar-experience="mobile"] .mobile-dedicated-experience .sidebar'));
  assert.ok(responsive.includes('html[data-proar-experience="mobile"] .mobile-dedicated-experience .mobile-nav'));
  assert.ok(responsive.includes('html[data-proar-experience="mobile"] .customer-panel tbody tr'));
  assert.ok(routes.includes('html[data-proar-experience="mobile"] .mobile-today'));
  assert.ok(routes.includes('html[data-proar-experience="mobile"] .mobile-route-summary'));

  assert.ok(page.includes('{name:"Obras",label:"Obras",icon:Building2}'));
  assert.ok(!page.includes('{name:"Configurações",label:"Mais",icon:MoreHorizontal}'));
});

console.log("mobile-dedicated-layout.test.mjs: ok");
