import {NextRequest,NextResponse} from "next/server";
import {hasPermission,sessionFromRequest} from "@/lib/permissions";
import {routeContext,routeRest} from "@/lib/work-route-store";
import {assignedToSession,isOpenMobileOrder,mobileFieldOrders} from "@/lib/mobile-field";
import {commitNeonOperationalState,PRIMARY_DATABASE_URL} from "@/lib/supabase-rest";
import {requiredSecret} from "@/lib/security-env";
import {cloudDraftOwner,cloudDraftKey,cloudDraftPrefix,cloudDraftText,CLOUD_DRAFT_TTL,sealCloudDraft,openCloudDraft} from "@/lib/cloud-order-drafts";
export const runtime="nodejs";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
type Row=Record<string,unknown>;
function owns(row:Row,company:string,ownerId:string){return row.companyId===company&&row.ownerId===ownerId;}
export async function GET(request:NextRequest){
 const session=sessionFromRequest(request);if(!session)return reply({error:"Entre novamente para consultar suas cópias."},401);
 if(!hasPermission(session,"os.visualizar"))return reply({error:"Sem acesso às OS."},403);
 try{
  const c=await routeContext(session),actor={...session,employeeId:c.actor?.employeeId},orders=(c.state.serviceOrders||[]) as Row[];
  const allowed=orders.filter(order=>assignedToSession(order,actor)&&isOpenMobileOrder(order.status));
  const ownerId=cloudDraftOwner(c.actor?.employeeId,session.username);
  const orderId=request.nextUrl.searchParams.get("orderId");
  if(orderId){
   const order=allowed.find(item=>item.id===orderId);if(!order)return reply({error:"OS não disponível para este perfil."},403);
   const key=cloudDraftKey(c.company,ownerId,orderId);
   const response=await routeRest(c.db,`proar_state?id=eq.${encodeURIComponent(key)}&select=payload&limit=1`);
   if(!response.ok)throw new Error("Falha ao consultar cópia.");
   const rows=await response.json(),row=rows[0]?.payload as Row|undefined;
   if(!row)return reply({available:false,revision:0});
   if(!owns(row,c.company,ownerId)||row.orderId!==orderId)return reply({error:"Cópia de outro usuário."},403);
   if(Number(row.expiresAt)<=Date.now())return reply({available:false,revision:Number(row._revision||0)});
   const raw=JSON.parse(openCloudDraft(String(row.cipher),key,requiredSecret("PROAR_SESSION_SECRET")));
   const draft={...cloudDraftText(raw),before:"",after:"",signature:"",signerName:"",beforePhotos:[],afterPhotos:[],orderSnapshot:mobileFieldOrders([order],actor)[0]};
   return reply({available:true,revision:row._revision,draft,expiresAt:row.expiresAt});
  }
  const offset=Number(request.nextUrl.searchParams.get("offset")||0);
  if(!Number.isSafeInteger(offset)||offset<0||offset>10000)return reply({error:"Página inválida."},422);
  const prefix=cloudDraftPrefix(c.company,ownerId);
  const response=await routeRest(c.db,`proar_state?id=like.${encodeURIComponent(prefix+"*")}&select=payload&order=updated_at.desc&limit=50&offset=${offset}`);
  if(!response.ok)throw new Error("Falha ao consultar cópias.");
  const rows=await response.json() as {payload:Row}[];
  const drafts=rows.filter(({payload:row})=>row&&owns(row,c.company,ownerId)&&Number(row.expiresAt)>Date.now()&&allowed.some(order=>order.id===row.orderId)).map(({payload:row})=>({orderId:String(row.orderId),savedAt:Number(row.savedAt),revision:Number(row._revision),expiresAt:Number(row.expiresAt)}));
  return reply({drafts,hasMore:rows.length===50,offset});
 }catch{return reply({error:"Não foi possível consultar as cópias. Os rascunhos locais foram preservados."},503);}
}
export async function PUT(request:NextRequest){
 const session=sessionFromRequest(request);if(!session)return reply({error:"Sessão inválida."},401);
 if(!hasPermission(session,"os.editar"))return reply({error:"Sem permissão para guardar rascunhos de OS."},403);
 if(request.headers.get("origin")!==request.nextUrl.origin)return reply({error:"Origem não autorizada."},403);
 try{
  const text=await request.text();if(text.length>80000)return reply({error:"Cópia de texto excede o limite permitido."},413);
  const body=JSON.parse(text);if(typeof body.orderId!=="string"||body.orderId.length>120||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)return reply({error:"Identificação da cópia inválida."},422);
  let draft;try{draft=cloudDraftText(body.draft);}catch(error){return reply({error:error instanceof Error?error.message:"Rascunho inválido."},422);}
  const c=await routeContext(session),actor={...session,employeeId:c.actor?.employeeId};
  const ownerId=cloudDraftOwner(c.actor?.employeeId,session.username);
  const order=(c.state.serviceOrders||[]).find((item:Row)=>item.id===body.orderId);
  if(!order||!assignedToSession(order,actor)||!isOpenMobileOrder(order.status))return reply({error:"OS não disponível para este perfil."},403);
  const key=cloudDraftKey(c.company,ownerId,body.orderId),response=await routeRest(c.db,`proar_state?id=eq.${encodeURIComponent(key)}&select=payload&limit=1`);
  if(!response.ok)throw new Error("Falha ao verificar cópia anterior.");
  const rows=await response.json(),previous=rows[0]?.payload as Row|undefined;
  if(previous&&!owns(previous,c.company,ownerId))return reply({error:"Cópia de outro usuário."},403);
  const revision=Number(previous?._revision||0);if(revision!==body.expectedRevision)return reply({error:"Outra cópia foi salva. Atualize antes de substituir.",conflict:true},409);
  const payload={companyId:c.company,ownerId,username:session.username.trim().toLowerCase(),orderId:body.orderId,_revision:revision+1,savedAt:draft.savedAt,expiresAt:Math.min(Date.now()+CLOUD_DRAFT_TTL,draft.savedAt+CLOUD_DRAFT_TTL),cipher:sealCloudDraft(JSON.stringify(draft),key,requiredSecret("PROAR_SESSION_SECRET"))};
  let saved=false;
  if(c.db.url===PRIMARY_DATABASE_URL)saved=Boolean(await commitNeonOperationalState(key,previous?revision:null,payload,[]));
  else{
   const path=previous?`proar_state?id=eq.${encodeURIComponent(key)}&payload->>_revision=eq.${revision}&select=payload`:"proar_state?on_conflict=id&select=payload";
   const result=await routeRest(c.db,path,{method:previous?"PATCH":"POST",headers:{Prefer:previous?"return=representation":"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(previous?{payload,updated_at:new Date().toISOString()}:{id:key,payload,updated_at:new Date().toISOString()})});
   saved=result.ok&&(await result.json()).length>0;
  }
  return saved?reply({saved:true,revision:revision+1,savedAt:payload.savedAt,expiresAt:payload.expiresAt}):reply({error:"A cópia mudou durante o envio. Atualize e tente novamente."},409);
 }catch{return reply({error:"Cópia em nuvem não confirmada. O rascunho local foi preservado."},503);}
}
