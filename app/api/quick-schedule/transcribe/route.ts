import {NextRequest,NextResponse} from "next/server";
import {requirePermission} from "../../../../lib/permissions";
import {getOpenAiCredential,safeCompanyId} from "../../../../lib/openai-credential";
export const runtime="nodejs";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:NextRequest){
 const access=requirePermission(request,"os.editar");if(!access.ok)return reply({error:access.error},access.status);
 const form=await request.formData().catch(()=>null);const file=form?.get("audio");
 if(!(file instanceof File))return reply({error:"Envie um áudio para transcrição."},400);
 if(file.size>15*1024*1024)return reply({error:"O áudio precisa ter até 15 MB."},413);
 if(!/^audio\//.test(file.type)&&!/^video\/webm$/.test(file.type))return reply({error:"Formato de áudio não suportado."},415);
 const credential=await getOpenAiCredential(safeCompanyId(access.session.companyId));
 if(!credential)return reply({error:"IA não configurada. Use a transcrição nativa do navegador ou configure em Inteligência Artificial."},503);
 try{
  const upstream=new FormData();upstream.append("file",file,file.name||"captura.webm");upstream.append("model","whisper-1");upstream.append("language","pt");
  const response=await fetch("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:"Bearer "+credential.apiKey},body:upstream,cache:"no-store"});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)return reply({error:result?.error?.message||"Não foi possível transcrever o áudio."},502);
  return reply({text:typeof result.text==="string"?result.text.trim():""});
 }catch{return reply({error:"Falha na transcrição do áudio."},502)}
}
