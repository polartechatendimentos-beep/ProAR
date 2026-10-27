import {FIORILLI_SOURCES,type FiorilliSource} from './regional-sources.ts';
import type {ProcurementTender,SourceDiagnostic} from './domain.ts';
const text=(v:unknown,max=12000)=>typeof v==='string'||typeof v==='number'?String(v).trim().slice(0,max):'';
function brazilDate(raw:unknown,time?:unknown){
 const match=text(raw,40).match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}:\d{2})(?::\d{2})?)?$/);
 if(!match)return undefined;
 const [,day,month,year]=match,clock=time===undefined?'00:00':text(time,10);
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock))return undefined;
 const dateOnly=`${year}-${month}-${day}`;
 if(!Number.isFinite(Date.parse(dateOnly))||new Date(dateOnly).toISOString().slice(0,10)!==dateOnly)return undefined;
 return new Date(`${dateOnly}T${clock}:00-03:00`).toISOString();
}
export function fiorilliUrl(source:FiorilliSource,year:number){
 if(!Number.isInteger(year)||year<2000||year>2100)throw new Error('Exercício inválido.');
 const url=new URL('VersaoJson/LicitacoesEContratos/',source.base);
 url.search=new URLSearchParams({ConectarExercicio:String(year),Listagem:'Licitacoes',Ano:String(year),Empresa:source.entity,MostraDadosConsolidado:'False'}).toString();return url.href;
}
export function normalizeFiorilliRecord(value:unknown,source:FiorilliSource,year:number):ProcurementTender|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>,object=text(row.DISCR),id=text(row.NLICITACAO,100),recordYear=text(row.ANO,4);
 if(!object||!id||text(row.EMPRESA,10)!==source.entity||![String(year),String(year%100).padStart(2,'0')].includes(recordYear))return null;
 const hidden=text(row.ORCAMENTO_SIGILOSO,5).toUpperCase()==='S',rawPrice=text(row.VALOR,80);
 const price=rawPrice?Number(rawPrice.includes(',')?rawPrice.replaceAll('.','').replace(',','.'):rawPrice):NaN;
 const clock=text(row.HORENV,10);
 // A midnight date without a proposal time is not a confirmed deadline.
 const closing=clock?brazilDate(row.DTPROPOSTAFIM||row.DTENV,clock):undefined;
 return {sourceExternalId:`${source.id}:${year}:${id}`,numeroCompra:text(row.PROCLIC,100)||undefined,anoCompra:year,
 objetoCompra:object,modalidadeNome:text(row.LICIT,200)||undefined,situacaoCompraNome:text(row.SITUACAO,200)||undefined,
 dataPublicacaoPncp:brazilDate(row.DATAE),dataEncerramentoProposta:closing,
 valorTotalEstimado:!hidden&&Number.isFinite(price)&&price>=0?price:undefined,
 sourcePortal:'Portal Municipal',publicationSystem:'Fiorilli',sourceOrigins:['Portal Municipal','Fiorilli'],ingestedFrom:[`Fiorilli direto · ${source.city}`],
 linkSistemaOrigem:source.base,
 orgaoEntidade:{razaoSocial:text(row.NOMEEMPRESA,500)||undefined},unidadeOrgao:{municipioNome:source.city,ufSigla:source.uf,codigoIbge:source.ibge}};
}
async function readLimited(response:Response){
 if(Number(response.headers.get('content-length'))>5000000)throw new Error('Resposta muito grande.');
 const reader=response.body?.getReader();if(!reader)throw new Error('Resposta vazia.');
 let size=0,result='';const decoder=new TextDecoder();
 try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>5000000)throw new Error('Resposta muito grande.');result+=decoder.decode(chunk.value,{stream:true});}return result+decoder.decode();}finally{await reader.cancel();}
}
export async function fetchFiorilliTenders({year=new Date().getFullYear(),radius=200,fetcher=fetch}:{year?:number;radius?:number;fetcher?:typeof fetch}={}){
 const {municipalityDistances}=await import('../municipality-distances.ts');
 const sources=FIORILLI_SOURCES.filter(source=>Number.isFinite(municipalityDistances[source.ibge])&&municipalityDistances[source.ibge]<=radius);
 const results=await Promise.all(sources.map(async source=>{
 const started=Date.now();const diagnostic:SourceDiagnostic={source:`Fiorilli direto · ${source.city}`,status:'error',attempts:1,durationMs:0,count:0,mode:'direct'};
 try{
  const response=await fetcher(fiorilliUrl(source,year),{headers:{Accept:'application/json','User-Agent':'ProAR-Licitacoes/1.0 (+https://polartech.proar.online)'},redirect:'error',signal:AbortSignal.timeout(6500),cache:'no-store'});
  if(!response.ok)throw new Error('Falha na fonte.');
  const body=JSON.parse(await readLimited(response));if(!Array.isArray(body))throw new Error('Formato não reconhecido.');
  const items=body.slice(0,5000).map(row=>normalizeFiorilliRecord(row,source,year)).filter((row):row is ProcurementTender=>row!==null);
  return {items,diagnostic:{...diagnostic,status:'ok' as const,durationMs:Date.now()-started,count:items.length,truncated:body.length>5000||items.length!==body.slice(0,5000).length,detail:`Dados públicos do exercício ${year}; ${items.length} registros normalizados. Cobertura restrita ao município configurado. Prazos ausentes exigem conferência.`}};
 }catch{return {items:[] as ProcurementTender[],diagnostic:{...diagnostic,durationMs:Date.now()-started,error:'Consulta Fiorilli indisponível ou formato inválido. Resultados das outras fontes preservados.'}};}
 }));
 return {items:results.flatMap(r=>r.items),diagnostics:results.map(r=>r.diagnostic)};
}
