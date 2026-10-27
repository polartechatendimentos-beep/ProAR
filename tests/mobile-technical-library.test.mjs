import test from 'node:test';import assert from 'node:assert/strict';
import {technicalSources,technicalCodes,ptReference,referenceTemperature,searchTechnicalCodes,convertTechnicalUnit,technicalDifference} from '../lib/mobile-technical-library.ts';
test('error meaning requires matching manufacturer and documented family, not code alone',()=>{
 assert.equal(searchTechnicalCodes('Daikin','','U4').length,0);assert.equal(searchTechnicalCodes('Samsung','ABQ-A / controlador ARCWA','U4').length,0);assert.equal(searchTechnicalCodes('Daikin','ABQ-A / controlador ARCWA','u 4')[0].code,'U4');assert.equal(technicalCodes.length,10);
 for(const s of Object.values(technicalSources))assert.equal(new URL(s.url).protocol,'https:');
});
test('pressure reference preserves primary source anchors and rejects extrapolation',()=>{
 assert.equal(ptReference.find(r=>r.f===50).r410a,143.2);assert.equal(referenceTemperature(143.2,'r410a'),10);assert.equal(referenceTemperature(0,'r410a'),null);assert.equal(referenceTemperature(Infinity,'r32'),null);assert.equal(referenceTemperature(100,'toString'),null);
 assert.ok(referenceTemperature(150,'r410a')>10);assert.ok(referenceTemperature(97.9,'r407cLiquid')===10);assert.ok(referenceTemperature(78.8,'r407cVapor')===10);
});
test('thermal differences and unit conversions do not confuse thermal power with electricity',()=>{
 assert.equal(technicalDifference('superheat',15,5),10);assert.equal(technicalDifference('subcool',30,40),10);assert.throws(()=>technicalDifference('superheat',NaN,4));assert.ok(Math.abs(convertTechnicalUnit(1,'bar-psi')-14.5037738)<1e-5);assert.equal(convertTechnicalUnit(50,'f-c'),10);assert.ok(Math.abs(convertTechnicalUnit(12000,'btu-kw')-3.51685)<0.0001);assert.throws(()=>convertTechnicalUnit(Infinity,'psi-bar'));
});
