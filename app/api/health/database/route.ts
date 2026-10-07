import { NextRequest,NextResponse } from "next/server";
import { healthAccess } from "../../../../lib/health-access";
import { resolveTenantDb,tenantHeaders } from "../../../../lib/tenant-rest";
import { databaseFetch,databaseRuntimeConfig,neonPlanMetadata,primaryDatabaseMetrics } from "../../../../lib/supabase-rest";
import { probeDatabase } from "../../../../lib/database-resilience";
import { classifyProarError } from "../../../../lib/system-errors";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type AnyRow=Record<string,unknown>;

function operationalPayload(value:unknown){
  if(!value||typeof value!=="object")return false;
  const payload=value as AnyRow;
  return Array.isArray(payload.customers)||Array.isArray(payload.serviceOrders)||Boolean(payload.moduleRecords);
}

function statusFromIncident(row:AnyRow){
  const metadata=(row.metadata&&typeof row.metadata==="object"?row.metadata:{}) as AnyRow;
  const fromMetadata=Number(metadata.httpStatus||metadata.status||0);
  if([401,403,429].includes(fromMetadata)||fromMetadata>=500)return fromMetadata;
  const text=String(row.technical_message||"");
  const match=text.match(/\b(401|403|429|5\d\d)\b/);
  return match?Number(match[1]):0;
}

export async function GET(request:NextRequest){
  const access=healthAccess(request);
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
  const checkedAt=new Date().toISOString();

  try{
    const runtime=databaseRuntimeConfig();
    const db=await resolveTenantDb(access.companyId);
    if(!db.url||!db.key){
      return NextResponse.json({
        database:"error",
        code:"PROAR-DB-005",
        reason:"configuration",
        message:"Banco do tenant sem URL ou credencial válida.",
        provider:db.provider,
        checkedAt,
      },{status:503,headers:{"Cache-Control":"no-store"}});
    }

    const probe=await probeDatabase(()=>databaseFetch(
      `${db.url}/rest/v1/proar_state?select=id&limit=1`,
      {headers:tenantHeaders(db.key),cache:"no-store"},
    ));

    if(!probe.ok){
      const descriptor=classifyProarError(probe.detail,probe.status);
      const reason=descriptor.code==="PROAR-DB-004"?"quota":descriptor.code==="PROAR-DB-002"?"timeout":descriptor.code==="PROAR-DB-005"?"configuration":"unavailable";
      return NextResponse.json({
        database:"error",
        code:descriptor.code,
        reason,
        message:descriptor.userMessage,
        provider:db.provider,
        latencyMs:probe.latencyMs,
        attempts:probe.attempts,
        httpStatus:probe.status||null,
        checkedAt,
      },{status:503,headers:{"Cache-Control":"no-store"}});
    }

    const [metrics,stateResponse,backupResponse,externalBackupResponse,incidentsResponse]=await Promise.all([
      primaryDatabaseMetrics().catch(()=>null),
      databaseFetch(`${db.url}/rest/v1/proar_state?select=id,payload,updated_at&order=updated_at.desc&limit=200`,{headers:tenantHeaders(db.key),cache:"no-store"}).catch(()=>null),
      databaseFetch(`${db.url}/rest/v1/proar_state_snapshots?company_id=eq.${encodeURIComponent(access.companyId)}&select=id,revision,reason,created_at&order=created_at.desc&limit=1`,{headers:tenantHeaders(db.key),cache:"no-store"}).catch(()=>null),
      databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(`backup-status:${access.companyId}`)}&select=payload,updated_at&limit=1`,{headers:tenantHeaders(db.key),cache:"no-store"}).catch(()=>null),
      databaseFetch(`${db.url}/rest/v1/proar_system_incidents?company_id=eq.${encodeURIComponent(access.companyId)}&created_at=gte.${encodeURIComponent(new Date(Date.now()-24*60*60*1000).toISOString())}&select=technical_message,metadata,created_at&order=created_at.desc&limit=200`,{headers:tenantHeaders(db.key),cache:"no-store"}).catch(()=>null),
    ]);

    const states=stateResponse?.ok?await stateResponse.json() as AnyRow[]:[];
    const operational=states.find(row=>operationalPayload(row.payload));
    const backups=backupResponse?.ok?await backupResponse.json() as AnyRow[]:[];
    const externalBackups=externalBackupResponse?.ok?await externalBackupResponse.json() as AnyRow[]:[];
    const externalBackupPayload=(externalBackups[0]?.payload&&typeof externalBackups[0].payload==="object"?externalBackups[0].payload:{}) as AnyRow;
    const incidents=incidentsResponse?.ok?await incidentsResponse.json() as AnyRow[]:[];
    const counts={http5xx:0,http401:0,http403:0,http429:0};

    for(const row of incidents){
      const status=statusFromIncident(row);
      if(status>=500)counts.http5xx+=1;
      else if(status===401)counts.http401+=1;
      else if(status===403)counts.http403+=1;
      else if(status===429)counts.http429+=1;
    }

    const slow=probe.latencyMs>2500;
    const quota=runtime.resolvedProvider==="neon"
      ?neonPlanMetadata()
      :{plan:null,quotaMode:null,monthlyCuHours:null,usagePercent:null,status:"not-applicable",note:""};

    const payload=(operational?.payload&&typeof operational.payload==="object"?operational.payload:{}) as AnyRow;
    return NextResponse.json({
      database:slow?"degraded":"ok",
      provider:db.provider,
      projectName:db.projectName||null,
      latencyMs:probe.latencyMs,
      attempts:probe.attempts,
      connections:metrics?.connections??null,
      activeConnections:metrics?.activeConnections??null,
      waitingConnections:metrics?.waitingConnections??null,
      databaseSizeBytes:metrics?.databaseSizeBytes??null,
      neonQuota:quota.status,
      quota,
      observedErrors24h:counts,
      lastSuccessfulSync:operational?.updated_at||payload._updatedAt||null,
      lastConfirmedBackup:externalBackupPayload.status==="ok"?(externalBackupPayload.createdAt||externalBackups[0]?.updated_at||null):(backups[0]?.created_at||null),
      backupType:externalBackupPayload.status==="ok"?"external-private-blob":backups[0]?"database-snapshot":null,
      backupRecords:externalBackupPayload.status==="ok"?((externalBackupPayload.totals as AnyRow|undefined)?.records??null):null,
      backupRevision:backups[0]?.revision??null,
      runtime,
      checkedAt,
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    const descriptor=classifyProarError(error);
    return NextResponse.json({
      database:"error",
      code:descriptor.code,
      reason:descriptor.code==="PROAR-DB-004"?"quota":descriptor.code==="PROAR-DB-002"?"timeout":descriptor.code==="PROAR-DB-005"?"configuration":"unavailable",
      message:descriptor.userMessage,
      checkedAt,
    },{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
