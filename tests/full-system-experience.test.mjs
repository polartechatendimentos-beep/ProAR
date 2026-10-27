import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {isMobileInterfacePath} from '../lib/interface-experience.ts';
test('sistema completo é escolhido pela rota, mesmo em celular/tablet ou com preferência mobile antiga',()=>{
 for(const width of [320,360,390,768,1024,1440])for(const cookie of ['', 'proar-experience=mobile'])for(const pathname of ['/','/login','/relatorios','/mobile-other']){
  const device={width,cookie,pathname};assert.equal(isMobileInterfacePath(device.pathname),false,JSON.stringify(device));
 }
 for(const path of ['/mobile','/mobile/','/mobile/relatorios'])assert.equal(isMobileInterfacePath(path),true);
});
test('integração da raiz usa a rota, remove marcadores antigos e preserva dashboard completo',async()=>{
 const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8'),css=await readFile(new URL('../app/responsive-hardening.css',import.meta.url),'utf8');
 assert.match(page,/const mobileExperience = typeof window !== "undefined" && isMobileInterfacePath\(window.location.pathname\)/);
 assert.doesNotMatch(page,/const mobileViewport|const mobileSubdomain/);
 assert.match(page,/dataset.proarExperience = "system"/);assert.match(page,/classList.remove\("proar-mobile-route"\)/);
 assert.match(page,/current === "Painel inicial" && mobileExperience \? <MobileToday/);
 assert.match(page,/current === "Painel inicial" \? <DashboardWorkspace/);
 assert.match(css,/\.proar-full-system \.mobile-nav\{display:none!important\}/);
});
