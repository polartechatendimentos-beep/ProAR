import test from 'node:test';import assert from 'node:assert/strict';
import {calculateVehicleStock,validateVehicleStockConsumption} from '../lib/field/vehicle-stock.ts';
import {calculateHvacReading,interpolateSaturation} from '../lib/field/hvac-thermodynamics.ts';
import {validatePlateProposal} from '../lib/field/equipment-plate.ts';
const load={id:'M1',companyId:'empresa-a',vehicleId:'V1',sku:'CAP',quantityDelta:10,referenceId:'LOAD1',createdAt:'2026-10-15T12:00:00Z',userId:'teste',reason:'LOAD'};
test('estoque de viatura isola empresa/veículo, deduplica replay e bloqueia conflito de referência',()=>{
 assert.equal(calculateVehicleStock([load,load,{...load,companyId:'empresa-b',quantityDelta:99}], 'empresa-a','V1','CAP'),10);
 assert.equal(calculateVehicleStock([load],'empresa-a','V2','CAP'),0);
 assert.throws(()=>calculateVehicleStock([load,{...load,quantityDelta:20}],'empresa-a','V1','CAP'),/CONFLICT/);
 const use={...load,id:'M2',referenceId:'USE1',reason:'OS_CONSUMPTION',orderId:'OS-TESTE',quantityDelta:-3};assert.equal(validateVehicleStockConsumption([load],use).remaining,7);
 assert.throws(()=>validateVehicleStockConsumption([load],{...use,quantityDelta:-11}),/INSUFFICIENT/);assert.throws(()=>validateVehicleStockConsumption([load],{...use,quantityDelta:NaN}),/INVALID/);assert.throws(()=>validateVehicleStockConsumption([load,use],use),/DUPLICATE/);
});
const table={refrigerant:'R32',source:'Tabela sintética de teste, não usar em campo',version:'test-v1',points:[{pressurePsiGauge:100,dewC:0,bubbleC:-1},{pressurePsiGauge:200,dewC:10,bubbleC:9}]};
test('HVAC interpola sem extrapolar e exige tabela do fluido com proveniência',()=>{
 const r=calculateHvacReading({refrigerant:'R32',pressurePsiGauge:150,suctionLineC:12,liquidLineC:1},table);assert.equal(r.superheatK,7);assert.equal(r.subcoolingK,3);
 assert.throws(()=>calculateHvacReading({refrigerant:'R410A',pressurePsiGauge:150},table),/MISMATCH/);assert.throws(()=>calculateHvacReading({refrigerant:'R32',pressurePsiGauge:150},{...table,source:''}),/PROVENANCE/);
 assert.throws(()=>interpolateSaturation(table.points,99,'dewC'),/OUTSIDE/);assert.throws(()=>interpolateSaturation([...table.points,table.points[1]],110,'dewC'),/DUPLICATE/);
});
test('proposta OCR exige imagem, confiança e valores físicos plausíveis, mantendo revisão humana',()=>{
 assert.equal(validatePlateProposal({sourceImageId:'IMG-TESTE',confidence:.8,capacityBtu:12000,voltageV:220}).requiresHumanConfirmation,true);
 assert.equal(validatePlateProposal({sourceImageId:' ',confidence:2,capacityBtu:-10,voltageV:0}).valid,false);
 assert.equal(validatePlateProposal({sourceImageId:'IMG',confidence:.8,serial:123}).valid,false);
});
