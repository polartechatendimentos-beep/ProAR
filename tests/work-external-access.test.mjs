import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mutateWorkExternalAccess } from "../lib/work-external-access.ts";

const access = {
  id:"obra-access-1",
  name:"Eduarda",
  role:"Engenheiro",
  username:"eduarda.reserva",
  passwordHash:"a".repeat(64),
  active:true,
  createdAt:"2026-10-06T12:00:00.000Z",
};

test("external access add changes only the selected work",()=>{
  const projects=[
    {id:"obra-a",name:"Obra A",blocks:[{block:"A",houses:5}],materialPlanning:{keep:true}},
    {id:"obra-b",name:"Obra B",externalAccess:[]},
  ];
  const result=mutateWorkExternalAccess(projects,{action:"external_access_add",workId:"obra-a",access});
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.changed,true);
  assert.equal(result.externalAccess.length,1);
  assert.equal(result.externalAccess[0].username,"eduarda.reserva");
  assert.deepEqual(result.projects[0].blocks,[{block:"A",houses:5}]);
  assert.deepEqual(result.projects[0].materialPlanning,{keep:true});
  assert.deepEqual(result.projects[1],projects[1]);
});

test("external access add is idempotent for the same access id",()=>{
  const projects=[{id:"obra-a",externalAccess:[access]}];
  const result=mutateWorkExternalAccess(projects,{action:"external_access_add",workId:"obra-a",access});
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.changed,false);
  assert.equal(result.externalAccess.length,1);
});

test("external access rejects duplicate usernames in the same work",()=>{
  const projects=[{id:"obra-a",externalAccess:[access]}];
  const result=mutateWorkExternalAccess(projects,{
    action:"external_access_add",
    workId:"obra-a",
    access:{...access,id:"obra-access-2",name:"Outra pessoa",username:"Eduarda.Reserva"},
  });
  assert.equal(result.ok,false);
  if(result.ok)return;
  assert.equal(result.status,409);
  assert.equal(result.code,"WORK_EXTERNAL_ACCESS_USERNAME_EXISTS");
});

test("external access toggle updates only the requested credential",()=>{
  const second={...access,id:"obra-access-2",name:"Fiscal",role:"Fiscal",username:"fiscal.obra"};
  const projects=[{id:"obra-a",externalAccess:[access,second]}];
  const result=mutateWorkExternalAccess(projects,{
    action:"external_access_toggle",
    workId:"obra-a",
    accessId:"obra-access-2",
    active:false,
  });
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.externalAccess[0].active,true);
  assert.equal(result.externalAccess[1].active,false);
});

test("engineer/fiscal screen uses independent persistence and final responsive layout",async()=>{
  const page=await readFile(new URL("../app/page.tsx",import.meta.url),"utf8");
  const route=await readFile(new URL("../app/api/work-external-access/route.ts",import.meta.url),"utf8");
  const css=await readFile(new URL("../app/responsive-hardening.css",import.meta.url),"utf8");
  assert.ok(page.includes('fetch("/api/work-external-access"'));
  assert.ok(page.includes('/api/work-external-access?company='));
  assert.ok(page.includes('method:"POST"'));
  assert.ok(page.includes('action:"external_access_add"'));
  assert.ok(route.includes("work-access-"));
  assert.ok(route.includes("legacyAccess"));
  assert.ok(route.includes("WORK_EXTERNAL_ACCESS_SAVE_FAILED"));
  assert.ok(css.includes("grid-template-areas:"));
  assert.ok(css.includes('"intro progress"'));
  assert.ok(css.includes('"share share"'));
  assert.ok(css.includes(".app-shell .external-access-modal .modal-actions"));
});

console.log("work-external-access.test.mjs: ok");
