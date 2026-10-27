import test from "node:test";
import assert from "node:assert/strict";
import { prepareCustomerStructureSave, prepareCustomerStructureInactivation } from "../lib/customer-structure.ts";

test("Prefeitura mantém hierarquia Prefeitura → Secretaria → Unidade → Sala", () => {
  const prefeitura = { id: "CLI-PREF-BALSAMO-TESTE", name: "Prefeitura Municipal de Bálsamo", organizationType:"Prefeitura" };
  let structures = [];

  const secretaria = prepareCustomerStructureSave(prefeitura, {
    id: "EST-SAUDE-TESTE",
    name: "Secretaria de Saúde",
    category: "Secretaria",
    hierarchyLevel: "Secretaria",
  }, structures);
  structures = secretaria.nextStructures;

  const ubs = prepareCustomerStructureSave(prefeitura, {
    id: "EST-UBS-CENTRO-TESTE",
    name: "UBS Central",
    category: "Unidade",
    hierarchyLevel: "Unidade",
    parentId: secretaria.record.id,
  }, structures);
  structures = ubs.nextStructures;

  const sala = prepareCustomerStructureSave(prefeitura, {
    id: "EST-RECEPCAO-TESTE",
    name: "Recepção",
    category: "Sala",
    hierarchyLevel: "Sala",
    parentId: ubs.record.id,
  }, structures);

  assert.equal(secretaria.record.customerId, prefeitura.id);
  assert.equal(secretaria.record.parentId, undefined);
  assert.equal(ubs.record.parentId, secretaria.record.id);
  assert.equal(ubs.record.parentUnit, "Secretaria de Saúde");
  assert.equal(sala.record.parentId, ubs.record.id);
  assert.equal(sala.record.parentUnit, "UBS Central");
  assert.equal(sala.unitCount, 3);
});

test("Prefeitura permite Unidade diretamente na Matriz", () => {
  const prefeitura={id:"CLI-PREF-A",name:"Prefeitura A",organizationType:"Prefeitura"};
  const saved=prepareCustomerStructureSave(prefeitura,{id:"EST-UBS",name:"UBS Central",category:"Unidade",hierarchyLevel:"Unidade"},[]);
  assert.equal(saved.record.parentId,undefined);
  assert.equal(saved.record.customerId,prefeitura.id);
});

test("Prefeitura bloqueia Sala vinculada diretamente à Secretaria", () => {
  const prefeitura = { id: "CLI-PREF-A", name: "Prefeitura A", organizationType:"Prefeitura" };
  const secretaria = { id:"SEC-1", name:"Secretaria de Saúde", customerId:prefeitura.id, client:prefeitura.name, category:"Secretaria", hierarchyLevel:"Secretaria" };
  assert.throws(() => prepareCustomerStructureSave(prefeitura, {
    id: "SALA-1",
    name: "Recepção",
    category: "Sala",
    hierarchyLevel: "Sala",
    parentId: secretaria.id,
  }, [secretaria]), /Unidade/);
});

test("estrutura de uma Prefeitura não pode ser vinculada a outra Prefeitura", () => {
  const prefeitura = { id: "CLI-PREF-A", name: "Prefeitura A", organizationType:"Prefeitura" };
  const foreign = [{ id: "EST-OUTRA", name: "Secretaria de outra Prefeitura", client: "Prefeitura B", customerId: "CLI-PREF-B", category:"Secretaria", hierarchyLevel:"Secretaria" }];
  assert.throws(() => prepareCustomerStructureSave(prefeitura, {
    id: "EST-UNIDADE-A",
    name: "UBS",
    parentId: "EST-OUTRA",
    category: "Unidade",
    hierarchyLevel:"Unidade",
  }, foreign), /outro cliente/);
});

test("hierarquia bloqueia auto vínculo e ciclos", () => {
  const cliente = { id: "CLI-A", name: "Cliente A" };
  const structures = [
    { id: "A", name: "Unidade", customerId: cliente.id, client: cliente.name },
    { id: "B", name: "Sala", customerId: cliente.id, client: cliente.name, parentId: "A" },
  ];
  assert.throws(() => prepareCustomerStructureSave(cliente, { ...structures[0], parentId: "A" }, structures), /ela mesma/);
  assert.throws(() => prepareCustomerStructureSave(cliente, { ...structures[0], parentId: "B" }, structures), /ciclo/);
});


test("inactivation preserves duplicate legacy sectors by ID without hierarchy validation",()=>{
 const c={id:"p",name:"Prefeitura A"};
 const items=[{id:"first",name:"Educação",client:c.name,category:"Setor",status:"Ativo",createdAt:"old"},{id:"duplicate",name:"Educação",client:c.name,category:"Setor",status:"Ativo",extra:"preserved"}];
 const result=prepareCustomerStructureInactivation(c,"duplicate",items,[c],"Setor duplicado");
 assert.equal(result.nextStructures[0].status,"Ativo");
 assert.equal(result.record.status,"Inativo");
 assert.equal(result.record.extra,"preserved");
 assert.equal(result.record.customerId,"p");
 assert.equal(result.unitCount,1);
 assert.equal(items[1].status,"Ativo");
});
test("inactivation rejects ambiguous legacy ownership and foreign explicit IDs",()=>{
 const c={id:"p",name:"Prefeitura A"};
 const r={id:"sector",name:"Saúde",client:c.name};
 assert.throws(()=>prepareCustomerStructureInactivation(c,r.id,[r],[c,{...c,id:"other"}],"duplicado"),/confirmar/);
 assert.throws(()=>prepareCustomerStructureInactivation(c,r.id,[{...r,customerId:"foreign"}],[c],"duplicado"),/confirmar/);
 assert.throws(()=>prepareCustomerStructureInactivation(c,r.id,[r],[c]," "),/motivo/);
});
test("editing a legacy root sector confirms unique owner and preserves metadata",()=>{
 const c={id:"p",name:"Prefeitura A"};
 const r={id:"s",name:"Educação",client:c.name,category:"Setor",createdAt:"original",extra:"keep"};
 const saved=prepareCustomerStructureSave(c,{...r,name:"Educação Municipal"},[r],[c]);
 assert.equal(saved.record.customerId,c.id);
 assert.equal(saved.record.extra,"keep");
 assert.equal(saved.record.createdAt,"original");
 assert.throws(()=>prepareCustomerStructureSave(c,{...r,name:"New"},[r],[c,{...c,id:"other"}]),/confirmado/);
 assert.throws(()=>prepareCustomerStructureSave(c,{...r,id:"new"},[r],[c]),/Unidade/);
});
