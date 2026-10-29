import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {tenantEmployeeCandidate} from "../lib/tenant-employee-auth.ts";
test("ambiguous employee identity is rejected even if an older account exists",()=>{
 assert.throws(()=>tenantEmployeeCandidate({moduleRecords:{"Funcionários":[{id:"1",employeeUsername:"marin"},{id:"2",employeeUsername:"MARIN"}]}},"C1","marin"),/duplicado/);
});
test("authentication lookup never scans all operational states or falls through on a wrong current password",async()=>{
 const source=await readFile(new URL("../app/api/auth/route.ts",import.meta.url),"utf8");
 assert.equal(source.includes('supabaseRest("proar_state?select=id,payload")'),false);
 assert.ok(source.includes('employeeStateKeys(companyId,db.dedicated,PRIMARY_COMPANY_ID)'));
 assert.ok(source.includes('if(!storedHash||!verifyPassword(password,storedHash))return {denied:true'));
 assert.ok(source.includes('resolvedTenant!==PRIMARY_COMPANY_SLUG ? null : authenticate'));
});

test("legacy state recovery cannot use a company ID supplied by the browser",async()=>{
 const source=await readFile(new URL("../app/api/state/route.ts",import.meta.url),"utf8");
 assert.equal(source.includes('[id, requestedCompany(request),'),false);
 assert.ok(source.includes("String(payload._companyId)!==expectedCompany"));
 assert.ok(source.includes('String(current._companyId)!==company'));
});
