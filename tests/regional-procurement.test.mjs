import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeFiorilliRecord,fetchFiorilliTenders,fiorilliUrl} from '../lib/procurement/fiorilli-connector.ts';
import {FIORILLI_SOURCES,publicationSystem} from '../lib/procurement/regional-sources.ts';
import {canonicalProcurementKey,mergeProcurementEvidence} from '../lib/procurement/domain.ts';
const source=FIORILLI_SOURCES[0];
const row={ANO:'26',NLICITACAO:'1485',PROCLIC:'000098/26',EMPRESA:'1',DISCR:'Manutenção de ar condicionado e PMOC',LICIT:'PREGÃO ELETRÔNICO',SITUACAO:'Aberta',DATAE:'23/09/2026 00:00:00',DTPROPOSTAFIM:'29/10/2026 00:00:00',HORENV:'08:30',VALOR:'12.345,67',ORCAMENTO_SIGILOSO:'N',NOMEEMPRESA:'Órgão de teste'};
test('Fiorilli usa contrato documentado, ano validado e origem fixa',()=>{
 const url=new URL(fiorilliUrl(source,2026));assert.equal(url.hostname,'transparencia.ibira.sp.gov.br');assert.equal(url.searchParams.get('Listagem'),'Licitacoes');assert.equal(url.searchParams.get('Empresa'),'1');assert.throws(()=>fiorilliUrl(source,NaN));
});
test('normalização não confunde número do processo com sequência PNCP',()=>{
 const normalized=normalizeFiorilliRecord(row,source,2026);assert.equal(normalized.numeroControlePNCP,undefined);assert.equal(normalized.sequencialCompra,undefined);assert.equal(normalized.publicationSystem,'Fiorilli');assert.equal(normalized.valorTotalEstimado,12345.67);assert.equal(normalized.dataEncerramentoProposta,'2026-10-29T11:30:00.000Z');assert.match(canonicalProcurementKey(normalized),/^external:/);assert.equal(normalized.unidadeOrgao.codigoIbge,'3519402');
});
test('valor sigiloso e prazo sem hora não são inventados',()=>{
 const normalized=normalizeFiorilliRecord({...row,ORCAMENTO_SIGILOSO:'S',HORENV:''},source,2026);assert.equal(normalized.valorTotalEstimado,undefined);assert.equal(normalized.dataEncerramentoProposta,undefined);
 assert.equal(normalizeFiorilliRecord({...row,HORENV:'25:00'},source,2026).dataEncerramentoProposta,undefined);
 assert.equal(normalizeFiorilliRecord({...row,DTPROPOSTAFIM:'31/02/2026'},source,2026).dataEncerramentoProposta,undefined);
});
test('registros de outra entidade ou ano e objetos incompletos são rejeitados',()=>{
 for(const invalid of [null,[],{}, {...row,ANO:'25'},{...row,EMPRESA:'2'},{...row,NLICITACAO:''},{...row,DISCR:''}])assert.equal(normalizeFiorilliRecord(invalid,source,2026),null);
});
test('consulta direta reporta sucesso, rejeições e limites do formato',async()=>{
 const result=await fetchFiorilliTenders({year:2026,radius:200,fetcher:async()=>new Response(JSON.stringify([row,{...row,EMPRESA:'2'}]),{headers:{'Content-Type':'application/json'}})});
 assert.equal(result.items.length,1);assert.equal(result.diagnostics[0].mode,'direct');assert.equal(result.diagnostics[0].status,'ok');assert.equal(result.diagnostics[0].truncated,true);
});
test('falha isolada ou HTML não produz falsa consulta bem-sucedida',async()=>{
 for(const response of [new Response('indisponível',{status:503}),new Response('<html>Login</html>'),new Response(JSON.stringify({error:'falha'})),new Response('[]',{headers:{'content-length':'5000001'}})]){
  const result=await fetchFiorilliTenders({year:2026,radius:200,fetcher:async()=>response});assert.equal(result.items.length,0);assert.equal(result.diagnostics[0].status,'error');
 }
 const result=await fetchFiorilliTenders({year:2026,radius:1,fetcher:async()=>{throw new Error('Não consultar fora do raio');}});assert.equal(result.diagnostics.length,0);
});
test('publicador não substitui plataforma e evidência é preservada na deduplicação',()=>{
 assert.equal(publicationSystem('Fiorilli Software'),'Fiorilli');assert.equal(publicationSystem('Betha Sistemas'),'Betha');assert.equal(publicationSystem('IPM Sistemas Atende.net'),'IPM / Atende.net');assert.equal(publicationSystem('Órgão desconhecido'),undefined);
 const merged=mergeProcurementEvidence({sourcePortal:'BLL Compras',numeroControlePNCP:'12345678000190-1-000001/2026'},{sourcePortal:'PNCP',publicationSystem:'Fiorilli',ingestedFrom:['PNCP']});assert.equal(merged.sourcePortal,'BLL Compras');assert.equal(merged.publicationSystem,'Fiorilli');
});

test('plataforma usa domínio exato, nunca substring em URL maliciosa',async()=>{
 const {disputePlatformFromUrl}=await import('../lib/procurement/regional-sources.ts');
 assert.equal(disputePlatformFromUrl('https://www.bec.sp.gov.br/teste'),'BEC-SP');
 assert.equal(disputePlatformFromUrl('https://bllcompras.com.evil.invalid/'),undefined);
 assert.equal(disputePlatformFromUrl('https://evil.invalid/?site=bllcompras.com'),undefined);
 assert.equal(disputePlatformFromUrl('https://bllcompras.com/Process/ProcessView?param1=abc'),'BLL Compras');
});
