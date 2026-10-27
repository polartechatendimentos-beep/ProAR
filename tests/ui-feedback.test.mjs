import assert from "node:assert/strict";
import test from "node:test";
import { inferFeedbackTone } from "../lib/ui-feedback.ts";

test("feedback classifica confirmações como sucesso",()=>{
  assert.equal(inferFeedbackTone("Cliente salvo com sucesso."),"success");
  assert.equal(inferFeedbackTone("Alterações salvas."),"success");
  assert.equal(inferFeedbackTone("Registro excluído."),"success");
});

test("feedback classifica falhas e conflitos",()=>{
  assert.equal(inferFeedbackTone("Falha ao salvar o cliente."),"error");
  assert.equal(inferFeedbackTone("Não foi possível concluir a operação."),"error");
  assert.equal(inferFeedbackTone("Conflito detectado: dados mais recentes preservados."),"warning");
});

test("feedback usa informação quando não há estado operacional evidente",()=>{
  assert.equal(inferFeedbackTone("Consulta finalizada."),"info");
});
