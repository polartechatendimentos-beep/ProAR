import {NextRequest,NextResponse} from "next/server";
import {requirePermission} from "../../../../lib/permissions";
import {getOpenAiCredential,safeCompanyId} from "../../../../lib/openai-credential";
export const runtime="nodejs";
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:NextRequest){
 const access=requirePermission(request,"os.editar");if(!access.ok)return reply({error:access.error},access.status);
 const raw=await request.text();if(raw.length>12000)return reply({error:"A descrição ficou muito longa. Reduza para até 3.000 caracteres."},413);
 let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return reply({error:"Solicitação inválida."},400)}
 const text=typeof body.text==="string"?body.text.trim():"";
 if(!text||text.length>3000)return reply({error:"Digite ou transcreva a solicitação (máximo de 3.000 caracteres)."},400);
 const credential=await getOpenAiCredential(safeCompanyId(access.session.companyId));
 if(!credential)return reply({error:"IA não configurada. Configure em Configurações → Inteligência Artificial."},503);
 const now=typeof body.now==="string"?body.now.slice(0,40):new Date().toISOString();
 const timezone="America/Sao_Paulo";
 const prompt=[
 "Extraia do texto um possível agendamento de manutenção de ar-condicionado.",
 "Retorne somente JSON no formato especificado; não invente campos ausentes, use null.",
 "Resolva datas relativas com a data/hora informada, considerando fuso America/Sao_Paulo.",
 "Não trate uma data passada como futura; se a fala for ambígua, deixe data_iso null.",
 "Não conclua diagnóstico nem complete endereço ou telefone que não foram informados.",
 "JSON: {cliente:{nome_citado:string|null,telefone:string|null},endereco:{logradouro:string|null,numero:string|null,bairro:string|null,cidade:string|null,complemento:string|null},atendimento:{tipo_servico:string|null,equipamento:string|null,data_iso:string|null,hora_inicio:string|null,tecnico_citado:string|null,urgencia:string|null,observacoes:string|null}}.",
 "Agora: "+now+"; fuso: "+timezone+".",
 "Texto recebido: "+text
 ].join("\n");
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+credential.apiKey,"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify({model:"gpt-4.1-mini",input:prompt,text:{format:{type:"json_object"}}})});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)return reply({error:payload?.error?.message||"A IA não conseguiu interpretar o agendamento."},502);
  const output=payload.output_text||payload.output?.flatMap((entry:{content?:{text?:string}[]})=>entry.content||[]).map((item:{text?:string})=>item.text||"").join("")||"{}";
  const parsed=JSON.parse(output) as Record<string,any>;
  const client=parsed.cliente||{},address=parsed.endereco||{},appointment=parsed.atendimento||{};
  const clean=(value:unknown,max=180)=>typeof value==="string"&&value.trim()?value.trim().slice(0,max):null;
  const date=clean(appointment.data_iso,10),time=clean(appointment.hora_inicio,5);
  return reply({fields:{
   client:{name:clean(client.nome_citado),phone:clean(client.telefone,30)},
   address:{street:clean(address.logradouro),number:clean(address.numero,20),neighborhood:clean(address.bairro),city:clean(address.cidade),complement:clean(address.complemento)},
   appointment:{service:clean(appointment.tipo_servico),equipment:clean(appointment.equipamento),date:/^\d{4}-\d{2}-\d{2}$/.test(date||"")?date:null,time:/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time||"")?time:null,technician:clean(appointment.tecnico_citado),urgency:clean(appointment.urgencia,30),notes:clean(appointment.observacoes,600)}
  }});
 }catch{return reply({error:"Falha ao interpretar o texto. Tente novamente ou preencha manualmente."},502)}
}
