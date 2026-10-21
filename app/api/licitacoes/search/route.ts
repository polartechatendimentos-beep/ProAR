import {NextRequest,NextResponse} from "next/server";
import {GET as searchRadar} from "../route";
import {normalizeSearchTender} from "@/lib/procurement/search-contract";
import {matchesHvacDomain} from "@/lib/procurement/domain";
export const maxDuration=120;
/** Compatibility contract for the uploaded client; all providers run in the existing Radar. */
export async function GET(request:NextRequest){
  const url=request.nextUrl.clone();
  url.pathname="/api/licitacoes";
  // This endpoint always searches; detail/monitor flags cannot bypass its filters.
  for(const key of ["monitor","detail","documents"])url.searchParams.delete(key);
  if(!url.searchParams.has("apenasAbertas"))url.searchParams.set("apenasAbertas","true");
  const response=await searchRadar(new NextRequest(url,{headers:request.headers}));
  if(!response.ok)return response;
  const result=await response.json();
  const items=(Array.isArray(result.data)?result.data:[]).filter((t:{objetoCompra?:string})=>matchesHvacDomain(t.objetoCompra??"")).map(normalizeSearchTender);
  const diagnostics=Array.isArray(result.sourceDiagnostics)?result.sourceDiagnostics:[];
  const health=(prefix:string)=>{
    const runs=diagnostics.filter((d:{source:string})=>d.source.startsWith(prefix));
    return {source:prefix,status:!runs.length?"not_checked":runs.every((d:{status:string})=>d.status==="ok")?"online":runs.some((d:{status:string})=>d.status==="ok")?"degraded":"unavailable",count:runs.reduce((sum:number,d:{count?:number})=>sum+(d.count??0),0),checks:runs};
  };
  return NextResponse.json({...result,success:!result.warning||items.length>0,total:items.length,items,warnings:result.warning?[result.warning]:[],sourcesHealth:{bll:health("BLL Compras"),pncp:health("PNCP"),fiorilli:health("Fiorilli"),betha:health("Betha"),ipm:health("IPM / Atende.net"),comprasgov:health("Compras.gov.br")}}, {headers:{"Cache-Control":"private, no-store"}});
}
