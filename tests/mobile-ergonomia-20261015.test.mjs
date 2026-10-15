import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync(new URL("../components/ProARFieldMobile.module.css",import.meta.url),"utf8");
test("compact layout is available for narrow phones",()=>assert.match(css,/@media \\(max-width: 420px\\)/));
test("respects reduced motion",()=>assert.match(css,/@media \\(prefers-reduced-motion: reduce\\)/));
test("respects higher contrast preference",()=>assert.match(css,/@media \\(prefers-contrast: more\\)/));
test("interactive controls have visible focus and thumb-sized targets",()=>{assert.match(css,/focus-visible/);assert.match(css,/min-width: 44px/);assert.match(css,/min-height: 48px/);});
