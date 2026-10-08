import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  assignDeploymentAlias,
  ensureReleaseGovernanceSchema,
  inspectAlias,
  probeAlias,
  recordReleaseCheck,
  schemaCompatible,
  snapshotBeforeRelease,
  type ProARReleaseRecord,
  type ReleaseTarget,
  type TenantReleaseSettings,
} from "../../../../lib/release-governance";
import { PROAR_SCHEMA_VERSION } from "../../../../lib/manager-platform";
import { recordSystemIncident } from "../../../../lib/system-observability";
import { supabaseRest } from "../../../../lib/supabase-rest";

export const runtime="nodejs";

function safeEqual(left:string,right:string){const a=Buffer.from(left);const b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b)}
function authorized(request:NextRequest){const secret=process.env.CRON_SECRET||"";return Boolean(secret)&&safeEqual(request.headers.get("authorization")||"","Bearer "+secret)}
const now=()=>new Date().toISOString();

async function audit(action:string,details:Record<string,unknown>,companyId?:string|null){
  await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId||null,action,actor:"system-cron",details})}).catch(()=>null);
}

async function releaseById(id:string):Promise<ProARReleaseRecord|null>{
  const response=await supabaseRest("proar_releases?select=*&id=eq."+encodeURIComponent(id)+"&limit=1");
  return response.ok?(await response.json())[0]||null:null;
}
async function settingFor(companyId:string):Promise<TenantReleaseSettings|null>{
  const response=await supabaseRest("proar_tenant_release_settings?select=*&company_id=eq."+encodeURIComponent(companyId)+"&limit=1");
  return response.ok?(await response.json())[0]||null:null;
}

async function failTarget(target:ReleaseTarget,release:ProARReleaseRecord,code:string,message:string,previousDeploymentId?:string|null,snapshotId?:number|null){
  if(previousDeploymentId)await assignDeploymentAlias(previousDeploymentId,target.alias).catch(()=>null);
  await supabaseRest("proar_release_targets?id=eq."+target.id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({
    status:"failed",health_status:"error",error_code:code,error_message:message,previous_deployment_id:previousDeploymentId||target.previous_deployment_id||null,
    snapshot_id:snapshotId||target.snapshot_id||null,updated_at:now(),
  })});
  await supabaseRest("proar_releases?id=eq."+encodeURIComponent(release.id),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"failed",updated_at:now()})});
  await supabaseRest("proar_release_targets?release_id=eq."+encodeURIComponent(release.id)+"&status=eq.scheduled",{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"blocked",health_status:"error",error_code:"PROAR-REL-ROLLOUT-HALTED",error_message:"Distribuição interrompida automaticamente após regressão.",updated_at:now()})}).catch(()=>null);
  await recordReleaseCheck({releaseId:release.id,companyId:target.company_id||null,environmentCode:target.environment_code,stage:"post",checkKey:"scheduled-rollout",status:"error",code,detail:message});
  await recordSystemIncident({companyId:target.company_id||undefined,module:"Central de Versões",operation:"Rollout agendado",code:"PROAR-DEPLOY-001",severity:"critical",route:"/api/cron/release-rollout",metadata:{releaseId:release.id,targetId:target.id,alias:target.alias,message,releaseCode:code}});
}

async function criticalIncidentsSince(companyId:string,since:string){
  const response=await supabaseRest("proar_system_incidents?select=id&company_id=eq."+encodeURIComponent(companyId)+"&severity=eq.critical&created_at=gte."+encodeURIComponent(since)+"&limit=20").catch(()=>null);
  return response?.ok?(await response.json()).length:0;
}

async function releaseHasRegression(release:ProARReleaseRecord,channel:ReleaseTarget["environment_code"]){
  const since=new Date(Date.now()-24*60*60*1000).toISOString();
  const response=await supabaseRest("proar_release_targets?select=*&release_id=eq."+encodeURIComponent(release.id)+"&environment_code=eq."+channel+"&status=eq.active&applied_at=gte."+encodeURIComponent(since)+"&order=applied_at.desc&limit=10").catch(()=>null);
  const active=response?.ok?await response.json() as ReleaseTarget[]:[];
  for(const item of active){
    const health=await probeAlias(item.alias);
    const servedDeployment=String((health.payload as Record<string,unknown>)?.deploymentId||"");
    const servedCommit=String((health.payload as Record<string,unknown>)?.commit||"");
    const deploymentMatch=servedDeployment===item.target_deployment_id||Boolean(release.commit_sha&&servedCommit===release.commit_sha);
    const critical=item.company_id&&item.applied_at?await criticalIncidentsSince(item.company_id,item.applied_at):0;
    const healthy=health.ok&&deploymentMatch&&!critical;
    await recordReleaseCheck({releaseId:release.id,companyId:item.company_id||null,environmentCode:item.environment_code,stage:"continuous",checkKey:"regression-watch",status:healthy?"ok":"error",code:healthy?null:(!deploymentMatch?"PROAR-REL-ALIAS-MISMATCH":"PROAR-REL-REGRESSION"),detail:critical?"Incidente crítico detectado após a atualização.":!deploymentMatch?"Alias servindo deployment divergente.":"HTTP "+health.httpStatus,latencyMs:health.latencyMs});
    if(!healthy){
      const message=critical?"Regressão detectada: incidente crítico após a atualização.":"Regressão detectada: health check do tenant falhou.";
      await failTarget(item,release,"PROAR-REL-REGRESSION",message,item.previous_deployment_id,item.snapshot_id);
      return{detected:true,alias:item.alias,message};
    }
  }
  return{detected:false as const};
}

