import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../lib/manager-auth";
import { ALL_MANAGER_MODULES } from "../../../../lib/manager-plans";
import { PROAR_SCHEMA_VERSION } from "../../../../lib/manager-platform";
import { provisionTenant, resumeTenantProvisioning } from "../../../../lib/tenant-provisioning";
import { recordSystemIncident } from "../../../../lib/system-observability";
import { databaseFetch, supabaseRest } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import {
  INTERNAL_QA_COMPANY_ID,
  INTERNAL_QA_COMPANY_SLUG,
  RELEASE_ENVIRONMENTS,
  assignDeploymentAlias,
  companyAlias,
  ensureReleaseGovernanceSchema,
  inspectAlias,
  inspectDeployment,
  probeAlias,
  recordReleaseCheck,
  releaseId,
  restoreReleaseSnapshot,
  schemaCompatible,
  snapshotBeforeRelease,
  type ProARReleaseRecord,
  type ReleaseChannel,
  type ReleaseTarget,
  type TenantReleaseSettings,
} from "../../../../lib/release-governance";

export const runtime="nodejs";
const manager=(request:NextRequest)=>readManagerSession(request);
const now=()=>new Date().toISOString();

async function audit(action:string,actor:string,details:Record<string,unknown>,companyId?:string|null){
  await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({
    company_id:companyId||null,action,actor,details,
  })}).catch(()=>null);
}

async function listData(){
  const [releases,targets,settings,flags,overrides,checks,companies,instances]=await Promise.all([
    supabaseRest("proar_releases?select=*&order=created_at.desc&limit=80").catch(()=>null),
    supabaseRest("proar_release_targets?select=*&order=created_at.desc&limit=250").catch(()=>null),
    supabaseRest("proar_tenant_release_settings?select=*&order=company_id.asc").catch(()=>null),
    supabaseRest("proar_feature_flags?select=*&order=flag_key.asc").catch(()=>null),
    supabaseRest("proar_feature_flag_overrides?select=*&order=updated_at.desc&limit=250").catch(()=>null),
    supabaseRest("proar_release_checks?select=*&order=checked_at.desc&limit=250").catch(()=>null),
    supabaseRest("proar_companies?select=id,slug,trade_name,legal_name,status,plan_code&order=created_at.asc").catch(()=>null),
    supabaseRest("proar_tenant_instances?select=company_id,provisioning_status,provisioning_error,last_health_at,project_name&order=created_at.asc").catch(()=>null),
  ]);
  return{
    releases:releases?.ok?await releases.json():[],
    targets:targets?.ok?await targets.json():[],
    settings:settings?.ok?await settings.json():[],
    flags:flags?.ok?await flags.json():[],
    overrides:overrides?.ok?await overrides.json():[],
    checks:checks?.ok?await checks.json():[],
    companies:companies?.ok?await companies.json():[],
    instances:instances?.ok?await instances.json():[],
  };
}

async function environmentAliases(){
  const rows=[] as Array<Record<string,unknown>>;
  for(const env of RELEASE_ENVIRONMENTS){
    if(!env.alias){rows.push({...env,deploymentId:null,aliasStatus:"not-applicable"});continue}
    const alias=await inspectAlias(env.alias);
    rows.push({...env,deploymentId:alias.deploymentId||null,aliasStatus:alias.ok?"ok":"error",aliasError:alias.error||null});
  }
  return rows;
}

export async function GET(request:NextRequest){
  if(!manager(request))return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const schema=await ensureReleaseGovernanceSchema().catch(error=>({ready:false,reason:error instanceof Error?error.message:"Falha ao preparar governança."}));
  if(!schema.ready)return NextResponse.json({ready:false,schema,environments:RELEASE_ENVIRONMENTS,releases:[],targets:[],settings:[],flags:[],overrides:[],checks:[],companies:[],instances:[]});
  const data=await listData();
  return NextResponse.json({ready:true,schema,environments:await environmentAliases(),...data,dualApproval:process.env.PROAR_RELEASE_DUAL_APPROVAL==="true"});
}

