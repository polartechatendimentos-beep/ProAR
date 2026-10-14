import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../components/ProARFieldMobile.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../components/ProARFieldMobile.module.css",import.meta.url),"utf8");
test("sunlight toggle has accessible pressed state",()=>{assert.match(ui,/aria-pressed=\{sunlightMode\}/);assert.match(ui,/setSunlightMode\(value=>!value\)/);});
test("sunlight mode enforces black-on-white and visible keyboard focus",()=>{assert.match(css,/\.sunlightMode \{ background: #fff/);assert.match(css,/outline: 3px solid #000/);});