export async function GET(request:NextRequest){
  if(!authorized(request))return NextResponse.json({error:"Não autorizado."},{status:401});
  const schema=await ensureReleaseGovernanceSchema().catch(error=>({ready:false,reason:error instanceof Error?error.message:"Falha no schema."}));
  if(!schema.ready)return NextResponse.json({error:schema.reason},{status:503});

  const due=await supabaseRest("proar_release_targets?select=*&status=eq.scheduled&scheduled_at=lte."+encodeURIComponent(now())+"&order=scheduled_at.asc&limit=10");
  const targets=due.ok?await due.json() as ReleaseTarget[]:[];
  const results:Array<Record<string,unknown>>=[];

  for(const target of targets){
    const release=await releaseById(target.release_id);
    if(!release){results.push({targetId:target.id,ok:false,error:"Release ausente."});continue}
    if(release.status==="failed"||release.status==="rolled_back"){
      await supabaseRest("proar_release_targets?id=eq."+target.id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"blocked",error_code:"PROAR-REL-ROLLOUT-HALTED",error_message:"Release interrompida antes deste target.",updated_at:now()})});
      results.push({targetId:target.id,ok:false,blocked:true,error:"Release já interrompida."});
      continue;
    }
    if(target.environment_code==="production"||target.environment_code==="canary"){
      const regression=await releaseHasRegression(release,target.environment_code);
      if(regression.detected){results.push({targetId:target.id,ok:false,blocked:true,error:regression.message});break}
    }
    const settings=target.company_id?await settingFor(target.company_id):null;
    const schemaVersion=settings?.schema_version||PROAR_SCHEMA_VERSION;
    if(target.company_id&&!schemaCompatible(schemaVersion,release.minimum_schema_version)){
      const message="Schema "+schemaVersion+" abaixo do mínimo "+release.minimum_schema_version+".";
      await failTarget(target,release,"PROAR-REL-SCHEMA",message);
      results.push({targetId:target.id,ok:false,error:message});
      break;
    }

    const alias=await inspectAlias(target.alias);
    const previousDeploymentId=alias.deploymentId||settings?.current_deployment_id||target.previous_deployment_id||null;
    let snapshotId=target.snapshot_id||null;
    if(target.company_id){
      const snapshot=await snapshotBeforeRelease(target.company_id,"system-cron");
      if(!snapshot.ok){
        const message=snapshot.error||"Snapshot pré-release falhou.";
        await failTarget(target,release,"PROAR-REL-SNAPSHOT",message,previousDeploymentId);
        results.push({targetId:target.id,ok:false,error:message});
        break;
      }
      snapshotId=snapshot.snapshotId;
    }

    await supabaseRest("proar_release_targets?id=eq."+target.id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"deploying",previous_deployment_id:previousDeploymentId,snapshot_id:snapshotId,updated_at:now()})});
    const assigned=await assignDeploymentAlias(release.deployment_id,target.alias);
    if(!assigned.ok){
      const message=assigned.error||"Falha ao promover alias.";
      await failTarget(target,release,assigned.code||"PROAR-REL-ALIAS",message,previousDeploymentId,snapshotId);
      results.push({targetId:target.id,ok:false,error:message});
      break;
    }

    await new Promise(resolve=>setTimeout(resolve,900));
    const health=await probeAlias(target.alias);
    const servedDeployment=String((health.payload as Record<string,unknown>)?.deploymentId||"");
    const servedCommit=String((health.payload as Record<string,unknown>)?.commit||"");
    const deploymentMatch=servedDeployment===release.deployment_id||Boolean(release.commit_sha&&servedCommit===release.commit_sha);
    const healthOk=health.ok&&deploymentMatch;
    await recordReleaseCheck({releaseId:release.id,companyId:target.company_id||null,environmentCode:target.environment_code,stage:"post",checkKey:"scheduled-health",status:healthOk?"ok":"error",code:healthOk?null:(health.ok?"PROAR-REL-ALIAS-MISMATCH":"PROAR-REL-HEALTH"),detail:"HTTP "+health.httpStatus+" • servido "+(servedDeployment||servedCommit||"desconhecido"),latencyMs:health.latencyMs});
    if(!healthOk){
      const message=health.ok?"Alias serviu deployment divergente após promoção. Rollout interrompido.":"Health check falhou em "+target.alias+". O rollout foi interrompido e o alias anterior foi restaurado.";
      await failTarget(target,release,health.ok?"PROAR-REL-ALIAS-MISMATCH":"PROAR-REL-HEALTH",message,previousDeploymentId,snapshotId);
      results.push({targetId:target.id,ok:false,error:message});
      break;
    }

    await supabaseRest("proar_release_targets?id=eq."+target.id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"active",health_status:"ok",applied_at:now(),previous_deployment_id:previousDeploymentId,snapshot_id:snapshotId,error_code:null,error_message:null,updated_at:now()})});
    if(target.company_id){
      await supabaseRest("proar_tenant_release_settings?on_conflict=company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({
        company_id:target.company_id,release_channel:target.environment_code,current_version:release.version,current_deployment_id:release.deployment_id,
        schema_version:release.schema_version,last_health_at:now(),last_health_status:"ok",last_error_code:null,last_error_message:null,updated_at:now(),
      })});
    }
    await supabaseRest("proar_releases?id=eq."+encodeURIComponent(release.id),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({channel:target.environment_code,status:"active",promoted_at:now(),updated_at:now()})});
    await audit("RELEASE_SCHEDULED_TARGET_ACTIVE",{releaseId:release.id,version:release.version,targetId:target.id,alias:target.alias,deploymentId:release.deployment_id},target.company_id||null);
    results.push({targetId:target.id,ok:true,alias:target.alias});
  }

  return NextResponse.json({processed:results.length,results,checkedAt:now()});
}
