import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("SOS flutuante desaparece apenas na ordem de serviço aberta", () => {
  const mobile = readFileSync(new URL("../components/ProARFieldMobile.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/FieldSupportPanel.tsx", import.meta.url), "utf8");
  const prop = mobile.match(/<FieldSupportPanel[^>]*showSosButton=\{([^}]+)\}/)?.[1];
  const condition = panel.match(/\{([^{}]+)&&<button className=\{styles\.sosButton\}/)?.[1];
  assert.ok(prop && condition, "a aplicação fornece e consome a condição de visibilidade");
  for (const tab of ["home", "orders", "central"]) {
    for (const current of [undefined, { id: "OS-teste" }]) {
      const showSosButton = runInNewContext(prop, { tab, current });
      assert.equal(Boolean(runInNewContext(condition, { showSosButton, data: { employee: { employeeId: "tech" } } })), !current);
      assert.equal(Boolean(runInNewContext(condition, { showSosButton, data: { employee: null } })), false);
    }
  }
  assert.match(panel, /save\("sos",\{/);
  assert.match(panel, /save\("sos-ack",\{/);
});
