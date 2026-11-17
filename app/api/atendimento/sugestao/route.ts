import {NextRequest,NextResponse} from 'next/server';
import {chatAccess,readChat,chatSettings,saveChatSettings} from '@/lib/chatdesk-store';
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
  const settings=await chatSettings(access.companyId);
  if(body.action==='remember'){
   if(!access.actor.admin)return NextResponse.json({error:'Somente o administrador pode aprovar referências para a empresa.'},{status:403});
   const text=String(body.text||'').trim();if(text.length<10||text.length>1200)return NextResponse.json({error:'Use um modelo de 10 a 1.200 caracteres, sem dados pessoais.'},{status:400});
   const rows=settings.quickReplies||[];
   if(rows.some(row=>row.text===text))return NextResponse.json({saved:true});
   if(rows.length>=30)return NextResponse.json({error:'Limite de 30 modelos. Revise as respostas rápidas em Assistente.'},{status:409});
   await saveChatSettings(access.companyId,{...settings,quickReplies:[...rows,{shortcut:'/modelo'+crypto.randomUUID().slice(0,8),sector:chat.sector,text}]});
   return NextResponse.json({saved:true},{headers:{'Cache-Control':'private, no-store'}});
  }
  const mode=String(body.mode||'responder');if(!['responder','completar','melhorar','cordial','direto'].includes(mode))throw new Error('Modo inválido.');
  const suggestion=await suggestChatReply(access.companyId,chat.messages.filter(m=>m.direction==='in'||m.direction==='out'),String(body.draft||'').slice(0,3000),mode,(settings.quickReplies||[]).filter(row=>row.sector==='Todos'||row.sector===chat.sector).map(row=>row.text));
  return NextResponse.json({suggestion,reviewRequired:true},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Sugestão indisponível.'},{status:503});}
}
