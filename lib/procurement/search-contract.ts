import {canonicalProcurementKey,mentionsPmoc,normalizeProcurementText,type ProcurementTender} from "./domain";
import {safeTenderOrigin,tenderPncpLink} from "../tender-links";
export type SearchFilters={city:string;uf:string;modality:string;onlyOpen:boolean;onlyPmoc:boolean;strictRadius:number|null;portals:string[]};
export function procurementFilters(params:URLSearchParams):SearchFilters{
  const uf=(params.get("uf")??"").trim().toUpperCase();
  if(uf&&!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf))throw new Error("UF inválida.");
  const distance=params.get("distanciaMaxKm");const radius=distance==null||distance===""?null:Number(distance);
  if(radius!==null&&(!Number.isFinite(radius)||radius<0||radius>1000))throw new Error("Distância deve estar entre 0 e 1000 km.");
  for(const key of ["raio","raio_km"]){const value=params.get(key);if(value!==null&&(!value.trim()||!Number.isFinite(Number(value))||Number(value)<1||Number(value)>1000))throw new Error("Raio deve estar entre 1 e 1000 km.");}
  for(const key of ["q","termo","municipio","modalidade"]){if((params.get(key)?.length??0)>300)throw new Error("Filtro de busca muito longo.");}
  for(const key of ["dataInicial","dataFinal"]){const value=params.get(key);if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw new Error("Data de busca inválida.");}
  const start=params.get("dataInicial"),end=params.get("dataFinal");if(start&&end&&(start>end||Date.parse(end)-Date.parse(start)>366*86400000))throw new Error("Período de busca inválido ou superior a 366 dias.");
  const aliases:Record<string,string>={bll:"BLL Compras",pncp:"PNCP",comprasgov:"Compras.gov.br",licitacoese:"Licitações-e"};
  const portals=(params.get("portais")??"").split(",").filter(Boolean).map(value=>aliases[normalizeProcurementText(value)]??value.trim());
  return {city:normalizeProcurementText(params.get("municipio")),uf,modality:normalizeProcurementText(params.get("modalidade")),onlyOpen:params.get("apenasAbertas")==="true",onlyPmoc:params.get("apenasPmoc")==="true",strictRadius:radius&&radius>0?radius:null,portals};
}
export function filterProcurementResults<T extends ProcurementTender>(items:T[],filters:SearchFilters,now=Date.now()):T[]{
  return items.filter(t=>{
    if(filters.portals.length&&!filters.portals.some(p=>normalizeProcurementText(p)===normalizeProcurementText(t.sourcePortal??"PNCP")))return false;
    if(filters.city&&normalizeProcurementText(t.unidadeOrgao?.municipioNome)!==filters.city)return false;
    if(filters.uf&&t.unidadeOrgao?.ufSigla?.toUpperCase()!==filters.uf)return false;
    if(filters.modality&&!normalizeProcurementText(t.modalidadeNome).includes(filters.modality))return false;
    if(filters.strictRadius!==null&&(!Number.isFinite(t.distanciaMirassol)||Number(t.distanciaMirassol)>filters.strictRadius))return false;
    if(filters.onlyPmoc&&!mentionsPmoc(t.objetoCompra??""))return false;
    if(filters.onlyOpen){const closing=Date.parse(t.dataEncerramentoProposta??"");if(!Number.isFinite(closing)||closing<=now||t.validationStatus==="history"||/encerrad|homologad|cancelad|revogad|anulad|suspens|fracassad|desert/.test(normalizeProcurementText(t.situacaoCompraNome)))return false;}
    return true;
  });
}
export function normalizeSearchTender(t:ProcurementTender){
  return {canonicalId:canonicalProcurementKey(t),externalIds:{pncp:t.numeroControlePNCP,bll:t.sourcePortal==="BLL Compras"?t.sourceExternalId:undefined},
    origins:t.sourceOrigins??[t.sourcePortal??"PNCP"],ingestedFrom:t.ingestedFrom??[],primaryPortal:t.sourcePortal??"PNCP",
    code:t.numeroCompra??t.numeroControlePNCP??"",modality:t.modalidadeNome??"",status:t.situacaoCompraNome??t.validationStatus??"incomplete",
    agencyName:t.orgaoEntidade?.razaoSocial??"",agencyCnpj:t.orgaoEntidade?.cnpj??"",city:t.unidadeOrgao?.municipioNome??"",uf:t.unidadeOrgao?.ufSigla??"",
    distanceKm:Number.isFinite(t.distanciaMirassol)?t.distanciaMirassol:null,estimatedValue:t.valorTotalEstimado??null,
    publishedAt:t.dataPublicacaoPncp??"",proposalDeadline:t.dataEncerramentoProposta??"",object:t.objetoCompra??"",sourceUrl:safeTenderOrigin(t.linkSistemaOrigem)||tenderPncpLink(t),requiresPmoc:mentionsPmoc(t.objetoCompra??"")};
}
