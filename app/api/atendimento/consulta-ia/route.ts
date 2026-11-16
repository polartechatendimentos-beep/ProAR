import { NextRequest, NextResponse } from "next/server";
import { GET as getState } from "../../state/route";
import { chatAccess } from "../../../../lib/chatdesk-store";
import { hasPermission } from "../../../../lib/permissions";
import { catalogForChat, scheduledSlotsForChat } from "../../../../lib/chatdesk-live-consultation";
export const runtime="nodejs";
export async function GET(request:NextRequest) {
 const access=chatAccess(request);
 if(!access)return NextResponse.json({error:"Usuário sem acesso à central."},{status:403});
 if(!hasPermission(access.session,"os.visualizar"))return NextResponse.json({error:"Sem permissão para consultar agendamentos."},{status:403});
 const answer=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
 try {
  const res=await getState(request);
  const value=await res.json();
  if(!res.ok||!value.state)return answer({error:"Dados operacionais indisponíveis."},503);
  const state=value.state;
  const search=String(request.nextUrl.searchParams.get("q")||"").slice(0,100);
  const date=String(request.nextUrl.searchParams.get("date")||"");
  const catalog=catalogForChat(state.moduleRecords||{},search);
  const occupied=scheduledSlotsForChat(state.serviceOrders||[],date);
  return answer({catalog,occupied,date,notice:"Horários ocupados conforme OS registradas. Esta consulta não comprova disponibilidade de equipe, deslocamento ou capacidade de atendimento. Nenhuma reserva foi feita.",source:"ProAR — empresa autenticada"});
 }catch {return answer({error:"Não foi possível consultar catálogo e agenda."},503);}
}
