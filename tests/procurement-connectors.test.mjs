import {tenderSearchMatches,pncpProposalQuery,withinTenderWindow,procurementDateIso} from "../lib/procurement/search-relevance.ts";
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';import {runInNewContext} from 'node:vm';
import {canonicalProcurementKey,identifyProcurementSource,mergeProcurementEvidence,matchesHvacDomain,mentionsPmoc} from '../lib/procurement/domain.ts';
import {publicationSystem,disputePlatformFromUrl} from '../lib/procurement/regional-sources.ts';
import {safeTenderOrigin,tenderPncpLink} from '../lib/tender-links.ts';import {hasPermission,sessionCompany} from '../lib/permissions.ts';
const source=async p=>stripTypeScriptTypes(await readFile(new URL(p,import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
const bll=runInNewContext(await source('../lib/procurement/bll-connector.ts')+'\n({normalizeBllRecord,fetchBllTenders})',{safeTenderOrigin,URL,AbortSignal,Date,process:{env:{}}});
const {procurementFilters,filterProcurementResults,normalizeSearchTender}=runInNewContext(await source('../lib/procurement/search-contract.ts')+'\n({procurementFilters,filterProcurementResults,normalizeSearchTender})',{canonicalProcurementKey,mentionsPmoc,normalizeProcurementText:v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),safeTenderOrigin,tenderPncpLink,Date,URL});
test('identidade usa controle PNCP e não confunde número de pregão com sequência PNCP',()=>{
 const a={numeroControlePNCP:'12345678000199-1-000123/2026'},b={orgaoEntidade:{cnpj:'12.345.678/0001-99'},anoCompra:2026,sequencialCompra:123};assert.equal(canonicalProcurementKey(a),canonicalProcurementKey(b));
 assert.notEqual(canonicalProcurementKey(b),canonicalProcurementKey({...b,sequencialCompra:124}));assert.notEqual(canonicalProcurementKey(b),canonicalProcurementKey({orgaoEntidade:b.orgaoEntidade,anoCompra:2026,numeroCompra:'123',sourceExternalId:'bll-123',sourcePortal:'BLL Compras'}));
 assert.notEqual(canonicalProcurementKey({objetoCompra:'Edital A'}),canonicalProcurementKey({objetoCompra:'Edital B'}));
});
test('proveniência exige domínio correto e mantém todas as evidências sem mutar entradas',()=>{
 assert.equal(identifyProcurementSource({linkSistemaOrigem:'https://bllcompras.com/Process/x'}),'BLL Compras');assert.equal(identifyProcurementSource({linkSistemaOrigem:'https://bllcompras.com.evil.example/bll'}),'PNCP');
 const a={sourcePortal:'PNCP',ingestedFrom:['PNCP'],valorTotalEstimado:0},b={sourcePortal:'BLL Compras',ingestedFrom:['BLL feed autorizado'],valorTotalEstimado:100};const merged=mergeProcurementEvidence(a,b);assert.equal(merged.valorTotalEstimado,0);assert.equal(merged.sourceOrigins.length,2);assert.equal(merged.ingestedFrom.length,2);assert.equal(a.sourceOrigins,undefined);
});
test('feed não fabrica município, prazo, CNPJ, valor, ano ou modalidade',()=>{
 const item=bll.normalizeBllRecord({id:'BLL-1',objeto:'Manutenção de ar-condicionado'});assert.equal(item.orgaoEntidade.cnpj,undefined);assert.equal(item.anoCompra,undefined);assert.equal(item.dataEncerramentoProposta,undefined);assert.equal(item.unidadeOrgao.municipioNome,undefined);assert.equal(item.valorTotalEstimado,undefined);assert.equal(item.modalidadeNome,undefined);
 assert.equal(bll.normalizeBllRecord({objeto:'Sem identidade'}),null);assert.equal(bll.normalizeBllRecord({id:'a',objeto:'teste',cnpjOrgao:'99999999000199',numeroControlePNCP:'12345678000199-1-1/2026'}),null);
});
test('BLL sem configuração não faz chamada e falha do feed não vaza token nem URL',async()=>{
 let calls=0;const no=await bll.fetchBllTenders({fetcher:async()=>{calls++;throw Error();}});assert.equal(calls,0);assert.equal(no.configured,false);assert.equal(no.diagnostic,null);
 const failed=await bll.fetchBllTenders({url:'https://feed.example.com/private?key=secret',token:'secret',fetcher:async()=>{throw Error('secret private URL');}});assert.equal(failed.diagnostic.status,'error');assert.doesNotMatch(JSON.stringify(failed),/secret|feed.example/);
});
test('feed autorizado bloqueia redirecionamentos e informa registros inválidos e cobertura',async()=>{
 let request;const result=await bll.fetchBllTenders({url:'https://feed.example.com/public',token:'token',fetcher:async(u,opts)=>{request=opts;return{ok:true,text:async()=>JSON.stringify({items:[{id:'1',objeto:'PMOC'},null],hasMore:true})};}});assert.equal(request.redirect,'error');assert.equal(result.items.length,1);assert.equal(result.diagnostic.status,'ok');assert.equal(result.diagnostic.truncated,true);
 const invalid=await bll.fetchBllTenders({url:'http://127.0.0.1/feed',fetcher:async()=>{throw Error('must not call');}});assert.equal(invalid.diagnostic.status,'error');
});
test('vocabulário HVAC não considera qualquer manutenção uma oportunidade de climatização',()=>{
 assert.equal(matchesHvacDomain('Manutenção de elevadores'),false);assert.equal(matchesHvacDomain('Instalação de ar-condicionado'),true);assert.equal(matchesHvacDomain('Aquisição de split','chiller'),false);assert.equal(mentionsPmoc('Não exige PMOC'),false);assert.equal(mentionsPmoc('Serviços de PMOC'),true);
});
test('filtros recusam NaN, UF e datas inválidas; raio estrito não aceita cidade desconhecida',()=>{
 for(const query of ['raio_km=NaN','distanciaMaxKm=-1','uf=ZZ','dataInicial=2026-02-30','dataInicial=2026-10-15&dataFinal=2026-10-14'])assert.throws(()=>procurementFilters(new URLSearchParams(query)));
 const filters=procurementFilters(new URLSearchParams('municipio=Bálsamo&uf=SP&distanciaMaxKm=100&apenasAbertas=true'));
 const item={unidadeOrgao:{municipioNome:'Balsamo',ufSigla:'SP'},distanciaMirassol:29,dataEncerramentoProposta:'2026-10-20T10:00:00Z'};
 assert.equal(filterProcurementResults([item,{...item,distanciaMirassol:undefined},{...item,situacaoCompraNome:'Cancelado'},{...item,dataEncerramentoProposta:undefined}],filters,Date.parse('2026-10-16')).length,1);
 const normalized=normalizeSearchTender({});assert.equal(normalized.estimatedValue,null);assert.equal(normalized.distanceKm,null);assert.equal(normalized.proposalDeadline,'');assert.equal(normalized.sourceUrl,'');
});
test('consulta exige sessão, empresa, permissão e plano antes de acessar fontes',async()=>{
 const code=await source('../lib/procurement/access.ts');const actor={companyId:'a',role:'Consulta',permissions:['licitacoes.visualizar']};
 function access(session){return runInNewContext(code+'\nprocurementAccess;',{requirePermission:()=>!session?{ok:false,status:401,error:'Sessão inválida'}:!hasPermission(session,'licitacoes.visualizar')?{ok:false,status:403,error:'Sem acesso'}:{ok:true,session},sessionCompany})({});}
 assert.equal(access(null).status,401);assert.equal(access({...actor,companyId:''}).status,401);assert.equal(access({...actor,permissions:[]}).status,403);assert.equal(access({...actor,entitledModules:['Clientes']}).status,403);assert.equal(access(actor).ok,true);
});
test('rota do Radar impede busca sem autorização e rejeita filtros inválidos sem chamadas externas',async()=>{
 const code=await source('../app/api/licitacoes/route.ts');let calls=0;
 const base={Headers,URL,URLSearchParams,AbortSignal,Date,process:{env:{}},console:{warn(){},error(){}},fetch:async()=>{calls++;throw Error('Unexpected network');},NextResponse:{json:(body,init={})=>({body,status:init.status??200,headers:new Headers(init.headers)})},procurementFilters,filterProcurementResults};
 const denied=runInNewContext(code+'\nGET;',{...base,procurementAccess:()=>({ok:false,status:401,error:'Sessão inválida'})});
 const result=await denied({nextUrl:new URL('https://polartech.proar.online/api/licitacoes')});assert.equal(result.status,401);assert.equal(result.headers.get('Cache-Control'),'private, no-store');
 const allowed=runInNewContext(code+'\nGET;',{...base,procurementAccess:()=>({ok:true,companyId:'a'})});assert.equal((await allowed({nextUrl:new URL('https://polartech.proar.online/api/licitacoes?raio=NaN')})).status,400);assert.equal(calls,0);
});
test('consulta real orquestrada mantém o PNCP quando BLL e Fiorilli falham e deduplica sem perder proveniência',async()=>{
 const code=await source('../app/api/licitacoes/route.ts');const now=new Date();const closing=new Date(now.getTime()+86400000).toISOString();
 const tender={numeroControlePNCP:'12345678000199-1-000123/2026',objetoCompra:'Manutenção de climatização',usuarioNome:'Fiorilli Software',modalidadeNome:'Pregão Eletrônico',dataEncerramentoProposta:closing,orgaoEntidade:{cnpj:'12345678000199'},unidadeOrgao:{municipioNome:'Mirassol',ufSigla:'SP'},linkSistemaOrigem:'https://bllcompras.com/Process/x'};
 const search=runInNewContext(code+'\nsearchAutomaticTenders;',{Headers,URL,URLSearchParams,AbortSignal,Date,process:{env:{}},console:{warn(){},error(){}},setTimeout,tenderSearchMatches,pncpProposalQuery,withinTenderWindow,procurementDateIso,fetchOlimpiaTenders:async()=>({items:[],diagnostic:{source:"Portal Municipal · Olímpia",status:"error",attempts:1,durationMs:1,count:0,error:"Indisponível"}}),publicationSystem,disputePlatformFromUrl,canonicalProcurementKey,identifyProcurementSource,mergeProcurementEvidence,municipalityDistances:{},municipalityNameDistances:{},municipalTenderDate:()=>undefined,
 fetchFiorilliTenders:async()=>({items:[],diagnostics:[{source:'Fiorilli direto · Ibirá',status:'error',attempts:1,durationMs:2,count:0,error:'Indisponível'}]}),
 fetchBllTenders:async()=>({items:[],configured:true,diagnostic:{source:'BLL Compras · feed autorizado',status:'error',attempts:1,durationMs:2,count:0,error:'Feed indisponível'}}),
 fetch:async url=>({ok:true,status:200,json:async()=>String(url).includes('pncp.gov.br')?{data:[tender],totalPaginas:1}:{resultado:[]},text:async()=>''})});
 const result=await search({radius:400,term:'climatização'});assert.equal(result.data.length,1);assert.equal(result.data[0].sourcePortal,'BLL Compras');assert.equal(result.data[0].ingestedFrom[0],'PNCP');assert.ok(result.data[0].sourceOrigins.includes('PNCP'));assert.ok(result.failedSources.includes('BLL Compras · feed autorizado'));assert.ok(result.failedSources.includes('Fiorilli direto · Ibirá'));assert.ok(result.failedSources.includes('Portal Municipal · Olímpia'));assert.equal(result.data[0].publicationSystem,'Fiorilli');assert.equal(result.data[0].disputePlatform,'BLL Compras');assert.ok(result.coverage.duplicates>0);
});
