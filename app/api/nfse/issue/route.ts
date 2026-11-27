import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/permissions";
import { validateFiscalPayload } from "../../../../lib/fiscal-validation";
import { convertedNfseOriginError } from "../../../../lib/commercial-conversion";
import { routeContext } from "../../../../lib/work-route-store";
import { loadNfseAttempt,writeNfseAttempt,type NfseAttempt } from "../../../../lib/nfse-issuance-attempt";
import { nfseIssuanceHold,nfseProviderOutcome } from "../../../../lib/nfse-issuance-status";

export const runtime = "nodejs";
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
const validOrderId=(id:string)=>/^#?[a-zA-Z0-9_.:-]{1,100}$/.test(id);
const uncertaintyMessage="Não foi possível confirmar a autorização. Consulte a situação no provedor com esta OS antes de qualquer nova emissão.";
const snapshot=(attempt:NfseAttempt)=>({status:attempt.status,number:attempt.number||"",verificationCode:attempt.verificationCode||"",protocol:attempt.protocol||"",updatedAt:attempt.updatedAt});

export async function GET(request:NextRequest){
 let access=requirePermission(request,"fiscal.consultar");
 if(!access.ok)access=requirePermission(request,"fiscal.emitir");
 if(!access.ok)return json({error:access.error},access.status);
 const orderId=request.nextUrl.searchParams.get("serviceOrderId")||"";
 if(!validOrderId(orderId))return json({error:"Informe a OS."},422);
 try{
  const context=await routeContext(access.session);
  if(!context.state.serviceOrders?.some((row:{id:string})=>row.id===orderId))return json({error:"OS não encontrada nesta empresa."},404);
  const attempt=await loadNfseAttempt(context.db,context.company,orderId);
  return json({attempt:attempt?snapshot(attempt):null});
 }catch{return json({error:"Não foi possível consultar o registro fiscal local."},503);}
}

