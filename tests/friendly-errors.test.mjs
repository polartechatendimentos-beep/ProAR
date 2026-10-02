import test from "node:test";
import assert from "node:assert/strict";
import { friendlyErrorMessage } from "../lib/error-messages.ts";

test("technical API and bot-like messages are hidden from users",()=>{
  assert.equal(friendlyErrorMessage("TypeError: fetch failed at POST /api/state"),"Não foi possível acessar os dados do sistema neste momento. Tente novamente.");
  assert.equal(friendlyErrorMessage('{"error":"Internal Server Error","request_id":"abc"}'),"Não foi possível concluir esta operação. Tente novamente.");
  assert.equal(friendlyErrorMessage("OpenAI tool call failed with status code=500"),"Não foi possível concluir esta operação. Tente novamente.");
});

test("common HTTP errors become actionable Portuguese messages",()=>{
  assert.equal(friendlyErrorMessage("Forbidden",{status:403}),"Você não possui permissão para realizar esta operação.");
  assert.equal(friendlyErrorMessage("Conflict",{status:409}),"Este registro foi alterado por outro usuário. Atualize a tela e tente novamente.");
  assert.equal(friendlyErrorMessage("Gateway Timeout",{status:504}),"A operação demorou mais que o esperado. Tente novamente.");
});

test("already friendly domain messages are preserved",()=>{
  assert.equal(friendlyErrorMessage("CNPJ inválido."),"CNPJ inválido.");
  assert.equal(friendlyErrorMessage("Sistema bloqueado. Entre em contato com a equipe da ProAR.",{status:403}),"Sistema bloqueado. Entre em contato com a equipe da ProAR.");
});

console.log("friendly-errors.test.mjs: ok");
