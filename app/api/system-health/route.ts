import { NextRequest, NextResponse } from "next/server";
import { requirePermission, sessionCompany } from "../../../lib/permissions";
import { resolveTenantDb, tenantHeaders } from "../../../lib/tenant-rest";
import { databaseFetch } from "../../../lib/supabase-rest";

export const runtime = "nodejs";

type HealthState = "ok" | "warning" | "error";

export async function GET(request: NextRequest) {
  const access = requirePermission(request, "integridade.visualizar");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const scope = sessionCompany(access.session);
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });

  let database: { state: HealthState; message: string } = { state:"error", message:"Banco não verificado." };
  try {
    const db = await resolveTenantDb(scope.companyId);
    if (!db.url || !db.key) database = { state:"error", message:"Credenciais do banco indisponíveis." };
    else {
      const response = await databaseFetch(`${db.url}/rest/v1/proar_state?select=id&limit=1`, { headers:tenantHeaders(db.key), cache:"no-store", signal:AbortSignal.timeout(5000) });
      database = response.ok ? { state:"ok", message:db.dedicated ? "Banco dedicado acessível." : "Banco compartilhado acessível e segregado por empresa." } : { state:"error", message:`Banco respondeu HTTP ${response.status}.` };
    }
  } catch {
    database = { state:"error", message:"Banco indisponível ou excedeu o tempo de resposta." };
  }

  const configured = (name:string) => Boolean(String(process.env[name] || "").trim());
  const fiscalVault = configured("BLOB_READ_WRITE_TOKEN") && configured("PROAR_FISCAL_ENCRYPTION_KEY");
  const services = [
    { id:"database", label:"Banco de dados", ...database },
    { id:"fiscal-vault", label:"Cofre fiscal", state:(fiscalVault ? "ok" : "warning") as HealthState, message:fiscalVault ? "Armazenamento criptografado configurado." : "Cofre fiscal incompleto no ambiente." },
    { id:"nfe", label:"NF-e / SEFAZ-SP", state:(configured("SEFAZ_SP_NFE_API_URL") && configured("SEFAZ_SP_NFE_API_TOKEN") ? "ok" : "warning") as HealthState, message:configured("SEFAZ_SP_NFE_API_URL") && configured("SEFAZ_SP_NFE_API_TOKEN") ? "Adaptador configurado." : "Adaptador de emissão ainda não configurado." },
    { id:"nfce", label:"NFC-e / SEFAZ-SP", state:(configured("SEFAZ_SP_NFCE_API_URL") && configured("SEFAZ_SP_NFCE_API_TOKEN") ? "ok" : "warning") as HealthState, message:configured("SEFAZ_SP_NFCE_API_URL") && configured("SEFAZ_SP_NFCE_API_TOKEN") ? "Adaptador configurado." : "Adaptador/CSC ainda precisa de configuração." },
    { id:"nfse", label:"NFS-e Mirassol", state:(configured("MIRASSOL_NFSE_API_URL") && configured("MIRASSOL_NFSE_API_TOKEN") ? "ok" : "warning") as HealthState, message:configured("MIRASSOL_NFSE_API_URL") && configured("MIRASSOL_NFSE_API_TOKEN") ? "Adaptador configurado." : "Integração municipal ainda não configurada." },
    { id:"dfe", label:"Distribuição DF-e", state:(configured("NFE_DISTRIBUTION_API_URL") && configured("NFE_DISTRIBUTION_API_TOKEN") ? "ok" : "warning") as HealthState, message:configured("NFE_DISTRIBUTION_API_URL") && configured("NFE_DISTRIBUTION_API_TOKEN") ? "Consulta de documentos destinados configurada." : "Consulta DF-e ainda não configurada." },
    { id:"ai", label:"Inteligência Artificial", state:(configured("OPENAI_API_KEY") ? "ok" : "warning") as HealthState, message:configured("OPENAI_API_KEY") ? "Fallback de IA configurado no ambiente." : "Sem fallback global; credencial por empresa pode ser usada." },
  ];
  const totals = services.reduce((acc,item)=>{acc[item.state]+=1;return acc;},{ok:0,warning:0,error:0});
  return NextResponse.json({ checkedAt:new Date().toISOString(), companyId:scope.companyId, services, totals });
}
