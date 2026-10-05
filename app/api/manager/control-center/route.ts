import { NextRequest, NextResponse } from "next/server";
import { readManagerSession } from "../../../../lib/manager-auth";
import { supabaseConfigured, supabaseRest, databaseFetch } from "../../../../lib/supabase-rest";
import { resolveTenantDb, tenantHeaders } from "../../../../lib/tenant-rest";
import { managerPlan } from "../../../../lib/manager-plans";

const auth=(request:NextRequest)=>readManagerSession(request);

async function controlFor(companyId:string){
  const r=await supabaseRest(`proar_manager_controls?select=*&company_id=eq.${encodeURIComponent(companyId)}&limit=1`);
  if(!r.ok)return null;
  const rows=await r.json(); return rows?.[0]||null;
}

async function usageFor(companyId:string,planCode:string){
  const db=await resolveTenantDb(companyId);
  if(!db.url||!db.key)return {available:false};
  const stateId=db.dedicated?"main":companyId;
  const r=await databaseFetch(`${db.url}/rest/v1/proar_state?id=eq.${encodeURIComponent(stateId)}&select=payload`,{headers:tenantHeaders(db.key),cache:"no-store"});
  if(!r.ok)return {available:false};
  const rows=await r.json() as {payload?:Record<string,any>}[];
  const state=rows?.[0]?.payload||{};
  const modules=state.moduleRecords||{};
  const plan=managerPlan(planCode);
  return {
    available:true,
    users:Array.isArray(modules["Funcionários"])?modules["Funcionários"].length:0,
    serviceOrders:Array.isArray(state.serviceOrders)?state.serviceOrders.length:0,
    customers:Array.isArray(state.customers)?state.customers.length:0,
    equipment:Array.isArray(modules["Equipamentos"])?modules["Equipamentos"].length:0,
    products:Array.isArray(modules["Produtos"])?modules["Produtos"].length:0,
    limits:plan.limits,
  };
}

export async function GET(request:NextRequest){
  const user=auth(request); if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  if(!supabaseConfigured())return NextResponse.json({error:"Banco mestre não configurado."},{status:503});
  const url=new URL(request.url); const companyId=url.searchParams.get("companyId")||"";

  const companies=await supabaseRest(companyId
    ? `proar_companies?select=id,trade_name,legal_name,slug,plan_code,status& id=eq.${encodeURIComponent(companyId)}&limit=1`.replace("& id","&id")
    : "proar_companies?select=id,trade_name,legal_name,slug,plan_code,status&order=trade_name.asc"
  );
  if(!companies.ok)return NextResponse.json({error:"Falha ao consultar empresas."},{status:502});
  const companyRows=await companies.json();

  const controls=await supabaseRest(companyId
    ? `proar_manager_controls?select=*&company_id=eq.${encodeURIComponent(companyId)}&limit=1`
    : "proar_manager_controls?select=*"
  );
  const incidents=await supabaseRest(companyId
    ? `proar_manager_incidents?select=*&company_id=eq.${encodeURIComponent(companyId)}&order=created_at.desc&limit=50`
    : "proar_manager_incidents?select=*&order=created_at.desc&limit=100"
  );

  const controlRows=controls.ok?await controls.json():[];
  const incidentRows=incidents.ok?await incidents.json():[];
  let usage=null;
  if(companyId&&companyRows[0])usage=await usageFor(companyId,String(companyRows[0].plan_code||"trial"));

  const alerts:any[]=[];
  for(const company of companyRows){
    const control=controlRows.find((item:any)=>item.company_id===company.id);
    if(control?.maintenance_enabled)alerts.push({type:"maintenance",companyId:company.id,severity:"warning",title:"Modo manutenção ativo",detail:company.trade_name||company.legal_name});
    if(control?.backup_status==="error")alerts.push({type:"backup",companyId:company.id,severity:"error",title:"Falha de backup registrada",detail:company.trade_name||company.legal_name});
    if(control?.domain_status==="error")alerts.push({type:"domain",companyId:company.id,severity:"error",title:"Domínio com erro",detail:control.custom_domain||company.slug});
  }
  for(const incident of incidentRows.filter((item:any)=>item.status==="open")){
    alerts.push({type:"incident",companyId:incident.company_id,severity:incident.severity,title:incident.title,detail:incident.description||""});
  }
  return NextResponse.json({setupPending:!controls.ok||!incidents.ok,companies:companyRows,controls:controlRows,incidents:incidentRows,usage,alerts});
}

