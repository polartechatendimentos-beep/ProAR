import { resolveTenantDb, tenantHeaders } from "@/lib/tenant-rest";

export type ProcurementSession={companyId?:string;displayName?:string;username?:string};
export type ProcurementSource={id:string;company_id?:string|null;name:string;base_url:string;source_type:string;integration_mode:string;enabled:boolean;priority:number;status:string;health_message?:string;last_sync_at?:string;last_success_at?:string;last_error_at?:string};
export type NormalizedOpportunity={canonicalId:string;pncpId?:string;source:string;sourceUrl?:string;buyerName?:string;buyerCnpj?:string;city?:string;state?:string;modality?:string;processNumber?:string;object:string;estimatedValue?:number;proposalEndAt?:string;publishedAt?:string;distanceKm?:number;score:number};
export type PreflightCheck={key:string;label:string;result:"ok"|"attention"|"blocker"|"not_applicable";detail:string;action:string};

const defaults:ProcurementSource[]=[
  {id:"pncp",name:"PNCP",base_url:"https://pncp.gov.br",source_type:"national",integration_mode:"official_api",enabled:true,priority:1,status:"pending",health_message:"Aguardando sincronização."},
  {id:"compras-gov",name:"Compras.gov.br",base_url:"https://www.gov.br/compras",source_type:"federal",integration_mode:"official_open_data",enabled:true,priority:2,status:"pending",health_message:"Aguardando sincronização."},
  {id:"bll",name:"BLL Compras",base_url:"https://bll.org.br",source_type:"marketplace",integration_mode:"manual_link",enabled:true,priority:10,status:"manual",health_message:"Link oficial; sem integração autorizada."},
  {id:"portal-compras-publicas",name:"Portal de Compras Públicas",base_url:"https://www.portaldecompraspublicas.com.br",source_type:"marketplace",integration_mode:"manual_link",enabled:true,priority:11,status:"manual",health_message:"Link oficial; sem integração autorizada."},
  {id:"licitanet",name:"Licitanet",base_url:"https://licitanet.com.br",source_type:"marketplace",integration_mode:"manual_link",enabled:true,priority:12,status:"manual",health_message:"Link oficial; sem integração autorizada."},
];

