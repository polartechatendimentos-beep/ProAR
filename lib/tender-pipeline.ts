import {qualificationReadiness,priceComposition,type PricingInput,type ProcurementRecord} from './procurement-readiness.ts';
import {isTenderClosed} from './tender-visibility.ts';
export const PIPELINE_STAGES=['RADAR','ANALISE','HABILITACAO','HOMOLOGADO','ENCERRADO'] as const;
export type PipelineStage=typeof PIPELINE_STAGES[number];
export const STAGE_LABELS:Record<PipelineStage,string>={RADAR:'Radar / Descoberta',ANALISE:'Em análise técnica',HABILITACAO:'Dossiê / Habilitação pronta',HOMOLOGADO:'Homologado',ENCERRADO:'Encerrado / Não vencido'};
export type PipelineTender={numeroControlePNCP?:string;objetoCompra?:string;modalidadeNome?:string;dataEncerramentoProposta?:string;dataPublicacaoPncp?:string;valorTotalEstimado?:number;sourcePortal?:string;linkSistemaOrigem?:string;validationStatus?:"active_confirmed"|"history"|"incomplete";score?:number;publicationSystem?:string;disputePlatform?:string;distanciaMirassol?:number;orgaoEntidade?:{razaoSocial?:string;cnpj?:string};unidadeOrgao?:{municipioNome?:string;ufSigla?:string};};
export type ProposalDraft={company:string;cnpj:string;address:string;email:string;monthly:number;months:number;validityDays:number;validityReference:string;notes:string};
export type TenderTracking={tenderKey:string;stage:PipelineStage;favorite:boolean;checks:Record<string,boolean>;pmocRequired:boolean|null;tender:PipelineTender;proposal?:ProposalDraft;pricing?:PricingInput;resultEvidence?:string};
export type PipelineRecord={id:string;name:string;tracking?:TenderTracking;createdAt?:string;client?:string;description?:string};
const norm=(s:unknown)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function tenderIdentity(t:PipelineTender){return t.numeroControlePNCP?.trim()||[t.sourcePortal,t.orgaoEntidade?.cnpj,t.orgaoEntidade?.razaoSocial,t.objetoCompra,t.linkSistemaOrigem].map(norm).join('|');}
export function pipelineRecordId(key:string){let a=2166136261,b=5381;for(const c of key){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return `BID-${(a>>>0).toString(16)}${(b>>>0).toString(16)}`;}
export function pipelineChecklist(tracking:TenderTracking|undefined,documents:ProcurementRecord[],today?:string){
 const certs=qualificationReadiness(documents,today).items.map(i=>({id:`cert-${i.kind}`,label:`Certidão ${i.kind}`,done:i.eligible,automatic:true,detail:i.label}));
 const manual=[['registration','Registro CREA / CFT conferido'],['responsibility','ART / TRT e responsável conferidos'],['capacity','Atestado e capacidade térmica conferidos'],['notice','Exigências e anexos do edital revisados']].map(([id,label])=>({id,label,done:tracking?.checks[id]===true,automatic:false,detail:'Conferência da equipe para este certame'}));
 const items=[...certs,...manual];return {items,percentage:Math.round(items.filter(i=>i.done).length/items.length*100),ready:items.every(i=>i.done)};
}
export function validateTracking(tracking:TenderTracking,documents:ProcurementRecord[],today?:string){
 if(!tracking||!PIPELINE_STAGES.includes(tracking.stage)||typeof tracking.favorite!=='boolean'||![true,false,null].includes(tracking.pmocRequired)||!tracking.tender||typeof tracking.tenderKey!=='string'||tracking.tenderKey!==tenderIdentity(tracking.tender)||!tracking.tender.objetoCompra?.trim())throw new Error('Dados do acompanhamento inválidos.');
 if(!tracking.checks||Array.isArray(tracking.checks)||Object.entries(tracking.checks).some(([key,v])=>!['registration','responsibility','capacity','notice'].includes(key)||typeof v!=='boolean'))throw new Error('Checklist inválido.');
 if(tracking.stage==='HABILITACAO'&&!pipelineChecklist(tracking,documents,today).ready)throw new Error('Conclua a habilitação documental e técnica antes de marcar o dossiê como pronto.');
 if(tracking.stage==='HOMOLOGADO'&&!tracking.resultEvidence?.trim())throw new Error('Informe a referência do resultado oficial da homologação.');
 if(tracking.resultEvidence&&tracking.resultEvidence.length>2000)throw new Error('Referência do resultado muito longa.');
 if(tracking.pricing)priceComposition(tracking.pricing);
 if(tracking.proposal){const p=tracking.proposal;for(const key of ['company','cnpj','address','email','validityReference','notes'] as const)if(typeof p[key]!=='string'||p[key].length>10000)throw new Error('Texto da minuta inválido.');if(!Number.isFinite(p.monthly)||p.monthly<0||p.monthly>1e10||!Number.isInteger(p.months)||p.months<1||p.months>120||!Number.isInteger(p.validityDays)||p.validityDays<1||p.validityDays>365)throw new Error('Revise os valores da minuta.');}
}
export function validateProposal(p:ProposalDraft){
 if(!p.company?.trim()||!p.cnpj?.trim()||!p.validityReference?.trim())throw new Error('Preencha a empresa, documento e referência da validade.');
 if(!Number.isFinite(p.monthly)||p.monthly<=0||p.monthly>1e10||!Number.isInteger(p.months)||p.months<1||p.months>120||!Number.isInteger(p.validityDays)||p.validityDays<1||p.validityDays>365)throw new Error('Revise preço, duração e validade da proposta.');
}
export function proposalText(t:PipelineTender,p:ProposalDraft){validateProposal(p);const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});const monthly=Math.round(p.monthly*100)/100,total=monthly*p.months;
 return `MINUTA — SUJEITA À REVISÃO E ÀS EXIGÊNCIAS DO EDITAL\n\nPROPOSTA COMERCIAL\n${p.company}\nCNPJ/CPF: ${p.cnpj}\n${p.address}\n${p.email}\n\nAo órgão: ${t.orgaoEntidade?.razaoSocial||'A preencher'}\nProcesso: ${t.numeroControlePNCP||'A preencher'}\nObjeto: ${t.objetoCompra||'A preencher'}\n\nPreço mensal: ${money(monthly)}\nPrazo considerado: ${p.months} meses\nValor global: ${money(total)}\nValidade da Proposta: ${p.validityDays} dias a contar de ${p.validityReference}, conforme o edital.\n\nOs serviços ofertados observarão o instrumento convocatório e, quando aplicável, a Lei 13.589/2018, o PMOC e as normas sanitárias e técnicas vigentes. A RDC 886/2024 revogou a RE 09/2003 e não é apresentada nesta minuta como norma de novos limites de qualidade do ar.\n\n${p.notes||''}\n\nRepresentante legal: ____________________\nData e assinatura: ____________________\n\nDocumento de trabalho. Não constitui envio de proposta, assinatura digital ou comprovação de habilitação.`;
}
export type PipelineFilters={query:string;portal:string;city:string;modality:string;status:string;onlyPmoc:boolean;onlyFavorites:boolean;stage:string;sort:string;showClosed:boolean};
export function filterPipeline(tenders:PipelineTender[],records:PipelineRecord[],documents:ProcurementRecord[],f:PipelineFilters,now=new Date()){
 const map=new Map<string,PipelineTender>();for(const r of records)if(r.tracking)map.set(r.tracking.tenderKey,r.tracking.tender);for(const t of tenders)if(t.objetoCompra)map.set(tenderIdentity(t),t);
 const rows=[...map].map(([key,tender])=>({key,tender,record:records.find(r=>r.tracking?.tenderKey===key)})).filter(({tender:t,record:r})=>{
  const closed=isTenderClosed(t,now),stage=r?.tracking?.stage||'RADAR';
  if(!f.showClosed&&closed)return false;if(f.stage&&f.stage!==stage)return false;
  if(f.query&&!norm([t.objetoCompra,t.numeroControlePNCP,t.sourcePortal,t.orgaoEntidade?.razaoSocial,t.unidadeOrgao?.municipioNome].join(' ')).includes(norm(f.query)))return false;
  if(f.portal&&t.sourcePortal!==f.portal||f.city&&t.unidadeOrgao?.municipioNome!==f.city||f.modality&&t.modalidadeNome!==f.modality)return false;
  if(f.onlyFavorites&&!r?.tracking?.favorite||f.onlyPmoc&&r?.tracking?.pmocRequired!==true)return false;
  const deadline=Date.parse(t.dataEncerramentoProposta||''),remaining=deadline-now.getTime();
  if(f.status==='open'&&(!Number.isFinite(deadline)||closed))return false;
  if(f.status==='soon'&&(!Number.isFinite(deadline)||remaining<0||remaining>48*3600000))return false;
  if(f.status==='homologated'&&stage!=='HOMOLOGADO')return false;
  if(f.status==='unknown'&&Number.isFinite(deadline))return false;return true;
 });
 const date=(s?:string)=>Number.isFinite(Date.parse(s||''))?Date.parse(s!):Infinity;
 return rows.sort((a,b)=>{
  if(f.sort==='valueDesc')return (b.tender.valorTotalEstimado||0)-(a.tender.valorTotalEstimado||0);
  if(f.sort==='valueAsc')return (a.tender.valorTotalEstimado??Infinity)-(b.tender.valorTotalEstimado??Infinity);
  if(f.sort==='score')return (b.tender.score||0)-(a.tender.score||0);
  if(f.sort==='readiness')return pipelineChecklist(b.record?.tracking,documents).percentage-pipelineChecklist(a.record?.tracking,documents).percentage;
  if(f.sort==='recent')return (date(b.tender.dataPublicacaoPncp)===Infinity?0:date(b.tender.dataPublicacaoPncp))-(date(a.tender.dataPublicacaoPncp)===Infinity?0:date(a.tender.dataPublicacaoPncp));
  return date(a.tender.dataEncerramentoProposta)-date(b.tender.dataEncerramentoProposta);
 });
}
export function pipelineCsv(rows:ReturnType<typeof filterPipeline>){
 const cell=(v:unknown)=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`;};
 return '\uFEFF'+[['Processo','Objeto','Órgão','Município','Portal','Prazo','Valor estimado','Etapa','Favorito','PMOC confirmado'],...rows.map(r=>[r.tender.numeroControlePNCP,r.tender.objetoCompra,r.tender.orgaoEntidade?.razaoSocial,r.tender.unidadeOrgao?.municipioNome,r.tender.sourcePortal,r.tender.dataEncerramentoProposta,r.tender.valorTotalEstimado,STAGE_LABELS[r.record?.tracking?.stage||'RADAR'],r.record?.tracking?.favorite?'Sim':'Não',r.record?.tracking?.pmocRequired===true?'Sim':r.record?.tracking?.pmocRequired===false?'Não':'Não conferido'])].map(row=>row.map(cell).join(';')).join('\r\n');
}
