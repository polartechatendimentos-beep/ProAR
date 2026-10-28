import test from "node:test";
import assert from "node:assert/strict";
import { prepareOperationalState } from "../lib/operational-ledger.ts";

const employee={id:"FUN-1",name:"Técnico",status:"Ativo",employeeUsername:"tecnico.um",employeePasswordHash:"a".repeat(64)};
const state=(employees)=>({customers:[],serviceOrders:[],moduleRecords:{"Funcionários":employees}});
const admin={username:"admin",can:()=>true};
test("employee login change requires user administration permission",()=>{
 const before=state([employee]);
 assert.throws(()=>prepareOperationalState(before,state([{...employee,employeeUsername:"tecnico.novo"}]),{username:"editor",can:p=>p!=="configuracoes.usuarios"}),/permiss|autoriza|acesso/i);
});
test("employee login rejects duplicates and invalid usernames",()=>{
 const before=state([employee,{...employee,id:"FUN-2",employeeUsername:"outro"}]);
 assert.throws(()=>prepareOperationalState(before,state([employee,{...employee,id:"FUN-2",employeeUsername:"TECNICO.UM"}]),admin),/outro funcionário/);
 assert.throws(()=>prepareOperationalState(state([employee]),state([{...employee,employeeUsername:"nome com espaço"}]),admin),/inválido/);
});
test("employee username update preserves password unless explicitly changed",()=>{
 const result=prepareOperationalState(state([employee]),state([{...employee,employeeUsername:"Novo.Usuario"}]),admin);
 assert.equal(result.moduleRecords["Funcionários"][0].employeeUsername,"novo.usuario");
 assert.equal(result.moduleRecords["Funcionários"][0].employeePasswordHash,employee.employeePasswordHash);
});
test("unrelated employee edit leaves legacy credentials intact",()=>{
 const legacy={...employee,employeeUsername:"legacy username"};
 const result=prepareOperationalState(state([legacy]),state([{...legacy,phone:"123"}]),admin);
 assert.equal(result.moduleRecords["Funcionários"][0].employeeUsername,legacy.employeeUsername);
 assert.equal(result.moduleRecords["Funcionários"][0].employeePasswordHash,legacy.employeePasswordHash);
});