async function procurementDb(session:ProcurementSession){
  const companyId=session.companyId||String(process.env.PROAR_PRIMARY_COMPANY_ID||"polartech-principal").replace(/[^a-zA-Z0-9_-]/g,"");
  const db=await resolveTenantDb(session.companyId);
  if(!db.url||!db.key)throw new Error("Banco de licitações indisponível");
  return{companyId,url:db.url,headers:tenantHeaders(db.key)};
}
async function requestDb(session:ProcurementSession,path:string,init:RequestInit={}){
  const db=await procurementDb(session);
  const response=await fetch(`${db.url}/rest/v1/${path}`,{...init,headers:{...db.headers,...init.headers},cache:"no-store"});
  if(!response.ok)throw new Error(await response.text());
  return{db,response};
}
export async function listProcurementSources(session:ProcurementSession){
  const db=await procurementDb(session);
  const{response}=await requestDb(session,`procurement_sources?select=*&or=(company_id.is.null,company_id.eq.${encodeURIComponent(db.companyId)})&order=priority.asc`);
  const data=await response.json() as ProcurementSource[];const byId=new Map(defaults.map(source=>[source.id,source]));
  for(const source of data)byId.set(source.id,source);
  return[...byId.values()].sort((a,b)=>a.priority-b.priority);
}
export async function persistRadar(session:ProcurementSession,opportunities:NormalizedOpportunity[],failedSources:string[]){
  const db=await procurementDb(session);const now=new Date().toISOString();
  const rows=opportunities.map(item=>({company_id:db.companyId,canonical_id:item.canonicalId,pncp_id:item.pncpId||null,source:item.source,source_external_id:item.pncpId||item.canonicalId,source_url:item.sourceUrl||null,buyer_name:item.buyerName||null,buyer_cnpj:item.buyerCnpj||null,state:item.state||null,city:item.city||null,modality:item.modality||null,process_number:item.processNumber||null,object:item.object,estimated_value:item.estimatedValue??null,published_at:item.publishedAt||null,proposal_end_at:item.proposalEndAt||null,status:"open",score:item.score,raw_payload:item,normalized_at:now,last_seen_at:now,updated_at:now}));
  if(rows.length)await requestDb(session,"procurement_opportunities?on_conflict=company_id,canonical_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(rows)});
  const status=failedSources.length?(rows.length?"partial":"error"):"success";
  await requestDb(session,"procurement_sync_runs",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:db.companyId,source_id:"pncp",started_at:now,finished_at:now,status,imported_count:rows.length,rejected_count:0,error_message:failedSources.join(", ")||null})});
  const health:Record<string,unknown>={status,health_message:failedSources.length?`Consulta parcial: ${failedSources.join(", ")}.`:`${rows.length} oportunidade(s) normalizada(s).`,last_sync_at:now,updated_at:now};
  if(rows.length)health.last_success_at=now;if(failedSources.length)health.last_error_at=now;
  await requestDb(session,"procurement_sources?id=eq.pncp",{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(health)});
}
export async function listPersistedOpportunities(session:ProcurementSession){
  const db=await procurementDb(session);const{response}=await requestDb(session,`procurement_opportunities?company_id=eq.${encodeURIComponent(db.companyId)}&select=*&order=score.desc,last_seen_at.desc&limit=250`);
  const rows=await response.json() as Array<Record<string,unknown>>;
  return rows.map(row=>({canonicalId:String(row.canonical_id),pncpId:row.pncp_id?String(row.pncp_id):undefined,source:String(row.source),sourceUrl:row.source_url?String(row.source_url):undefined,buyerName:row.buyer_name?String(row.buyer_name):undefined,buyerCnpj:row.buyer_cnpj?String(row.buyer_cnpj):undefined,city:row.city?String(row.city):undefined,state:row.state?String(row.state):undefined,modality:row.modality?String(row.modality):undefined,processNumber:row.process_number?String(row.process_number):undefined,object:String(row.object),estimatedValue:row.estimated_value==null?undefined:Number(row.estimated_value),proposalEndAt:row.proposal_end_at?String(row.proposal_end_at):undefined,publishedAt:row.published_at?String(row.published_at):undefined,score:Number(row.score||0)})) satisfies NormalizedOpportunity[];
}
export function scoreOpportunity(input:{object?:string;estimatedValue?:number;distanceKm?:number;proposalEnd?:string}){
  const object=(input.object??"").toLowerCase();const adherence=/ar.?condicionado|climatiza|refrigera|pmoc|vrf|split|cassete|piso.?teto|exaust/.test(object)?20:5;
  const financial=input.estimatedValue&&input.estimatedValue>=50000?30:input.estimatedValue?18:10;const distance=input.distanceKm===undefined?8:input.distanceKm<=100?15:input.distanceKm<=300?10:3;
  const deadline=input.proposalEnd?Math.max(0,new Date(input.proposalEnd).getTime()-Date.now())/86400000:14;const timing=deadline>=3?15:deadline>=1?8:2;
  return Math.max(0,Math.min(100,financial+adherence+distance+timing+20));
}
export function evaluatePreflight(input:{opportunity?:Record<string,unknown>;checklist?:Array<Record<string,unknown>>;documents?:Array<Record<string,unknown>>;proposal?:Record<string,unknown>}){
  const opportunity=input.opportunity??{},checklist=input.checklist??[],documents=input.documents??[],proposal=input.proposal??{},now=Date.now();
  const checks:PreflightCheck[]=[
    {key:"identification",label:"Identificação do processo",result:opportunity.process_number||opportunity.notice_number?"ok":"blocker",detail:opportunity.process_number||opportunity.notice_number?"Processo ou aviso identificado.":"Processo e número do aviso não foram confirmados.",action:"Confirmar os dados do edital."},
    {key:"buyer",label:"Órgão e CNPJ",result:opportunity.buyer_name&&opportunity.buyer_cnpj?"ok":"attention",detail:opportunity.buyer_name&&opportunity.buyer_cnpj?"Órgão identificado.":"Órgão ou CNPJ ainda precisa de conferência.",action:"Validar dados no edital oficial."},
    {key:"proposal",label:"Proposta e totais",result:Number(proposal.total??0)>0?"ok":"blocker",detail:Number(proposal.total??0)>0?"Proposta possui total calculado.":"Não há proposta totalizada.",action:"Preencher e recalcular a proposta."},
    {key:"requirements",label:"Exigências obrigatórias",result:checklist.some(item=>item.required&&item.status!=="ok")?"blocker":"ok",detail:checklist.some(item=>item.required&&item.status!=="ok")?"Existem exigências obrigatórias pendentes.":"Nenhuma exigência obrigatória pendente.",action:"Validar requisitos, capacidade técnica e declarações."},
    {key:"documents",label:"Documentos e validades",result:documents.some(item=>item.required&&(!item.storage_url||(item.expires_at&&new Date(String(item.expires_at)).getTime()<now)))?"blocker":"ok",detail:documents.some(item=>item.required&&!item.storage_url)?"Há documento obrigatório sem arquivo.":documents.some(item=>item.expires_at&&new Date(String(item.expires_at)).getTime()<now)?"Há documento vencido.":"Documentos obrigatórios conferidos.",action:"Anexar ou renovar os documentos pendentes."},
    {key:"deadline",label:"Prazos",result:opportunity.proposal_end_at&&new Date(String(opportunity.proposal_end_at)).getTime()<now?"blocker":"ok",detail:opportunity.proposal_end_at?"Prazo de proposta identificado.":"Prazo ainda não confirmado.",action:"Conferir a data no edital."},
  ];const blockers=checks.filter(item=>item.result==="blocker").length;return{checks,blockers,readyToSubmit:blockers===0};
}
export async function calculateAndPersistPreflight(session:ProcurementSession,canonicalId:string){
  const db=await procurementDb(session),filter=`company_id=eq.${encodeURIComponent(db.companyId)}`;
  const opportunityResponse=await requestDb(session,`procurement_opportunities?${filter}&canonical_id=eq.${encodeURIComponent(canonicalId)}&select=*&limit=1`);
  const opportunities=await opportunityResponse.response.json() as Array<Record<string,unknown>>;if(!opportunities[0])throw new Error("Oportunidade não encontrada");
  const opportunityId=String(opportunities[0].id);
  const[checklistResponse,documentsResponse,proposalsResponse]=await Promise.all([requestDb(session,`procurement_checklist?${filter}&opportunity_id=eq.${opportunityId}&select=*`),requestDb(session,`procurement_documents?${filter}&opportunity_id=eq.${opportunityId}&select=*`),requestDb(session,`procurement_proposals?${filter}&opportunity_id=eq.${opportunityId}&select=*&order=updated_at.desc&limit=1`)]);
  const checklist=await checklistResponse.response.json() as Array<Record<string,unknown>>,documents=await documentsResponse.response.json() as Array<Record<string,unknown>>,proposals=await proposalsResponse.response.json() as Array<Record<string,unknown>>;
  const result=evaluatePreflight({opportunity:opportunities[0],checklist,documents,proposal:proposals[0]||{}}),now=new Date().toISOString();
  if(proposals[0])await requestDb(session,`procurement_proposals?id=eq.${proposals[0].id}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({ready_to_submit:result.readyToSubmit,ready_calculated_at:now,updated_at:now})});
  await requestDb(session,"procurement_audit_events",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:db.companyId,opportunity_id:opportunityId,event_type:"PREFLIGHT_CALCULATED",actor:session.displayName||session.username||"Usuário",payload:{blockers:result.blockers,ready_to_submit:result.readyToSubmit},created_at:now})});return result;
}
export async function listDocuments(session:ProcurementSession,canonicalId:string){
  const db=await procurementDb(session),opportunity=await requestDb(session,`procurement_opportunities?company_id=eq.${encodeURIComponent(db.companyId)}&canonical_id=eq.${encodeURIComponent(canonicalId)}&select=id&limit=1`);
  const rows=await opportunity.response.json() as Array<{id:string}>;if(!rows[0])return[];
  const documents=await requestDb(session,`procurement_documents?company_id=eq.${encodeURIComponent(db.companyId)}&opportunity_id=eq.${rows[0].id}&select=*&order=created_at.desc`);return await documents.response.json();
}
export function simulateBid(input:{amount:number;cost:number;minimumAuthorized:number;taxRate?:number}){
  const amount=Number(input.amount),cost=Number(input.cost),minimumAuthorized=Number(input.minimumAuthorized),taxRate=Number(input.taxRate||0);
  if(![amount,cost,minimumAuthorized,taxRate].every(Number.isFinite)||amount<=0||cost<0||minimumAuthorized<0||taxRate<0||taxRate>100)throw new Error("Valores inválidos para simulação");
  const tax=amount*(taxRate/100),result=amount-cost-tax,margin=result/amount*100;return{amount,cost,tax,result,margin,belowMinimum:amount<minimumAuthorized,copyValue:amount.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})};
}
export async function auditBidSimulation(session:ProcurementSession,input:Record<string,unknown>,result:Record<string,unknown>){
  const db=await procurementDb(session);await requestDb(session,"procurement_audit_events",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:db.companyId,event_type:"BID_SIMULATED",actor:session.displayName||session.username||"Usuário",payload:{input,result,external_action:"copy_value_only"}})});
}
