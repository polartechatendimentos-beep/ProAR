export const searchText=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
export function hvacRelevant(value:string){return /\bar condicionado\b|\bcondicionadores? de ar\b|climatiz|refriger|pmoc|hvac|\bsplit\b|cassete|piso teto|evaporador|condensador|chiller|\bvrf\b|fan coil|fluido refrigerante|compressor frigorifico|ventilacao mecanica|exaustao/.test(searchText(value));}
export function tenderSearchMatches(object:string,searchable:string,query=""){
 if(!hvacRelevant(object))return false;
 const q=searchText(query);if(!q)return true;
 if(/^(ar condicionado|ar condicionados|climatizacao|climatizadores|refrigeracao|hvac|manutencao de ar condicionado|servicos de climatizacao)$/.test(q))return true;
 const text=searchText(searchable);
 return q.split(" ").every(term=>text.includes(term));
}
export function pncpProposalQuery(end:string,uf:string,modality:number,page:number,municipality?:string){
 const query=new URLSearchParams({dataFinal:end,codigoModalidadeContratacao:String(modality),uf,pagina:String(page),tamanhoPagina:"50"});
 if(municipality)query.set("codigoMunicipioIbge",municipality);return query;
}
export function withinTenderWindow(closing:string|undefined,published:string|undefined,start:number,end:number,municipal=false){
 const deadline=Date.parse(procurementDateIso(closing)??"");if(Number.isFinite(deadline))return deadline>=start&&deadline<=end;
 const publication=Date.parse(procurementDateIso(published)??"");return municipal||(Number.isFinite(publication)&&publication>=start-366*86400000);
}

/** PNCP civil timestamps without an offset refer to Brazilian local procurement time. */
export function procurementDateIso(value:string|undefined){
 if(!value)return undefined;
 const input=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)?value+"-03:00":value;
 const millis=Date.parse(input);return Number.isFinite(millis)?new Date(millis).toISOString():undefined;
}
