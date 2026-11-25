import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { chatAccess, chatSettings, changeChat, readChat } from "../../../../lib/chatdesk-store";
import { assertActiveWhatsAppCompany, evolutionConnection } from "../../../../lib/evolution-tenant";
import { getOpenAiCredential, readStoredOpenAiIntegration } from "../../../../lib/openai-credential";
import { readWhatsAppMediaForReview } from "../../../../lib/whatsapp-media-analysis";
import { mediaTrialAttachment, mediaTrialAge, mediaTrialStart } from "../../../../lib/polartech-media-trial";

export const runtime = "nodejs";
export const maxDuration = 60;
const origin = "https://polartech.proar.online";
const respond = (body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const approvedContact = "6c1ba65ee4375f919f2962c8f5fe9b59c739f4cea2b8383cdf5a99622b6edcfe";

export async function POST(request:NextRequest) {
  if (request.nextUrl.origin!==origin || request.headers.get("origin")!==origin || request.headers.get("sec-fetch-site")!=="same-origin") return respond({error:"Origem inválida."},403);
  const access=chatAccess(request);
  if (!access?.actor.admin || access.companyId!=="polartech-principal" || process.env.PROAR_EVOLUTION_AUTOMATION_ENABLED!=="true") return respond({error:"Teste interno indisponível."},403);
  try {
    if (Number(request.headers.get("content-length")||0)>2048) return respond({error:"Solicitação inválida."},400);
    const plain=await request.text();
    if (plain.length>2048) return respond({error:"Solicitação inválida."},400);
    const body=JSON.parse(plain);
    if (!body || body.confirmSynthetic!==true || typeof body.id!=="string" || !/^[a-zA-Z0-9_-]{1,512}$/.test(body.id)) return respond({error:"Selecione e confirme um arquivo fictício de teste."},400);
    const settings=await chatSettings(access.companyId);
    const phone=settings.botTestPhone;
    if (!settings.botEnabled || !phone || createHash("sha256").update(access.companyId+":"+phone).digest("hex")!==approvedContact) return respond({error:"O número interno autorizado não está configurado."},403);

    if (!mediaTrialAttachment(await readChat(access.companyId,phone),body.id,Date.now())) return respond({error:"Arquivo não elegível ou este tipo de teste já foi usado."},409);
    const stored=await readStoredOpenAiIntegration(access.companyId);
    if (!stored?.enabled || stored.validation_status!=="valid" || stored.validation_source!=="company") return respond({error:"Valide a credencial própria da PolarTech em Configurações → Inteligência Artificial."},412);
    const credential=await getOpenAiCredential(access.companyId);
    const connection=await evolutionConnection(access.companyId);
    if (credential?.source!=="company" || !connection) return respond({error:"A chave própria ou a conexão WhatsApp não está disponível."},412);

    // Reserve one trial of each type before any provider request. Never retry an
    // attempt after an uncertain outcome, even if the browser disconnected.
    const reserved=await changeChat(access.companyId,phone,current=>{
      const file=mediaTrialAttachment(current,body.id,Date.now());
      if (!current || !file) return null;
      return {...current,mediaTrial:{...current.mediaTrial,[file.kind]:{id:file.id,at:new Date().toISOString(),state:"processing"}}};
    });
    const picked=reserved.chat?.messages.find(m=>m.direction==="in" && m.id===body.id);
    const kind=picked?.mediaKind;
    if (!reserved.changed || !picked || (kind!=="foto" && kind!=="áudio")) return respond({error:"Arquivo não elegível ou este tipo de teste já foi usado."},409);
    const result=await readWhatsAppMediaForReview({companyId:access.companyId,mediaProcessingEnabled:true,pilotPhone:phone,activatedAt:mediaTrialStart,manualReviewWindowMs:mediaTrialAge},
      {id:picked.id,phone,instance:connection.config.instance,kind,at:picked.at},connection.config,{getCredential:async()=>credential});
    await changeChat(access.companyId,phone,current=>{
      const trial=current?.mediaTrial?.[kind];
      if (!current || !trial || trial.id!==picked.id || trial.state!=="processing") return null;
      return {...current,mediaTrial:{...current.mediaTrial,[kind]:{...trial,state:result.state}}};
    });
    return result.state==="review" ? respond({state:result.state,source:result.source,text:result.text})
      : respond({state:result.state,reason:result.reason,error:"Não foi possível analisar este arquivo no teste. A tentativa não será repetida automaticamente."},422);
  } catch { return respond({error:"Não foi possível concluir o teste. Nenhum novo envio será tentado automaticamente."},503); }
}
