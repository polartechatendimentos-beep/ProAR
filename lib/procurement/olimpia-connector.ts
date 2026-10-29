import type {ProcurementTender,SourceDiagnostic} from "./domain.ts";
import {municipalTenderDate} from "../tender-date.ts";
import {hvacRelevant} from "./search-relevance.ts";
const ORIGIN="https://www.olimpia.sp.gov.br";
export function municipalText(html:string){return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&ordm;|&#186;/gi,"º").replace(/&amp;/gi,"&").replace(/\s+/g," ").trim();}
export function olimpiaDetailLinks(html:string){
 const urls=new Set<string>();
 for(const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  if(!hvacRelevant(municipalText(match[2])))continue;
  try{const url=new URL(match[1],ORIGIN);if(url.origin===ORIGIN&&/^\/portal\/editais\/0\/1\/\d+\/?$/.test(url.pathname))urls.add(url.href);}catch{}
 }
 return [...urls].slice(0,16);
}
export function parseOlimpiaDetail(html:string,url:string):ProcurementTender|null{
 const origin=new URL(url);if(origin.origin!==ORIGIN||!/^\/portal\/editais\/0\/1\/\d+\/?$/.test(origin.pathname))return null;
 const text=municipalText(html),notice=text.match(/Aviso de Licita[cç][aã]o\s+([\s\S]*?)(?:Secretarias Vinculadas|Movimenta[cç][oõ]es|Arquivos|$)/i)?.[1]||"";
 const object=notice.match(/Objeto:\s*([\s\S]*?)(?:In[ií]cio do recebimento|Recebimento das propostas|Encerramento:|Edital completo|$)/i)?.[1]?.trim();
 const number=text.match(/N[º°o.]*\s*(?:da\s*)?Licita[cç][aã]o\s*:?\s*(\d+\/\d{4})/i)||notice.match(/(?:Credenciamento|Preg[aã]o(?: Eletr[oô]nico)?)\s*(?:n[º°o.]*)?\s*(\d+\/\d{4})/i);
 const modality=text.match(/Modalidade\s*:?\s*(Credenciamento|Preg[aã]o(?: Eletr[oô]nico)?|Concorr[eê]ncia|Dispensa)/i)?.[1];
 const status=text.match(/Situa[cç][aã]o\s*:?\s*(Aberto|Em andamento|Suspenso|Suspensa|Encerrado|Homologado|Revogado|Anulado|Cancelado|Deserto|Fracassado)/i)?.[1];
 if(!object||!hvacRelevant(object)||!number||!modality)return null;
 const process=text.match(/N[º°o.]*\s*(?:do\s*)?Processo\s*:?\s*(\d+\/\d{4})/i)?.[1];
 return {sourceExternalId:origin.pathname,numeroCompra:number[1],anoCompra:Number(number[1].split("/")[1]),objetoCompra:object,
 modalidadeNome:modality,situacaoCompraNome:status,dataEncerramentoProposta:municipalTenderDate(notice||text),
 sourcePortal:"Portal Municipal",sourceOrigins:["Portal Municipal"],ingestedFrom:["Portal oficial · Olímpia"],
 linkSistemaOrigem:origin.href,orgaoEntidade:{cnpj:"46596151000155",razaoSocial:"Município da Estância Turística de Olímpia"},
 unidadeOrgao:{municipioNome:"Olímpia",ufSigla:"SP",codigoIbge:"3533908",nomeUnidade:process?"Processo "+process:undefined}};
}
async function readPage(url:string,fetcher:typeof fetch){
 const response=await fetcher(url,{headers:{Accept:"text/html","User-Agent":"ProAR-Licitacoes/1.0 (+https://polartech.proar.online)"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(6500)});
 if(!response.ok)throw new Error("Portal respondeu "+response.status);
 if(Number(response.headers.get("content-length"))>3000000)throw new Error("Resposta excede limite");
 const reader=response.body?.getReader();if(!reader)throw new Error("Resposta vazia");
 const decoder=new TextDecoder();let result="",size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>3000000)throw new Error("Resposta excede limite");result+=decoder.decode(part.value,{stream:true});}return result+decoder.decode();}finally{await reader.cancel();}
}
export async function fetchOlimpiaTenders(fetcher:typeof fetch=fetch){
 const start=Date.now(),urls=new Set<string>([ORIGIN+"/portal/editais/0/1/5114/"]);
 // The known URL is an official source to revalidate, never a seeded tender.
 let incomplete=false;
 const lists=await Promise.allSettled([ORIGIN+"/portal/editais/1",ORIGIN+"/portal/editais/6/1/0/0/0/0/0/0/0/numero-ano-licitacao-decrescente/0"].map(url=>readPage(url,fetcher)));
 for(const result of lists){if(result.status==="fulfilled")for(const url of olimpiaDetailLinks(result.value))urls.add(url);else incomplete=true;}
 const queue=[...urls].slice(0,16),items:ProcurementTender[]=[];let cursor=0,read=0;
 await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(cursor<queue.length){const url=queue[cursor++];try{const item=parseOlimpiaDetail(await readPage(url,fetcher),url);read++;if(item)items.push(item);}catch{incomplete=true;}}}));
 const diagnostic:SourceDiagnostic={source:"Portal Municipal · Olímpia",status:read?"ok":"error",attempts:lists.length+queue.length,durationMs:Date.now()-start,count:items.length,pagesRead:read,truncated:incomplete||urls.size>16,mode:"direct",detail:"Páginas oficiais consultadas; credenciamentos usam encerramento do recebimento, sem substituir pela data de abertura.",...(read?{}:{error:"Portal oficial indisponível. Nenhum registro foi inventado."})};
 return {items,diagnostic};
}
