import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../../lib/permissions";
import { validateFiscalPayload } from "../../../../lib/fiscal-validation";
import { runNfse, validNfseOrderId } from "../../../../lib/nfse-reconciliation";
import { nfseCompany, nfseStore } from "../../../../lib/nfse-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const access = requirePermission(request, "fiscal.emitir");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const scope=sessionCompany(access.session);
  if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status});
  const body=await request.json().catch(()=>null);
  if(!body||!validNfseOrderId(body.serviceOrderId))return NextResponse.json({error:"Informe uma ordem de serviço válida."},{status:400});
  let validation:ReturnType<typeof validateFiscalPayload>;
  try{validation=validateFiscalPayload({...body,kind:"NFSE"});}catch{return NextResponse.json({error:"Formato inválido nos campos fiscais."},{status:400});}
  if(!validation.valid)return NextResponse.json({error:"Pré-validação fiscal reprovada.",validation},{status:422});
  const value=Number(body?.service?.value);
  if(!body?.customer?.document||!body?.service?.description||!Number.isFinite(value)||value<=0){
    return NextResponse.json({error:"Dados obrigatórios da NFS-e incompletos."},{status:400});
  }
  if(!/^\d{7}$/.test(String(body?.nfse?.municipalityCode||""))||!String(body?.nfse?.serviceCode||"").trim()){
    return NextResponse.json({error:"Configure o código IBGE do município e o código de serviço antes de preparar a DPS nacional."},{status:422});
  }
  const companyId=nfseCompany({...access.session,companyId:scope.companyId});
  const providerUrl=process.env.PROAR_SEFIN_NACIONAL_ADAPTER_URL;
  const providerToken=process.env.PROAR_SEFIN_NACIONAL_ADAPTER_TOKEN;
  try{
    const repo=await nfseStore(companyId,body.serviceOrderId);
    const result=await runNfse({
      companyId,legacyCompanyId:scope.companyId,serviceOrderId:body.serviceOrderId,value,repo,
      send:providerUrl&&providerToken?attempt=>fetch(providerUrl,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${providerToken}`,"Idempotency-Key":attempt.idempotencyKey},
        body:JSON.stringify({serviceOrderId:attempt.serviceOrderId,customer:body.customer,service:{...body.service,value:attempt.value},nfse:body.nfse,issuer:"SEFIN Nacional",requestedBy:access.session.username,companyId:attempt.providerCompanyId??attempt.companyId,idempotencyKey:attempt.idempotencyKey}),
        cache:"no-store",redirect:"error",signal:AbortSignal.timeout(30_000),
      }):undefined,
    },"issue");
    return NextResponse.json(result.body,{status:result.code});
  }catch{return NextResponse.json({error:"Não foi possível conferir o registro de emissão. Consulte a NFS-e antes de qualquer reenvio."},{status:503});}
}
