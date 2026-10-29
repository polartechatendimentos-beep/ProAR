import {NextRequest,NextResponse} from "next/server";
import {get} from "@vercel/blob";
import {createHash,randomUUID} from "node:crypto";
import {procurementAccess} from "@/lib/procurement/access";
import {hasPermission} from "@/lib/permissions";
import {routeContext,routeRest} from "@/lib/work-route-store";
import {DOCUMENT_CATEGORIES,DOCUMENT_LIMIT,documentFileInput,fileSignatureMatches,reviewDocument,documentStatus,type BiddingDocument} from "@/lib/bidding-documents";
import {biddingDocumentPath,biddingDocumentPrefix,loadBiddingDocument,saveBiddingDocument,biddingTenderOptions} from "@/lib/bidding-document-store";
export const runtime="nodejs";
export const maxDuration=60;
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
export async function GET(request:NextRequest){
 const access=procurementAccess(request);if(!access.ok)return json({error:access.error},access.status);
 try{
  const c=await routeContext(access.session),id=request.nextUrl.searchParams.get("id");
  if(id){
   const doc=await loadBiddingDocument(c.db,c.company,id);if(!doc)return json({error:"Documento não encontrado."},404);
   if(request.nextUrl.searchParams.get("download")==="1"){
    if(!doc.uploaded)return json({error:"Arquivo ainda não recebido."},409);
    const result=await get(doc.pathname,{access:"private"});
    if(!result||result.statusCode!==200)return json({error:"Arquivo privado indisponível."},503);
    return new NextResponse(result.stream,{headers:{"Content-Type":doc.mime,"Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(doc.filename),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'"}});
   }
   const {pathname,...safe}=doc;return json({document:{...safe,status:documentStatus(doc)}});
  }
  const offset=Number(request.nextUrl.searchParams.get("offset")||0);if(!Number.isSafeInteger(offset)||offset<0||offset>10000)return json({error:"Página inválida."},422);
  const result=await routeRest(c.db,"proar_state?id=like."+encodeURIComponent(biddingDocumentPrefix(c.company)+"*")+"&select=payload&order=updated_at.desc&limit=50&offset="+offset);
  if(!result.ok)throw new Error("Consulta indisponível");
  const rows=await result.json() as {payload:BiddingDocument}[];
  return json({companyId:c.company,canEdit:hasPermission(access.session,"licitacoes.editar"),storageConfigured:Boolean(process.env.BLOB_READ_WRITE_TOKEN||process.env.BLOB_STORE_ID),documents:rows.filter(row=>row.payload.companyId===c.company).map(({payload:doc})=>{const {pathname,...safe}=doc;return {...safe,audit:doc.audit.slice(-5),status:documentStatus(doc)};}),hasMore:rows.length===50,tenders:biddingTenderOptions(c.state)});
 }catch{return json({error:"Não foi possível consultar os documentos privados. Nenhum registro foi alterado."},503);}
}
export async function POST(request:NextRequest){
 const access=procurementAccess(request);if(!access.ok)return json({error:access.error},access.status);
 if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para anexar ou conferir documentos."},403);
 if(request.headers.get("origin")!==request.nextUrl.origin)return json({error:"Origem não autorizada."},403);
 try{
  const raw=await request.text();if(raw.length>16000)return json({error:"Solicitação muito grande."},413);
  const body=JSON.parse(raw),c=await routeContext(access.session),actor=access.session.username,now=new Date();
  if(body.action==="prepare"){
   if(!process.env.BLOB_READ_WRITE_TOKEN&&!process.env.BLOB_STORE_ID)return json({error:"Armazenamento privado não configurado. O arquivo não foi enviado nem salvo."},503);
   const file=documentFileInput(body);
   if(!DOCUMENT_CATEGORIES.includes(body.category))return json({error:"Categoria inválida."},422);
   const tenderId=String(body.tenderId||"");if(tenderId&&!biddingTenderOptions(c.state).some(t=>t.id===tenderId))return json({error:"Edital não vinculado a esta empresa. Salve-o no acompanhamento primeiro."},422);
   const id=randomUUID(),name=String(body.name||file.filename).trim();if(!name||name.length>200)return json({error:"Nome do documento inválido."},422);
   const doc:BiddingDocument={id,companyId:c.company,_revision:1,name,filename:file.filename,mime:file.mime,size:file.size,category:body.category,tenderId,pathname:biddingDocumentPath(c.company,id,file.extension),uploaded:false,validUntil:"",noExpiry:false,review:"received",reviewNote:"",createdAt:now.toISOString(),createdBy:actor,audit:[{at:now.toISOString(),actor,action:"prepare",note:"Aguardando arquivo real no armazenamento privado."}]};
   if(!await saveBiddingDocument(c.db,doc,null))return json({error:"Cadastro do envio não confirmado."},409);
   return json({prepared:true,id,pathname:doc.pathname});
  }
  const previous=await loadBiddingDocument(c.db,c.company,String(body.id||""));if(!previous)return json({error:"Documento não encontrado."},404);
  if(body.action==="complete"){
   if(previous.uploaded)return json({saved:true,document:{id:previous.id,status:documentStatus(previous)}});
   const blob=await get(previous.pathname,{access:"private",useCache:false});if(!blob||blob.statusCode!==200)return json({error:"Arquivo não encontrado no armazenamento privado. Tente confirmar novamente."},409);
   const reader=blob.stream.getReader(),parts:Uint8Array[]=[];let size=0;
   try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>DOCUMENT_LIMIT)throw new Error("Arquivo excede 10 MB.");parts.push(part.value);}}finally{await reader.cancel();}
   const bytes=Buffer.concat(parts);
   if(size!==previous.size||!fileSignatureMatches(bytes,previous.mime))return json({error:"Tamanho ou assinatura do arquivo inválidos. O arquivo não será aprovado nem liberado para download."},422);
   const next:BiddingDocument={...previous,_revision:previous._revision+1,uploaded:true,sha256:createHash("sha256").update(bytes).digest("hex"),audit:[...previous.audit,{at:now.toISOString(),actor,action:"received",note:"Arquivo privado recebido; formato e tamanho conferidos. Conteúdo e validade ainda não aprovados."}]};
   return await saveBiddingDocument(c.db,next,previous)?json({saved:true,document:{id:next.id,status:documentStatus(next)}}):json({error:"Documento alterado durante o envio. Atualize a lista."},409);
  }
  if(body.action==="review"){
   if(body.expectedRevision!==previous._revision)return json({error:"Outra conferência foi salva. Atualize antes de continuar."},409);
   const next=reviewDocument(previous,body,actor,now);
   return await saveBiddingDocument(c.db,next,previous)?json({saved:true,document:{id:next.id,status:documentStatus(next)}}):json({error:"A conferência mudou. Atualize a lista."},409);
  }
  return json({error:"Ação inválida."},422);
 }catch(error){return json({error:error instanceof Error&&/Informe|Confirme|Documento|arquivo|Arquivo|validade|justificativa|Situação|Limite|extensão|formato|Use PDF/.test(error.message)?error.message:"Operação não confirmada no servidor. Os registros existentes foram preservados."},422);}
}
