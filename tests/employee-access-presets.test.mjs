import test from "node:test";
import assert from "node:assert/strict";
import { employeeAccessPreset, employeeAccessRole, employeeAccessProfile, EMPLOYEE_ACCESS_PROFILES, EMPLOYEE_ACCESS_MODULES } from "../lib/employee-access-presets.ts";
test("technician preset includes OS editing but excludes financial and administrative access",()=>{
 const p=employeeAccessPreset("Técnico de Campo");
 assert.deepEqual(p["Ordens de serviço"],["Visualizar","Editar"]);
 assert.deepEqual(p.Financeiro,[]);assert.deepEqual(p.Configurações,[]);
 assert.deepEqual(p.Funcionários,[]);
});
test("presets are cloned and unknown profiles fail closed",()=>{
 const a=employeeAccessPreset("Técnico");a["Ordens de serviço"].push("Excluir");
 assert.equal(employeeAccessPreset("Técnico")["Ordens de serviço"].includes("Excluir"),false);
 assert.ok(Object.values(employeeAccessPreset("desconhecido")).every(actions=>actions.length===0));
});
test("all profiles include only valid actions and viewing before mutations",()=>{
 for(const profile of EMPLOYEE_ACCESS_PROFILES)for(const actions of Object.values(employeeAccessPreset(profile))){
 assert.ok(actions.every(action=>["Visualizar","Criar","Editar","Excluir"].includes(action)));
 if(actions.length)assert.ok(actions.includes("Visualizar"));
 }
 for(const module of EMPLOYEE_ACCESS_MODULES)assert.deepEqual(employeeAccessPreset("Administrador")[module],["Visualizar","Criar","Editar","Excluir"]);
});
test("profile roles preserve technician and manager scope and consultation is read-only",()=>{
 assert.equal(employeeAccessRole("Gestão"),"Gerência");
 assert.equal(employeeAccessRole("Técnico"),"Técnico de Campo");
 assert.equal(employeeAccessProfile("Supervisor"),"Gestão");
 assert.ok(Object.values(employeeAccessPreset("Consulta")).every(actions=>actions.length===0||actions.join()==="Visualizar"));
 assert.deepEqual(employeeAccessPreset("Vendedor").Financeiro,[]);
 assert.deepEqual(employeeAccessPreset("Estoquista").Configurações,[]);
});
