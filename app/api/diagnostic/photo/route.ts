import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { getOpenAiCredential, safeCompanyId } from "../../../../lib/openai-credential";

export async function POST(request:NextRequest){
  const access=requirePermission(request,"os.visualizar");
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const image=String(body.image||"");
  if(!image.startsWith("data:image/"))return NextResponse.json({error:"Envie uma foto válida do display, LEDs, placa ou etiqueta."},{status:400});
  if(image.length>11_000_000)return NextResponse.json({error:"A imagem enviada é muito grande."},{status:413});
  const credential=await getOpenAiCredential(safeCompanyId(access.session.companyId));
  if(!credential)return NextResponse.json({error:"Configure a IA em Configurações → Inteligência Artificial."},{status:503});
  const context={
    brand:String(body.brand||""),model:String(body.model||""),equipmentType:String(body.equipmentType||""),
    photoKind:String(body.photoKind||"display"),symptom:String(body.symptom||""),
  };
  const prompt=`Analise esta foto técnica HVAC-R com postura conservadora. Contexto: ${JSON.stringify(context)}.
Retorne JSON puro com:
photoKind, visibleText, detectedBrand, detectedModel, detectedCode, blinkIndicators, componentHints, confidence, warnings.
Regras:
- Leia somente o que está realmente visível.
- Não invente código, modelo, quantidade de piscadas, posição de LED ou componente.
- Se for uma foto estática de LEDs, descreva apenas LEDs acesos/apagados visíveis; não deduza sequência de piscadas a partir de uma única foto.
- Se o código estiver parcial, mantenha parcial e confidence="baixa".
- Nunca conclua troca de placa/compressor apenas pela imagem.
- warnings deve lembrar quando é necessária confirmação por manual/modelo e segurança elétrica.`;
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${credential.apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"gpt-4.1-mini",
        input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image,detail:"high"}]}],
        text:{format:{type:"json_object"}},
      }),
    });
    const payload=await response.json();
    if(!response.ok)throw new Error(payload?.error?.message||"Falha ao analisar a foto.");
    const output=payload.output_text||payload.output?.flatMap((item:{content?:{text?:string}[]})=>item.content||[]).map((item:{text?:string})=>item.text||"").join("")||"{}";
    return NextResponse.json({analysis:JSON.parse(output)});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Não foi possível analisar a foto técnica."},{status:502});
  }
}
