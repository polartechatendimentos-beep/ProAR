import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission } from "../lib/permissions.ts";
const session=(permissions,role="Técnico de Campo")=>({username:"marin",displayName:"Marin",role,permissions,companyId:"polartech-principal"});
test("employee OS matrix grants viewing and editing selected in the profile",()=>{
 const user=session(["Ordens de serviço","Ordens de serviço:Visualizar","Ordens de serviço:Criar","Ordens de serviço:Editar","Ordens de serviço:Excluir"]);
 assert.equal(hasPermission(user,"os.visualizar"),true);
 assert.equal(hasPermission(user,"os.editar"),true);
 assert.equal(hasPermission(user,"financeiro.editar"),false);
 assert.equal(hasPermission(user,"configuracoes.usuarios"),false);
});
test("read-only employee OS grant does not allow mutation or export",()=>{
 const user=session(["Ordens de serviço","Ordens de serviço:Visualizar"]);
 assert.equal(hasPermission(user,"os.visualizar"),true);
 for(const permission of ["os.editar","os.cancelar","os.exportar"])assert.equal(hasPermission(user,permission),false);
});
test("OS editing matrix action does not independently grant viewing",()=>{
 const user=session(["Ordens de serviço:Editar"]);
 assert.equal(hasPermission(user,"os.editar"),true);
 assert.equal(hasPermission(user,"os.visualizar"),false);
});
test("unrelated module and missing session cannot grant OS access",()=>{
 assert.equal(hasPermission(session(["Agenda","Clientes","Equipamentos"]),"os.visualizar"),false);
 assert.equal(hasPermission(null,"os.visualizar"),false);
});
test("existing canonical and legacy OS permissions remain compatible",()=>{
 for(const value of ["os.visualizar","Ordens de Serviço","OS"])assert.equal(hasPermission(session([value]),"os.visualizar"),true);
 assert.equal(hasPermission(session(["*"]),"os.editar"),true);
});
test("external profile needs an explicit selected editing action",()=>{
 assert.equal(hasPermission(session(["Ordens de serviço"],"Fiscal"),"os.editar"),false);
 assert.equal(hasPermission(session(["Ordens de serviço:Editar"],"Fiscal"),"os.editar"),true);
});
