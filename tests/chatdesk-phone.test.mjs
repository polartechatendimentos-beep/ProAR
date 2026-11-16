import test from "node:test";
import assert from "node:assert/strict";
import {normalizeWhatsAppPhone,whatsappNumberExists} from "../lib/chatdesk-phone.ts";

test("DDD brasileiro é convertido para E.164 sem o sinal +",()=>{
 assert.equal(normalizeWhatsAppPhone("(17) 99999-1234"),"5517999991234");
 assert.equal(normalizeWhatsAppPhone("+55 (17) 99999-1234"),"5517999991234");
 assert.equal(normalizeWhatsAppPhone("1732535688"),"551732535688");
});
test("recusa telefone curto, DDD inválido e entradas internacionais",()=>{
 for(const value of ["1234","00000000000","(00) 99999-1234","+1 202 555 0171","5517000000000"]){
  assert.throws(()=>normalizeWhatsAppPhone(value));
 }
});
test("nunca assume que WhatsApp existe sem resposta explícita",()=>{
 assert.equal(whatsappNumberExists([{number:"5517999991234",exists:true}],"5517999991234"),true);
 assert.equal(whatsappNumberExists([{number:"5517999991234",exists:false}],"5517999991234"),false);
 assert.throws(()=>whatsappNumberExists([{number:"5517999991234"}],"5517999991234"));
 assert.throws(()=>whatsappNumberExists([{number:"5517999999999",exists:true}],"5517999991234"));
});
