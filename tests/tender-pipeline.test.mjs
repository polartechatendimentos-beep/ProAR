import test from 'node:test';import assert from 'node:assert/strict';
import {tenderIdentity,pipelineRecordId,pipelineChecklist,filterPipeline,pipelineCsv,proposalText,validateTracking} from '../lib/tender-pipeline.ts';
import {CERTIFICATE_KINDS,EMPTY_PRICING,priceComposition} from '../lib/procurement-readiness.ts';
import {prepareOperationalState} from '../lib/operational-ledger.ts';
const now=new Date('2026-10-15T12:00:00Z');
const tender={numeroControlePNCP:'TESTE-2026-1',objetoCompra:'Manutenção de climatização e PMOC',dataEncerramentoProposta:'2026-10-16T12:00:00Z',dataPublicacaoPncp:'2026-10-14T12:00:00Z',valorTotalEstimado:100000,sourcePortal:'PNCP',orgaoEntidade:{razaoSocial:'Órgão de teste'},unidadeOrgao:{municipioNome:'Município de teste'}};
const track=(overrides={})=>({tenderKey:tenderIdentity(tender),stage:'RADAR',favorite:false,checks:{},pmocRequired:null,tender,...overrides});
const record=(tracking=track())=>({id:pipelineRecordId(tracking.tenderKey),name:tender.objetoCompra,tracking});
const docs=()=>CERTIFICATE_KINDS.map((kind,i)=>({id:`DOC-${i}`,name:kind,procurement:{type:'certificate',kind,conclusion:'regular',verifiedAt:'2026-10-15',expiresAt:'2026-12-30'}}));
const filters={query:'',portal:'',city:'',modality:'',status:'',onlyPmoc:false,onlyFavorites:false,stage:'',sort:'deadline',showClosed:false};
const proposal={company:'Empresa de teste',cnpj:'DOCUMENTO DE TESTE',address:'Endereço de teste',email:'teste@example.com',monthly:1000.01,months:12,validityDays:90,validityReference:'data de abertura prevista no edital',notes:'Dados sintéticos para teste'};
test('GEM-01: identidade estável e união de fonte real com acompanhamento salvo sem duplicação',()=>{
 const rows=filterPipeline([tender,{...tender,objetoCompra:'Objeto atualizado'}],[record()],[],filters,now);assert.equal(rows.length,1);assert.equal(rows[0].tender.objetoCompra,'Objeto atualizado');assert.equal(rows[0].record.id,pipelineRecordId(tenderIdentity(tender)));
});
test('GEM-02: pipeline validado no servidor, preservado após serialização e protegido por permissão e identidade',()=>{
 const before={customers:[],serviceOrders:[],moduleRecords:{}},next=structuredClone(before),actor={username:'analista',can:p=>p==='licitacoes.editar'};
 next.moduleRecords['Acompanhamento de licitações']=[record(track({stage:'ANALISE',favorite:true}))];const saved=prepareOperationalState(before,next,actor,now.toISOString());assert.equal(JSON.parse(JSON.stringify(saved)).moduleRecords['Acompanhamento de licitações'][0].tracking.stage,'ANALISE');
 assert.throws(()=>prepareOperationalState(before,next,{username:'tecnico',can:()=>false},now.toISOString()),e=>e.status===403);
 const edited=structuredClone(saved);edited.moduleRecords['Acompanhamento de licitações'][0].tracking.tenderKey='OUTRO';assert.throws(()=>prepareOperationalState(saved,edited,actor,now.toISOString()),/identidade/);
 assert.throws(()=>validateTracking(track({stage:'HOMOLOGADO'}),docs(),'2026-10-15'),/resultado oficial/);
});
test('GEM-03: oito de dez documentos resultam em 80%, sem liberar habilitação incompleta',()=>{
 const t=track({stage:'HABILITACAO',checks:{registration:true,responsibility:true}});assert.equal(pipelineChecklist(t,docs(),'2026-10-15').percentage,80);assert.throws(()=>validateTracking(t,docs(),'2026-10-15'),/Conclua/);
 t.checks.capacity=true;t.checks.notice=true;validateTracking(t,docs(),'2026-10-15');assert.equal(pipelineChecklist(t,docs(),'2026-10-15').ready,true);
});
test('GEM-04: BDI usa parcelas multiplicativas, e global usa valor mensal arredondado',()=>{
 const result=priceComposition({...EMPTY_PRICING,labor:12150,administration:4,profit:12,taxes:8.65});assert.equal(result.price,Math.ceil(12150*1.04*1.12/.9135*100)/100);assert.notEqual(result.price,Math.round(12150/(1-.2465)*100)/100);
 const text=proposalText(tender,{...proposal,monthly:result.price});assert.ok(text.includes((result.price*12).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})));
});
test('GEM-05: PMOC exige confirmação no edital, filtros combinam favorito, portal, prazo e busca',()=>{
 assert.equal(filterPipeline([tender],[],[],{...filters,onlyPmoc:true},now).length,0);
 const r=record(track({pmocRequired:true,favorite:true}));assert.equal(filterPipeline([tender],[r],[],{...filters,onlyPmoc:true,onlyFavorites:true,portal:'PNCP',query:'climatizacao',status:'soon'},now).length,1);
 assert.equal(filterPipeline([tender],[r],[],{...filters,city:'Outra cidade'},now).length,0);assert.equal(filterPipeline([{...tender,dataEncerramentoProposta:'2026-10-14T12:00:00Z'}],[r],[],filters,now).length,0);
});
test('GEM-06: minuta parametrizável mantém ressalvas normativas e aceita rascunho incompleto sem gerar proposta',()=>{
 const text=proposalText(tender,proposal);assert.match(text,/90 dias a contar de data de abertura/);assert.match(text,/RDC 886\/2024 revogou/);assert.ok(!text.includes('estabelece os novos padrões'));assert.throws(()=>proposalText(tender,{...proposal,validityDays:0}));
 validateTracking(track({proposal:{...proposal,company:'',cnpj:'',monthly:0}}),[],'2026-10-15');assert.throws(()=>proposalText(tender,{...proposal,company:''}));
});
test('GEM-07: CSV contém BOM, acentos, aspas e neutraliza fórmulas no Excel',()=>{
 const csv=pipelineCsv(filterPipeline([{...tender,objetoCompra:'=HYPERLINK("malicioso")\nAção'}],[],[],filters,now));assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('Órgão'));assert.ok(csv.includes('"\'=HYPERLINK(""malicioso"")'));assert.ok(csv.includes('\r\n'));
});
