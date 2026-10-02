import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTeamSchedule } from "../lib/team-planning.ts";

test("agenda detecta conflito do mesmo técnico",()=>{
  const result=analyzeTeamSchedule([
    {id:"OS1",client:"A",date:"2026-10-02",time:"09:00",tech:"Tiago",status:"Agendada",estimatedDurationMinutes:120},
    {id:"OS2",client:"B",date:"2026-10-02",time:"10:00",tech:"Tiago",status:"Agendada",estimatedDurationMinutes:90},
  ]);
  assert.equal(result.conflicts.length,1);
  assert.ok(result.orderFlags.get("OS1").includes("Conflito de horário"));
});
test("agenda sinaliza OS sem técnico e sugere menor carga",()=>{
  const result=analyzeTeamSchedule(
    [{id:"OS1",client:"A",date:"2026-10-02",time:"09:00",tech:"",status:"Agendada",serviceType:"Instalação"}],
    [{id:"T1",name:"Thiago",status:"Ativo",skills:"Instalação refrigeração"},{id:"T2",name:"João",status:"Ativo",skills:"Manutenção"}]
  );
  assert.equal(result.unassigned.length,1);
  assert.equal(result.suggestTechnicians(result.unassigned[0])[0].tech,"Thiago");
});
