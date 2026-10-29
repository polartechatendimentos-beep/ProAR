import test from "node:test";
import assert from "node:assert/strict";
import {projectOperationalState,mergeOperationalView} from "../lib/state-access.ts";
import {tenantEmployeeCandidate,employeeStateKeys} from "../lib/tenant-employee-auth.ts";
const tech={username:"marin",displayName:"Marin",role:"Técnico de Campo",permissions:[]};
const admin={username:"admin",role:"Administrador",permissions:["*"]};
const can=p=>["os.visualizar","clientes.visualizar","Serviços","equipamentos.visualizar"].includes(p);
const state={_revision:7,_companyId:"C1",_mobileFieldOps:{private:"internal"},customers:[{id:"C",name:"Cliente"}],serviceOrders:[{id:"OS1",tech:"Marin",total:900,diagnosis:"Inicial"},{id:"OS2",tech:"Outro",total:1200}],moduleRecords:{"Funcionários":[{id:"F",employeeUsername:"marin",employeePasswordHash:"stored",name:"Marin"}],Financeiro:[{id:"FIN",value:600}],Serviços:[{id:"S",name:"Limpeza",cost:20}],Equipamentos:[{id:"EQ",name:"Split"}],"Credenciais IA":[{id:"KEY",apiKey:"private"}]}};
test("technician state excludes other OS, financial modules, internal operations and secrets",()=>{
 const view=projectOperationalState(state,tech,can);
 assert.deepEqual(view.serviceOrders.map(x=>x.id),["OS1"]);
 assert.equal(view.serviceOrders[0].total,undefined);
 assert.equal(view.moduleRecords.Financeiro,undefined);
 assert.equal(view.moduleRecords["Funcionários"],undefined);
 assert.equal(view.moduleRecords["Credenciais IA"],undefined);
 assert.equal(view.moduleRecords.Serviços[0].cost,undefined);
 assert.equal(view._mobileFieldOps,undefined);
 assert.equal(state.moduleRecords.Financeiro[0].value,600);
});
test("admin retains all modules while hashes and secret keys never leave server",()=>{
 const view=projectOperationalState(state,admin,()=>true);
 assert.ok(view.moduleRecords.Financeiro);assert.equal(view.serviceOrders.length,2);
 assert.equal(view.moduleRecords["Funcionários"][0].employeePasswordHash,undefined);
 assert.equal(view.moduleRecords["Credenciais IA"][0].apiKey,undefined);
});
test("editing a projected OS preserves hidden OS, modules, original amounts and credentials",()=>{
 const view=projectOperationalState(state,tech,can);
 view.serviceOrders[0].diagnosis="Atualizado";
 view.serviceOrders[0].total=1;
 view.moduleRecords.Financeiro=[{id:"FIN",value:0}];
 const merged=mergeOperationalView(state,view,tech,can);
 assert.equal(merged.serviceOrders.find(x=>x.id==="OS1").diagnosis,"Atualizado");
 assert.equal(merged.serviceOrders.find(x=>x.id==="OS1").total,900);
 assert.deepEqual(merged.serviceOrders.find(x=>x.id==="OS2"),state.serviceOrders[1]);
 assert.deepEqual(merged.moduleRecords.Financeiro,state.moduleRecords.Financeiro);
 assert.equal(merged.moduleRecords["Funcionários"][0].employeePasswordHash,"stored");
 assert.equal(merged._mobileFieldOps.private,"internal");
});
test("admin can reset a password but omission from a redacted view preserves it",()=>{
 const view=projectOperationalState(state,admin,()=>true);
 view.moduleRecords["Funcionários"][0].name="Nome atualizado";
 assert.equal(mergeOperationalView(state,view,admin,()=>true).moduleRecords["Funcionários"][0].employeePasswordHash,"stored");
 view.moduleRecords["Funcionários"][0].employeePasswordHash="new-hash";
 assert.equal(mergeOperationalView(state,view,admin,()=>true).moduleRecords["Funcionários"][0].employeePasswordHash,"new-hash");
});
test("view without OS or customer grant cannot disclose their records",()=>{
 const view=projectOperationalState(state,{...tech,role:"Consulta"},()=>false);
 assert.deepEqual(view.customers,[]);assert.deepEqual(view.serviceOrders,[]);assert.deepEqual(view.moduleRecords,{});
});
test("tenant employee lookup accepts only expected state ownership and explicit state keys",()=>{
 const payload={_companyId:"C1",moduleRecords:{"Funcionários":[{employeeUsername:"marin",id:"F1"}]}};
 assert.equal(tenantEmployeeCandidate(payload,"C1","MARIN").id,"F1");
 assert.equal(tenantEmployeeCandidate(payload,"C2","marin"),null);
 assert.equal(tenantEmployeeCandidate(payload,"C1","outro"),null);
 assert.deepEqual(employeeStateKeys("C2",false,"C1"),["C2"]);
 assert.deepEqual(employeeStateKeys("C2",true,"C1"),["main"]);
 assert.deepEqual(employeeStateKeys("C1",false,"C1"),["C1","main","polartech"]);
});
