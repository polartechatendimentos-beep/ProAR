import {createHash,randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {procurementAccess} from "@/lib/procurement/access";
import {hasPermission} from "@/lib/permissions";
import {routeContext,routeRest} from "@/lib/work-route-store";
import {loadBiddingDocument,biddingTenderOptions} from "@/lib/bidding-document-store";
import {DOCUMENT_CATEGORIES} from "@/lib/bidding-documents";
export const runtime="nodejs";
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
type Requirement={id:string;category:string;description:string;threshold:string;unit:string;documentId:string};
type Stored={companyId:string;tenderId:string;revision:number;updatedAt:string;updatedBy:string;requirements:Requirement[]};
const keyFor=(company:string,tenderId:string)=>"bidding-requirements-v1:"+createHash("sha256").update(company+":"+tenderId).digest("hex");
const readList=(value:unknown):Requirement[]=>{
 if(!Array.isArray(value)||value.length>100)throw new Error("Informe até 100 exigências do edital.");
 return value.map((raw,index)=>{
  if(!raw||typeof raw!=="object")throw new Error("Exigência inválida.");
  const item=raw as Record<string,unknown>,description=String(item.description||"").trim(),category=String(item.category||"Outros"),threshold=String(item.threshold||"").trim(),unit=String(item.unit||"").trim(),documentId=String(item.documentId||"");
  if(description.length<4||description.length>500)throw new Error("Cada exigência deve ter de 4 a 500 caracteres.");
  if(!DOCUMENT_CATEGORIES.includes(category as typeof DOCUMENT_CATEGORIES[number]))throw new Error("Categoria inválida.");
  if(threshold.length>80||unit.length>40)throw new Error("Limite excedido em quantidade ou unidade.");
  return {id:/^[0-9a-f-]{36}$/.test(String(item.id||""))?String(item.id):randomUUID(),category,description,threshold,unit,documentId};
 });
};
export async function GET(request:NextRequest){
 const access=procurementAccess(request);if(!access.ok)return json({error:access.error},access.status);
 try{
  const c=await routeContext(access.session),tenderId=String(request.nextUrl.searchParams.get("tenderId")||"");
  if(!tenderId||!biddingTenderOptions(c.state).some(item=>item.id===tenderId))return json({error:"Salve e selecione um edital desta empresa."},422);
  const result=await routeRest(c.db,"proar_state?id=eq."+encodeURIComponent(keyFor(c.company,tenderId))+"&select=payload&limit=1");
  if(!result.ok)throw new Error("Consulta indisponível");
  const stored=(await result.json())[0]?.payload as Stored|undefined;
  if(stored&&(stored.companyId!==c.company||stored.tenderId!==tenderId))return json({error:"Vínculo de empresa inválido."},403);
  return json({requirements:stored?.requirements||[],revision:stored?.revision||0,canEdit:hasPermission(access.session,"licitacoes.editar")});
 }catch{return json({error:"Não foi possível carregar as exigências do edital."},503);}
}
export async function POST(request:NextRequest){
 const access=procurementAccess(request);if(!access.ok)return json({error:access.error},access.status);
 if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para editar exigências."},403);
 if(request.headers.get("origin")!==request.nextUrl.origin)return json({error:"Origem não autorizada."},403);
 try{
  const raw=await request.text();if(raw.length>80000)return json({error:"Solicitação muito grande."},413);
  const body=JSON.parse(raw),c=await routeContext(access.session),tenderId=String(body.tenderId||"");
  if(!tenderId||!biddingTenderOptions(c.state).some(item=>item.id===tenderId))return json({error:"Salve e selecione um edital desta empresa."},422);
  const requirements=readList(body.requirements);
  for(const req of requirements)if(req.documentId){
   const doc=await loadBiddingDocument(c.db,c.company,req.documentId);
   if(!doc||!doc.uploaded||doc.tenderId&&doc.tenderId!==tenderId)return json({error:"Documento vinculado não pertence a esta empresa ou a este edital."},422);
  }
  const key=keyFor(c.company,tenderId),existingResult=await routeRest(c.db,"proar_state?id=eq."+encodeURIComponent(key)+"&select=payload&limit=1");
  if(!existingResult.ok)throw new Error("Consulta indisponível");
  const old=(await existingResult.json())[0]?.payload as Stored|undefined;
  if(old&&(old.companyId!==c.company||old.tenderId!==tenderId))return json({error:"Vínculo de empresa inválido."},403);
  const revision=Number(old?.revision||0);
  if(Number(body.expectedRevision||0)!==revision)return json({error:"As exigências foram alteradas em outra sessão. Atualize antes de salvar."},409);
  const next:Stored={companyId:c.company,tenderId,revision:revision+1,updatedAt:new Date().toISOString(),updatedBy:access.session.username,requirements};
  const result=await routeRest(c.db,old?"proar_state?id=eq."+encodeURIComponent(key)+"&payload->>revision=eq."+revision+"&select=payload":"proar_state?on_conflict=id&select=payload",{method:old?"PATCH":"POST",headers:{Prefer:old?"return=representation":"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(old?{payload:next,updated_at:next.updatedAt}:{id:key,payload:next,updated_at:next.updatedAt})});
  if(!result.ok||!(await result.json()).length)return json({error:"Exigências não salvas. Atualize e tente novamente."},409);
  return json({saved:true,revision:next.revision,requirements:next.requirements});
 }catch(error){return json({error:error instanceof Error&&/Exigência|exigência|Categoria|Limite|quantidade|Documento|edital|Vínculo/.test(error.message)?error.message:"Não foi possível salvar as exigências. Os dados anteriores foram preservados."},422);}
}