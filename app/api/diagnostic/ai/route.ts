import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../lib/permissions";
import { getOpenAiCredential } from "../../../../lib/openai-credential";
import { validateManufacturerCode } from "../../../../lib/diagnostic-brand-rules";

export const runtime="nodejs";

type DiagnosticRequest={
  brand?:string;
  equipmentType?:string;
  model?:string;
  serialNumber?:string;
  code?:string;
  blinkPattern?:string;
  symptoms?:string;
  serviceRequest?:string;
  measurements?:string;
  matchedReference?:Record<string,unknown>|null;
  manufacturerValidation?:Record<string,unknown>|null;
};

function responseText(payload:any){
  if(typeof payload?.output_text==="string") return payload.output_text;
  for(const item of payload?.output||[]) {
    for(const part of item?.content||[]) if(part?.type==="output_text"&&typeof part.text==="string") return part.text;
  }
  return "";
}

function parseJson(value:string){
  const cleaned=value.trim().replace(/^\`\`\`(?:json)?/i,"").replace(/\`\`\`$/,"").trim();
  return JSON.parse(cleaned);
}

export async function POST(request:NextRequest){
  const access=requirePermission(request,"os.visualizar");
  if(!access.ok) return NextResponse.json({error:access.error},{status:access.status});
  const scope=sessionCompany(access.session);
  if(!scope.ok) return NextResponse.json({error:scope.error},{status:scope.status});

  const body=await request.json().catch(()=>({})) as DiagnosticRequest;
  if(!String(body.symptoms||body.code||body.blinkPattern||"").trim()) {
    return NextResponse.json({error:"Informe pelo menos um sintoma, código de erro ou padrão de piscadas."},{status:400});
  }

  const credential=await getOpenAiCredential(scope.companyId);
  if(!credential) return NextResponse.json({error:"Configure a Inteligência Artificial em Configurações antes de usar o diagnóstico assistido.",code:"AI_NOT_CONFIGURED"},{status:503});

  const manufacturerValidation=validateManufacturerCode({brand:body.brand,model:body.model,code:body.code,blinkPattern:body.blinkPattern});
  const context={
    equipment:{
      brand:String(body.brand||"").trim(),
      equipmentType:String(body.equipmentType||"").trim(),
      model:String(body.model||"").trim(),
      serialNumber:String(body.serialNumber||"").trim(),
    },
    failure:{
      code:String(body.code||"").trim(),
      blinkPattern:String(body.blinkPattern||"").trim(),
      symptoms:String(body.symptoms||"").trim(),
      serviceRequest:String(body.serviceRequest||"").trim(),
      measurements:String(body.measurements||"").trim(),
    },
    verifiedReference:manufacturerValidation.canUseAsConfirmedReference ? (body.matchedReference||null) : null,
    manufacturerValidation,
  };

  const prompt=`Você é um assistente técnico HVAC-R para apoiar um técnico em campo.
Analise o contexto JSON abaixo. Use pesquisa na web quando houver marca/modelo/código/piscadas e priorize manual técnico, boletim de serviço ou documentação oficial do fabricante.
REGRAS:
- Nunca invente o significado de código de erro, sequência de LEDs, pressão, temperatura, carga de refrigerante ou procedimento específico do fabricante.
- Respeite manufacturerValidation. Se status="needs-extraction", NÃO interprete o valor informado como código final: explique como obter o código correto para aquele modelo/controlador e mantenha referenceConfidence="nao_confirmada".
- Como fonte complementar, você pode consultar https://www.webarcondicionado.com.br/codigos-de-erro e os PDFs/manuais por marca apontados nessa página, mas prefira documentação oficial do fabricante quando disponível.
- Ao pesquisar, inclua marca, modelo/família, tipo (Split/Cassete/Piso Teto/VRF), capacidade e se o sinal aparece na evaporadora ou condensadora. Não transfira uma tabela de uma família para outra.
- Se status="needs-model", deixe explícito que o significado depende da família/modelo e não confirme a falha até localizar documentação correspondente.
- Para Daikin, não assuma que todos os códigos são letra+número: manuais também usam combinações como UA, EA, AF e CJ. Número isolado diferente de 00 deve ser tratado como leitura incompleta/pista, não como código final.
- Se a documentação localizada não confirmar a associação marca+modelo+código/piscadas, marque referenceConfidence="nao_confirmada".
- Diferencie "causa provável" de "causa confirmada". Probabilidade é uma estimativa de triagem, não uma medição.
- Recomende sequência de testes objetivos antes de trocar peças.
- Não recomende bypass de proteção elétrica, pressostato, sensor, fusível ou dispositivo de segurança.
- Para atividade elétrica/refrigerante, inclua avisos de desenergização, EPI e procedimentos técnicos aplicáveis.
- Responda SOMENTE JSON válido, sem markdown.

FORMATO:
{
  "summary":"resumo curto",
  "severity":"Baixa|Média|Alta|Crítica",
  "referenceConfidence":"confirmada|parcial|nao_confirmada",
  "codeMeaning":"significado confirmado ou texto informando que não foi confirmado",
  "probableCauses":[{"cause":"texto","probability":0-100,"why":"motivo"}],
  "verificationTests":[{"test":"teste","expected":"o que observar","tools":["ferramenta"]}],
  "solutions":[{"action":"ação","condition":"quando aplicar"}],
  "requiredTools":["ferramenta"],
  "safetyWarnings":["aviso"],
  "sourceUrls":["https://..."],
  "technicalNote":"texto objetivo pronto para anexar à OS"
}

CONTEXTO:
${JSON.stringify(context)}`;

  try{
    const aiResponse=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{Authorization:`Bearer ${credential.apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"gpt-4.1-mini",
        tools:[{type:"web_search",search_context_size:"low"}],
        tool_choice:"auto",
        input:prompt,
        text:{format:{type:"json_object"}},
        max_output_tokens:2200,
      }),
      signal:AbortSignal.timeout(45000),
    });
    const payload=await aiResponse.json().catch(()=>({}));
    if(!aiResponse.ok) {
      console.error("HVAC diagnostic AI error",payload);
      return NextResponse.json({error:"A IA de diagnóstico não respondeu corretamente."},{status:502});
    }
    const raw=responseText(payload);
    if(!raw) return NextResponse.json({error:"A IA não retornou um diagnóstico estruturado."},{status:502});
    const diagnostic=parseJson(raw);
    return NextResponse.json({
      diagnostic,
      generatedAt:new Date().toISOString(),
      source:credential.source,
      webSearchUsed:true,
    });
  }catch(error){
    console.error("HVAC diagnostic request failed",error);
    return NextResponse.json({error:"Não foi possível concluir o diagnóstico assistido neste momento."},{status:504});
  }
}
