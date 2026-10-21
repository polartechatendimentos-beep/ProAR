import test from 'node:test';import assert from 'node:assert/strict';
import {tenderPreferenceKey,parseTenderPreferences} from '../lib/tender-preferences.ts';
const filters={query:'climatização',portal:'PNCP',city:'Bálsamo',modality:'',status:'soon',stage:'ANALISE',sort:'deadline',onlyPmoc:true,onlyFavorites:false,showClosed:false};
test('preferências separam usuários e empresas sem escopo anônimo',()=>{
 assert.notEqual(tenderPreferenceKey('A','ana'),tenderPreferenceKey('B','ana'));
 assert.notEqual(tenderPreferenceKey('A','ana'),tenderPreferenceKey('A','tiago'));
 assert.notEqual(tenderPreferenceKey('A:B','C'),tenderPreferenceKey('A','B:C'));
 assert.equal(tenderPreferenceKey('','ana'),null);assert.equal(tenderPreferenceKey('A',null),null);
});
test('filtros restauram valores válidos e rejeitam corrupção ou opções desconhecidas',()=>{
 const preference={version:1,view:'kanban',filters};assert.deepEqual(parseTenderPreferences(JSON.stringify(preference)),preference);
 for(const invalid of ['{',JSON.stringify({...preference,version:2}),JSON.stringify({...preference,filters:{...filters,onlyPmoc:'true'}}),JSON.stringify({...preference,filters:{...filters,sort:'script'}})])assert.throws(()=>parseTenderPreferences(invalid));
});