export async function PATCH(request:NextRequest){
  const user=auth(request); if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const body=await request.json(); const companyId=String(body.companyId||"").trim();
  if(body.resolveIncident===true){
    const id=String(body.incidentId||"").trim();
    const r=await supabaseRest(`proar_manager_incidents?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:"resolved",resolved_at:new Date().toISOString()})});
    if(!r.ok)return NextResponse.json({error:"Não foi possível resolver o incidente."},{status:502});
    return NextResponse.json({saved:true});
  }
  if(!companyId)return NextResponse.json({error:"Empresa não informada."},{status:400});
  const current=await controlFor(companyId);
  const patch:any={company_id:companyId,updated_at:new Date().toISOString()};
  if(typeof body.maintenanceEnabled==="boolean")patch.maintenance_enabled=body.maintenanceEnabled;
  if(typeof body.maintenanceMessage==="string")patch.maintenance_message=body.maintenanceMessage.slice(0,240);
  if(typeof body.supportAccessEnabled==="boolean")patch.support_access_enabled=body.supportAccessEnabled;
  if(body.supportAccessUntil!==undefined)patch.support_access_until=body.supportAccessUntil||null;
  if(typeof body.customDomain==="string"){patch.custom_domain=body.customDomain.trim().toLowerCase().slice(0,180)||null;patch.domain_status=patch.custom_domain?"pending":"not_configured";}
  if(body.featureFlags&&typeof body.featureFlags==="object")patch.feature_flags={...(current?.feature_flags||{}),...body.featureFlags};
  if(body.limitOverrides&&typeof body.limitOverrides==="object")patch.limit_overrides={...(current?.limit_overrides||{}),...body.limitOverrides};
  if(typeof body.backupRetentionDays==="number")patch.backup_retention_days=Math.max(1,Math.min(body.backupRetentionDays,3650));
  const r=await supabaseRest("proar_manager_controls?on_conflict=company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(patch)});
  if(!r.ok)return NextResponse.json({error:"Não foi possível atualizar os controles do tenant. Verifique se a migration foi aplicada."},{status:502});
  await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId,action:"TENANT_CONTROL_UPDATED",actor:user.username,details:patch})});
  return NextResponse.json({saved:true,control:(await r.json())?.[0]});
}

export async function POST(request:NextRequest){
  const user=auth(request); if(!user)return NextResponse.json({error:"Acesso restrito ao ProAR Manager."},{status:403});
  const body=await request.json(); const companyId=String(body.companyId||"").trim();

  if(body.action==="createIncident"){
    const r=await supabaseRest("proar_manager_incidents",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({company_id:companyId||null,severity:["info","warning","error","critical"].includes(body.severity)?body.severity:"warning",status:"open",title:String(body.title||"Incidente").slice(0,160),description:String(body.description||"").slice(0,1000),source:String(body.source||"manager").slice(0,80),code:String(body.code||"").slice(0,80)||null,created_by:user.username})});
    if(!r.ok)return NextResponse.json({error:"Não foi possível registrar o incidente."},{status:502});
    return NextResponse.json({created:true,incident:(await r.json())?.[0]});
  }

  if(body.action==="requestBackup"){
    const r=await supabaseRest("proar_manager_controls?on_conflict=company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({company_id:companyId,backup_status:"requested",updated_at:new Date().toISOString()})});
    if(!r.ok)return NextResponse.json({error:"Não foi possível registrar a solicitação de backup."},{status:502});
    await supabaseRest("proar_manager_audit",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId,action:"BACKUP_REQUESTED",actor:user.username,details:{providerExecution:false}})});
    return NextResponse.json({requested:true,providerExecution:false,message:"Solicitação registrada. A execução real depende da integração do provedor do banco."});
  }

  if(body.action==="verifyDomain"){
    const control=await controlFor(companyId); const domain=String(control?.custom_domain||"").trim();
    if(!domain)return NextResponse.json({error:"Domínio personalizado não configurado."},{status:400});
    let status="error";
    try{const r=await fetch(`https://${domain}`,{method:"HEAD",redirect:"manual",cache:"no-store"});status=r.status>0&&r.status<500?"online":"error";}catch{}
    await supabaseRest("proar_manager_controls?on_conflict=company_id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({company_id:companyId,domain_status:status,updated_at:new Date().toISOString()})});
    return NextResponse.json({checked:true,status});
  }

  if(body.action==="runDiagnostic"){
    const db=await resolveTenantDb(companyId);
    const result:any={database:false,state:false};
    if(db.url&&db.key){
      const r=await databaseFetch(`${db.url}/rest/v1/proar_state?select=id&limit=1`,{headers:tenantHeaders(db.key),cache:"no-store"});
      result.database=r.ok; result.state=r.ok;
    }
    if(!result.database){
      await supabaseRest("proar_manager_incidents",{method:"POST",headers:{Prefer:"return=minimal"},body:JSON.stringify({company_id:companyId,severity:"error",status:"open",title:"Diagnóstico do tenant encontrou falha de banco",description:"O ProAR Manager não conseguiu validar o banco operacional deste tenant.",source:"diagnostic",code:"PROAR-DB-001",created_by:user.username})});
    }
    return NextResponse.json({checkedAt:new Date().toISOString(),result});
  }

  return NextResponse.json({error:"Ação não reconhecida."},{status:400});
}