async function seedInternalQaState(actor:string){
  const db=await resolveTenantDb(INTERNAL_QA_COMPANY_ID);
  if(!db.url||!db.key)return{seeded:false,reason:"Banco interno ainda não está pronto."};
  const existing=await databaseFetch(db.url+"/rest/v1/proar_state?id=eq.main&select=id",{headers:tenantHeaders(db.key),cache:"no-store"});
  const rows=existing.ok?await existing.json():[];
  if(rows.length)return{seeded:false,reason:"Base sintética já inicializada."};
  const createdAt=now();
  const payload={
    _revision:1,_updatedAt:createdAt,_companyId:INTERNAL_QA_COMPANY_ID,_synthetic:true,
    customers:[{id:"QA-CLI-001",name:"Cliente Sintético ProAR",doc:"00.000.000/0001-00",city:"Ambiente QA",state:"SP",status:"Ativo"}],
    serviceOrders:[{id:"QA-OS-001",customerId:"QA-CLI-001",client:"Cliente Sintético ProAR",description:"Teste sintético de ponta a ponta",status:"Aberta",priority:"Normal",date:createdAt.slice(0,10)}],
    moduleRecords:{
      "Funcionários":[{id:"QA-USR-001",name:"Administrador QA",employeeUsername:"qa.admin",employeeRole:"Administrador",status:"Ativo"}],
      "Equipamentos":[{id:"QA-EQP-001",name:"Split QA 12.000 BTUs",client:"Cliente Sintético ProAR",customerId:"QA-CLI-001",brand:"ProAR QA",model:"SYNTH-12000",status:"Ativo"}],
      "Orçamentos":[{id:"QA-ORC-001",name:"Orçamento Sintético",client:"Cliente Sintético ProAR",customerId:"QA-CLI-001",status:"Criado",value:650}],
      "Vendas":[{id:"QA-VND-001",name:"Venda Sintética",client:"Cliente Sintético ProAR",customerId:"QA-CLI-001",status:"Pendente",value:650}],
      "Produtos":[{id:"QA-PRD-001",name:"Material QA",category:"Sintético",status:"Ativo",value:10}],
      "Estoque":[{id:"QA-EST-001",name:"Material QA",quantity:10,status:"Disponível"}],
      "Compras":[{id:"QA-CMP-001",name:"Compra Sintética",status:"Pendente",value:100}],
      "Fornecedores":[{id:"QA-FOR-001",name:"Fornecedor Sintético",status:"Ativo"}],
      "Financeiro":[{id:"QA-FIN-001",name:"Recebimento Sintético",transactionType:"Receber",status:"Em aberto",value:650}],
      "PMOC":[{id:"QA-PMOC-001",name:"PMOC Sintético",client:"Cliente Sintético ProAR",status:"Ativo"}],
      "Obras":[{id:"QA-OBR-001",name:"Obra Sintética",client:"Cliente Sintético ProAR",status:"INÍCIO"}],
      "Licitações":[{id:"QA-LIC-001",name:"Licitação Sintética",status:"Monitorando",value:1000}],
      "Fiscal":[{id:"QA-FIS-001",name:"Documento Fiscal Sintético",status:"Pendente"}],
      "Diagnósticos":[{id:"QA-DIA-001",name:"Diagnóstico Sintético",status:"Aberto"}],
      "Atividades":[{id:"QA-ATV-001",name:"Seed QA criado",status:"Concluído",createdAt}],
    },
  };
  const response=await databaseFetch(db.url+"/rest/v1/proar_state?on_conflict=id",{method:"POST",headers:{...tenantHeaders(db.key),Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:"main",payload,updated_by:actor,updated_at:createdAt}),cache:"no-store"});
  return response.ok?{seeded:true,reason:null}:{seeded:false,reason:"Falha ao criar dados sintéticos."};
}

async function ensureInternalTenant(actor:string){
  const existingResponse=await supabaseRest(`proar_companies?select=*&id=eq.${encodeURIComponent(INTERNAL_QA_COMPANY_ID)}&limit=1`);
  const existing=existingResponse.ok?(await existingResponse.json())[0]:null;
  if(!existing){
    const record={
      id:INTERNAL_QA_COMPANY_ID,
      legal_name:"ProAR Interno QA",
      trade_name:"ProAR Interno",
      slug:INTERNAL_QA_COMPANY_SLUG,
      status:"active",
      plan_code:"completo",
      modules:ALL_MANAGER_MODULES,
      billing_enabled:false,
      email:"",
      city:"Ambiente interno",
      state:"SP",
      created_at:now(),
      updated_at:now(),
    };
    const inserted=await supabaseRest("proar_companies?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(record)});
    if(!inserted.ok)throw new Error("Não foi possível criar o tenant interno de QA.");
  }
  const instanceResponse=await supabaseRest(`proar_tenant_instances?select=*&company_id=eq.${encodeURIComponent(INTERNAL_QA_COMPANY_ID)}&limit=1`);
  const instance=instanceResponse.ok?(await instanceResponse.json())[0]:null;
  let provisioning:unknown=instance||null;
  if(!instance){
    provisioning=await provisionTenant({id:INTERNAL_QA_COMPANY_ID,slug:INTERNAL_QA_COMPANY_SLUG,tradeName:"ProAR Interno"});
  }else if(instance.provisioning_status==="creating"&&instance.project_ref){
    provisioning=await resumeTenantProvisioning(INTERNAL_QA_COMPANY_ID).catch(()=>instance);
  }
  await supabaseRest("proar_tenant_release_settings?on_conflict=company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({
    company_id:INTERNAL_QA_COMPANY_ID,release_channel:"internal",update_policy:"manual",schema_version:PROAR_SCHEMA_VERSION,
    maintenance_mode:false,updated_at:now(),
  })});
  const synthetic=await seedInternalQaState(actor).catch(error=>({seeded:false,reason:error instanceof Error?error.message:"Falha no seed sintético."}));
  await audit("RELEASE_INTERNAL_BOOTSTRAP",actor,{companyId:INTERNAL_QA_COMPANY_ID,provisioning,synthetic});
  return{companyId:INTERNAL_QA_COMPANY_ID,provisioning,synthetic};
}

