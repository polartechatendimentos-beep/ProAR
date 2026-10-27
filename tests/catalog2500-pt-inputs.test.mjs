import test from "node:test";
import assert from "node:assert/strict";
import { interpolatePt,validatePtDataset } from "../lib/refrigerant-tools.ts";
const dataset={refrigerant:"Teste",source:"Fixture sintética",sourceUrl:"https://example.com/fixture",verified:true,points:[{temperatureC:0,pressureBar:2,pressurePsi:29},{temperatureC:10,pressureBar:4,pressurePsi:58}]};
test("PT interpolation rejects invalid requested temperature without throwing",()=>{
 for(const value of [NaN,Infinity,-Infinity,"5",null,undefined]) assert.equal(interpolatePt(dataset,value).ok,false);
});
test("PT datasets reject invalid required and optional measurements",()=>{
 for(const key of ["temperatureC","pressureBar","pressurePsi","dewPressureBar","bubblePressureBar"]) for(const value of [NaN,Infinity,-Infinity,"5",null]) {
  const invalid={...dataset,points:[{...dataset.points[0],[key]:value},dataset.points[1]]};
  assert.equal(validatePtDataset(invalid).ok,false);
  assert.equal(interpolatePt(invalid,5).ok,false);
 }
});
test("PT datasets reject null rows without throwing",()=>{
 assert.equal(interpolatePt({...dataset,points:[null,dataset.points[1]]},5).ok,false);
});
test("valid PT interpolation and boundary checks remain supported",()=>{
 const result=interpolatePt(dataset,5);
 assert.equal(result.ok,true);
 assert.deepEqual(result.point,{temperatureC:5,pressureBar:3,pressurePsi:43.5});
 assert.deepEqual(interpolatePt(dataset,0).point,dataset.points[0]);
 assert.equal(interpolatePt(dataset,11).ok,false);
});
