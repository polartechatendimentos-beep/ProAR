import test from "node:test";
import assert from "node:assert/strict";
import {hasPermission} from "../lib/permissions.ts";
import {rolePermissionPreset} from "../lib/role-permissions.ts";

const session=(role)=>({username:role,role,companyId:"tenant-test",permissions:rolePermissionPreset(role)});
test("RBAC: financeiro pode baixar e emitir fiscal, mas não alterar estoque",()=>{
 assert.equal(hasPermission(session("Financeiro"),"financeiro.baixar"),true);
 assert.equal(hasPermission(session("Financeiro"),"fiscal.emitir"),true);
 assert.equal(hasPermission(session("Financeiro"),"estoque.ajustar"),false);
});
test("RBAC: técnico não acessa mutações financeiras, fiscais ou estoque",()=>{
 for(const p of ["financeiro.baixar","financeiro.estornar","fiscal.emitir","estoque.ajustar"]) assert.equal(hasPermission(session("Técnico"),p),false);
 assert.equal(hasPermission(session("Técnico"),"os.editar"),true);
});
test("RBAC: estoquista recebe compra e ajusta estoque, sem baixa financeira",()=>{
 assert.equal(hasPermission(session("Estoquista"),"compras.receber"),true);
 assert.equal(hasPermission(session("Estoquista"),"estoque.ajustar"),true);
 assert.equal(hasPermission(session("Estoquista"),"financeiro.baixar"),false);
});
test("RBAC: consulta permanece somente leitura",()=>{
 for(const p of ["os.editar","financeiro.editar","comercial.editar","fiscal.emitir","estoque.editar"]) assert.equal(hasPermission(session("Consulta"),p),false);
});
test("RBAC: administrador formal mantém acesso total",()=>assert.equal(hasPermission({username:"admin",role:"Administrador",companyId:"tenant-test",permissions:[],claims:["company_owner"]},"fiscal.cancelar"),true));
test("RBAC: texto Administrador sozinho não concede acesso total",()=>assert.equal(hasPermission({username:"qualquer",role:"Administrador",companyId:"tenant-test",permissions:[],claims:[]},"fiscal.cancelar"),false));
console.log("rbac-matrix.test.mjs: ok");
