import test from "node:test";
import assert from "node:assert/strict";
import { prepareCustomerStructureSave } from "../lib/customer-structure.ts";

test("cadastro teste: Prefeitura de Bálsamo mantém Diretoria de Saúde, UBS Centro e Recepção vinculados por ID", () => {
  const prefeitura = { id: "CLI-PREF-BALSAMO-TESTE", name: "Prefeitura Municipal de Bálsamo" };
  let structures = [];

  const diretoria = prepareCustomerStructureSave(prefeitura, {
    id: "EST-SAUDE-TESTE",
    name: "Diretoria de Saúde",
    category: "Diretoria",
    hierarchyLevel: "Diretoria",
  }, structures);
  structures = diretoria.nextStructures;

  const ubs = prepareCustomerStructureSave(prefeitura, {
    id: "EST-UBS-CENTRO-TESTE",
    name: "UBS Centro",
    category: "Unidade",
    hierarchyLevel: "Unidade",
    parentId: diretoria.record.id,
  }, structures);
  structures = ubs.nextStructures;

  const setor = prepareCustomerStructureSave(prefeitura, {
    id: "EST-RECEPCAO-TESTE",
    name: "Recepção",
    category: "Setor",
    hierarchyLevel: "Setor",
    parentId: ubs.record.id,
  }, structures);

  assert.equal(diretoria.record.customerId, prefeitura.id);
  assert.equal(ubs.record.customerId, prefeitura.id);
  assert.equal(ubs.record.parentId, diretoria.record.id);
  assert.equal(ubs.record.parentUnit, "Diretoria de Saúde");
  assert.equal(setor.record.customerId, prefeitura.id);
  assert.equal(setor.record.parentId, ubs.record.id);
  assert.equal(setor.record.parentUnit, "UBS Centro");
  assert.equal(setor.unitCount, 3);
});

test("estrutura de uma Prefeitura não pode ser vinculada a outra Prefeitura", () => {
  const prefeitura = { id: "CLI-PREF-A", name: "Prefeitura A" };
  const foreign = [{ id: "EST-OUTRA", name: "UBS de outra Prefeitura", client: "Prefeitura B", customerId: "CLI-PREF-B" }];
  assert.throws(() => prepareCustomerStructureSave(prefeitura, {
    id: "EST-SETOR-A",
    name: "Recepção",
    parentId: "EST-OUTRA",
    category: "Setor",
  }, foreign), /outro cliente/);
});

test("hierarquia bloqueia auto vínculo e ciclos", () => {
  const prefeitura = { id: "CLI-PREF-A", name: "Prefeitura A" };
  const structures = [
    { id: "A", name: "Saúde", customerId: prefeitura.id, client: prefeitura.name },
    { id: "B", name: "UBS", customerId: prefeitura.id, client: prefeitura.name, parentId: "A" },
  ];
  assert.throws(() => prepareCustomerStructureSave(prefeitura, { ...structures[0], parentId: "A" }, structures), /ela mesma/);
  assert.throws(() => prepareCustomerStructureSave(prefeitura, { ...structures[0], parentId: "B" }, structures), /ciclo/);
});
