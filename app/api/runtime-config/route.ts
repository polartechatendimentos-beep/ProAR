import { NextRequest, NextResponse } from "next/server";
import { normalizeHost, tenantSlugFromHost } from "../../../lib/tenant-host";
import {
  INTERNAL_HOSTS,
  INTERNAL_QA_COMPANY_ID,
  inspectAlias,
  resolveFeatureFlags,
  type ReleaseChannel,
  type TenantReleaseSettings,
} from "../../../lib/release-governance";
import { supabaseRest } from "../../../lib/supabase-rest";

export const runtime="nodejs";

function internalChannel(host:string):ReleaseChannel|null{
  if(host==="teste.proar.online")return"internal";
  if(host==="homologacao.proar.online")return"homologation";
  return null;
}

export async function GET(request:NextRequest){
  const host=normalizeHost(request.headers.get("host"));
  const forcedChannel=internalChannel(host);
  const tenantSlug=tenantSlugFromHost(host);
  let companyId:string|undefined=forcedChannel?INTERNAL_QA_COMPANY_ID:undefined;
  let channel:ReleaseChannel=forcedChannel||"production";
  let settings:TenantReleaseSettings|null=null;

  if(!companyId&&tenantSlug){
    const companyResponse=await supabaseRest(`proar_companies?select=id,slug&slug=eq.${encodeURIComponent(tenantSlug)}&limit=1`).catch(()=>null);
    if(companyResponse?.ok){
      const company=(await companyResponse.json())[0];
      companyId=company?.id?String(company.id):undefined;
    }
  }

  if(companyId){
    const response=await supabaseRest(`proar_tenant_release_settings?select=*&company_id=eq.${encodeURIComponent(companyId)}&limit=1`).catch(()=>null);
    if(response?.ok){
      settings=((await response.json())[0]||null) as TenantReleaseSettings|null;
      if(!forcedChannel&&settings?.release_channel)channel=settings.release_channel;
    }
  }

  const featureFlags=await resolveFeatureFlags(companyId,channel).catch(()=>({}));
  const flagRowsResponse=await supabaseRest("proar_feature_flags?select=flag_key,module_name,status&status=eq.active").catch(()=>null);
  const flagRows=flagRowsResponse?.ok?await flagRowsResponse.json() as Array<{flag_key:string;module_name?:string|null}>:[];
  const moduleFlags:Record<string,boolean>={};
  for(const row of flagRows){
    if(row.module_name)moduleFlags[String(row.module_name)]=featureFlags[row.flag_key]!==false;
  }

  let currentVersion=settings?.current_version||null;
  let publishedDeploymentId=settings?.current_deployment_id||null;
  if(forcedChannel){
    const targetResponse=await supabaseRest(`proar_release_targets?select=target_version,target_deployment_id,applied_at&alias=eq.${encodeURIComponent(host)}&status=eq.active&order=applied_at.desc&limit=1`).catch(()=>null);
    if(targetResponse?.ok){
      const row=(await targetResponse.json())[0];
      currentVersion=row?.target_version||currentVersion;
      publishedDeploymentId=row?.target_deployment_id||publishedDeploymentId;
    }
  }

  let changelog:null|{version:string;title?:string;summary?:string;notes?:unknown[]}=null;
  if(currentVersion){
    const releaseResponse=await supabaseRest(`proar_releases?select=version,title,summary,notes&version=eq.${encodeURIComponent(currentVersion)}&limit=1`).catch(()=>null);
    if(releaseResponse?.ok){
      const release=(await releaseResponse.json())[0];
      if(release)changelog={version:String(release.version),title:release.title,summary:release.summary,notes:Array.isArray(release.notes)?release.notes:[]};
    }
  }

  const alias=host&&host!=="localhost"?host:null;
  const aliasInfo=alias?await inspectAlias(alias).catch(()=>null):null;
  const servedDeploymentId=aliasInfo?.ok?aliasInfo.deploymentId||null:null;

  return NextResponse.json({
    environment:channel,
    internal:INTERNAL_HOSTS.has(host),
    companyId:companyId||null,
    currentVersion,
    schemaVersion:settings?.schema_version||null,
    maintenanceMode:Boolean(settings?.maintenance_mode),
    maintenanceMessage:settings?.maintenance_message||"Atualização do ProAR em andamento. Tente novamente em alguns instantes.",
    updatePolicy:settings?.update_policy||"automatic",
    pinnedVersion:settings?.pinned_version||null,
    featureFlags,
    moduleFlags,
    changelog,
    publishedDeploymentId,
    servedDeploymentId,
    deploymentMismatch:Boolean(publishedDeploymentId&&servedDeploymentId&&publishedDeploymentId!==servedDeploymentId),
    checkedAt:new Date().toISOString(),
  },{headers:{"Cache-Control":"no-store, max-age=0"}});
}
