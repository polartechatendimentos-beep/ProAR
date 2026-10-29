import {NextRequest,NextResponse} from "next/server";
import {handleUpload,type HandleUploadBody} from "@vercel/blob/client";
import {procurementAccess} from "@/lib/procurement/access";
import {hasPermission} from "@/lib/permissions";
import {routeContext} from "@/lib/work-route-store";
import {loadBiddingDocument} from "@/lib/bidding-document-store";
import {DOCUMENT_LIMIT} from "@/lib/bidding-documents";
export const runtime="nodejs";
export async function POST(request:NextRequest){
 try{
  const raw=await request.text();if(raw.length>16000)return NextResponse.json({error:"Solicitação muito grande."},{status:413});
  const body=JSON.parse(raw) as HandleUploadBody;
  const result=await handleUpload({request,body,
   onBeforeGenerateToken:async(pathname,clientPayload)=>{
    const access=procurementAccess(request);if(!access.ok)throw new Error("Sessão ou permissão inválida.");
    if(!hasPermission(access.session,"licitacoes.editar")||request.headers.get("origin")!==request.nextUrl.origin)throw new Error("Envio não autorizado.");
    const c=await routeContext(access.session),id=String(JSON.parse(clientPayload||"{}").id||""),doc=await loadBiddingDocument(c.db,c.company,id);
    if(!doc||doc.uploaded||doc.pathname!==pathname||Date.now()-Date.parse(doc.createdAt)>15*60000)throw new Error("Envio expirado ou arquivo de outra empresa.");
    return {allowedContentTypes:[doc.mime],maximumSizeInBytes:Math.min(doc.size,DOCUMENT_LIMIT),addRandomSuffix:false,allowOverwrite:false,validUntil:Date.now()+10*60000,tokenPayload:JSON.stringify({companyId:c.company,id:doc.id})};
   },
   onUploadCompleted:async()=>{/* Completion does not approve or expose the document. The authenticated finalize operation validates the real bytes. */}
  });
  return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({error:"Envio privado não autorizado ou indisponível. Nenhum documento foi aprovado."},{status:400,headers:{"Cache-Control":"private, no-store"}});}
}
