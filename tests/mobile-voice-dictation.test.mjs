import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const editor=readFileSync(new URL("../components/FieldOrderEditor.tsx",import.meta.url),"utf8");const voice=readFileSync(new URL("../components/FieldVoiceDictation.tsx",import.meta.url),"utf8");
test("voice input wired to diagnosis and executed report",()=>{assert.match(editor,/Ditar diagnóstico/);assert.match(editor,/Ditar serviço executado/);});
test("speech recognition requires user tap",()=>{assert.match(voice,/const toggle=/);assert.match(voice,/onClick=\\{toggle\\}/);});
test("supports Brazilian Portuguese and manual fallback",()=>{assert.match(voice,/pt-BR/);assert.match(voice,/Use o teclado/);});