async function releaseById(id:string):Promise<ProARReleaseRecord|null>{
  const response=await supabaseRest(`proar_releases?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  if(!response.ok)return null;
  return(await response.json())[0]||null;
}

async function settingFor(companyId:string):Promise<TenantReleaseSettings|null>{
  const response=await supabaseRest(`proar_tenant_release_settings?select=*&company_id=eq.${encodeURIComponent(companyId)}&limit=1`);
  if(!response.ok)return null;
  return(await response.json())[0]||null;
}

async function companyById(companyId:string){
  const response=await supabaseRest(`proar_companies?select=id,slug,trade_name,legal_name,status& id=eq.${encodeURIComponent(companyId)}&limit=1`.replace("& ","&"));
  if(!response.ok)return null;
  return(await response.json())[0]||null;
}

async function criticalIncidentCount(companyId:string){
  const since=new Date(Date.now()-15*60*1000).toISOString();
  const response=await supabaseRest(`proar_system_incidents?select=id&company_id=eq.${encodeURIComponent(companyId)}&severity=eq.critical&created_at=gte.${encodeURIComponent(since)}&limit=20`).catch(()=>null);
  if(!response?.ok)return 0;
  return (await response.json()).length;
}

async function upsertTarget(input:{
  release:ProARReleaseRecord;companyId?:string|null;environmentCode:ReleaseChannel;alias:string;
  status:ReleaseTarget["status"];previousVersion?:string|null;previousDeploymentId?:string|null;snapshotId?:number|null;
  healthStatus?:"ok"|"warning"|"error"|null;errorCode?:string|null;errorMessage?:string|null;scheduledAt?:string|null;
}){
  const response=await supabaseRest("proar_release_targets?on_conflict=release_id,environment_code,alias",{
    method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({
      release_id:input.release.id,company_id:input.companyId||null,environment_code:input.environmentCode,alias:input.alias,
      previous_version:input.previousVersion||null,previous_deployment_id:input.previousDeploymentId||null,
      target_version:input.release.version,target_deployment_id:input.release.deployment_id,status:input.status,
      health_status:input.healthStatus||null,snapshot_id:input.snapshotId||null,error_code:input.errorCode||null,error_message:input.errorMessage||null,
      scheduled_at:input.scheduledAt||null,applied_at:input.status==="active"?now():null,updated_at:now(),
    }),
  });
  if(!response.ok)return null;
  return (await response.json())[0]||null;
}

async function recordTargetFailure(release:ProARReleaseRecord,channel:ReleaseChannel,companyId:string|null,alias:string,code:string,error:string,previousDeploymentId?:string|null,snapshotId?:number|null){
  await upsertTarget({release,companyId,environmentCode:channel,alias,status:"failed",previousDeploymentId,snapshotId,healthStatus:"error",errorCode:code,errorMessage:error});
  await recordReleaseCheck({releaseId:release.id,companyId,environmentCode:channel,stage:"post",checkKey:"rollout",status:"error",code,detail:error});
  await recordSystemIncident({companyId:companyId||undefined,module:"Central de Versões",operation:"Rollout de release",code:"PROAR-DEPLOY-001",severity:"critical",route:"/api/manager/releases",metadata:{releaseId:release.id,version:release.version,channel,alias,error,releaseCode:code}});
}

async function applyTarget(release:ProARReleaseRecord,channel:ReleaseChannel,companyId:string|null,alias:string,actor:string){
  const setting=companyId?await settingFor(companyId):null;
  const schemaVersion=setting?.schema_version||PROAR_SCHEMA_VERSION;
  if(companyId&& !schemaCompatible(schemaVersion,release.minimum_schema_version)){
    const error=`Schema ${schemaVersion} incompatível. A release exige no mínimo ${release.minimum_schema_version}.`;
    await recordTargetFailure(release,channel,companyId,alias,"PROAR-REL-SCHEMA",error);
    return{ok:false,error,code:"PROAR-REL-SCHEMA"};
  }
  if(companyId&&await criticalIncidentCount(companyId)>0){
    const error="Rollout interrompido: há incidente crítico recente neste tenant.";
    await recordTargetFailure(release,channel,companyId,alias,"PROAR-REL-INCIDENT",error);
    return{ok:false,error,code:"PROAR-REL-INCIDENT"};
  }

  const currentAlias=await inspectAlias(alias);
  const previousDeploymentId=currentAlias.deploymentId||setting?.current_deployment_id||null;
  const previousVersion=setting?.current_version||null;
  let snapshotId:number|null=null;
  if(companyId){
    const snapshot=await snapshotBeforeRelease(companyId,actor);
    if(!snapshot.ok){
      const error=snapshot.error||"Snapshot pré-release falhou.";
      await recordTargetFailure(release,channel,companyId,alias,"PROAR-REL-SNAPSHOT",error,previousDeploymentId);
      return{ok:false,error,code:"PROAR-REL-SNAPSHOT"};
    }
    snapshotId=snapshot.snapshotId;
    await recordReleaseCheck({releaseId:release.id,companyId,environmentCode:channel,stage:"pre",checkKey:"snapshot",status:"ok",detail:snapshotId?`Snapshot ${snapshotId} criado.`:"Tenant ainda sem estado operacional."});
  }

  await upsertTarget({release,companyId,environmentCode:channel,alias,status:"deploying",previousVersion,previousDeploymentId,snapshotId});
  const assigned=await assignDeploymentAlias(release.deployment_id,alias);
  if(!assigned.ok){
    await recordTargetFailure(release,channel,companyId,alias,assigned.code||"PROAR-REL-ALIAS",assigned.error||"Falha no alias.",previousDeploymentId,snapshotId);
    return{ok:false,error:assigned.error,code:assigned.code};
  }

  await new Promise(resolve=>setTimeout(resolve,900));
  const health=await probeAlias(alias);
  await recordReleaseCheck({releaseId:release.id,companyId,environmentCode:channel,stage:"post",checkKey:"http-health",status:health.ok?"ok":"error",code:health.ok?null:"PROAR-REL-HEALTH",detail:`HTTP ${health.httpStatus}`,latencyMs:health.latencyMs});
  if(!health.ok){
    if(previousDeploymentId)await assignDeploymentAlias(previousDeploymentId,alias).catch(()=>null);
    const error=`Health check pós-deploy falhou em ${alias}. Rollback do alias foi solicitado automaticamente.`;
    await recordTargetFailure(release,channel,companyId,alias,"PROAR-REL-HEALTH",error,previousDeploymentId,snapshotId);
    return{ok:false,error,code:"PROAR-REL-HEALTH"};
  }

  await upsertTarget({release,companyId,environmentCode:channel,alias,status:"active",previousVersion,previousDeploymentId,snapshotId,healthStatus:"ok"});
  if(companyId){
    await supabaseRest("proar_tenant_release_settings?on_conflict=company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({
      company_id:companyId,
      release_channel:channel,
      current_version:release.version,
      current_deployment_id:release.deployment_id,
      schema_version:release.schema_version,
      last_health_at:now(),
      last_health_status:"ok",
      last_error_code:null,
      last_error_message:null,
      updated_at:now(),
    })});
  }
  await audit("RELEASE_TARGET_ACTIVE",actor,{releaseId:release.id,version:release.version,channel,alias,deploymentId:release.deployment_id,previousDeploymentId,snapshotId},companyId);
  return{ok:true,alias,companyId,health};
}

async function latestTarget(releaseIdValue:string,channel:ReleaseChannel){
  const response=await supabaseRest("proar_release_targets?select=*&release_id=eq."+encodeURIComponent(releaseIdValue)+"&environment_code=eq."+channel+"&order=created_at.desc&limit=1");
  return response.ok?((await response.json())[0] as ReleaseTarget|undefined):undefined;
}

async function validatePromotionSource(release:ProARReleaseRecord,next:ReleaseChannel){
  if(next===release.channel)return{ok:true as const};
  const source=await latestTarget(release.id,release.channel);
  if(!source||source.status!=="active"||source.health_status!=="ok"){
    return{ok:false as const,error:"A etapa "+release.channel+" ainda não possui target ativo e saudável.",code:"PROAR-REL-SOURCE-NOT-HEALTHY"};
  }
  if(next==="production"){
    const minMinutes=Math.max(0,Number(process.env.PROAR_CANARY_MINUTES||60));
    const applied=source.applied_at?new Date(source.applied_at).getTime():0;
    const elapsed=applied?Date.now()-applied:0;
    if(!applied||elapsed<minMinutes*60_000){
      const remaining=Math.max(1,Math.ceil((minMinutes*60_000-elapsed)/60_000));
      return{ok:false as const,error:"Canary ainda em observação. Aguarde aproximadamente "+remaining+" minuto(s) antes da Produção.",code:"PROAR-REL-CANARY-WINDOW"};
    }
    if(source.company_id&&await criticalIncidentCount(source.company_id)>0){
      return{ok:false as const,error:"Canary apresentou incidente crítico recente. A Produção permanece bloqueada.",code:"PROAR-REL-CANARY-REGRESSION"};
    }
  }
  return{ok:true as const};
}

function nextChannelAllowed(current:ReleaseChannel,next:ReleaseChannel){
  const order:ReleaseChannel[]=["internal","homologation","canary","production"];
  return order.indexOf(next)===order.indexOf(current)+1 || next===current;
}

export async function POST(request:NextRequest){
  const user=manager(request);
  if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"");
  const schema=await ensureReleaseGovernanceSchema().catch(error=>({ready:false,reason:error instanceof Error?error.message:"Falha ao preparar governança."}));
  if(!schema.ready)return NextResponse.json({error:schema.reason||"Governança de releases indisponível.",code:"PROAR-REL-SCHEMA-SETUP"},{status:503});

  try{
    if(action==="bootstrap-internal"){
      return NextResponse.json({saved:true,internal:await ensureInternalTenant(user.username)});
    }

    if(action==="create-release"){
      const version=String(body.version||"").trim();
      const deploymentId=String(body.deploymentId||"").trim();
      const commitSha=String(body.commitSha||"").trim();
      if(!version||!/^dpl_[A-Za-z0-9]+$/.test(deploymentId))return NextResponse.json({error:"Informe versão e deployment válido."},{status:400});
      const deployment=await inspectDeployment(deploymentId);
      if(!deployment.ok)return NextResponse.json({error:"O deployment precisa estar READY antes de entrar no fluxo.",code:"PROAR-REL-DEPLOYMENT"},{status:409});
      if(commitSha&&deployment.commitSha&&commitSha!==deployment.commitSha)return NextResponse.json({error:"O commit informado não corresponde ao deployment selecionado.",code:"PROAR-REL-COMMIT"},{status:409});
      const migrations=Array.isArray(body.migrations)?body.migrations:[];
      const unsafeMigration=migrations.find((item:unknown)=>{
        if(!item||typeof item!=="object")return false;
        const migration=item as Record<string,unknown>;
        return migration.destructive===true&&migration.reversible!==true;
      });
      if(unsafeMigration)return NextResponse.json({error:"Migration destrutiva sem rollback declarado foi bloqueada.",code:"PROAR-REL-MIGRATION-SAFETY"},{status:409});
      const id=releaseId(version);
      const release:ProARReleaseRecord={
        id,version,commit_sha:commitSha||deployment.commitSha||"",
        deployment_id:deploymentId,schema_version:String(body.schemaVersion||PROAR_SCHEMA_VERSION),
        minimum_schema_version:String(body.minimumSchemaVersion||PROAR_SCHEMA_VERSION),
        channel:"internal",status:"testing",title:String(body.title||`ProAR ${version}`).slice(0,160),
        summary:String(body.summary||"").slice(0,1000)||null,
        affected_modules:Array.isArray(body.affectedModules)?body.affectedModules:[],
        notes:Array.isArray(body.notes)?body.notes:[],
        migrations,
        compatibility:body.compatibility&&typeof body.compatibility==="object"?body.compatibility as Record<string,unknown>:{},
        quality_gate:{deploymentReady:true,commitVerified:Boolean(deployment.commitSha),createdAt:now()},
        approval_required:body.approvalRequired!==false,created_by:user.username,updated_at:now(),
      };
      const response=await supabaseRest("proar_releases?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(release)});
      if(!response.ok)return NextResponse.json({error:"Não foi possível registrar a release."},{status:502});
      await audit("RELEASE_CREATED",user.username,{releaseId:id,version,deploymentId,commitSha:release.commit_sha});
      await ensureInternalTenant(user.username);
      const internal=await applyTarget(release,"internal",INTERNAL_QA_COMPANY_ID,"teste.proar.online",user.username);
      if(!internal.ok){
        await supabaseRest(`proar_releases?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"failed",updated_at:now()})});
        return NextResponse.json({saved:true,release,internal,error:"Release registrada, mas a publicação no ProAR Interno falhou. Corrija a causa e use Repetir Interno.",code:"PROAR-REL-INTERNAL-PUBLISH"},{status:409});
      }
      return NextResponse.json({saved:true,release,internal});
    }

    if(action==="publish-internal"){
      const id=String(body.releaseId||"");
      const release=await releaseById(id);
      if(!release)return NextResponse.json({error:"Release não encontrada."},{status:404});
      await ensureInternalTenant(user.username);
      await supabaseRest(`proar_releases?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({channel:"internal",status:"testing",updated_at:now()})});
      const result=await applyTarget({...release,channel:"internal",status:"testing"},"internal",INTERNAL_QA_COMPANY_ID,"teste.proar.online",user.username);
      if(!result.ok)return NextResponse.json({saved:false,error:result.error||"Falha ao publicar no ProAR Interno.",code:result.code||"PROAR-REL-INTERNAL-PUBLISH"},{status:409});
      await audit("RELEASE_INTERNAL_PUBLISHED",user.username,{releaseId:id,version:release.version,deploymentId:release.deployment_id});
      return NextResponse.json({saved:true,published:true,result});
    }

    if(action==="approve"){
      const id=String(body.releaseId||"");
      const release=await releaseById(id);
      if(!release)return NextResponse.json({error:"Release não encontrada."},{status:404});
      if(process.env.PROAR_RELEASE_DUAL_APPROVAL==="true"&&release.created_by===user.username){
        return NextResponse.json({error:"Aprovação em duas etapas está ativa. Outro administrador deve aprovar esta release.",code:"PROAR-REL-DUAL-APPROVAL"},{status:409});
      }
      await supabaseRest(`proar_releases?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"approved",approved_by:user.username,approved_at:now(),updated_at:now()})});
      await audit("RELEASE_APPROVED",user.username,{releaseId:id,version:release.version});
      return NextResponse.json({saved:true,approved:true});
    }

    if(action==="tenant-policy"){
      const companyId=String(body.companyId||"").trim();
      if(!companyId)return NextResponse.json({error:"Empresa não informada."},{status:400});
      const patch={
        company_id:companyId,
        release_channel:["internal","homologation","canary","production"].includes(String(body.releaseChannel))?String(body.releaseChannel):"production",
        update_policy:["automatic","manual","pinned","scheduled"].includes(String(body.updatePolicy))?String(body.updatePolicy):"automatic",
        pinned_version:String(body.pinnedVersion||"").trim()||null,
        schema_version:String(body.schemaVersion||PROAR_SCHEMA_VERSION).trim(),
        maintenance_mode:Boolean(body.maintenanceMode),
        maintenance_message:String(body.maintenanceMessage||"").trim().slice(0,240)||null,
        scheduled_update_at:String(body.scheduledUpdateAt||"").trim()||null,
        updated_at:now(),
      };
      await supabaseRest("proar_tenant_release_settings?on_conflict=company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(patch)});
      await audit("TENANT_RELEASE_POLICY_UPDATED",user.username,patch,companyId);
      return NextResponse.json({saved:true,settings:patch});
    }

    if(action==="feature-flag"){
      const flagKey=String(body.flagKey||"").trim().toLowerCase().replace(/[^a-z0-9._:-]/g,"-").slice(0,100);
      if(!flagKey)return NextResponse.json({error:"Chave da feature flag não informada."},{status:400});
      const flag={
        flag_key:flagKey,name:String(body.name||flagKey).slice(0,140),description:String(body.description||"").slice(0,500)||null,
        module_name:String(body.moduleName||"").trim().slice(0,120)||null,status:["active","paused","retired"].includes(String(body.status))?String(body.status):"active",
        default_enabled:Boolean(body.defaultEnabled),internal_enabled:body.internalEnabled!==false,homologation_enabled:Boolean(body.homologationEnabled),
        canary_percent:Math.max(0,Math.min(100,Math.round(Number(body.canaryPercent)||0))),production_enabled:Boolean(body.productionEnabled),
        created_by:user.username,updated_at:now(),
      };
      await supabaseRest("proar_feature_flags?on_conflict=flag_key",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(flag)});
      await audit("FEATURE_FLAG_UPDATED",user.username,{flagKey,...flag});
      return NextResponse.json({saved:true,flag});
    }

    if(action==="feature-override"){
      const companyId=String(body.companyId||"").trim();
      const flagKey=String(body.flagKey||"").trim();
      if(!companyId||!flagKey)return NextResponse.json({error:"Empresa e feature flag são obrigatórias."},{status:400});
      const row={flag_key:flagKey,company_id:companyId,enabled:Boolean(body.enabled),reason:String(body.reason||"").slice(0,240)||null,updated_by:user.username,updated_at:now()};
      await supabaseRest("proar_feature_flag_overrides?on_conflict=flag_key,company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(row)});
      await audit("FEATURE_FLAG_OVERRIDE",user.username,row,companyId);
      return NextResponse.json({saved:true,override:row});
    }

    if(action==="promote"){
      const id=String(body.releaseId||"");
      const channel=String(body.channel||"") as ReleaseChannel;
      const release=await releaseById(id);
      if(!release)return NextResponse.json({error:"Release não encontrada."},{status:404});
      if(!RELEASE_ENVIRONMENTS.some(env=>env.code===channel))return NextResponse.json({error:"Canal inválido."},{status:400});
      if(!nextChannelAllowed(release.channel,channel))return NextResponse.json({error:`Fluxo inválido: ${release.channel} deve avançar somente para o próximo canal.`,code:"PROAR-REL-FLOW"},{status:409});
      const sourceGate=await validatePromotionSource(release,channel);
      if(!sourceGate.ok)return NextResponse.json({error:sourceGate.error,code:sourceGate.code},{status:409});

      const customerFacing=channel==="canary"||channel==="production";
      if(customerFacing&&release.approval_required&&!release.approved_by){
        return NextResponse.json({error:"Esta release precisa de aprovação antes de chegar a clientes.",code:"PROAR-REL-APPROVAL"},{status:409});
      }

      const scheduledAt=String(body.scheduledAt||"").trim();
      const future=scheduledAt&&new Date(scheduledAt).getTime()>Date.now()+60_000;
      let targets:Array<{companyId:string|null;alias:string}>=[];
      const env=RELEASE_ENVIRONMENTS.find(item=>item.code===channel)!;
      if(channel==="internal"||channel==="homologation"){
        await ensureInternalTenant(user.username);
        targets=[{companyId:INTERNAL_QA_COMPANY_ID,alias:String(env.alias)}];
      }else{
        let requested=Array.isArray(body.companyIds)?body.companyIds.map((value:unknown)=>String(value)).filter(Boolean):[];
        if(channel==="canary"&&!requested.length)return NextResponse.json({error:"Selecione ao menos um tenant para o Canary."},{status:400});
        if(channel==="production"&&!requested.length){
          const response=await supabaseRest("proar_companies?select=id,slug,status&status=eq.active&order=created_at.asc");
          const rows=response.ok?await response.json():[];
          requested=rows.filter((row:{id?:string})=>row.id!==INTERNAL_QA_COMPANY_ID).map((row:{id:string})=>row.id);
        }
        for(const companyId of requested){
          const company=await companyById(companyId);
          if(!company?.slug||company.status!=="active")continue;
          const settings=await settingFor(companyId);
          if(channel==="production"&&settings?.update_policy==="pinned"&&settings.pinned_version&&settings.pinned_version!==release.version)continue;
          if(channel==="production"&&settings?.update_policy==="manual"&&!Array.isArray(body.companyIds))continue;
          targets.push({companyId,alias:companyAlias(String(company.slug))});
        }
      }
      if(!targets.length)return NextResponse.json({error:"Nenhum target elegível para esta promoção."},{status:409});

      // A liberação geral nunca acontece em massa no mesmo request. Produção é escalonada
      // em lotes para que health checks e incidentes possam interromper o restante.
      if(channel==="production"&&!Array.isArray(body.companyIds)&&!future){
        const batchSize=Math.max(1,Math.min(20,Number(process.env.PROAR_PRODUCTION_BATCH_SIZE||5)));
        const batchMinutes=Math.max(15,Number(process.env.PROAR_PRODUCTION_BATCH_MINUTES||60));
        for(let index=0;index<targets.length;index+=1){
          const batch=Math.floor(index/batchSize);
          const targetSchedule=new Date(Date.now()+batch*batchMinutes*60_000).toISOString();
          await upsertTarget({release,companyId:targets[index].companyId,environmentCode:channel,alias:targets[index].alias,status:"scheduled",scheduledAt:targetSchedule});
        }
        await supabaseRest(`proar_releases?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({channel:"production",status:"scheduled",scheduled_at:now(),updated_at:now()})});
        await audit("RELEASE_PRODUCTION_STAGED",user.username,{releaseId:id,version:release.version,totalTargets:targets.length,batchSize,batchMinutes});
        return NextResponse.json({saved:true,scheduled:true,staged:true,targets:targets.length,batchSize,batchMinutes});
      }

      if(future){
        for(const target of targets)await upsertTarget({release,companyId:target.companyId,environmentCode:channel,alias:target.alias,status:"scheduled",scheduledAt});
        await supabaseRest(`proar_releases?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"scheduled",scheduled_at:scheduledAt,updated_at:now()})});
        await audit("RELEASE_SCHEDULED",user.username,{releaseId:id,version:release.version,channel,scheduledAt,targets:targets.map(item=>item.alias)});
        return NextResponse.json({saved:true,scheduled:true,targets:targets.length});
      }

      await supabaseRest(`proar_releases?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"rolling_out",updated_at:now()})});
      const results=[] as Array<Record<string,unknown>>;
      for(const target of targets){
        const result=await applyTarget(release,channel,target.companyId,target.alias,user.username);
        results.push({...target,...result});
        if(!result.ok){
          await supabaseRest(`proar_releases?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"failed",updated_at:now()})});
          await audit("RELEASE_ROLLOUT_HALTED",user.username,{releaseId:id,version:release.version,channel,failedAlias:target.alias,results});
          return NextResponse.json({saved:false,halted:true,error:"Rollout interrompido automaticamente após falha de validação.",results},{status:409});
        }
      }
      await supabaseRest(`proar_releases?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({channel,status:channel==="homologation"&&release.approval_required?"testing":"active",promoted_at:now(),scheduled_at:null,updated_at:now()})});
      await audit("RELEASE_PROMOTED",user.username,{releaseId:id,version:release.version,channel,targets:results.map(item=>item.alias)});
      return NextResponse.json({saved:true,promoted:true,channel,results});
    }

    if(action==="rollback-target"){
      const targetId=Number(body.targetId);
      const response=await supabaseRest(`proar_release_targets?select=*&id=eq.${targetId}&limit=1`);
      const target=response.ok?(await response.json())[0] as ReleaseTarget|undefined:undefined;
      if(!target)return NextResponse.json({error:"Target de release não encontrado."},{status:404});
      if(!target.previous_deployment_id)return NextResponse.json({error:"Este target não possui deployment anterior registrado."},{status:409});
      const aliasResult=await assignDeploymentAlias(target.previous_deployment_id,target.alias);
      if(!aliasResult.ok)return NextResponse.json({error:aliasResult.error,code:aliasResult.code},{status:502});
      let dataRollback:unknown=null;
      if(target.company_id&&target.snapshot_id&&body.restoreData!==false){
        dataRollback=await restoreReleaseSnapshot(target.company_id,target.snapshot_id,user.username);
        if(!(dataRollback as {ok?:boolean})?.ok)return NextResponse.json({error:(dataRollback as {error?:string}).error||"Código restaurado, mas os dados não puderam ser restaurados.",code:"PROAR-REL-DATA-ROLLBACK"},{status:502});
      }
      await supabaseRest(`proar_release_targets?id=eq.${targetId}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"rolled_back",rolled_back_at:now(),health_status:"warning",updated_at:now()})});
      if(target.company_id)await supabaseRest("proar_tenant_release_settings?on_conflict=company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({company_id:target.company_id,current_version:target.previous_version||null,current_deployment_id:target.previous_deployment_id,last_health_status:"warning",updated_at:now()})});
      await audit("RELEASE_TARGET_ROLLBACK",user.username,{targetId,alias:target.alias,from:target.target_deployment_id,to:target.previous_deployment_id,dataRollback},target.company_id||null);
      return NextResponse.json({saved:true,rolledBack:true,dataRollback});
    }

    if(action==="health"){
      const alias=String(body.alias||"").trim();
      if(!alias)return NextResponse.json({error:"Alias não informado."},{status:400});
      const health=await probeAlias(alias);
      return NextResponse.json({checked:true,health},{status:health.ok?200:503});
    }

    return NextResponse.json({error:"Ação de release desconhecida."},{status:400});
  }catch(error){
    const message=error instanceof Error?error.message:"Falha na governança de releases.";
    await recordSystemIncident({module:"Central de Versões",operation:action||"ação desconhecida",code:"PROAR-UNKNOWN-001",severity:"error",route:"/api/manager/releases",error:message,metadata:{actor:user.username,releaseCode:"PROAR-REL-UNEXPECTED"}});
    return NextResponse.json({error:message,code:"PROAR-REL-UNEXPECTED"},{status:500});
  }
}
