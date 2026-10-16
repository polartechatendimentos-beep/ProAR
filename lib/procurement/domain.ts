import {createHash} from "node:crypto";
export type ProcurementPortal="PNCP"|"Compras.gov.br"|"BLL Compras"|"Licitações-e"|"Portal Municipal";
export type ProcurementTender = {
  numeroControlePNCP?:string; sequencialCompra?:number; anoCompra?:number; numeroCompra?:string;
  objetoCompra?:string; modalidadeNome?:string; situacaoCompraNome?:string;
  dataPublicacaoPncp?:string; dataEncerramentoProposta?:string; valorTotalEstimado?:number;
  linkSistemaOrigem?:string; usuarioNome?:string; sourcePortal?:ProcurementPortal; sourceOrigins?:string[];
  ingestedFrom?:string[]; sourceExternalId?:string; distanciaMirassol?:number;
  orgaoEntidade?:{cnpj?:string;razaoSocial?:string};
  unidadeOrgao?:{municipioNome?:string;ufSigla?:string;codigoIbge?:string;nomeUnidade?:string};
  canonicalKey?:string; validationStatus?:"active_confirmed"|"history"|"incomplete";
};
export type SourceDiagnostic = {source:string;status:"ok"|"error";attempts:number;durationMs:number;count:number;error?:string;pagesRead?:number;truncated?:boolean;mode?:"direct"|"pncp_bridge";detail?:string};
export const normalizeProcurementText=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
export function canonicalProcurementKey(item:ProcurementTender){
  const control=item.numeroControlePNCP?.match(/^(\d{14})-1-(\d{1,12})\/(\d{4})$/);
  if(control)return `pncp:${control[1]}:${Number(control[3])}:${Number(control[2])}`;
  const cnpj=(item.orgaoEntidade?.cnpj??"").replace(/\D/g,"");
  if(cnpj.length===14&&Number.isInteger(item.anoCompra)&&Number(item.anoCompra)>=2000&&Number.isSafeInteger(item.sequencialCompra)&&Number(item.sequencialCompra)>0)return `pncp:${cnpj}:${item.anoCompra}:${item.sequencialCompra}`;
  // A purchase/process number is not the PNCP sequence. Never equate the two.
  if(item.sourceExternalId)return `external:${item.sourcePortal??"unknown"}:${cnpj}:${item.sourceExternalId}`;
  if(item.numeroControlePNCP)return `control:${item.numeroControlePNCP}`;
  return `unresolved:${digest(JSON.stringify([item.sourcePortal,cnpj,item.linkSistemaOrigem,item.numeroCompra,item.anoCompra,item.objetoCompra,item.unidadeOrgao]))}`;
}
export function identifyProcurementSource(item:ProcurementTender){
  let host="";try{host=new URL(item.linkSistemaOrigem??"").hostname.toLowerCase().replace(/^www\./,"");}catch{}
  const name=normalizeProcurementText(item.usuarioNome);
  if(host==="bllcompras.com"||host.endsWith(".bllcompras.com")||/^(bll(?: compras)?|bolsa de licitacoes(?: e leiloes)? do brasil)$/.test(name))return "BLL Compras";
  if(host==="licitacoes-e.com.br"||host.endsWith(".licitacoes-e.com.br")||/^(licitacoes-e|licitacoes e)$/.test(name))return "Licitações-e";
  if(host==="compras.gov.br"||host.endsWith(".compras.gov.br")||host==="comprasnet.gov.br"||host.endsWith(".comprasnet.gov.br")||/^(comprasnet|compras.gov.br|serpro)$/.test(name))return "Compras.gov.br";
  return "PNCP";
}
export function mergeProcurementEvidence<T extends ProcurementTender>(preferred:T,other:T):T{
  return {...other,...preferred,
    sourceOrigins:[...new Set([...(preferred.sourceOrigins??[]),preferred.sourcePortal??identifyProcurementSource(preferred),...(other.sourceOrigins??[]),other.sourcePortal??identifyProcurementSource(other)])],
    ingestedFrom:[...new Set([...(preferred.ingestedFrom??[]),...(other.ingestedFrom??[])])],
    valorTotalEstimado:preferred.valorTotalEstimado??other.valorTotalEstimado,
    linkSistemaOrigem:preferred.linkSistemaOrigem||other.linkSistemaOrigem};
}
export function matchesHvacDomain(text:string,query=""){
  const normalized=normalizeProcurementText(text),q=normalizeProcurementText(query);
  return (!q||normalized.includes(q))&&/ar\s*-?\s*condicionado|condicionador(?:es)? de ar|climatiza|refrigera|\bpmoc\b|\bhvac\b|\bsplit\b|cassete|chiller|\bvrf\b|fan[ -]?coil/.test(normalized);
}
export function mentionsPmoc(text:string){const t=normalizeProcurementText(text);return /\bpmoc\b|plano de manutencao[, ]+operacao e controle/.test(t)&&!/(?:nao|sem|dispensa).{0,35}(?:exig.{0,12})?\bpmoc\b/.test(t);}
