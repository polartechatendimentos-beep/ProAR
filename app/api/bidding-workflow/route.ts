import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {procurementAccess} from "@/lib/procurement/access";
import {hasPermission} from "@/lib/permissions";
import {routeContext,routeRest} from "@/lib/work-route-store";
import {commitNeonOperationalState,PRIMARY_DATABASE_URL} from "@/lib/supabase-rest";

import {biddingTenderOptions} from "@/lib/bidding-document-store";
import {computeBidFloor,type ApprovedFloor,type FloorInput} from "@/lib/bidding-assisted-floor";

export const runtime="nodejs";
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Robots-Tag":"noindex"}});
const keyFor=(company:string)=>"bidding-workflow-v1:"+createHash("sha256").update(company).digest("hex");
const stages=["Novas","Para analisar","Interessantes","Participaremos","Descartadas","Aguardando abertura","Em disputa","Habilitação","Homologadas"] as const;
const trackKinds=["Sessão","Lance","Habilitação","Recurso","Adjudicação","Homologação","Empenho","Contrato","Outro"] as const;
type CostLine={id:string;label:string;quantity:number;unitCost:number};
type TrackEvent={id:string;kind:typeof trackKinds[number];date:string;value:number|null;note:string};
type RecordValue={title?:string;status?:typeof stages[number];deadlines?:Record<string,string>;costLines?:CostLine[];taxRate?:number;targetMargin?:number;checklist?:Record<string,boolean>;tracking?:TrackEvent[];proposalNote?:string;updatedAt?:string};
type Stored={companyId:string;_revision:number;updatedAt:string;updatedBy:string;records:Record<string,RecordValue>;bidFloors?:Record<string,ApprovedFloor[]>};
const dateOK=(v:string)=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v)));
function sanitizeRecords(value:unknown):Record<string,RecordValue>{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Dados do fluxo inválidos.");
 const entries=Object.entries(value as Record<string,unknown>);
 if(entries.length>200)throw new Error("O fluxo suporta até 200 certames salvos.");
 const out:Record<string,RecordValue>={};
 for(const [id,raw] of entries){
  if(!/^[a-zA-Z0-9._:/-]{1,160}$/.test(id)||!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Certame inválido.");
  const x=raw as Record<string,unknown>,record:RecordValue={};
  if(x.title!==undefined)record.title=String(x.title||"").slice(0,500);
  if(x.status!==undefined){if(!stages.includes(x.status as typeof stages[number]))throw new Error("Etapa inválida.");record.status=x.status as typeof stages[number];}
  if(x.deadlines!==undefined){if(!x.deadlines||typeof x.deadlines!=="object"||Array.isArray(x.deadlines))throw new Error("Prazos inválidos.");const deadlines:Record<string,string>={};for(const [name,d] of Object.entries(x.deadlines as Record<string,unknown>).slice(0,12)){const v=String(d||"");if(name.length>60||!dateOK(v))throw new Error("Data de prazo inválida.");deadlines[name]=v;}record.deadlines=deadlines;}
  if(x.costLines!==undefined){if(!Array.isArray(x.costLines)||x.costLines.length>30)throw new Error("Informe até 30 componentes de custo.");record.costLines=x.costLines.map((rawLine,index)=>{const line=rawLine as Record<string,unknown>,quantity=Number(line.quantity),unitCost=Number(line.unitCost),label=String(line.label||"").trim().slice(0,120);if(!label||!Number.isFinite(quantity)||quantity<0||quantity>1e8||!Number.isFinite(unitCost)||unitCost<0||unitCost>1e12)throw new Error("Componente de custo inválido.");return{id:String(line.id||index).slice(0,80),label,quantity,unitCost};});}
  for(const field of ["taxRate","targetMargin"] as const)if(x[field]!==undefined){const n=Number(x[field]);if(!Number.isFinite(n)||n<0||n>100)throw new Error("Percentual inválido.");record[field]=n;}
  if(x.checklist!==undefined){if(!x.checklist||typeof x.checklist!=="object"||Array.isArray(x.checklist))throw new Error("Checklist inválido.");const checklist:Record<string,boolean>={};for(const [name,val] of Object.entries(x.checklist as Record<string,unknown>).slice(0,40)){if(name.length>100||typeof val!=="boolean")throw new Error("Item de checklist inválido.");checklist[name]=val;}record.checklist=checklist;}
  if(x.tracking!==undefined){if(!Array.isArray(x.tracking)||x.tracking.length>40)throw new Error("Limite de 40 registros de acompanhamento excedido.");record.tracking=x.tracking.map(rawEvent=>{const e=rawEvent as Record<string,unknown>,kind=String(e.kind||"Outro") as typeof trackKinds[number],date=String(e.date||""),value=e.value===null||e.value===""||e.value===undefined?null:Number(e.value),note=String(e.note||"").trim().slice(0,1000);if(!trackKinds.includes(kind)||!dateOK(date)||!date||value!==null&&(!Number.isFinite(value)||value<0||value>1e15))throw new Error("Registro pós-lance inválido.");return{id:String(e.id||"").slice(0,80),kind,date,value,note};});}
  if(x.proposalNote!==undefined)record.proposalNote=String(x.proposalNote||"").slice(0,3000);
  record.updatedAt=new Date().toISOString();out[id]=record;
 }
 return out;
}
async function read(c:Awaited<ReturnType<typeof routeContext>>){
 const key=keyFor(c.company),result=await routeRest(c.db,"proar_state?id=eq."+encodeURIComponent(key)+"&select=payload&limit=1");
 if(!result.ok)throw new Error("Consulta indisponível");
 const stored=(await result.json())[0]?.payload as Stored|undefined;
 if(stored&&stored.companyId!==c.company)throw new Error("Vínculo de empresa inválido.");
 return stored;
}
export async function GET(request:NextRequest){
 const access=procurementAccess(request);if(!access.ok)return json({error:access.error},access.status);
 try{
  const c=await routeContext(access.session),stored=await read(c);
  const revision=stored?._revision||0,canEdit=hasPermission(access.session,"licitacoes.editar"),floorTender=request.nextUrl.searchParams.get("floorTender");
  if(floorTender!==null){
   if(!biddingTenderOptions(c.state).some(item=>item.id===floorTender))return json({error:"Selecione um edital salvo nesta empresa."},422);
   return json({revision,canEdit,canApprove:hasPermission(access.session,"aprovacoes.aprovar"),actor:access.session.username,floors:stored?.bidFloors&&Object.hasOwn(stored.bidFloors,floorTender)?stored.bidFloors[floorTender]:[]});
  }
  return json({records:stored?.records||{},revision,canEdit});
 }
 catch{return json({error:"Não foi possível carregar o fluxo de licitações."},503);}
}
export async function POST(request:NextRequest){
 const access=procurementAccess(request);if(!access.ok)return json({error:access.error},access.status);
 if(request.headers.get("origin")!==request.nextUrl.origin)return json({error:"Origem não autorizada."},403);
 try{
  const raw=await request.text();if(raw.length>250000)return json({error:"Solicitação muito grande."},413);
  const body=JSON.parse(raw),c=await routeContext(access.session),old=await read(c),revision=Number(old?._revision||0);
  if(Number(body.expectedRevision||0)!==revision)return json({error:"O fluxo foi alterado em outra sessão. Atualize antes de salvar."},409);
  const actor=access.session.username, now=new Date().toISOString();
  const next:Stored={companyId:c.company,_revision:revision+1,updatedAt:now,updatedBy:actor,records:old?.records||{},bidFloors:old?.bidFloors||{}};
  if(body.action==="submit-bid-floor"||body.action==="decide-bid-floor"){
   const id=typeof body.tenderId==="string"?body.tenderId:"";
   if(!/^[a-zA-Z0-9._:/-]{1,160}$/.test(id)||id==="__proto__"||id==="constructor"||id==="prototype"||!biddingTenderOptions(c.state).some(item=>item.id===id))return json({error:"Identificador do certame inválido."},422);
   const current=Object.hasOwn(next.bidFloors!,id)?next.bidFloors![id]:[];
   if(body.action==="submit-bid-floor"){
    if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para cadastrar piso."},403);
    if(body.costsReviewed!==true)return json({error:"Confirme os custos e a unidade de preço antes de enviar o piso."},422);
    const {scope,reference,materials,labor,travel,other,taxes,margin}=body.floor||{};
    const str=(v:unknown)=>typeof v==="string"&&v.length<=100?v.trim():"";
    const input:FloorInput={scope,reference:str(reference),materials:str(materials),labor:str(labor),travel:str(travel),other:str(other),taxes:str(taxes),margin:str(margin)};
    let calc;
    try{calc=computeBidFloor(input);}catch(error){return json({error:error instanceof Error?error.message:"Piso inválido."},422);}
    const previous=current.find(f=>f.key===calc.key);
    if(previous?.status==="pending")return json({error:"Este item ou lote já tem um piso aguardando revisão."},409);
    if(!previous&&current.length>=100||!Object.hasOwn(next.bidFloors!,id)&&Object.keys(next.bidFloors!).length>=200)return json({error:"Limite de pisos do fluxo atingido."},422);
    const floor:ApprovedFloor={...input,reference:calc.reference,key:calc.key,floorCents:calc.floorCents,breakEvenCents:calc.breakEvenCents,status:"pending",submittedBy:actor,submittedAt:now};
    next.bidFloors={...next.bidFloors,[id]:[...current.filter(f=>f.key!==floor.key),floor]};
   }else{
    if(!hasPermission(access.session,"aprovacoes.aprovar"))return json({error:"Sem permissão para aprovar piso."},403);
    const floor=current.find(f=>f.key===body.floorKey);
    if(!floor||floor.status!=="pending")return json({error:"Piso não está aguardando decisão."},409);
    if(floor.submittedBy===actor)return json({error:"Outra pessoa precisa revisar o piso."},403);
    const status=body.decision,note=typeof body.note==="string"?body.note.trim():"";
    if(!["approved","rejected"].includes(status)||note.length<5||note.length>500)return json({error:"Informe uma decisão com justificativa de 5 a 500 caracteres."},422);
    next.bidFloors={...next.bidFloors,[id]:current.map(f=>f.key===floor.key?{...floor,status,decidedBy:actor,decidedAt:now,decisionNote:note}:f)};
   }
  }else{
   if(body.action!==undefined)return json({error:"Operação inválida."},422);
   if(!hasPermission(access.session,"licitacoes.editar"))return json({error:"Sem permissão para editar o fluxo de licitações."},403);
   next.records=sanitizeRecords(body.records);
  }
  const key=keyFor(c.company);let saved=false;
  if(c.db.url===PRIMARY_DATABASE_URL)saved=Boolean(await commitNeonOperationalState(key,old?revision:null,next,[]));
  else{const result=await routeRest(c.db,old?"proar_state?id=eq."+encodeURIComponent(key)+"&payload->>_revision=eq."+revision+"&select=payload":"proar_state?on_conflict=id&select=payload",{method:old?"PATCH":"POST",headers:{Prefer:old?"return=representation":"resolution=ignore-duplicates,return=representation"},body:JSON.stringify(old?{payload:next,updated_at:next.updatedAt}:{id:key,payload:next,updated_at:next.updatedAt})});saved=result.ok&&(await result.json()).length>0;}
  if(!saved)return json({error:"Alterações não salvas. Atualize e tente novamente."},409);
  if(body.action)return json({saved:true,revision:next._revision,floors:next.bidFloors?.[body.tenderId]||[]});
  return json({saved:true,revision:next._revision,records:next.records});
 }catch(error){return json({error:error instanceof Error&&/inválid|inválida|suporta|Informe|Limite|excedido|Percentual/.test(error.message)?error.message:"Não foi possível salvar o fluxo. As informações anteriores foram preservadas."},422);}
}
