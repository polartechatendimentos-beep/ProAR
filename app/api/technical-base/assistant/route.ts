import {NextRequest,NextResponse} from 'next/server';
import {technicalBaseAccess} from '@/lib/technical-base-access';
import {answerTechnicalQuestion} from '@/lib/field/technical-knowledge';
export const runtime='nodejs';
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:NextRequest){
 const access=technicalBaseAccess(request);if(!access.ok)return reply({success:false,error:access.error},access.status);
 const raw=await request.text();if(raw.length>12000)return reply({success:false,error:'Reduza a consulta técnica.'},413);
 let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return reply({success:false,error:'JSON inválido.'},400);}
 if(!body||typeof body!=='object'||typeof body.question!=='string'||!body.question.trim()||body.question.length>1500)return reply({success:false,error:'Informe uma pergunta de até 1500 caracteres.'},400);
 return reply(answerTechnicalQuestion({symptoms:body.question,brand:typeof body.brand==='string'?body.brand:'',model:typeof body.model==='string'?body.model:'',code:typeof body.code==='string'?body.code:'',equipmentType:typeof body.equipmentType==='string'?body.equipmentType:''}));
}
