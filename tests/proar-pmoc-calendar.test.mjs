import test from "node:test";
import assert from "node:assert/strict";
import {previewPmocCalendar} from "../lib/proar-pmoc-calendar.ts";
const plan={companyId:"a",contractCompanyId:"a",contractId:"PMOC-1",startDate:"2026-01-31",endDate:"2026-12-31",frequencyMonths:1};
test("PMOC monthly previews clamp end-of-month and respect contract bounds",()=>{
 const dates=previewPmocCalendar(plan,2026).map(x=>x.date);
 assert.equal(dates.length,12);assert.equal(dates[1],"2026-02-28");assert.equal(dates[3],"2026-04-30");
 assert.equal(previewPmocCalendar(plan,2027).length,0);
});
test("PMOC rejects invalid dates and cross-tenant contracts",()=>{
 assert.throws(()=>previewPmocCalendar({...plan,contractCompanyId:"b"},2026),/outra empresa/);
 assert.throws(()=>previewPmocCalendar({...plan,startDate:"2026-02-30"},2026),/inválida/);
 assert.throws(()=>previewPmocCalendar({...plan,endDate:"2025-12-31"},2026),/Vigência/);
});