export async function POST(request: NextRequest) {
 const access = requirePermission(request, "fiscal.emitir");
 if (!access.ok) return json({ error: access.error },access.status);
 const user = access.session;
 const body = await request.json().catch(()=>null);
 if(!body||typeof body!=="object")return json({error:"Dados obrigatórios da NFS-e incompletos."},400);
 const validation = validateFiscalPayload({ ...body, kind: "NFSE" });
 if (!validation.valid) return json({ error:"Pré-validação fiscal reprovada. Nenhuma DPS foi transmitida.", validation },422);
 const providerUrl = process.env.PROAR_SEFIN_NACIONAL_ADAPTER_URL;
 const providerToken = process.env.PROAR_SEFIN_NACIONAL_ADAPTER_TOKEN;
 if (!providerUrl || !providerToken) return json({ error: "Adaptador do Sistema Nacional NFS-e não configurado no servidor. Nenhuma DPS foi transmitida." },428);
 const orderId=String(body.serviceOrderId||"");
 if (!validOrderId(orderId) || !body?.customer?.document || !body?.service?.description || Number(body?.service?.value || 0) <= 0) return json({ error: "Dados obrigatórios da NFS-e incompletos." },400);
 if (!/^\d{7}$/.test(String(body?.nfse?.municipalityCode || "")) || !String(body?.nfse?.serviceCode || "").trim()) {
  return json({ error: "Configure o código IBGE do município e o código de serviço antes de preparar a DPS nacional." },422);
 }
 let context:Awaited<ReturnType<typeof routeContext>>,attempt:NfseAttempt;
 try{
  context=await routeContext(user);
  const order=context.state.serviceOrders?.find((row:{id:string})=>row.id===orderId);
  if(!order)return json({error:"OS não encontrada nesta empresa. Nenhuma DPS foi transmitida."},404);
  const previous=await loadNfseAttempt(context.db,context.company,orderId);
  if(previous?.status==="Autorizada"){
   return json({issued:true,status:"Autorizada",replay:true,idempotencyKey:previous.idempotencyKey,result:snapshot(previous)});
  }
  if(previous&&previous.status!=="Rejeitada"){
   return json({issued:false,status:"Conferência pendente",error:uncertaintyMessage,idempotencyKey:previous.idempotencyKey},409);
  }
  // A public invoice may cover several OS/items or only part of one OS.
  // The per-OS adapter cannot represent that settlement: use the verified
  // Empenho/Financeiro flow and preserve any already authorized replay above.
  if (order.certameId || (Array.isArray(order.contractItems) && order.contractItems.length)) {
   return json({error:"Esta OS está vinculada a um Certame. Confira o saldo e faça o faturamento pelo Empenho. Nenhuma DPS foi transmitida."},409);
  }
  const hold=nfseIssuanceHold(order);
  if(hold)return json({error:hold},409);
  const linkedCustomer=order.commercialSnapshot && order.customerId
   ? context.state.customers?.find((row:{id:string})=>row.id===order.customerId)
   : undefined;
  const conversionError=convertedNfseOriginError(order,linkedCustomer,body.customer.document,body.service.value);
  if(conversionError)return json({error:conversionError+" Nenhuma DPS foi transmitida."},422);
  // Preserve the previous adapter key format for the same OS and service value. A local
  // CAS row serializes attempts for the OS even when the requested value differs.
  const idempotencyKey=createHash("sha256").update(`${user.companyId}:${orderId}:${body.service.value}`).digest("hex");
  attempt={companyId:context.company,orderId,idempotencyKey,_revision:(previous?._revision??0)+1,status:"Processando",actor:user.username,updatedAt:new Date().toISOString()};
  if(!await writeNfseAttempt(context.db,attempt,previous))return json({issued:false,status:"Conferência pendente",error:"Outra sessão já reservou a emissão desta OS. Consulte a situação antes de transmitir novamente."},409);
 }catch{return json({error:"Não foi possível reservar a emissão no banco. Nenhuma DPS foi transmitida por esta solicitação."},503);}

 let raw:unknown, responseOk=false;
 try{
  const response = await fetch(providerUrl, {
   method: "POST",
   headers: { "Content-Type": "application/json", Authorization: `Bearer ${providerToken}`, "Idempotency-Key": attempt.idempotencyKey },
   body: JSON.stringify({ ...body, issuer: "SEFIN Nacional", requestedBy: user.username, companyId: user.companyId, idempotencyKey:attempt.idempotencyKey }),
   cache: "no-store",
   signal: AbortSignal.timeout(30000),
  });
  responseOk=response.ok;
  raw=await response.json().catch(()=>null);
 }catch{/* Timeout/transporte não prova que o provedor não recebeu a nota. */}
 const result=nfseProviderOutcome(responseOk,raw);
 const next:NfseAttempt={...attempt,_revision:attempt._revision+1,status:result.outcome,number:result.number,verificationCode:result.verificationCode,protocol:result.protocol,updatedAt:new Date().toISOString()};
 try {
  if(!await writeNfseAttempt(context.db,next,attempt))throw new Error("Registro alterado.");
 }catch{return json({issued:false,status:"Conferência pendente",idempotencyKey:attempt.idempotencyKey,error:uncertaintyMessage},503);}
 if(result.outcome==="Autorizada")return json({issued:true,status:"Autorizada",idempotencyKey:attempt.idempotencyKey,result:snapshot(next)});
 if(result.outcome==="Processando")return json({issued:false,status:"Processando",idempotencyKey:attempt.idempotencyKey},202);
 if(result.outcome==="Rejeitada")return json({issued:false,status:"Rejeitada",idempotencyKey:attempt.idempotencyKey,error:result.message||"O provedor confirmou a rejeição da NFS-e."},responseOk?422:502);
 return json({issued:false,status:"Conferência pendente",idempotencyKey:attempt.idempotencyKey,error:uncertaintyMessage},502);
}
