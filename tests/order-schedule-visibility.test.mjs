import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("new order scheduling is visible before tabs for municipal and other customers",async()=>{
 const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
 const start=page.indexOf('if (isNewOrder) return');
 const end=page.indexOf('return <div className="modal-layer"',start);
 const form=page.slice(start,end);
 const schedule=form.indexOf('aria-label="Data e horário do atendimento"');
 const tabs=form.indexOf('aria-label="Etapas da nova ordem"');
 assert.ok(schedule>=0&&schedule<tabs);
 const block=form.slice(schedule,tabs);
 assert.ok(block.includes('id="os-create-date"'));
 assert.ok(block.includes('id="os-create-time"'));
 assert.ok(!block.includes("municipal-legacy-location"));
 assert.equal((form.match(/id="os-create-date"/g)||[]).length,1);
 assert.equal((form.match(/id="os-create-time"/g)||[]).length,1);
 assert.ok(form.includes('Agendamento & Janela')===false);
});
