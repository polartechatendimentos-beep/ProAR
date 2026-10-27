import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';import {runInNewContext} from 'node:vm';
import {assessTechnicalEvidence} from '../lib/field/technical-diagnosis.ts';import {answerTechnicalQuestion} from '../lib/field/technical-knowledge.ts';import {hasPermission,sessionCompany} from '../lib/permissions.ts';import {normalizeDiagnosticManual} from '../lib/diagnostic-manual-library.ts';
const source=async path=>stripTypeScriptTypes(await readFile(new URL(path,import.meta.url),'utf8')).replace(/^import .*;$/gm,'').replace(/^export /gm,'');
const accessSource=await source('../lib/technical-base-access.ts'),postSource=await source('../app/api/technical-base/assistant/route.ts'),getSource=await source('../app/api/technical-base/route.ts');
function access(session){return runInNewContext(accessSource+'\ntechnicalBaseAccess;',{sessionFromRequest:()=>session,sessionCompany,hasPermission})({});}
const actor={username:'tecnico',companyId:'empresa-a',role:'Técnico',permissions:['os.visualizar']};
const response={json:(body,{status=200,headers}={})=>({body,status,headers})};
test('consulta técnica exige sessão e escopo da empresa e não concede acesso financeiro',()=>{
 assert.equal(access(null).status,401);assert.equal(access({...actor,companyId:''}).status,401);assert.equal(access({...actor,permissions:['financeiro.visualizar']}).status,403);assert.equal(access(actor).ok,true);
});
test('auxiliar não inventa código e sempre pede confirmação, mesmo com marca/modelo',()=>{
 const intake=assessTechnicalEvidence({brand:'Elgin',code:'E0',symptoms:'Não funciona'},false);assert.ok(intake.missing.includes('modelo'));assert.equal(intake.canConfirmFailure,false);assert.equal(intake.canAuthorizeRepair,false);
 const r=answerTechnicalQuestion({brand:'Elgin',model:'TESTE',code:'E0',symptoms:'Código E0'});assert.equal(r.aiEnabled,false);assert.equal(r.diagnosticStatus,'NOT_CONFIRMED');assert.equal(r.sources.length,0);
 const guidance=answerTechnicalQuestion({symptoms:'teste de estanqueidade'});assert.match(guidance.answer,/Nunca pressurizar com oxigênio/);assert.ok(guidance.sources.length);
});
test('API de consulta recusa JSON inválido e pergunta extensa, e retorna resultados privados',async()=>{
 const fn=runInNewContext(postSource+'\nPOST;',{NextResponse:response,technicalBaseAccess:()=>access(actor),answerTechnicalQuestion});
 assert.equal((await fn({text:async()=>'{'})).status,400);assert.equal((await fn({text:async()=>JSON.stringify({question:'a'.repeat(1501)})})).status,400);
 const r=await fn({text:async()=>JSON.stringify({question:'como realizar vácuo?'})});assert.equal(r.status,200);assert.equal(r.body.aiEnabled,false);assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('biblioteca consulta a empresa da sessão e só expõe documentos revisados com HTTPS',async()=>{
 let company;const fn=runInNewContext(getSource+'\nGET;',{NextResponse:response,technicalBaseAccess:()=>access(actor),normalizeDiagnosticManual,routeContext:async session=>{company=session.companyId;return {state:{moduleRecords:{'Manuais técnicos':[{id:'M1',brand:'Teste',name:'Manual interno de teste',url:'https://example.com/manual.pdf',verified:true},{id:'M2',brand:'Teste',name:'Não revisado',url:'https://example.com/manual2.pdf',verified:false},{id:'M3',brand:'Teste',name:'Link não permitido',url:'javascript:alert(1)',verified:true}]}}};}});
 const r=await fn({});assert.equal(company,'empresa-a');assert.equal(r.body.data.length,1);assert.equal(r.body.data[0].id,'M1');assert.equal(r.headers['Cache-Control'],'private, no-store');
});
