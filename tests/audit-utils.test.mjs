import assert from "node:assert/strict";
import test from "node:test";
import { auditMatches, diffAuditRecord } from "../lib/audit-utils.ts";

test("auditoria identifica campos alterados",()=>{
  const changes=diffAuditRecord(
    {id:"CLI-1",name:"Cliente A",phone:"1111",status:"Ativo"},
    {id:"CLI-1",name:"Cliente A",phone:"2222",status:"Inativo"},
  );
  assert.ok(changes.some(item=>item.field==="Telefone"&&item.before==="1111"&&item.after==="2222"));
  assert.ok(changes.some(item=>item.field==="Situação"&&item.before==="Ativo"&&item.after==="Inativo"));
});

test("auditoria ignora campos sensíveis",()=>{
  const changes=diffAuditRecord(
    {id:"FUN-1",employeePasswordHash:"abc",name:"A"},
    {id:"FUN-1",employeePasswordHash:"xyz",name:"A"},
  );
  assert.equal(changes.length,0);
});

test("histórico localiza evento estruturado e legado",()=>{
  assert.equal(auditMatches({recordId:"PRO-1",auditModule:"Produtos"},"Produtos","PRO-1","Cobre"),true);
  assert.equal(auditMatches({description:"Produtos • PRO-1 • Registro atualizado"},"Produtos","PRO-1","Cobre"),true);
  assert.equal(auditMatches({description:"Outro registro"},"Produtos","PRO-1","Cobre"),false);
});
