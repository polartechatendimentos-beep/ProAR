import test from "node:test";
import assert from "node:assert/strict";
import { findDiagnosticMatches, parseDiagnosticSearch } from "../lib/diagnostic-engine.ts";
import { validateManufacturerCode } from "../lib/diagnostic-brand-rules.ts";
import { BUILTIN_HVAC_ERROR_CODES } from "../lib/hvac-error-code-catalog.ts";

test("interprets natural-language field query with brand, outdoor unit, blink count, type and capacity",()=>{
  const parsed=parseDiagnosticSearch("elgin apresentando erro na condensadora piscando 5 vezes piso teto 60mil");
  assert.equal(parsed.brand,"elgin");
  assert.equal(parsed.unit,"Condensadora");
  assert.equal(parsed.equipmentType,"Piso Teto");
  assert.equal(parsed.capacityBtus,60000);
  assert.equal(parsed.blinkPattern,"5 piscadas");
  assert.equal(parsed.code,"","\"na\" não pode ser interpretado como código de erro");
});

test("does not return Elgin split evaporator 5-blink code for a floor-ceiling outdoor-unit query",()=>{
  const query=parseDiagnosticSearch("elgin apresentando erro na condensadora piscando 5 vezes piso teto 60mil");
  const matches=findDiagnosticMatches(BUILTIN_HVAC_ERROR_CODES,query,20).filter(item=>item.score>5);
  assert.equal(matches.some(item=>item.record.id==="SRC-ELGIN-SPLIT-E5"),false);
});

test("Elgin E0 requires model context before confirmation",()=>{
  const result=validateManufacturerCode({brand:"Elgin",code:"E0"});
  assert.equal(result.status,"needs-model");
  assert.equal(result.canUseAsConfirmedReference,false);
});

test("Daikin isolated numeric reading is treated as incomplete extraction",()=>{
  const result=validateManufacturerCode({brand:"Daikin",code:"37",model:"VRV"});
  assert.equal(result.status,"needs-extraction");
  assert.equal(result.canUseAsConfirmedReference,false);
});

test("Daikin alphanumeric identifiers such as UA remain valid candidates",()=>{
  const result=validateManufacturerCode({brand:"Daikin",code:"UA",model:"VRV"});
  assert.equal(result.status,"candidate");
});
