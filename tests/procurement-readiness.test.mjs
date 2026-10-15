import test from 'node:test';
import assert from 'node:assert/strict';
import {CERTIFICATE_KINDS,EMPTY_PRICING,brazilDay,certificateHealth,qualificationReadiness,priceComposition,matchAttestations,validateProcurementData} from '../lib/procurement-readiness.ts';
import {prepareOperationalState} from '../lib/operational-ledger.ts';
const certificate=(days,conclusion='regular')=>({type:'certificate',kind:'Federal',conclusion,verifiedAt:'2026-10-15',expiresAt:`2026-10-${String(15+days).padStart(2,'0')}`});
const certs=()=>CERTIFICATE_KINDS.map((kind,i)=>({id:`C${i}`,name:kind,procurement:{...certificate(15),kind}}));
test('certidões: limites 15, 5, zero dias e vencida respeitam a validade civil',()=>{
 for(const [days,level,eligible] of [[15,'warning',true],[5,'critical',true],[0,'critical',true],[-1,'critical',false]]){const r=certificateHealth(certificate(days),'2026-10-15');assert.equal(r.level,level);assert.equal(r.eligible,eligible);assert.equal(r.days,days);}
 assert.equal(certificateHealth({...certificate(15),expiresAt:'2026-02-30'},'2026-10-15').eligible,false);
 assert.equal(certificateHealth({...certificate(15),verifiedAt:'2026-10-16'},'2026-10-15').eligible,false);
 assert.equal(brazilDay(new Date('2026-10-16T01:00:00Z')),'2026-10-15');
});
test('habilitação: documento restritivo não é ocultado por duplicata regular; ausência e inativação não liberam',()=>{
 const docs=certs();assert.equal(qualificationReadiness(docs,'2026-10-15').eligible,true);
 assert.equal(qualificationReadiness(docs.slice(1),'2026-10-15').eligible,false);
 docs.push({id:'R',name:'Restritiva',procurement:certificate(10,'restrictive')});assert.equal(qualificationReadiness(docs,'2026-10-15').eligible,false);
 docs.at(-1).status='Inativo';assert.equal(qualificationReadiness(docs,'2026-10-15').eligible,true);
 docs[0].procurement.verifiedAt='';assert.equal(qualificationReadiness(docs,'2026-10-15').eligible,false);
});
test('BDI: composição multiplicativa, tributo sobre receita e arredondamento para cima',()=>{
 const r=priceComposition({...EMPTY_PRICING,labor:1000,administration:5,risk:2,insurance:1,financial:1,profit:10,taxes:8});assert.equal(r.direct,1000);assert.equal(r.price,Math.ceil(1000*1.08*1.01*1.1/.92*100)/100);
 for(const v of [100,NaN,-1,Infinity])assert.throws(()=>priceComposition({...EMPTY_PRICING,taxes:v}));
 assert.throws(()=>priceComposition({labor:10}));
});
const att=(id,capacityBtu,equipmentType='VRF')=>({id,name:id,procurement:{type:'attestation',customer:'Contratante',capacityBtu,equipmentType,equipmentCount:10,responsibilityDocument:'TRT-TESTE'}});
test('acervo: não soma sem autorização, não mistura sistemas e não duplica atestados',()=>{
 const a=att('A',3000000),b=att('B',3000000),docs=[a,b,a,att('C',9000000,'Split')];
 assert.equal(matchAttestations(docs,6000000,'VRF',false).meets,false);
 const r=matchAttestations(docs,6000000,'VRF',true);assert.equal(r.meets,true);assert.equal(r.selected.length,2);assert.equal(r.capacityBtu,6000000);
 assert.equal(matchAttestations(docs,0,'',true).meets,false);
 delete a.procurement.responsibilityDocument;assert.equal(matchAttestations(docs,6000000,'VRF',true).meets,false);
});
test('validação recusa links com credenciais, certidões inválidas e atestado incompleto',()=>{
 assert.throws(()=>validateProcurementData({...certificate(10),sourceUrl:'javascript:alert(1)'}));
 assert.throws(()=>validateProcurementData({...certificate(10),sourceUrl:'https://user:password@example.com'}));
 assert.throws(()=>validateProcurementData({type:'attestation',capacityBtu:10}));
 validateProcurementData(att('A',12000).procurement);
});
const actor={username:'teste',can:()=>true},base=()=>({customers:[],serviceOrders:[],moduleRecords:{}});
test('servidor bloqueia participação sem certidões e valida custos mesmo sem interface',()=>{
 const before=base(),next=base();next.moduleRecords.Certames=[{id:'L1',name:'Certame',status:'Participaremos'}];assert.throws(()=>prepareOperationalState(before,next,actor,'2026-10-15T12:00:00Z'),/Habilitação pendente/);
 next.moduleRecords['Documentação / Habilitação']=certs();assert.equal(prepareOperationalState(before,next,actor,'2026-10-15T12:00:00Z').moduleRecords.Certames.length,1);
 next.moduleRecords['Composições de licitação']=[{id:'P1',name:'Preço',pricing:{labor:10}}];assert.throws(()=>prepareOperationalState(before,next,actor,'2026-10-15T12:00:00Z'),/valores/);
});
test('servidor exige permissão de licitações e registra alteração de habilitação na auditoria',()=>{
 const before=base(),next=base();next.moduleRecords['Documentação / Habilitação']=certs();assert.throws(()=>prepareOperationalState(before,next,{username:'tecnico',can:()=>false}),e=>e.status===403);
 const saved=prepareOperationalState(before,next,actor,'2026-10-15T12:00:00Z');assert.ok(saved.moduleRecords['Auditoria operacional'].some(r=>r.module==='Documentação / Habilitação'));
});

import {deriveOperationalActions} from '../lib/action-center.ts';
test('central de pendências recebe certidões a vencer e remove a pendência após regularização',()=>{
 const docs=certs(),modules={'Documentação / Habilitação':docs};
 assert.equal(deriveOperationalActions([],modules,new Date('2026-10-15T12:00:00Z')).filter(r=>r.id.startsWith('certificate-')).length,6);
 for(const doc of docs)doc.procurement.expiresAt='2026-12-30';
 assert.equal(deriveOperationalActions([],modules,new Date('2026-10-15T12:00:00Z')).filter(r=>r.id.startsWith('certificate-')).length,0);
});
