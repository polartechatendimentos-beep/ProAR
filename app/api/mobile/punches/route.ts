import { NextRequest, NextResponse } from "next/server";
import { hasPermission, sessionFromRequest } from "../../../../lib/permissions";
import { routeContext, routeRest } from "../../../../lib/work-route-store";
import { RouteError } from "../../../../lib/work-routes";
import { decryptWorkSelfie } from "../../../../lib/work-selfie";
import { requiredSecret } from "../../../../lib/security-env";

const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"}});
export async function GET(request:NextRequest){
  const session=sessionFromRequest(request);if(!session)return reply({error:"Sessão inválida."},401);
  try{const c=await routeContext(session),requested=request.nextUrl.searchParams.get("employeeId")||c.actor?.employeeId;
    if(!requested||!c.employees.some(e=>e.id===requested))return reply({error:"Funcionário não encontrado."},404);
    if(requested!==c.actor?.employeeId&&!hasPermission(session,"rotas.visualizar"))return reply({error:"Sem permissão para consultar marcações de terceiros."},403);
    const prefix=`work-punch-v1:${Buffer.from(c.company).toString("hex")}:${Buffer.from(requested).toString("hex")}:`,eventId=request.nextUrl.searchParams.get("evidence"),date=request.nextUrl.searchParams.get("date");
    if(eventId&&!/^[A-Za-z0-9-]{8,100}$/.test(eventId))return reply({error:"Marcação inválida."},400);
    if(eventId&&!/^\d{4}-\d{2}-\d{2}$/.test(date||""))return reply({error:"Data da marcação inválida."},400);
    const response=await routeRest(c.db,`proar_state?id=${eventId?"eq."+encodeURIComponent(prefix+date+":"+eventId):"like."+encodeURIComponent(prefix+"*")}&select=payload&limit=1001`);
    if(!response.ok)throw new Error("DATABASE_UNAVAILABLE");
    const rows=await response.json() as {payload:Record<string,unknown>}[];
    const records=rows.map(row=>row.payload).filter(item=>item.companyId===c.company&&item.employeeId===requested);
    if(eventId){const evidence=records[0]?.selfieEvidence as {cipher:string}|undefined;if(!evidence)return reply({error:"Esta marcação não contém selfie."},404);
      return reply({image:decryptWorkSelfie(evidence.cipher,requiredSecret("PROAR_SESSION_SECRET"),c.company),method:"selfie-evidence",faceRecognitionVerified:false});}
    return reply({punches:records.sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,1000).map(({selfieEvidence,...item})=>({...item,hasSelfie:Boolean(selfieEvidence)})),truncated:records.length>1000,compliance:"operational-only",notice:"Comprovante operacional de jornada. Não substitui comprovante REP-P assinado."});
  }catch(error){return reply({error:error instanceof RouteError?error.message:"Não foi possível consultar as marcações."},error instanceof RouteError?error.status:503);}
}
