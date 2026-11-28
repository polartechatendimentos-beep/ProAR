import {NextRequest,NextResponse} from "next/server";
import {requirePermission,sessionCompany} from "../../../../lib/permissions";
import {runNfse,validNfseOrderId} from "../../../../lib/nfse-reconciliation";
import {nfseCompany,nfseStore} from "../../../../lib/nfse-store";

export const runtime="nodejs";
export const maxDuration=30;

export async function POST(request:NextRequest){
  const consult=requirePermission(request,"fiscal.consultar");
  const access=consult.ok?consult:requirePermission(request,"fiscal.emitir");
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
  const scope=sessionCompany(access.session);
  if(!scope.ok)return NextResponse.json({error:scope.error},{status:scope.status});
  const body=await request.json().catch(()=>null);
  if(!validNfseOrderId(body?.serviceOrderId))return NextResponse.json({error:"Informe uma ordem de serviço válida."},{status:400});
  const companyId=nfseCompany({...access.session,companyId:scope.companyId});
  const lookupUrl=process.env.PROAR_SEFIN_NACIONAL_ADAPTER_LOOKUP_URL;
  const providerToken=process.env.PROAR_SEFIN_NACIONAL_ADAPTER_TOKEN;
  try{
    const repo=await nfseStore(companyId,body.serviceOrderId);
    const result=await runNfse({companyId,legacyCompanyId:scope.companyId,serviceOrderId:body.serviceOrderId,repo,
      lookup:lookupUrl&&providerToken?attempt=>{
        const url=new URL(lookupUrl);
        url.searchParams.set("idempotencyKey",attempt.idempotencyKey);
        url.searchParams.set("companyId",attempt.providerCompanyId??attempt.companyId);
        url.searchParams.set("serviceOrderId",attempt.serviceOrderId);
        return fetch(url,{method:"GET",headers:{Authorization:`Bearer ${providerToken}`},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15_000)});
      }:undefined,
    },"reconcile");
    return NextResponse.json(result.body,{status:result.code});
  }catch{return NextResponse.json({error:"Não foi possível conferir o registro fiscal. Não reenvie a DPS."},{status:503});}
}
