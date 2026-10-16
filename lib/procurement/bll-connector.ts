import type {ProcurementTender,SourceDiagnostic} from "./domain";
import {safeTenderOrigin} from "../tender-links";
type FeedOptions={url?:string;token?:string;fetcher?:typeof fetch};
const text=(v:unknown,max=500)=>typeof v==="string"||typeof v==="number"?String(v).trim().slice(0,max):"";
const date=(v:unknown)=>{const s=text(v,80);return s&&Number.isFinite(Date.parse(s))?s:undefined;};
export function normalizeBllRecord(value:unknown):ProcurementTender|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const raw=value as Record<string,unknown>,object=text(raw.objeto,12000),externalId=text(raw.id),control=text(raw.numeroControlePNCP);
  const link=safeTenderOrigin(text(raw.linkSalaDisputa,2048));
  if(!object||(!externalId&&!/^\d{14}-1-\d+\/\d{4}$/.test(control)&&!link))return null;
  const cnpj=text(raw.cnpjOrgao).replace(/\D/g,"");
  if(/^\d{14}-1-\d+\/\d{4}$/.test(control)&&cnpj&&control.slice(0,14)!==cnpj)return null;
  const year=Number(raw.ano),price=raw.valorEstimado==null||raw.valorEstimado===""?NaN:Number(raw.valorEstimado);
  return {numeroControlePNCP:/^\d{14}-1-\d+\/\d{4}$/.test(control)?control:undefined,
    sourceExternalId:externalId||undefined,numeroCompra:text(raw.numeroPregao||raw.numeroProcesso)||undefined,
    anoCompra:Number.isInteger(year)&&year>=2000&&year<=2100?year:undefined,
    objetoCompra:object,modalidadeNome:text(raw.modalidade)||undefined,situacaoCompraNome:text(raw.situacao)||undefined,
    orgaoEntidade:{cnpj:cnpj.length===14?cnpj:undefined,razaoSocial:text(raw.orgao)||undefined},
    unidadeOrgao:{municipioNome:text(raw.municipio)||undefined,ufSigla:/^[A-Z]{2}$/.test(text(raw.uf).toUpperCase())?text(raw.uf).toUpperCase():undefined,codigoIbge:/^\d{7}$/.test(text(raw.codigoIbge))?text(raw.codigoIbge):undefined},
    valorTotalEstimado:Number.isFinite(price)&&price>=0?price:undefined,
    dataPublicacaoPncp:date(raw.dataPublicacao),dataEncerramentoProposta:date(raw.dataLimiteProposta),
    linkSistemaOrigem:link||undefined,sourcePortal:"BLL Compras",sourceOrigins:["BLL Compras"],ingestedFrom:["BLL feed autorizado"]};
}
export async function fetchBllTenders(options:FeedOptions={}):Promise<{items:ProcurementTender[];diagnostic:SourceDiagnostic|null;configured:boolean}>{
  const url=options.url??process.env.BLL_AUTHORIZED_FEED_URL;
  if(!url)return {items:[],diagnostic:null,configured:false};
  const started=Date.now();
  const diagnostic:SourceDiagnostic={source:"BLL Compras · feed autorizado",status:"error",attempts:1,durationMs:0,count:0,mode:"direct"};
  try{
    const target=new URL(url),host=target.hostname.toLowerCase();
    if(target.protocol!=="https:"||target.username||target.password||target.port||!host.includes(".")||host==="localhost"||host.endsWith(".local")||/^(?:\d|\[)/.test(host))throw new Error("invalid configuration");
    const token=options.token??process.env.BLL_API_TOKEN;
    const response=await (options.fetcher??fetch)(target,{headers:{Accept:"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error("feed response failure");
    const bodyText=await response.text();if(bodyText.length>5_000_000)throw new Error("feed too large");
    const payload=JSON.parse(bodyText);if(!Array.isArray(payload?.items))throw new Error("invalid schema");
    const items=payload.items.slice(0,5000).map(normalizeBllRecord).filter((item:ProcurementTender|null):item is ProcurementTender=>item!==null);
    const rejected=payload.items.slice(0,5000).length-items.length;
    return {items,configured:true,diagnostic:{...diagnostic,status:"ok",durationMs:Date.now()-started,count:items.length,truncated:payload.items.length>5000||Boolean(payload.hasMore)||rejected>0,detail:`Feed autorizado: ${items.length} registro(s), ${rejected} rejeitado(s) por dados inválidos. Cobertura limitada ao conteúdo fornecido pelo feed.`}};
  }catch{return {items:[],configured:true,diagnostic:{...diagnostic,durationMs:Date.now()-started,error:"Feed BLL configurado não respondeu com dados válidos. Consulta via PNCP preservada."}};}
}
