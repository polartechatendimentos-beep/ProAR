import {createHash,randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {procurementAccess} from "@/lib/procurement/access";
import {hasPermission} from "@/lib/permissions";
import {routeContext,routeRest} from "@/lib/work-route-store";
import {commitNeonOperationalState,PRIMARY_DATABASE_URL} from "@/lib/supabase-rest";
import {loadBiddingDocument,biddingTenderOptions} from "@/lib/bidding-document-store";
import {DOCUMENT_CATEGORIES} from "@/lib/bidding-documents";
import {getOpenAiCredential,safeCompanyId} from "@/lib/openai-credential";
import {calculateBiddingFinancialRatios,type FinancialInputs,type FinancialRatio} from "@/lib/bidding-financial-audit";
export const runtime="nodejs";
export const maxDuration=60;
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
type Requirement={id:string;category:string;description:string;threshold:string;unit:string;documentId:string;sourcePage?:number;sourceQuote?:string;phase?:string;dueDate?:string;technicalEvidence?:{issuer:string;service:string;quantity:string;unit:string;startDate:string;endDate:string;professionalRecord:string}};
type Approval={status:"pending"|"approved"|"rejected";submittedAt:string;submittedBy:string;reviewedAt?:string;reviewedBy?:string;note?:string};
type FinancialAuditRecord=FinancialInputs&{ratios:FinancialRatio[];updatedAt:string;updatedBy:string};
type Stored={companyId:string;tenderId:string;_revision:number;updatedAt:string;updatedBy:string;requirements:Requirement[];approval?:Approval;financialAudit?:FinancialAuditRecord};
const keyFor=(company:string,tenderId:string)=>"bidding-requirements-v1:"+createHash("sha256").update(company+":"+tenderId).digest("hex");
const readList=(value:unknown):Requirement[]=>{
 if(!Array.isArray(value)||value.length>100)throw new Error("Informe até 100 exigências do edital.");
 return value.map((raw,index)=>{
  if(!raw||typeof raw!=="object")throw new Error("Exigência inválida.");
  const item=raw as Record<string,unknown>,description=String(item.description||"").trim(),category=String(item.category||"Outros"),threshold=String(item.threshold||"").trim(),unit=String(item.unit||"").trim(),documentId=String(item.documentId||"");
  if(description.length<4||description.length>500)throw new Error("Cada exigência deve ter de 4 a 500 caracteres.");
  if(!DOCUMENT_CATEGORIES.includes(category as typeof DOCUMENT_CATEGORIES[number]))throw new Error("Categoria inválida.");
  if(threshold.length>80||unit.length>40)throw new Error("Limite excedido em quantidade ou unidade.");
  const sourcePage=Number(item.sourcePage||0),sourceQuote=String(item.sourceQuote||"").trim(),phase=String(item.phase||""),dueDate=String(item.dueDate||"");
   if(sourcePage&&!Number.isSafeInteger(sourcePage))throw new Error("Página de referência inválida.");
   if(sourceQuote.length>500||phase.length>60||dueDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||!Number.isFinite(Date.parse(dueDate))))throw new Error("Referência ou prazo inválido.");
   const t=(item.technicalEvidence||{}) as Record<string,unknown>,technicalEvidence={issuer:String(t.issuer||"").trim().slice(0,200),service:String(t.service||"").trim().slice(0,500),quantity:String(t.quantity||"").trim().slice(0,80),unit:String(t.unit||"").trim().slice(0,40),startDate:String(t.startDate||"").slice(0,10),endDate:String(t.endDate||"").slice(0,10),professionalRecord:String(t.professionalRecord||"").trim().slice(0,120)};
   return {id:/^[0-9a-f-]{36}$/.test(String(item.id||""))?String(item.id):randomUUID(),category,description,threshold,unit,documentId,sourcePage:sourcePage||undefined,sourceQuote:sourceQuote||undefined,phase:phase||undefined,dueDate:dueDate||undefined,technicalEvidence:category==="Atestado técnico"?technicalEvidence:undefined};
 });
};
export async function GET(request:NextRequest){
 const access=procurementAccess(request);if(!access.ok)return json({error:access.error},access.status);
 try{
  const c=await routeContext(access.session),tenderId=String(request.nextUrl.searchParams.get("tenderId")||"");
  if(!tenderId||!biddingTenderOptions(c.state).some(item=>item.id===tenderId))return json({error:"Salve e selecione um edital desta empresa."},422);
  const result=await routeRest(c.db,"proar_state?id=eq."+encodeURIComponent(keyFor(c.company,tenderId))+"&select=payload&limit=1");
  if(!result.ok)throw new Error("Consulta indisponível");
  const stored=(await result.json())[0]?.payload as Stored|undefined;
  if(stored&&(stored.companyId!==c.company||stored.tenderId!==tenderId))return json({error:"Vínculo de empresa inválido."},403);
  return json({requirements:stored?.requirements||[],revision:stored?._revision||0,approval:stored?.approval||null,financialAudit:stored?.financialAudit||null,canEdit:hasPermission(access.session,"licitacoes.editar"),canApprove:hasPermission(access.session,"aprovacoes.aprovar")});
 }catch{return json({error:"Não foi possível carregar as exigências do edital."},503);}
}
export async function POST(request:NextRequest){
 const access=procurementAccess(request);if(!access.ok)return json({error:access.error},access.status);
 if(!hasPermission(access.session,"licitacoes.editar")&&!hasPermission(access.session,"aprovacoes.aprovar"))return json({error:"Sem permissão para editar ou aprovar exigências."},403);
 if(request.headers.get("origin")!==request.nextUrl.origin)return json({error:"Origem não autorizada."},403);
 try{
  const raw=await request.text();if(raw.length>320000)return json({error:"Solicitação muito grande."},413);
  const body=JSON.parse(raw),c=await routeContext(access.session),tenderId=String(body.tenderId||"");
  if(!tenderId||!biddingTenderOptions(c.state).some(item=>item.id===tenderId))return json({error:"Salve e selecione um edital desta empresa."},422);
  if(body.action==="extract-technical"){
   if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para analisar atestado."},403);
   const text=String(body.text||"");if(text.length<40||text.length>250000)return json({error:"Texto do atestado inválido ou fora do limite."},422);
   const credential=await getOpenAiCredential(safeCompanyId(c.company));if(!credential)return json({error:"Configure a IA em Configurações → Inteligência Artificial."},503);
   const prompt="Extraia somente dados legíveis de atestado de capacidade técnica. Retorne JSON com issuer, service, quantity, unit, startDate, endDate, professionalRecord, page, quote, warnings. Não estime quantidade nem período; não transforme unidade. Datas em AAAA-MM-DD somente se explícitas. Referencie a página [Página N] e uma citação literal curta. Use string vazia quando não conseguir confirmar. Não conclua aderência ao edital. Texto:\n"+text;
   const upstream=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+credential.apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",instructions:"Leia atestados com cautela. Não infira nem complete dados ausentes.",input:prompt,max_output_tokens:1200,text:{format:{type:"json_object"}},store:false})});
   const payload=await upstream.json();if(!upstream.ok)return json({error:"A IA não conseguiu analisar o atestado."},502);
   const output=payload.output_text||payload.output?.flatMap((item:{content?:{text?:string}[]})=>item.content||[]).map((item:{text?:string})=>item.text||"").join("")||"{}";
   try{const parsed=JSON.parse(output) as Record<string,unknown>;const fields=Object.fromEntries(["issuer","service","quantity","unit","startDate","endDate","professionalRecord"].map(key=>[key,typeof parsed[key]==="string"||typeof parsed[key]==="number"?String(parsed[key]).slice(0,500):""]));return json({fields,page:Number(parsed.page)||undefined,quote:String(parsed.quote||"").slice(0,500),warnings:Array.isArray(parsed.warnings)?parsed.warnings.slice(0,8).map(String):[],requiresHumanReview:true});}catch{return json({error:"A leitura do atestado não retornou dados estruturados."},502);}
  }
  if(body.action==="extract-financial"){
   if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para analisar balanço."},403);
   const text=String(body.text||"");if(text.length<40||text.length>250000)return json({error:"Texto contábil inválido ou fora do limite."},422);
   const credential=await getOpenAiCredential(safeCompanyId(c.company));if(!credential)return json({error:"Configure a IA em Configurações → Inteligência Artificial."},503);
   const prompt="Extraia somente valores claramente identificados em demonstrativo contábil. Retorne JSON com currentAssets, currentLiabilities, realizableLongTerm, longTermLiabilities, totalAssets, page, quote e warnings. Valores devem ser números sem separador de milhar e ponto decimal, copiando o valor literal e não calculando nem completando nada. Se não encontrar com segurança, use string vazia. page deve corresponder a [Página N]. quote deve ser uma citação literal curta. Não calcule índices e não conclua habilitação. Texto:\n"+text;
   const upstream=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+credential.apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",instructions:"Leia valores contábeis com cautela. Nunca calcule, infira ou complete valores.",input:prompt,max_output_tokens:1200,text:{format:{type:"json_object"}},store:false})});
   const payload=await upstream.json();if(!upstream.ok)return json({error:"A IA não conseguiu ler o demonstrativo. Tente novamente ou informe os valores manualmente."},502);
   const output=payload.output_text||payload.output?.flatMap((item:{content?:{text?:string}[]})=>item.content||[]).map((item:{text?:string})=>item.text||"").join("")||"{}";
   try{const parsed=JSON.parse(output) as Record<string,unknown>;const fields=Object.fromEntries(["currentAssets","currentLiabilities","realizableLongTerm","longTermLiabilities","totalAssets"].map(key=>[key,typeof parsed[key]==="string"||typeof parsed[key]==="number"?String(parsed[key]).slice(0,40):""]));return json({fields,page:Number(parsed.page)||undefined,quote:String(parsed.quote||"").slice(0,500),warnings:Array.isArray(parsed.warnings)?parsed.warnings.slice(0,8).map(String):[],requiresHumanReview:true});}catch{return json({error:"A leitura não retornou dados estruturados. Os campos não foram alterados."},502);}
  }
  if(body.action==="extract-edital"){
   if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para analisar edital."},403);
   const text=String(body.text||"");if(text.length<100||text.length>250000)return json({error:"Texto do edital inválido ou fora do limite de leitura."},422);
   const credential=await getOpenAiCredential(safeCompanyId(c.company));if(!credential)return json({error:"Configure a IA em Configurações → Inteligência Artificial."},503);
   const prompt="Extraia somente exigências obrigatórias de habilitação técnica, jurídica, fiscal, trabalhista e econômico-financeira. Use só o texto fornecido. Para cada item, retorne category, description, threshold, unit, page, quote, phase e dueDate. Categorias permitidas: "+DOCUMENT_CATEGORIES.join(", ")+". page deve usar o marcador [Página N]; quote deve ser curto e literal. Não invente requisito, quantidade, índice ou data. Use campo vazio quando ausente. phase só pode ser Impugnação, Esclarecimentos, Proposta, Sessão, Validade documental ou Outro. dueDate em AAAA-MM-DD só quando inequívoca. JSON: {requirements:[...]}.\n"+text;
   const upstream=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+credential.apiKey,"Content-Type":"application/json"},body:JSON.stringify({model:"gpt-4.1-mini",instructions:"Extraia dados do edital sem concluir habilitação e sem inventar informação.",input:prompt,max_output_tokens:4000,text:{format:{type:"json_object"}},store:false})});
   const payload=await upstream.json();if(!upstream.ok)return json({error:"A IA não conseguiu analisar o edital. Confira a configuração e tente novamente."},502);
   const output=payload.output_text||payload.output?.flatMap((item:{content?:{text?:string}[]})=>item.content||[]).map((item:{text?:string})=>item.text||"").join("")||"{}";
   try{const parsed=JSON.parse(output) as {requirements?:Record<string,unknown>[]};const requirements=(Array.isArray(parsed.requirements)?parsed.requirements:[]).slice(0,100).map(item=>{const category=String(item.category||"Outros");return {id:randomUUID(),category:DOCUMENT_CATEGORIES.includes(category as typeof DOCUMENT_CATEGORIES[number])?category:"Outros",description:String(item.description||"").trim().slice(0,500),threshold:String(item.threshold||"").trim().slice(0,80),unit:String(item.unit||"").trim().slice(0,40),documentId:"",sourcePage:Number(item.page)||undefined,sourceQuote:String(item.quote||"").trim().slice(0,500),phase:String(item.phase||"").slice(0,60),dueDate:String(item.dueDate||"").slice(0,10)};}).filter(item=>item.description.length>=4);return json({requirements,requiresHumanReview:true,source:"openai"});}catch{return json({error:"A resposta da IA não veio em formato válido. Nenhuma matriz foi alterada."},502);}
  }
  const key=keyFor(c.company,tenderId),existingResult=await routeRest(c.db,"proar_state?id=eq."+encodeURIComponent(key)+"&select=payload&limit=1");
  if(!existingResult.ok)throw new Error("Consulta indisponível");
  const old=(await existingResult.json())[0]?.payload as Stored|undefined;
  if(old&&(old.companyId!==c.company||old.tenderId!==tenderId))return json({error:"Vínculo de empresa inválido."},403);
  if(!old&&(body.action==="submit"||body.action==="decision"||body.action==="financial-audit"))return json({error:"Salve primeiro as exigências deste edital."},404);
  const revision=Number(old?._revision||0);
  if(Number(body.expectedRevision||0)!==revision)return json({error:"As exigências foram alteradas em outra sessão. Atualize antes de salvar."},409);
  const actor=access.session.username,now=new Date().toISOString();
  let next:Stored;
  if(body.action==="financial-audit"){
    if(!old)return json({error:"Salve primeiro a matriz deste edital."},404);
    if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para auditar índices."},403);
    const rawInput=(body.financial||{}) as Record<string,unknown>;
    const parseNumber=(rawValue:string)=>Number(rawValue.includes(",")?rawValue.replace(/\\./g,"").replace(",", "."):rawValue);
    const numeric=(key:string)=>{const rawValue=String(rawInput[key]??"").trim();if(!rawValue)throw new Error("Preencha todos os valores do balanço.");const value=parseNumber(rawValue);if(!Number.isFinite(value)||value<0||value>1e15)throw new Error("Valor financeiro inválido: "+key);return value;};
    const minimum=(key:string)=>{const value=String(rawInput[key]||"").trim();if(!value)return "";const parsed=parseNumber(value);if(!Number.isFinite(parsed)||parsed<0||parsed>1e6)throw new Error("Índice mínimo inválido: "+key);return String(parsed);};
    const documentIds=Array.isArray(rawInput.documentIds)?rawInput.documentIds.slice(0,20).map(String):[];
    if(!documentIds.length)return json({error:"Vincule ao menos um balanço ou DRE antes de salvar a auditoria."},422);
    for(const id of documentIds){const doc=await loadBiddingDocument(c.db,c.company,id);if(!doc||!doc.uploaded||doc.tenderId&&doc.tenderId!==tenderId||!["Balanço Patrimonial","DRE","Índices econômico-financeiros"].includes(doc.category))return json({error:"Vincule balanço/DRE real desta empresa e edital."},422);}
    const input:FinancialInputs={currentAssets:numeric("currentAssets"),currentLiabilities:numeric("currentLiabilities"),realizableLongTerm:numeric("realizableLongTerm"),longTermLiabilities:numeric("longTermLiabilities"),totalAssets:numeric("totalAssets"),minimumCurrent:minimum("minimumCurrent"),minimumGeneral:minimum("minimumGeneral"),minimumSolvency:minimum("minimumSolvency"),sourceNote:String(rawInput.sourceNote||"").trim().slice(0,1000),documentIds};
    const financialAudit={...input,ratios:calculateBiddingFinancialRatios(input),updatedAt:now,updatedBy:actor};
    next={...old,_revision:revision+1,updatedAt:now,updatedBy:actor,financialAudit,approval:undefined};
   }else if(body.action==="submit"){
   if(!old)return json({error:"Salve primeiro as exigências deste edital."},404);
   if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para enviar o dossiê."},403);
   if(!old.requirements.length)return json({error:"Inclua ao menos uma exigência antes de enviar o dossiê."},422);
   const requiresFinancial=old.requirements.some(req=>["Balanço Patrimonial","DRE","Índices econômico-financeiros"].includes(req.category));
   if(requiresFinancial&&!old.financialAudit)return json({error:"Complete a auditoria econômico-financeira exigida nesta matriz antes de enviar."},422);
   if(old.financialAudit?.ratios.some(ratio=>ratio.status==="below"||ratio.status==="undefined"))return json({error:"Há índice abaixo do mínimo informado ou sem denominador válido. Revise o balanço e o edital."},422);
   if(requiresFinancial)for(const id of old.financialAudit?.documentIds||[]){const doc=await loadBiddingDocument(c.db,c.company,id);if(!doc||!doc.uploaded||doc.review!=="approved"||doc.validUntil&&doc.validUntil<now.slice(0,10))return json({error:"A auditoria financeira tem documento pendente ou vencido."},422);}
   for(const req of old.requirements){
    if(!req.documentId)return json({error:"Vincule uma evidência para cada exigência antes de enviar à aprovação gerencial."},422);
    const doc=await loadBiddingDocument(c.db,c.company,req.documentId);
    if(!doc||!doc.uploaded||doc.tenderId&&doc.tenderId!==tenderId||doc.review!=="approved"||doc.validUntil&&doc.validUntil<now.slice(0,10))return json({error:"Há evidência ausente, não aprovada, vencida ou vinculada a outro edital."},422);
    if(req.category==="Atestado técnico"){
     const evidence=req.technicalEvidence,actual=Number(String(evidence?.quantity||"").replace(",", ".")),required=Number(String(req.threshold||"").replace(",", "."));
     if(!evidence?.issuer||!evidence.service||!evidence.unit||!evidence.startDate||!evidence.endDate||!evidence.professionalRecord||!Number.isFinite(actual)||actual<=0)return json({error:"Complete emitente, serviço, quantidade, unidade, período e CREA/CFT ou ART/CAT/TRT do atestado."},422);
     if(evidence.endDate<evidence.startDate)return json({error:"Período do atestado inválido."},422);
     if(Number.isFinite(required)&&required>0&&req.unit&&evidence.unit.trim().toLocaleLowerCase("pt-BR")!==req.unit.trim().toLocaleLowerCase("pt-BR"))return json({error:"A unidade comprovada do atestado difere da unidade exigida."},422);
     if(Number.isFinite(required)&&required>0&&actual<required)return json({error:"A quantidade registrada no atestado é menor que o mínimo digitado para este edital."},422);
    }
   }
   next={...old,_revision:revision+1,updatedAt:now,updatedBy:actor,approval:{status:"pending",submittedAt:now,submittedBy:actor}};
  }else if(body.action==="decision"){
   if(!old)return json({error:"Salve primeiro as exigências deste edital."},404);
   if(!hasPermission(access.session,"aprovacoes.aprovar"))return json({error:"A aprovação gerencial exige a permissão Aprovações → Aprovar."},403);
   if(!old.approval||old.approval.status!=="pending")return json({error:"Este dossiê não está aguardando aprovação gerencial."},409);
   if(old.approval.submittedBy===actor)return json({error:"A pessoa que enviou o dossiê não pode aprová-lo."},403);
   const decision=String(body.decision) as Approval["status"],note=String(body.note||"").trim();
   if(!["approved","rejected"].includes(decision)||note.length<5||note.length>1000)return json({error:"Informe uma decisão e justificativa de 5 a 1000 caracteres."},422);
   if(decision==="approved"){
     const requiresFinancial=old.requirements.some(req=>["Balanço Patrimonial","DRE","Índices econômico-financeiros"].includes(req.category));
     if(requiresFinancial&&!old.financialAudit)return json({error:"Auditoria econômico-financeira ausente; a gestão não pode aprovar este dossiê."},422);
     if(old.financialAudit?.ratios.some(ratio=>ratio.status==="below"||ratio.status==="undefined"))return json({error:"Revise os índices econômico-financeiros antes da aprovação."},422);
     for(const id of old.financialAudit?.documentIds||[]){const doc=await loadBiddingDocument(c.db,c.company,id);if(!doc||!doc.uploaded||doc.review!=="approved"||doc.validUntil&&doc.validUntil<now.slice(0,10))return json({error:"Um documento financeiro do dossiê está pendente ou vencido."},422);}
    }
    if(decision==="approved")for(const req of old.requirements){
    const doc=req.documentId?await loadBiddingDocument(c.db,c.company,req.documentId):null;
    if(!doc||doc.review!=="approved"||!doc.uploaded||doc.validUntil&&doc.validUntil<now.slice(0,10))return json({error:"O dossiê tem evidência pendente ou vencida. Reenvie para análise após corrigir."},422);
   }
   next={...old,_revision:revision+1,updatedAt:now,updatedBy:actor,approval:{...old.approval,status:decision,reviewedAt:now,reviewedBy:actor,note}};
  }else{
   if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para editar exigências."},403);
   const requirements=readList(body.requirements);
   for(const req of requirements)if(req.documentId){
    const doc=await loadBiddingDocument(c.db,c.company,req.documentId);
    if(!doc||!doc.uploaded||doc.tenderId&&doc.tenderId!==tenderId)return json({error:"Documento vinculado não pertence a esta empresa ou a este edital."},422);
   }
   next={companyId:c.company,tenderId,_revision:revision+1,updatedAt:now,updatedBy:actor,requirements,approval:undefined,financialAudit:undefined};
  }

  let saved=false;
  if(c.db.url===PRIMARY_DATABASE_URL)saved=Boolean(await commitNeonOperationalState(key,old?revision:null,next,[]));
  else{const result=await routeRest(c.db,old?"proar_state?id=eq."+encodeURIComponent(key)+"&payload->>_revision=eq."+revision+"&select=payload":"proar_state?on_conflict=id&select=payload",{method:old?"PATCH":"POST",headers:{Prefer:old?"return=representation":"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(old?{payload:next,updated_at:next.updatedAt}:{id:key,payload:next,updated_at:next.updatedAt})});saved=result.ok&&(await result.json()).length>0;}
  if(!saved)return json({error:"Exigências não salvas. Atualize e tente novamente."},409);
  return json({saved:true,revision:next._revision,requirements:next.requirements,approval:next.approval||null,financialAudit:next.financialAudit||null});
 }catch(error){return json({error:error instanceof Error&&/Exigência|exigência|Categoria|Limite|quantidade|Documento|edital|Vínculo/.test(error.message)?error.message:"Não foi possível salvar as exigências. Os dados anteriores foram preservados."},422);}
}