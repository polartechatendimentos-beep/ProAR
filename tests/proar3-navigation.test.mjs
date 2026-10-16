import test from 'node:test';import assert from 'node:assert/strict';
import {MODULE_TABS,moduleFromSearch,moduleNavigationUrl,canNavigateModule} from '../lib/module-navigation.ts';
test('navegação restaura todas as 26 telas por URL e preserva outros parâmetros e fragmento',()=>{
 assert.equal(Object.keys(MODULE_TABS).length,26);
 for(const [tab,module] of Object.entries(MODULE_TABS)){const url=moduleNavigationUrl('https://polartech.proar.online/?filtro=hoje#top',module);assert.equal(moduleFromSearch(new URL(url,'https://polartech.proar.online').search),module);assert.ok(url.includes('filtro=hoje'));assert.ok(url.endsWith('#top'));}
 assert.equal(moduleFromSearch('?tab=inexistente'),'Painel inicial');assert.equal(moduleNavigationUrl('https://polartech.proar.online/mobile','Clientes'),null);assert.equal(moduleNavigationUrl('https://polartech.proar.online/','Inexistente'),null);
});
test('atalhos não concedem permissão nem ultrapassam o plano contratado',()=>{
 const analyst={role:'Consulta',permissions:['Licitações']};assert.equal(canNavigateModule(moduleFromSearch('?tab=contratos'),analyst,['Licitações']),true);assert.equal(canNavigateModule(moduleFromSearch('?tab=financeiro'),analyst,['Financeiro']),false);assert.equal(canNavigateModule('Licitações',analyst,['Clientes']),false);
 assert.equal(canNavigateModule('Fiscal',{role:'Financeiro',permissions:['fiscal.consultar']},['Fiscal']),true);
});
