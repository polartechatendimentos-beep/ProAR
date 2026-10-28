import test from "node:test";
import assert from "node:assert/strict";
import {employeePasswordIssue} from "../lib/employee-password-validation.ts";
test("password reset reports exactly which requirements are missing",()=>{
 assert.deepEqual(employeePasswordIssue("tecnico12345","tecnico12345"),{field:"password",message:"A nova senha precisa conter uma letra maiúscula."});
 const issue=employeePasswordIssue("abc","abc");
 assert.equal(issue.field,"password");
 assert.match(issue.message,/10 caracteres/);assert.match(issue.message,/maiúscula/);assert.match(issue.message,/número/);
});
test("confirmation error identifies the confirmation field",()=>{
 assert.equal(employeePasswordIssue("Tecnico12345","")?.field,"confirmation");
 assert.equal(employeePasswordIssue("Tecnico12345","Outro123456")?.field,"confirmation");
});
test("matching valid password and blank unchanged password can be saved",()=>{
 assert.equal(employeePasswordIssue("Tecnico12345","Tecnico12345"),null);
 assert.equal(employeePasswordIssue("",""),null);
 assert.equal(employeePasswordIssue("","Texto123456")?.field,"password");
});
