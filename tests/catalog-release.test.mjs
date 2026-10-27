import test from 'node:test';import assert from 'node:assert/strict';
import {calculateCatalogPrice} from '../lib/catalog-cost-engine.ts';
import {simulateBatch,hourlyWorkforceCost,measuredMaterialLines,breakEvenUnits} from '../lib/catalog-advanced-simulators.ts';
import {simulatePublicBid} from '../lib/catalog-bid-simulator.ts';
import {prepareOperationalState} from '../lib/operational-ledger.ts';
const lines=[{id:'material',label:'Material de teste',quantity:2,unitCost:50,category:'material'},{id:'labor',label:'Equipe de teste',quantity:1,unitCost:100,category:'labor'}];
const scenario={taxPercent:10,marginPercent:20,cardFeePercent:5};
const bid={units:10,unitMaterials:100,unitLabor:50,unitTravel:20,unitOther:0,fixedContractCost:300,taxPercent:10,feesPercent:0,riskReservePercent:5,targetMarginPercent:20};
test('preço cobre custo, impostos, cartão e margem com arredondamento para cima',()=>{
 const result=calculateCatalogPrice(lines,scenario);assert.equal(result.cost,200);assert.equal(result.suggestedPrice,307.70);assert.ok(result.estimatedProfit>=61.54);
 assert.equal(calculateCatalogPrice(lines,{taxPercent:70,marginPercent:30}).suggestedPrice,null);
});
test('composição rejeita campos ausentes, não finitos, categorias e identidades inválidas',()=>{
 for(const bad of [{}, {...scenario,taxPercent:undefined},{...scenario,marginPercent:NaN},{...scenario,taxPercent:100}])assert.throws(()=>calculateCatalogPrice(lines,bad));
 for(const bad of [[{...lines[0],quantity:-1}],[{...lines[0],unitCost:Infinity}],[{...lines[0],category:'__proto__'}],[{...lines[0],category:'constructor'}],[lines[0],lines[0]],[{...lines[0],quantity:1e308,unitCost:1e308}]])assert.throws(()=>calculateCatalogPrice(bad,scenario));
});
test('equipe é calculada por profissional e hora produtiva, com limites válidos',()=>{
 assert.equal(hourlyWorkforceCost({monthlySalary:6000,monthlyBurden:1000,benefits:1000,productiveHours:160,people:2}),100);
 for(const bad of [{},{monthlySalary:1,monthlyBurden:0,benefits:0,productiveHours:0,people:1},{monthlySalary:1,monthlyBurden:0,benefits:0,productiveHours:1,people:1.5}])assert.throws(()=>hourlyWorkforceCost(bad));
 const material=measuredMaterialLines([{id:'copper',label:'Tubo teste',meters:12,unitCost:25,wastePercent:10}])[0];assert.equal(material.quantity,13.2);
 assert.equal(breakEvenUnits(3000,100,40,10),60);assert.equal(breakEvenUnits(3000,40,40,10),null);
});
test('lote inclui custo fixo e desconto na receita e na margem',()=>{
 const pricing={...scenario,discountPercent:10};const batch=simulateBatch({units:10,costLines:lines,pricing,fixedProjectCost:300});
 assert.equal(batch.totalCost,2300);assert.equal(batch.suggestedRevenue,3931.63);assert.ok(batch.marginPercent>=20);
 const negotiated=simulateBatch({units:10,costLines:lines,pricing,fixedProjectCost:300,negotiatedRevenue:2500});assert.equal(negotiated.profit,-175);
});
test('lance mínimo e alvo cobrem custos e nunca enviam proposta',()=>{
 const result=simulatePublicBid({...bid,referencePrice:4000,proposedBid:2000});assert.equal(result.totalCost,2100);assert.equal(result.minimumBid,2333.34);assert.equal(result.targetBid,3000);assert.equal(result.estimatedProfit,-300);assert.ok(result.warnings.some(x=>x.includes('abaixo')));
 assert.equal(simulatePublicBid({...bid,taxPercent:90,feesPercent:10}).minimumBid,null);
});
test('simulador de lances rejeita campos obrigatórios vazios e overflow',()=>{
 for(const bad of [{}, {...bid,unitLabor:undefined},{...bid,taxPercent:NaN},{...bid,units:1.5},{...bid,unitMaterials:1e308}])assert.throws(()=>simulatePublicBid(bad));
 const result=simulatePublicBid({...bid,units:100,unitMaterials:.004,unitLabor:.004,unitTravel:0,fixedContractCost:0,riskReservePercent:0});assert.equal(result.directCost,.80);
});
test('ledger preserva composições e bloqueia gravação inválida e sem permissão',()=>{
 const before={customers:[],serviceOrders:[],moduleRecords:{}};const record={id:'service-test',name:'Serviço teste',cost:200,value:307.7,costLines:lines,costTaxPercent:10,costMarginPercent:20,costCardFeePercent:5};
 const next={...before,moduleRecords:{'Serviços':[record]}};const actor={username:'gestor',can:p=>p==='catalogo.editar'};
 const saved=prepareOperationalState(before,next,actor);assert.deepEqual(saved.moduleRecords['Serviços'][0].costLines,lines);
 assert.throws(()=>prepareOperationalState(before,next,{username:'tecnico',can:()=>false}),e=>e.status===403);
 for(const patch of [{costTaxPercent:null},{costMarginPercent:100},{costLines:[{...lines[0],quantity:-1}]},{costLines:{invalid:true}}])assert.throws(()=>prepareOperationalState(before,{...next,moduleRecords:{'Serviços':[{...record,...patch}]}},actor));
});
