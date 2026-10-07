import { neon } from "@neondatabase/serverless";
import { createStateSnapshot, getStateSnapshot, listStateSnapshots } from "./state-snapshots";
import { databaseProvider, databaseFetch, supabaseRest } from "./supabase-rest";
import { resolveTenantDb, tenantHeaders } from "./tenant-rest";

export type ReleaseChannel="internal"|"homologation"|"canary"|"production";
export type ReleaseStatus="draft"|"testing"|"approved"|"scheduled"|"rolling_out"|"active"|"failed"|"rolled_back";
export type ReleaseEnvironment={code:ReleaseChannel;name:string;alias?:string|null;description?:string|null;customer_facing:boolean;requires_approval:boolean};
export type ProARReleaseRecord={
  id:string;version:string;commit_sha:string;deployment_id:string;schema_version:string;minimum_schema_version:string;
  channel:ReleaseChannel;status:ReleaseStatus;title:string;summary?:string|null;affected_modules?:string[];notes?:unknown[];
  migrations?:unknown[];compatibility?:Record<string,unknown>;quality_gate?:Record<string,unknown>;
  approval_required:boolean;created_by:string;approved_by?:string|null;approved_at?:string|null;scheduled_at?:string|null;promoted_at?:string|null;
  created_at?:string;updated_at?:string;
};
export type TenantReleaseSettings={
  company_id:string;release_channel:ReleaseChannel;update_policy:"automatic"|"manual"|"pinned"|"scheduled";
  pinned_version?:string|null;current_version?:string|null;current_deployment_id?:string|null;schema_version:string;
  maintenance_mode:boolean;maintenance_message?:string|null;scheduled_update_at?:string|null;
  last_health_at?:string|null;last_health_status?:"ok"|"warning"|"error"|null;last_error_code?:string|null;last_error_message?:string|null;
};
export type FeatureFlag={
  flag_key:string;name:string;description?:string|null;module_name?:string|null;status:"active"|"paused"|"retired";
  default_enabled:boolean;internal_enabled:boolean;homologation_enabled:boolean;canary_percent:number;production_enabled:boolean;
  created_by?:string|null;updated_at?:string;
};
export type ReleaseTarget={
  id:number;release_id:string;company_id?:string|null;environment_code:ReleaseChannel;alias:string;
  previous_version?:string|null;previous_deployment_id?:string|null;target_version:string;target_deployment_id:string;
  status:"pending"|"validating"|"scheduled"|"deploying"|"active"|"failed"|"blocked"|"rolled_back";
  health_status?:"ok"|"warning"|"error"|null;snapshot_id?:number|null;error_code?:string|null;error_message?:string|null;
  scheduled_at?:string|null;applied_at?:string|null;rolled_back_at?:string|null;created_at?:string;updated_at?:string;
};

export const RELEASE_ENVIRONMENTS:ReleaseEnvironment[]=[
  {code:"internal",name:"ProAR Interno",alias:"teste.proar.online",description:"Primeiro ambiente, somente equipe ProAR e dados sintéticos.",customer_facing:false,requires_approval:false},
  {code:"homologation",name:"Homologação",alias:"homologacao.proar.online",description:"Release Candidate validada antes de chegar a clientes.",customer_facing:false,requires_approval:false},
  {code:"canary",name:"Canary",description:"Liberação gradual para tenants selecionados.",customer_facing:true,requires_approval:true},
  {code:"production",name:"Produção",description:"Versão aprovada para PolarTech e demais clientes.",customer_facing:true,requires_approval:true},
];

export const INTERNAL_QA_COMPANY_ID="proar-internal";
export const INTERNAL_QA_COMPANY_SLUG="proar-internal";
export const INTERNAL_HOSTS=new Set(["teste.proar.online","homologacao.proar.online"]);

function primaryNeonUrl(){
  return process.env.PROAR_NEON_DATABASE_URL
    ?? process.env.PROAR_NEON_POSTGRES_URL
    ?? process.env.PROAR_NEON_POSTGRES_URL_NON_POOLING
    ?? process.env.PROAR_NEON_DATABASE_URL_UNPOOLED
    ?? "";
}

