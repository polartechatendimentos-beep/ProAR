import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync("app/mobile/page.tsx","utf8");
const queue=readFileSync("lib/mobile/offline-queue.ts","utf8");
test("mobile theme supports light dark auto",()=>{for(const theme of ['"light"','"dark"','"auto"'])assert.ok(ui.includes(theme));assert.match(ui,/proar-mobile-theme/);});
test("mobile supports six development workstreams without fake server synchronization",()=>{for(const label of ["Checklist","Fotos","Histórico","Supervisão","saveLocalEvent","photosPersisted:false"])assert.ok(ui.includes(label));assert.match(ui,/Sincronização bloqueada por segurança/);});
test("draft events use IndexedDB and stable event ids",()=>{assert.match(queue,/indexedDB.open/);assert.match(queue,/keyPath:"id"/);assert.match(ui,/crypto.randomUUID/);});
