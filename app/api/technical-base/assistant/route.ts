import { NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";

const PROCEDURES = [
  { id:"vacuo", title:"Vácuo e desidratação", keywords:["vacuo","microns","desidratacao"], guidance:"Conferir o procedimento do fabricante; utilizar vacuômetro calibrado e registrar pressão absoluta e teste de subida. Não usar somente tempo de bomba como critério.", source:"Procedimento interno de referência; confirmar manual oficial." },
  { id:"estanqueidade", title:"Teste de estanqueidade", keywords:["estanqueidade","nitrogenio","vazamento","pressurizacao"], guidance:"Isolar componentes conforme fabricante; usar nitrogênio seco com regulador; verificar limites de pressão, temperatura e duração do ensaio; registrar leituras. Nunca pressurizar com oxigênio.", source:"Procedimento interno de referência; confirmar manual oficial." },
  { id:"eletrica", title:"Segurança elétrica", keywords:["eletrica","tensao","placa","disjuntor","choque"], guidance:"Desenergizar, bloquear e sinalizar; verificar ausência de tensão com instrumento apropriado; seguir NR-10 e documentação do fabricante.", source:"Procedimento interno de referência; NR-10." },
] as const;
const normalize=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export async function POST(request: Request) {
  const session=await readSession(request);
  if (!session) return NextResponse.json({success:false,error:"Não autorizado."},{status:401});
  const body=await request.json().catch(()=>null);
  const question=typeof body?.question==="string"?body.question.trim():"";
  if (!question || question.length>1500) return NextResponse.json({success:false,error:"Informe uma pergunta de até 1500 caracteres."},{status:400});
  const normalized=normalize(question);
  const matches=PROCEDURES.map(p=>({...p,score:p.keywords.filter(k=>normalized.includes(k)).length})).filter(p=>p.score>0).sort((a,b)=>b.score-a.score);
  const match=matches[0];
  return NextResponse.json({
    success:true, mode:"assisted_knowledge_search", aiEnabled:false,
    answer:match ? match.guidance : "Não há documentação técnica homologada suficiente para responder com segurança. Informe fabricante, modelo, código de erro e sintoma; consulte o manual oficial e registre medições verificadas.",
    sources:match?[{title:match.title,reference:match.source}]:[],
    needsTechnicianVerification:true,
    notice:"Assistente de consulta técnica baseado em regras. Não utiliza modelo de IA nesta etapa e não deve autorizar intervenções perigosas.",
  });
}