const ddl=[
  `create table if not exists proar_release_environments (
    code text primary key check (code in ('internal','homologation','canary','production')),
    name text not null, alias text, description text, customer_facing boolean not null default false,
    requires_approval boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `create table if not exists proar_releases (
    id text primary key, version text not null unique, commit_sha text not null, deployment_id text not null,
    schema_version text not null, minimum_schema_version text not null,
    channel text not null default 'internal' check (channel in ('internal','homologation','canary','production')),
    status text not null default 'draft' check (status in ('draft','testing','approved','scheduled','rolling_out','active','failed','rolled_back')),
    title text not null, summary text, affected_modules jsonb not null default '[]'::jsonb, notes jsonb not null default '[]'::jsonb,
    migrations jsonb not null default '[]'::jsonb, compatibility jsonb not null default '{}'::jsonb, quality_gate jsonb not null default '{}'::jsonb,
    approval_required boolean not null default true, created_by text not null, approved_by text, approved_at timestamptz,
    scheduled_at timestamptz, promoted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `create table if not exists proar_release_targets (
    id bigint generated by default as identity primary key, release_id text not null references proar_releases(id), company_id text,
    environment_code text not null references proar_release_environments(code), alias text not null, previous_version text,
    previous_deployment_id text, target_version text not null, target_deployment_id text not null,
    status text not null default 'pending' check (status in ('pending','validating','scheduled','deploying','active','failed','blocked','rolled_back')),
    health_status text check (health_status is null or health_status in ('ok','warning','error')), snapshot_id bigint,
    error_code text, error_message text, scheduled_at timestamptz, applied_at timestamptz, rolled_back_at timestamptz,
    created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    unique (release_id,environment_code,alias))`,
  `create table if not exists proar_tenant_release_settings (
    company_id text primary key, release_channel text not null default 'production' check (release_channel in ('internal','homologation','canary','production')),
    update_policy text not null default 'automatic' check (update_policy in ('automatic','manual','pinned','scheduled')),
    pinned_version text, current_version text, current_deployment_id text, schema_version text not null default '2026.10.06',
    maintenance_mode boolean not null default false, maintenance_message text, scheduled_update_at timestamptz,
    last_health_at timestamptz, last_health_status text check (last_health_status is null or last_health_status in ('ok','warning','error')),
    last_error_code text, last_error_message text, updated_at timestamptz not null default now())`,
  `create table if not exists proar_feature_flags (
    flag_key text primary key, name text not null, description text, module_name text,
    status text not null default 'active' check (status in ('active','paused','retired')),
    default_enabled boolean not null default false, internal_enabled boolean not null default true, homologation_enabled boolean not null default false,
    canary_percent integer not null default 0 check (canary_percent between 0 and 100), production_enabled boolean not null default false,
    created_by text, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `create table if not exists proar_feature_flag_overrides (
    flag_key text not null references proar_feature_flags(flag_key), company_id text not null, enabled boolean not null,
    reason text, updated_by text, updated_at timestamptz not null default now(), primary key (flag_key,company_id))`,
  `create table if not exists proar_release_checks (
    id bigint generated by default as identity primary key, release_id text not null references proar_releases(id), company_id text,
    environment_code text not null, stage text not null check (stage in ('pre','post','continuous')), check_key text not null,
    status text not null check (status in ('ok','warning','error')), code text, detail text, latency_ms integer, checked_at timestamptz not null default now())`,
  `create index if not exists proar_releases_channel_status_idx on proar_releases(channel,status,created_at desc)`,
  `create index if not exists proar_release_targets_company_idx on proar_release_targets(company_id,created_at desc)`,
  `create index if not exists proar_release_targets_status_idx on proar_release_targets(status,scheduled_at)`,
  `create index if not exists proar_tenant_release_settings_channel_idx on proar_tenant_release_settings(release_channel,update_policy)`,
  `create index if not exists proar_release_checks_release_idx on proar_release_checks(release_id,checked_at desc)`,
];

export async function ensureReleaseGovernanceSchema(){
  if(databaseProvider()!=="neon") return {ready:false,reason:"A inicialização automática da governança está habilitada apenas no banco mestre Neon. A migration SQL continua disponível para execução controlada."};
  const url=primaryNeonUrl();
  if(!url)return{ready:false,reason:"Conexão Neon do banco mestre não configurada."};
  const sql=neon(url);
  for(const statement of ddl)await sql.query(statement,[]);
  for(const env of RELEASE_ENVIRONMENTS){
    await sql.query(
      `insert into proar_release_environments(code,name,alias,description,customer_facing,requires_approval)
       values($1,$2,$3,$4,$5,$6) on conflict(code) do update set name=excluded.name,alias=excluded.alias,description=excluded.description,
       customer_facing=excluded.customer_facing,requires_approval=excluded.requires_approval,updated_at=now()`,
      [env.code,env.name,env.alias||null,env.description||null,env.customer_facing,env.requires_approval],
    );
  }
  return{ready:true,reason:null};
}

export function normalizeVersion(value:unknown){
  return String(value||"").trim().replace(/^v/i,"").slice(0,80);
}

function versionParts(value:string){
  return normalizeVersion(value).split(/[^0-9]+/).filter(Boolean).map(part=>Number(part));
}

export function compareVersions(left:string,right:string){
  const a=versionParts(left),b=versionParts(right),length=Math.max(a.length,b.length);
  for(let i=0;i<length;i+=1){const diff=(a[i]||0)-(b[i]||0);if(diff)return diff>0?1:-1}
  return 0;
}

export function schemaCompatible(current:string,minimum:string){
  return compareVersions(current,minimum)>=0;
}

export function companyAlias(slug:string){
  const root=String(process.env.PROAR_ROOT_DOMAIN||"proar.online").replace(/^https?:\/\//,"").replace(/\/$/,"");
  return `${String(slug||"").trim().toLowerCase()}.${root}`;
}

export function releaseId(version:string){
  return `REL-${normalizeVersion(version).replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"").toUpperCase()}`;
}

function vercelConfig(){
  return{
    token:String(process.env.VERCEL_TOKEN||"").trim(),
    projectId:String(process.env.VERCEL_PROJECT_ID||"").trim(),
    teamId:String(process.env.VERCEL_TEAM_ID||"").trim(),
  };
}

function vercelQuery(teamId:string){
  return teamId?`?teamId=${encodeURIComponent(teamId)}`:"";
}

export async function assignDeploymentAlias(deploymentId:string,alias:string){
  const cfg=vercelConfig();
  if(!cfg.token||!cfg.projectId)return{ok:false,code:"PROAR-REL-VERCEL-CONFIG",error:"Vercel não configurada para promoção controlada."};
  if(!/^dpl_[A-Za-z0-9]+$/.test(deploymentId))return{ok:false,code:"PROAR-REL-DEPLOYMENT",error:"Deployment inválido."};
  const response=await fetch(`https://api.vercel.com/v2/deployments/${encodeURIComponent(deploymentId)}/aliases${vercelQuery(cfg.teamId)}`,{
    method:"POST",
    headers:{Authorization:`Bearer ${cfg.token}`,"Content-Type":"application/json"},
    body:JSON.stringify({alias}),
    cache:"no-store",
  });
  if(!response.ok){
    const detail=await response.text().catch(()=>"");
    return{ok:false,code:"PROAR-REL-ALIAS",error:`Falha ao apontar ${alias}: HTTP ${response.status} ${detail.slice(0,180)}`};
  }
  return{ok:true,alias,deploymentId};
}

