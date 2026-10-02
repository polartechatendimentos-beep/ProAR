import test from "node:test";
import assert from "node:assert/strict";
import { prepareCustomerStructureSave } from "../lib/customer-structure.ts";

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

test("Prefeitura bloqueia Unidade sem Secretaria", () => {
  const prefeitura = { id: "CLI-PREF-A", name: "Prefeitura A", organizationType:"Prefeitura" };
  assert.throws(() => prepareCustomerStructureSave(prefeitura, {
    id: "EST-UBS",
    name: "UBS Central",
    category: "Unidade",
    hierarchyLevel: "Unidade",
  }, []), /Secretaria/);
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
