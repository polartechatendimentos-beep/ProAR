import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";
import { databaseFetch, supabaseRest } from "../../../lib/supabase-rest";
import { probeDatabase } from "../../../lib/database-resilience";
import { proarError } from "../../../lib/system-errors";
import { recordSystemIncident } from "../../../lib/system-observability";
import { CURRENT_PROAR_RELEASE } from "../../../lib/release-notes";

export const runtime = "nodejs";

type HealthState = "ok" | "warning" | "error";
type HealthService = {
  id: string;
  label: string;
  state: HealthState;
  message: string;
  code?: string;
  latencyMs?: number;
  attempts?: number;
  metadata?: Record<string, unknown>;
};

function configured(name:string) {
  return Boolean(String(process.env[name] || "").trim());
}

function envService(id:string,label:string,names:string[],readyMessage:string,pendingMessage:string):HealthService {
  const ready=names.every(configured);
  return {
    id,
    label,
    state:ready?"ok":"warning",
    code:ready?undefined:proarError("PROAR-INTEGRATION-002").code,
    message:ready?readyMessage:pendingMessage,
  };
}

export async function GET(request: NextRequest) {
  const access = requirePermission(request, "integridade.visualizar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const scope = sessionCompany(access.session);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  let database:HealthService = {
    id:"database",
    label:"Banco de dados",
    state:"error",
    message:"Banco não verificado.",
    code:proarError("PROAR-DB-001").code,
  };

  try {
    const db=await resolveTenantDb(scope.companyId);
    if(!db.url || !db.key){
      database={
        ...database,
        message:`Banco do tenant indisponível (${db.provisioningStatus || "não provisionado"}).`,
        metadata:{provider:db.provider,projectName:db.projectName,source:db.source},
      };
    }else{
      const probe=await probeDatabase(()=>databaseFetch(
        `${db.url}/rest/v1/proar_state?select=id&limit=1`,
        {headers:tenantHeaders(db.key),cache:"no-store"},
      ));
      const slow=probe.ok && probe.latencyMs>2500;
      database={
        id:"database",
        label:"Banco de dados",
        state:probe.ok?(slow?"warning":"ok"):"error",
        code:probe.ok?(slow?proarError("PROAR-DB-002").code:undefined):proarError("PROAR-DB-003").code,
        message:probe.ok
          ? `${db.dedicated?"Banco dedicado":"Banco principal"} acessível${slow?" com latência elevada":""}.`
          : "Banco indisponível após novas tentativas. O modo de contingência deve preservar a última cópia sincronizada.",
        latencyMs:probe.latencyMs,
        attempts:probe.attempts,
        metadata:{provider:db.provider,projectName:db.projectName,source:db.source,httpStatus:probe.status},
      };

      void supabaseRest("proar_health_snapshots",{
        method:"POST",
        headers:{Prefer:"return=minimal"},
        body:JSON.stringify({
          company_id:scope.companyId,
          service:"database",
          state:database.state,
          latency_ms:probe.latencyMs,
          code:database.code||null,
          message:database.message,
          metadata:database.metadata||{},
          checked_at:probe.checkedAt,
        }),
      }).catch(()=>null);

      if(!probe.ok){
        void recordSystemIncident({
          companyId:scope.companyId,
          module:"Saúde do Sistema",
          operation:"Health check do banco",
          code:"PROAR-DB-003",
          error:probe.detail,
          route:"/api/system-health",
          metadata:{latencyMs:probe.latencyMs,attempts:probe.attempts,provider:db.provider,projectName:db.projectName},
        });
      }
    }
  }catch(error){
    database={
      ...database,
      state:"error",
      message:"Banco indisponível ou excedeu o tempo de resposta.",
      code:proarError("PROAR-DB-003").code,
    };
    void recordSystemIncident({
      companyId:scope.companyId,
      module:"Saúde do Sistema",
      operation:"Resolver banco do tenant",
      code:"PROAR-DB-003",
      error,
      route:"/api/system-health",
    });
  }

  const fiscalVault=configured("BLOB_READ_WRITE_TOKEN")&&configured("PROAR_FISCAL_ENCRYPTION_KEY");
  const services:HealthService[]=[
    database,
    {
      id:"application",
      label:"Aplicação ProAR",
      state:"ok",
      message:`Versão ${CURRENT_PROAR_RELEASE.version} carregada no ambiente ${process.env.VERCEL_ENV || process.env.NODE_ENV || "desconhecido"}.`,
      metadata:{
        commit:process.env.VERCEL_GIT_COMMIT_SHA || null,
        deploymentId:process.env.VERCEL_DEPLOYMENT_ID || null,
        region:process.env.VERCEL_REGION || null,
      },
    },
    {
      id:"fiscal-vault",
      label:"Cofre fiscal",
      state:fiscalVault?"ok":"warning",
      code:fiscalVault?undefined:proarError("PROAR-FISCAL-001").code,
      message:fiscalVault?"Armazenamento criptografado configurado.":"Cofre fiscal incompleto no ambiente.",
    },
    envService("nfe","NF-e / SEFAZ-SP",["SEFAZ_SP_NFE_API_URL","SEFAZ_SP_NFE_API_TOKEN"],"Adaptador configurado.","Adaptador de emissão ainda não configurado."),
    envService("nfce","NFC-e / SEFAZ-SP",["SEFAZ_SP_NFCE_API_URL","SEFAZ_SP_NFCE_API_TOKEN"],"Adaptador configurado.","Adaptador/CSC ainda precisa de configuração."),
    envService("nfse","NFS-e Mirassol",["MIRASSOL_NFSE_API_URL","MIRASSOL_NFSE_API_TOKEN"],"Integração municipal configurada.","Integração municipal ainda não configurada."),
    envService("dfe","Distribuição DF-e",["NFE_DISTRIBUTION_API_URL","NFE_DISTRIBUTION_API_TOKEN"],"Consulta de documentos destinados configurada.","Consulta DF-e ainda não configurada."),
    envService("payments","Mercado Pago",["MERCADO_PAGO_ACCESS_TOKEN"],"Cobrança integrada configurada.","Credencial de cobrança não configurada neste ambiente."),
    {
      id:"ai",
      label:"Inteligência Artificial",
      state:configured("OPENAI_API_KEY")?"ok":"warning",
      code:configured("OPENAI_API_KEY")?undefined:proarError("PROAR-INTEGRATION-002").code,
      message:configured("OPENAI_API_KEY")?"Fallback de IA configurado no ambiente.":"Sem fallback global; credencial por empresa pode ser usada.",
    },
    {
      id:"rollback",
      label:"Rollback de produção",
      state:configured("VERCEL_TOKEN")&&configured("VERCEL_PROJECT_ID")?"ok":"warning",
      code:configured("VERCEL_TOKEN")&&configured("VERCEL_PROJECT_ID")?undefined:proarError("PROAR-INTEGRATION-002").code,
      message:configured("VERCEL_TOKEN")&&configured("VERCEL_PROJECT_ID")
        ?"Rollback administrativo está configurado."
        :"Rollback em um clique depende de VERCEL_TOKEN e VERCEL_PROJECT_ID no Manager.",
    },
  ];

  const totals=services.reduce((acc,item)=>{acc[item.state]+=1;return acc;},{ok:0,warning:0,error:0});
  const overall:HealthState=totals.error?"error":totals.warning?"warning":"ok";

  return NextResponse.json({
    checkedAt:new Date().toISOString(),
    companyId:scope.companyId,
    overall,
    services,
    totals,
    release:{
      version:CURRENT_PROAR_RELEASE.version,
      commit:process.env.VERCEL_GIT_COMMIT_SHA || null,
      environment:process.env.VERCEL_ENV || process.env.NODE_ENV || null,
      deploymentId:process.env.VERCEL_DEPLOYMENT_ID || null,
    },
  });
}
