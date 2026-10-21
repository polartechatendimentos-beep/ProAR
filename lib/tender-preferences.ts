import {PIPELINE_STAGES,type PipelineFilters} from './tender-pipeline.ts';
import {normalizeTenderView,type TenderView} from './experience-design.ts';
export type TenderPreferences={version:1;filters:PipelineFilters;view:TenderView};
export function tenderPreferenceKey(company:unknown,username:unknown){
 if(typeof company!=='string'||!company.trim()||typeof username!=='string'||!username.trim())return null;
 return `proar-tender-preferences-v1:${encodeURIComponent(company)}:${encodeURIComponent(username)}`;
}
export function parseTenderPreferences(raw:string):TenderPreferences{
 const value=JSON.parse(raw),f=value?.filters;
 if(value?.version!==1||!f||typeof f!=='object')throw new Error('Preferência inválida.');
 for(const key of ['query','portal','city','modality','status','stage','sort'])if(typeof f[key]!=='string'||f[key].length>1000)throw new Error('Filtro inválido.');
 for(const key of ['onlyPmoc','onlyFavorites','showClosed'])if(typeof f[key]!=='boolean')throw new Error('Filtro inválido.');
 if(f.stage&&!PIPELINE_STAGES.includes(f.stage)||!['','open','soon','unknown','homologated'].includes(f.status)||!['deadline','score','valueDesc','valueAsc','readiness','recent'].includes(f.sort))throw new Error('Opção de filtro inválida.');
 return {version:1,view:normalizeTenderView(value.view),filters:{query:f.query,portal:f.portal,city:f.city,modality:f.modality,status:f.status,stage:f.stage,sort:f.sort,onlyPmoc:f.onlyPmoc,onlyFavorites:f.onlyFavorites,showClosed:f.showClosed}};
}
