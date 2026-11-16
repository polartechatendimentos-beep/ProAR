import {NextRequest,NextResponse} from 'next/server';
import {chatAccess,readChat} from '@/lib/chatdesk-store';
import {canReadChat} from '@/lib/chatdesk-local';
import {suggestChatReply} from '@/lib/chatdesk-ai';
import {assertAuthOrigin,readAuthBody} from '@/lib/auth-request-security';
export const runtime='nodejs';
export async function POST(request:NextRequest){
 try{
  assertAuthOrigin(request);
  const access=chatAccess(request);if(!access)return NextResponse.json({error:'Não autorizado.'},{status:403});
  const body=await readAuthBody(request),chat=await readChat(access.companyId,String(body.phone||''));
  if(!chat||!canReadChat(access.actor,chat)||(!access.actor.admin&&!access.actor.writeSectors.includes(chat.sector)))return NextResponse.json({error:'Atendimento indisponível.'},{status:403});
  if(chat.optOut)return NextResponse.json({error:'Cliente solicitou interrupção das mensagens.'},{status:409});
  const mode=String(body.mode||'responder');if(!['responder','completar','melhorar','cordial','direto'].includes(mode))throw new Error('Modo inválido.');
  const suggestion=await suggestChatReply(access.companyId,chat.messages.filter(m=>m.direction==='in'||m.direction==='out'),String(body.draft||'').slice(0,3000),mode);
  return NextResponse.json({suggestion,reviewRequired:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Sugestão indisponível.'},{status:503});}
}