export async function inspectGitQualityGate(commitSha:string){
  const sha=String(commitSha||"").trim();
  if(!/^[a-f0-9]{7,40}$/i.test(sha))return{passed:false,checks:[],error:"Commit SHA inválido."};
  const org=String(process.env.PROAR_GITHUB_ORG||"polartechatendimentos-beep");
  const repository=String(process.env.PROAR_GITHUB_REPO||"ProAR");
  const token=String(process.env.GITHUB_TOKEN||process.env.PROAR_GITHUB_TOKEN||"").trim();
  const headers:Record<string,string>={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"};
  if(token)headers.Authorization="Bearer "+token;
  const response=await fetch("https://api.github.com/repos/"+encodeURIComponent(org)+"/"+encodeURIComponent(repository)+"/commits/"+encodeURIComponent(sha)+"/check-runs?per_page=100",{headers,cache:"no-store"});
  if(!response.ok)return{passed:false,checks:[],error:"GitHub checks indisponíveis (HTTP "+response.status+")."};
  const payload=await response.json() as {check_runs?:Array<{name?:string;status?:string;conclusion?:string;html_url?:string}>};
  const checks=(payload.check_runs||[]).map(check=>({name:String(check.name||""),status:String(check.status||""),conclusion:String(check.conclusion||""),url:check.html_url||null}));
  const validation=checks.filter(check=>/validate|validar proar/i.test(check.name));
  return{passed:validation.length>0&&validation.every(check=>check.status==="completed"&&check.conclusion==="success"),checks,error:null};
}

export async function inspectDeployment(deploymentId:string){
  const cfg=vercelConfig();
  if(!cfg.token)return{ok:false,deploymentId,state:null,commitSha:null,target:null,error:"VERCEL_TOKEN ausente."};
  const response=await fetch(`https://api.vercel.com/v13/deployments/${encodeURIComponent(deploymentId)}${vercelQuery(cfg.teamId)}`,{
    headers:{Authorization:`Bearer ${cfg.token}`},cache:"no-store",
  });
  if(!response.ok)return{ok:false,deploymentId,state:null,commitSha:null,target:null,error:`HTTP ${response.status}`};
  const data=await response.json() as {readyState?:string;state?:string;target?:string|null;meta?:Record<string,string>;url?:string};
  return{
    ok:String(data.readyState||data.state||"").toUpperCase()==="READY",
    deploymentId,
    state:String(data.readyState||data.state||""),
    commitSha:String(data.meta?.githubCommitSha||""),
    commitRef:String(data.meta?.githubCommitRef||""),
    target:data.target||null,
    url:data.url||null,
    error:null,
  };
}

export async function inspectAlias(alias:string){
  const cfg=vercelConfig();
  if(!cfg.token)return{ok:false,alias,deploymentId:null,error:"VERCEL_TOKEN ausente."};
  const response=await fetch(`https://api.vercel.com/v4/aliases/${encodeURIComponent(alias)}${vercelQuery(cfg.teamId)}`,{
    headers:{Authorization:`Bearer ${cfg.token}`},cache:"no-store",
  });
  if(!response.ok)return{ok:false,alias,deploymentId:null,error:`HTTP ${response.status}`};
  const data=await response.json() as {deploymentId?:string;deployment?:{id?:string};projectId?:string};
  return{ok:true,alias,deploymentId:String(data.deploymentId||data.deployment?.id||""),projectId:data.projectId||null};
}

export async function probeAlias(alias:string){
  const started=Date.now();
  try{
    const response=await fetch(`https://${alias}/api/health`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
    const payload=await response.json().catch(()=>({})) as Record<string,unknown>;
    return{ok:response.ok,status:response.ok?"ok":"error" as const,httpStatus:response.status,latencyMs:Date.now()-started,payload};
  }catch(error){
    return{ok:false,status:"error" as const,httpStatus:0,latencyMs:Date.now()-started,payload:{},error:error instanceof Error?error.message:"Falha no health check"};
  }
}

export async function snapshotBeforeRelease(companyId:string,actor:string){
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)return{ok:false,snapshotId:null,error:`Banco do tenant indisponível (${db.provisioningStatus||"not-ready"}).`};
  const stateId=db.dedicated?"main":companyId;
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId)}&select=payload`,{headers:tenantHeaders(db.key),cache:"no-store"});
  if(!response.ok)return{ok:false,snapshotId:null,error:"Não foi possível ler o estado para snapshot."};
  const rows=await response.json() as Array<{payload?:Record<string,unknown>}>;
  const payload=rows[0]?.payload;
  if(!payload)return{ok:true,snapshotId:null,error:null};
  const saved=await createStateSnapshot({companyId,stateId,payload,reason:"pre-release",createdBy:actor});
  if(!saved)return{ok:false,snapshotId:null,error:"Não foi possível confirmar o snapshot pré-release."};
  const latest=await listStateSnapshots(companyId,1);
  return{ok:true,snapshotId:latest[0]?.id||null,error:null};
}

export async function restoreReleaseSnapshot(companyId:string,snapshotId:number,actor:string){
  const snapshot=await getStateSnapshot(companyId,snapshotId);
  if(!snapshot)return{ok:false,error:"Snapshot de pré-release não encontrado."};
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)return{ok:false,error:"Banco do tenant indisponível para rollback de dados."};
  const stateId=db.dedicated?"main":companyId;
  const response=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId)}&select=payload`,{headers:tenantHeaders(db.key),cache:"no-store"});
  const rows=response.ok?await response.json() as Array<{payload?:Record<string,unknown>}>:[];
  const current=rows[0]?.payload||null;
  if(current)await createStateSnapshot({companyId,stateId,payload:current,reason:"pre-release-rollback",createdBy:actor});
  const nextRevision=Number(current?._revision||0)+1;
  const restored={...snapshot.payload,_revision:nextRevision,_updatedAt:new Date().toISOString(),_companyId:companyId,_restoredFromSnapshot:snapshotId,_restoredBy:actor};
  const write=current
    ? await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId)}`,{method:"PATCH",headers:{...tenantHeaders(db.key),Prefer:"return=minimal"},body:JSON.stringify({payload:restored,updated_at:new Date().toISOString()}),cache:"no-store"})
    : await databaseFetch(`${db.url}/rest/v1/proar_state?on_conflict=id`,{method:"POST",headers:{...tenantHeaders(db.key),Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:stateId,payload:restored,updated_at:new Date().toISOString()}),cache:"no-store"});
  return write.ok?{ok:true,newRevision:nextRevision}:{ok:false,error:"Falha ao restaurar snapshot operacional."};
}

export async function recordReleaseCheck(input:{
  releaseId:string;companyId?:string|null;environmentCode:ReleaseChannel;stage:"pre"|"post"|"continuous";
  checkKey:string;status:"ok"|"warning"|"error";code?:string|null;detail?:string|null;latencyMs?:number|null;
}){
  return supabaseRest("proar_release_checks",{
    method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({
      release_id:input.releaseId,company_id:input.companyId||null,environment_code:input.environmentCode,stage:input.stage,
      check_key:input.checkKey,status:input.status,code:input.code||null,detail:input.detail||null,latency_ms:input.latencyMs??null,
    }),
  });
}

export async function resolveFeatureFlags(companyId:string|undefined,channel:ReleaseChannel){
  const flagsResponse=await supabaseRest("proar_feature_flags?select=*&status=eq.active&order=flag_key.asc").catch(()=>null);
  if(!flagsResponse?.ok)return{} as Record<string,boolean>;
  const flags=await flagsResponse.json() as FeatureFlag[];
  let overrides:Record<string,boolean>={};
  if(companyId){
    const response=await supabaseRest(`proar_feature_flag_overrides?select=flag_key,enabled&company_id=eq.${encodeURIComponent(companyId)}`).catch(()=>null);
    if(response?.ok){
      const rows=await response.json() as Array<{flag_key:string;enabled:boolean}>;
      overrides=Object.fromEntries(rows.map(row=>[row.flag_key,Boolean(row.enabled)]));
    }
  }
  const result:Record<string,boolean>={};
  for(const flag of flags){
    const bucket=companyId?Array.from((companyId+"|"+flag.flag_key)).reduce((sum,char)=>(sum*31+char.charCodeAt(0))%100,0):99;
    const channelDefault=channel==="internal"?flag.internal_enabled:channel==="homologation"?flag.homologation_enabled:channel==="canary"?bucket<Math.max(0,Math.min(100,Number(flag.canary_percent||0))):flag.production_enabled;
    result[flag.flag_key]=Object.prototype.hasOwnProperty.call(overrides,flag.flag_key)?overrides[flag.flag_key]:Boolean(channelDefault||flag.default_enabled);
  }
  return result;
}
