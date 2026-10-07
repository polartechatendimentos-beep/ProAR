"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, Building2, CheckCircle2, Copy, CreditCard, ExternalLink, LogIn, LogOut, RefreshCw, Save, ShieldCheck, X } from "lucide-react";
import { ReleaseGovernancePanel } from "@/components/ReleaseGovernancePanel";
import "../trial-manager.css";
import "./manager.css";

type Company={
  id:string;trade_name?:string;legal_name?:string;responsible_name?:string;cnpj?:string;cpf?:string;email?:string;
  status:string;plan_code?:string;trial_expires_at?:string;slug?:string;last_seen_at?:string;last_manager_check_at?:string;
  auto_registered?:boolean;modules?:string[];billing_enabled?:boolean;monthly_fee_cents?:number;billing_day?:number;
  billing_issue_lead_days?:number;billing_method?:"pix"|"boleto"|"card";billing_auto_block?:boolean;billing_email?:string;
  access_block_source?:string|null;suspended_reason?:string|null;
  tenant?:{companyId:string;slug:string;role:"primary-pilot"|"customer";environment:"pilot"|"production";isolation:string;databaseName:string;projectName:string};
  readiness?:{ready:boolean;score:number;blocking:string[];checks:{id:string;label:string;ok:boolean;blocking:boolean;detail:string}[]}
};
type Instance={company_id:string;provider?:string;project_name?:string;api_url?:string;provisioning_status?:string;provisioning_error?:string;last_health_at?:string};
type ManagerSummary={total:number;active:number;blocked:number;billingBlocked:number;manualBlocked:number;trials:number;expiringTrials:number;readyDatabases:number;databaseErrors:number;pendingDatabases:number;staleHealth:number;openCriticalIncidents?:number;recentIncidents?:number};
type BillingSummary={openCount:number;openCents:number;overdueCount:number;overdueCents:number;paidThisMonthCount:number;paidThisMonthCents:number;mrrCents:number};
type Receivable={id:string;company_id:string;reference_month:string;description:string;amount_cents:number;due_date:string;status:"pending"|"paid"|"canceled"|"refunded";payment_method:"pix"|"boleto"|"card"|"manual";provider_status?:string;payment_url?:string;pix_qr_code?:string;boleto_digitable_line?:string;paid_at?:string};
type AuditRow={id?:string|number;company_id?:string;action?:string;actor?:string;details?:Record<string,unknown>;created_at?:string};
type Incident={id:string;company_id?:string;module:string;operation:string;code:string;severity:"info"|"warning"|"error"|"critical";user_message?:string;technical_message?:string;request_id?:string;route?:string;resolved_at?:string;created_at?:string};
type DeploymentSafety={environment?:string;currentCommit?:string;currentDeploymentId?:string;rollbackConfigured?:boolean;canaryRequired?:boolean;productionGate?:string};
type StateSnapshot={id:number;company_id:string;state_id:string;revision:number;reason:string;created_by?:string;created_at:string};
type PlatformInfo={appVersion:string;releaseDate:string;releaseTitle:string;schemaVersion:string;channel:string;migrations:{id:string;title:string;status:string;destructive:boolean;description:string}[]};
type ManagerPlan={code:string;name:string;description:string;modules:string[];limits:{users:number|null;serviceOrdersPerMonth:number;storageGb:number;aiCallsPerMonth:number}};
type BillingDraft={enabled:boolean;monthlyPrice:string;billingDay:string;leadDays:string;method:"pix"|"boleto"|"card";autoBlock:boolean;email:string};

const money=(cents=0)=>(Number(cents||0)/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=(value?:string)=>value?new Date(value.length===10?`${value}T12:00:00`:value).toLocaleDateString("pt-BR"):"—";
const dateTime=(value?:string)=>value?new Date(value).toLocaleString("pt-BR"):"—";
const userLimitLabel=(users:number|null)=>users===null?"Usuários ilimitados":`${users} usuário${users===1?"":"s"}`;

function blankBilling():BillingDraft{return{enabled:false,monthlyPrice:"0,00",billingDay:"10",leadDays:"7",method:"pix",autoBlock:true,email:""}}
function billingDraftFromCompany(company?:Company|null):BillingDraft{
  if(!company)return blankBilling();
  return{
    enabled:Boolean(company.billing_enabled),
    monthlyPrice:(Number(company.monthly_fee_cents||0)/100).toFixed(2).replace(".",","),
    billingDay:String(company.billing_day||10),
    leadDays:String(company.billing_issue_lead_days??7),
    method:company.billing_method==="boleto"?"boleto":company.billing_method==="card"?"card":"pix",
    autoBlock:company.billing_auto_block!==false,
    email:company.billing_email||company.email||"",
  };
}

export default function ManagerPage(){
  const[authenticated,setAuthenticated]=useState<boolean|null>(null);
  const[username,setUsername]=useState("admin");
  const[password,setPassword]=useState("");
  const[loginError,setLoginError]=useState("");
  const[companies,setCompanies]=useState<Company[]>([]);
  const[instances,setInstances]=useState<Instance[]>([]);
  const[receivables,setReceivables]=useState<Receivable[]>([]);
  const[error,setError]=useState("");
  const[notice,setNotice]=useState("");
  const[loading,setLoading]=useState(false);
  const[summary,setSummary]=useState<ManagerSummary|null>(null);
  const[billingSummary,setBillingSummary]=useState<BillingSummary|null>(null);
  const[mercadoPagoReady,setMercadoPagoReady]=useState(false);
  const[audit,setAudit]=useState<AuditRow[]>([]);
  const[incidents,setIncidents]=useState<Incident[]>([]);
  const[deploymentSafety,setDeploymentSafety]=useState<DeploymentSafety|null>(null);
  const[rollbackDeploymentId,setRollbackDeploymentId]=useState("");
  const[rollbackReason,setRollbackReason]=useState("Rollback de emergência pelo ProAR Manager");
  const[recoveryCompanyId,setRecoveryCompanyId]=useState("");
  const[snapshots,setSnapshots]=useState<StateSnapshot[]>([]);
  const[recoveryLoading,setRecoveryLoading]=useState(false);
  const[platform,setPlatform]=useState<PlatformInfo|null>(null);
  const[plans,setPlans]=useState<ManagerPlan[]>([]);
  const[selectedCompanyId,setSelectedCompanyId]=useState("");
  const[detailTab,setDetailTab]=useState("Visão Geral");
  const[billingDraft,setBillingDraft]=useState<BillingDraft>(blankBilling());
  const[selectedPlanDraftCode,setSelectedPlanDraftCode]=useState("");
  const[savingCompanyChanges,setSavingCompanyChanges]=useState(false);

  const check=async()=>{
    try{
      const r=await fetch("/api/manager/auth",{cache:"no-store"});
      const j=await r.json();
      setAuthenticated(Boolean(j.authenticated));
      if(j.username)setUsername(j.username);
    }catch{setAuthenticated(false)}
  };

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const companiesResponse=await fetch("/api/manager/companies",{cache:"no-store"});
      const companiesJson=await companiesResponse.json();
      if(companiesResponse.status===403){setAuthenticated(false);throw new Error("Sessão do Manager expirada.")}
      if(!companiesResponse.ok)throw new Error(companiesJson.error||"Falha ao carregar o ProAR Manager.");
      setCompanies(companiesJson.companies||[]);
      setInstances(companiesJson.instances||[]);
      setSummary(companiesJson.summary||null);
      setAudit(companiesJson.audit||[]);
      setIncidents(companiesJson.incidents||[]);
      setPlatform(companiesJson.platform||null);
      setPlans(companiesJson.plans||[]);

      const deploymentResponse=await fetch("/api/manager/deployment-safety",{cache:"no-store"}).catch(()=>null);
      if(deploymentResponse?.ok)setDeploymentSafety(await deploymentResponse.json());else setDeploymentSafety(null);

      const billingResponse=await fetch("/api/manager/billing",{cache:"no-store"}).catch(()=>null);
      if(billingResponse?.ok){
        const billing=await billingResponse.json();
        setReceivables(billing.receivables||[]);
        setBillingSummary(billing.summary||null);
        setMercadoPagoReady(Boolean(billing.mercadoPagoConfigured));
      }else{
        setReceivables([]);setBillingSummary(null);setMercadoPagoReady(false);
      }
    }catch(e){setError(e instanceof Error?e.message:"Falha ao carregar o Manager.")}
    finally{setLoading(false)}
  };

  useEffect(()=>{void check()},[]);
  useEffect(()=>{if(authenticated)void load()},[authenticated]);

  const login=async(e:FormEvent)=>{
    e.preventDefault();setLoginError("");
    const r=await fetch("/api/manager/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});
    const j=await r.json();
    if(!r.ok){setLoginError(j.error||"Falha no login.");return}
    setPassword("");setAuthenticated(true);
  };
  const logout=async()=>{await fetch("/api/manager/auth",{method:"DELETE"});setAuthenticated(false);setCompanies([]);setReceivables([])};

  const map=useMemo(()=>Object.fromEntries(instances.map(i=>[i.company_id,i])),[instances]);
  const companyMap=useMemo(()=>Object.fromEntries(companies.map(c=>[c.id,c])),[companies]);
  const selectedCompany=companies.find(c=>c.id===selectedCompanyId)||null;
  const selectedInstance=selectedCompany?map[selectedCompany.id]:undefined;
  const selectedReceivables=receivables.filter(row=>row.company_id===selectedCompanyId);
  const selectedPlanCode=selectedCompany?.plan_code==="trial"?"basico":(plans.some(plan=>plan.code===selectedCompany?.plan_code)?String(selectedCompany?.plan_code):"basico");
  const effectivePlanDraftCode=selectedPlanDraftCode||selectedPlanCode;
  const selectedPlan=plans.find(plan=>plan.code===effectivePlanDraftCode)||plans.find(plan=>plan.code===selectedPlanCode)||plans[0]||null;
  const planLabel=(code?:string)=>code==="trial"?"Trial • Básico":(plans.find(plan=>plan.code===code)?.name||code||"Básico");

  useEffect(()=>{
    setBillingDraft(billingDraftFromCompany(selectedCompany));
    setSelectedPlanDraftCode("");
  },[selectedCompanyId,selectedPlanCode,selectedCompany?.billing_enabled,selectedCompany?.monthly_fee_cents,selectedCompany?.billing_day,selectedCompany?.billing_method,selectedCompany?.billing_issue_lead_days,selectedCompany?.billing_auto_block,selectedCompany?.billing_email,selectedCompany?.email]);

  const billingDirty=Boolean(selectedCompany)&&JSON.stringify(billingDraft)!==JSON.stringify(billingDraftFromCompany(selectedCompany));
  const planDirty=Boolean(selectedCompany)&&Boolean(selectedPlanDraftCode)&&(selectedCompany?.plan_code==="trial"||effectivePlanDraftCode!==selectedPlanCode);
  const hasUnsavedCompanyChanges=billingDirty||planDirty;

  const patch=async(companyId:string,body:Record<string,unknown>)=>{
    setNotice("");
    const r=await fetch("/api/manager/companies",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId,...body})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setError(j.error||"Falha ao atualizar.");return false}
    setError("");setNotice("Alteração salva com sucesso.");await load();return true;
  };

  const billingAction=async(body:Record<string,unknown>)=>{
    setNotice("");setError("");
    const r=await fetch("/api/manager/billing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setError(j.error||"Falha na operação financeira.");return false}
    setNotice("Operação financeira concluída.");await load();return true;
  };
  const rollbackDeployment=async()=>{
    const deploymentId=rollbackDeploymentId.trim();
    if(!deploymentId){setError("Informe o deployment anterior que deve voltar para produção.");return}
    if(!window.confirm("Confirmar rollback da produção para "+deploymentId+"? Essa ação altera imediatamente o tráfego de produção."))return;
    setError("");setNotice("");
    const r=await fetch("/api/manager/deployment-safety",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({deploymentId,reason:rollbackReason})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){setError(j.error||"Não foi possível solicitar o rollback.");return}
    setNotice("Rollback solicitado para "+deploymentId+". Valide a saúde da produção antes de continuar alterações.");
    await load();
  };
  const loadRecovery=async(companyId:string)=>{
    setRecoveryCompanyId(companyId);setSnapshots([]);
    if(!companyId)return;
    setRecoveryLoading(true);
    try{
      const r=await fetch("/api/manager/recovery?companyId="+encodeURIComponent(companyId),{cache:"no-store"});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||"Falha ao carregar backups.");
      setSnapshots(j.snapshots||[]);
    }catch(e){setError(e instanceof Error?e.message:"Falha ao carregar backups.");}
    finally{setRecoveryLoading(false)}
  };
  const createRecoverySnapshot=async()=>{
    if(!recoveryCompanyId){setError("Selecione a empresa para gerar o backup.");return}
    setRecoveryLoading(true);setError("");
    try{
      const r=await fetch("/api/manager/recovery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"snapshot",companyId:recoveryCompanyId})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||"Falha ao criar backup.");
      setSnapshots(j.snapshots||[]);setNotice("Backup operacional criado com sucesso.");
    }catch(e){setError(e instanceof Error?e.message:"Falha ao criar backup.");}
    finally{setRecoveryLoading(false)}
  };
  const restoreRecoverySnapshot=async(snapshot:StateSnapshot)=>{
    const company=companyMap[snapshot.company_id];
    const label=company?.trade_name||company?.legal_name||snapshot.company_id;
    if(!window.confirm("Restaurar "+label+" para a revisão "+snapshot.revision+"? O estado atual será salvo automaticamente antes da restauração."))return;
    const confirmation="RESTORE "+snapshot.id;
    setRecoveryLoading(true);setError("");
    try{
      const r=await fetch("/api/manager/recovery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"restore",companyId:snapshot.company_id,snapshotId:snapshot.id,confirmation})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.error||"Falha ao restaurar backup.");
      setNotice("Snapshot restaurado com segurança. Uma cópia do estado anterior foi preservada.");
      await loadRecovery(snapshot.company_id);
    }catch(e){setError(e instanceof Error?e.message:"Falha ao restaurar backup.");}
    finally{setRecoveryLoading(false)}
  };

  const resetCompanyDraft=()=>{
    setBillingDraft(billingDraftFromCompany(selectedCompany));
    setSelectedPlanDraftCode("");
    setNotice("Alterações descartadas.");
    setError("");
  };

  const saveCompanyChanges=async()=>{
    if(!selectedCompany||!hasUnsavedCompanyChanges||savingCompanyChanges)return;
    const nextPlan=plans.find(plan=>plan.code===effectivePlanDraftCode)||null;
    if(planDirty&&nextPlan){
      const currentPlan=plans.find(plan=>plan.code===selectedPlanCode)||null;
      const removed=(currentPlan?.modules||[]).filter(module=>!nextPlan.modules.includes(module));
      if(removed.length&&!window.confirm(`Confirmar alteração para ${nextPlan.name}? ${removed.length} recurso(s) ficarão indisponíveis. Os dados existentes serão preservados.`))return;
    }
    const body:Record<string,unknown>={};
    if(planDirty){body.planCode=effectivePlanDraftCode;body.status="active";}
    if(billingDirty){
      const monthlyPrice=Number(billingDraft.monthlyPrice.replace(/\./g,"").replace(",","."));
      body.billingEnabled=billingDraft.enabled;
      body.monthlyFeeCents=Number.isFinite(monthlyPrice)?Math.max(0,Math.round(monthlyPrice*100)):0;
      body.billingDay=Math.max(1,Math.min(28,Number(billingDraft.billingDay||10)));
      body.billingIssueLeadDays=Math.max(0,Math.min(20,Number(billingDraft.leadDays||7)));
      body.billingMethod=billingDraft.method;
      body.billingAutoBlock=billingDraft.autoBlock;
      body.billingEmail=billingDraft.email;
    }
    setSavingCompanyChanges(true);
    try{
      const saved=await patch(selectedCompany.id,body);
      if(saved)setNotice("Alterações da empresa salvas com sucesso.");
    }finally{setSavingCompanyChanges(false)}
  };

  const copy=async(value?:string)=>{
    if(!value)return;
    try{await navigator.clipboard.writeText(value);setNotice("Código copiado.");}
    catch{setError("Não foi possível copiar automaticamente.")}
  };

  const statusLabel=(company:Company)=>{
    const expired=Boolean(company.trial_expires_at&&new Date(company.trial_expires_at).getTime()<Date.now()&&(company.plan_code||"trial")==="trial");
    if(expired)return "TRIAL VENCIDO";
    if(company.status==="active")return "ATIVA";
    if(company.access_block_source==="billing")return "INADIMPLENTE";
    return "BLOQUEADA";
  };

  if(authenticated===null)return <main className="manager-root"><div className="manager-login-card"><div className="manager-mark"><ShieldCheck size={28}/></div><h1>ProAR Manager</h1><p>Validando acesso administrativo...</p></div></main>;

  if(!authenticated)return <main className="manager-root"><section className="manager-login-card"><div className="manager-mark"><ShieldCheck size={32}/></div><span className="manager-kicker">BY TAV&apos;s</span><h1>ProAR Manager</h1><p>Gerenciador exclusivo de empresas, licenças, cobrança, bancos e ambientes ProAR.</p><form onSubmit={login}><label>Usuário<input autoFocus autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>{loginError&&<div className="manager-error">{loginError}</div>}<button type="submit"><LogIn size={17}/> Entrar no Manager</button></form><small>Ambiente administrativo separado do ProAR operacional.</small></section></main>;

  return <main className="manager-dashboard">
    <header className="manager-header">
      <div className="manager-title"><div className="manager-mark small"><Building2 size={22}/></div><div><span>BY TAV&apos;s</span><h1>ProAR Manager</h1><p>Empresas, licenças, cobrança recorrente, trials e bancos isolados</p></div></div>
      <div className="manager-actions"><a href="https://teste.proar.online" target="_blank" rel="noreferrer">ProAR Interno</a><button onClick={()=>void load()}><RefreshCw size={15}/> Atualizar</button><button className="logout" onClick={()=>void logout()}><LogOut size={15}/> Sair</button></div>
    </header>

    <section className="manager-content">
      {error&&<div className="manager-alert">{error}</div>}
      {notice&&<div className="manager-notice">{notice}</div>}

      <div className="manager-summary">
        <article><b>{summary?.total??companies.length}</b><span>Empresas cadastradas</span></article>
        <article><b>{summary?.active??0}</b><span>Ativas</span></article>
        <article><b>{summary?.blocked??0}</b><span>Bloqueadas</span></article>
        <article><b>{summary?.billingBlocked??0}</b><span>Bloqueadas por cobrança</span></article>
        <article><b>{summary?.trials??0}</b><span>Trials</span></article>
        <article><b>{summary?.expiringTrials??0}</b><span>Trials vencendo</span></article>
        <article><b>{summary?.databaseErrors??0}</b><span>Bancos com erro</span></article>
        <article><b>{summary?.staleHealth??0}</b><span>Health check vencido</span></article>
        <article className={(summary?.openCriticalIncidents||0)>0?"danger":""}><b>{summary?.openCriticalIncidents??0}</b><span>Incidentes críticos</span></article>
        <article><b>{summary?.recentIncidents??0}</b><span>Incidentes em 24h</span></article>
      </div>

      <section className="manager-panel manager-operations-overview">
        <div className="panel-head manager-panel-head-inline"><div><h2>Operação das Empresas</h2><p>Status consolidado de banco, acesso, versão, atividade e incidentes dos tenants.</p></div><button onClick={()=>void load()}><RefreshCw size={15}/> Atualizar saúde</button></div>
        <div className="manager-table-wrap"><table className="manager-table manager-operations-table"><thead><tr><th>Empresa</th><th>Acesso</th><th>Banco</th><th>Último health</th><th>Última atividade</th><th>Incidentes</th><th>Ação</th></tr></thead><tbody>
          {companies.map(company=>{const inst=map[company.id];const companyIncidents=incidents.filter(item=>item.company_id===company.id&&!item.resolved_at);const critical=companyIncidents.filter(item=>item.severity==="critical").length;const bankState=inst?.provisioning_error?"Erro":inst?.provisioning_status==="ready"?"Online":inst?.provisioning_status||"Pendente";return <tr key={"ops-"+company.id}>
            <td><button className="manager-link-button" onClick={()=>{setSelectedCompanyId(company.id);setDetailTab("Visão Geral")}}>{company.trade_name||company.legal_name}</button></td>
            <td><span className={company.status==="active"?"manager-health ok":"manager-health error"}>{company.status==="active"?"Liberado":"Bloqueado"}</span></td>
            <td><span className={bankState==="Online"?"manager-health ok":bankState==="Erro"?"manager-health error":"manager-health warning"}>{bankState}</span></td>
            <td>{dateTime(inst?.last_health_at)}</td>
            <td>{dateTime(company.last_seen_at)}</td>
            <td><span className={critical?"manager-health error":companyIncidents.length?"manager-health warning":"manager-health ok"}>{critical?critical+" crítico(s)":companyIncidents.length?companyIncidents.length+" aberto(s)":"Sem incidentes"}</span></td>
            <td><button onClick={()=>void patch(company.id,{checkTenantHealth:true})}>Testar banco</button></td>
          </tr>})}
          {!companies.length&&<tr><td colSpan={7}>Nenhuma empresa cadastrada.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="manager-panel manager-observability-panel">
        <div className="panel-head"><div><h2>Central de Erros</h2><p>Códigos PROAR, módulo, operação, horário e causa técnica sem expor segredos ao usuário final.</p></div></div>
        <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Horário</th><th>Empresa</th><th>Código</th><th>Módulo / operação</th><th>Severidade</th><th>Mensagem</th></tr></thead><tbody>
          {incidents.slice(0,30).map(item=><tr key={item.id}><td>{dateTime(item.created_at)}</td><td>{companyMap[item.company_id||""]?.trade_name||item.company_id||"Plataforma"}</td><td><code>{item.code}</code></td><td>{item.module}<small className="manager-cell-detail">{item.operation}</small></td><td><span className={"manager-health "+(item.severity==="critical"||item.severity==="error"?"error":item.severity==="warning"?"warning":"ok")}>{item.severity}</span></td><td>{item.user_message||"Falha registrada"}{item.request_id&&<small className="manager-cell-detail">Request: {item.request_id}</small>}</td></tr>)}
          {!incidents.length&&<tr><td colSpan={6}>Nenhum incidente registrado.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="manager-panel manager-deployment-panel">
        <div className="panel-head"><div><h2>Publicação segura e rollback</h2><p>Produção somente após quality gate. O rollback aponta o tráfego para um deployment anterior sem alterar o banco.</p></div></div>
        <div className="manager-deployment-grid">
          <div><small>Ambiente</small><b>{deploymentSafety?.environment||"—"}</b></div>
          <div><small>Commit atual</small><b>{deploymentSafety?.currentCommit?.slice(0,12)||"—"}</b></div>
          <div><small>Deployment atual</small><b>{deploymentSafety?.currentDeploymentId||"—"}</b></div>
          <div><small>Rollback</small><b>{deploymentSafety?.rollbackConfigured?"Configurado":"Configuração pendente"}</b></div>
        </div>
        <div className="manager-rollback-form">
          <label>Deployment anterior<input value={rollbackDeploymentId} onChange={e=>setRollbackDeploymentId(e.target.value)} placeholder="dpl_..."/></label>
          <label>Motivo<input value={rollbackReason} onChange={e=>setRollbackReason(e.target.value)} maxLength={180}/></label>
          <button className="danger" disabled={!deploymentSafety?.rollbackConfigured} onClick={()=>void rollbackDeployment()}>Executar rollback</button>
        </div>
        <small className="manager-deployment-note">Gate: {deploymentSafety?.productionGate||"CI + build + runtime smoke + health check"}. O banco não é revertido junto com a aplicação.</small>
      </section>

      <section className="manager-panel manager-recovery-panel">
        <div className="panel-head manager-panel-head-inline"><div><h2>Centro de Recuperação e Backup</h2><p>Snapshots seguros do estado operacional. Antes de qualquer restauração, o estado atual é preservado automaticamente.</p></div><button disabled={!recoveryCompanyId||recoveryLoading} onClick={()=>void createRecoverySnapshot()}>Criar backup agora</button></div>
        <div className="manager-recovery-controls">
          <label>Empresa<select value={recoveryCompanyId} onChange={e=>void loadRecovery(e.target.value)}><option value="">Selecione...</option>{companies.map(company=><option key={"recovery-"+company.id} value={company.id}>{company.trade_name||company.legal_name}</option>)}</select></label>
          <span>{recoveryLoading?"Processando...":snapshots.length?snapshots.length+" snapshot(s) localizado(s)":"Selecione uma empresa para consultar os backups."}</span>
        </div>
        {recoveryCompanyId&&<div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Data</th><th>Revisão</th><th>Origem</th><th>Criado por</th><th>Ação</th></tr></thead><tbody>
          {snapshots.slice(0,15).map(snapshot=><tr key={"snapshot-"+snapshot.id}><td>{dateTime(snapshot.created_at)}</td><td>{snapshot.revision}</td><td>{snapshot.reason}</td><td>{snapshot.created_by||"Sistema"}</td><td><button className="danger" disabled={recoveryLoading} onClick={()=>void restoreRecoverySnapshot(snapshot)}>Restaurar</button></td></tr>)}
          {!snapshots.length&&!recoveryLoading&&<tr><td colSpan={5}>Nenhum snapshot disponível para esta empresa.</td></tr>}
        </tbody></table></div>}
      </section>

      <ReleaseGovernancePanel />

      <section className="manager-panel manager-billing-overview">
        <div className="panel-head manager-panel-head-inline"><div><h2>Financeiro do ProAR Manager</h2><p>Mensalidades das empresas locatárias, separado do financeiro operacional de cada tenant.</p></div><button onClick={()=>void billingAction({action:"run-cycle"})}><RefreshCw size={15}/> Executar ciclo agora</button></div>
        {!mercadoPagoReady&&<div className="manager-warning"><AlertTriangle size={16}/><span>Mercado Pago ainda não está configurado neste ambiente. As mensalidades podem ser geradas, mas Pix/boleto exigem as credenciais do Mercado Pago.</span></div>}
        <div className="manager-billing-kpis">
          <article><CreditCard size={18}/><div><b>{money(billingSummary?.mrrCents)}</b><span>MRR configurado</span></div></article>
          <article><Banknote size={18}/><div><b>{money(billingSummary?.openCents)}</b><span>{billingSummary?.openCount||0} em aberto</span></div></article>
          <article className={(billingSummary?.overdueCount||0)>0?"danger":""}><AlertTriangle size={18}/><div><b>{money(billingSummary?.overdueCents)}</b><span>{billingSummary?.overdueCount||0} vencidas</span></div></article>
          <article><CheckCircle2 size={18}/><div><b>{money(billingSummary?.paidThisMonthCents)}</b><span>{billingSummary?.paidThisMonthCount||0} pagas no mês</span></div></article>
        </div>
      </section>

      <section className="manager-panel manager-plans-overview">
        <div className="panel-head"><div><h2>Planos comerciais</h2><p>Somente três níveis de contratação. Os recursos são liberados pelo plano, sem módulos avulsos.</p></div></div>
        <div className="manager-plan-grid">{plans.map(plan=><article key={"overview-"+plan.code} className="manager-plan-card manager-plan-card-static">
          <header><div><b>{plan.name}</b><small>{userLimitLabel(plan.limits.users)} • {plan.modules.length} recursos</small></div></header>
          <p>{plan.description}</p>
          <div className="manager-plan-features">{plan.modules.slice(0,6).map(module=><span key={module}>{module}</span>)}{plan.modules.length>6&&<span>+ {plan.modules.length-6} recursos</span>}</div>
          <small>{userLimitLabel(plan.limits.users)} • {plan.limits.serviceOrdersPerMonth} OS/mês • {plan.limits.storageGb} GB</small>
        </article>)}</div>
      </section>

      <section className="manager-panel">
        <div className="panel-head"><div><h2>Empresas</h2><p>Cada empresa possui ambiente e banco operacional isolados, com acesso e cobrança controlados pelo Manager.</p></div></div>
        {loading?<div className="manager-empty">Carregando empresas...</div>:<div className="manager-company-grid">
          {companies.map(c=>{const inst=map[c.id];const expires=c.trial_expires_at?new Date(c.trial_expires_at):null;const label=statusLabel(c);return <article key={c.id} className="manager-company">
            <header><div><h3>{c.trade_name||c.legal_name}</h3><small>{c.cnpj||c.cpf||c.id} • {c.email||"Sem e-mail"}</small></div><span className={c.status==="active"&&label==="ATIVA"?"active":"blocked"}>{label}</span></header>
            <dl>
              <div><dt>Plano</dt><dd>{planLabel(c.plan_code)}</dd></div>
              <div><dt>Mensalidade</dt><dd>{c.billing_enabled?money(c.monthly_fee_cents):"Desativada"}</dd></div>
              <div><dt>Vencimento</dt><dd>{c.billing_enabled?`Dia ${c.billing_day||10} • ${c.billing_method==="boleto"?"Boleto":c.billing_method==="card"?"Cartão":"Pix"}`:"—"}</dd></div>
              <div><dt>Trial</dt><dd>{expires?expires.toLocaleDateString("pt-BR"):"—"}</dd></div>
              <div><dt>Tenant</dt><dd>{c.tenant?.role==="primary-pilot"?"Tenant 1 • Piloto":"Cliente locatário"}</dd></div>
              <div><dt>Banco lógico</dt><dd>{c.tenant?.databaseName||"—"}</dd></div><div><dt>Isolamento</dt><dd>{c.tenant?.isolation==="dedicated-project"?"Projeto/Banco dedicado":c.tenant?.isolation||"—"}</dd></div>
              <div><dt>Provisionamento</dt><dd>{inst?.provisioning_status||"não provisionado"}</dd></div><div><dt>Saúde do banco</dt><dd>{dateTime(inst?.last_health_at)}</dd></div>
              <div><dt>Prontidão</dt><dd><span className={c.readiness?.ready?"manager-health ok":"manager-health warning"}>{c.readiness?.score??0}%</span></dd></div><div><dt>Último uso</dt><dd>{dateTime(c.last_seen_at)}</dd></div>
            </dl>
            {c.suspended_reason&&c.status!=="active"&&<div className="manager-alert compact">{c.suspended_reason}</div>}
            {inst?.provisioning_error&&<div className="manager-alert compact">{inst.provisioning_error}</div>}
            <footer>
              <button onClick={()=>{setSelectedCompanyId(c.id);setDetailTab("Visão Geral")}}>Gerenciar</button>
              <button onClick={()=>void patch(c.id,{checkTenantHealth:true})}>Verificar banco</button>
              {c.plan_code==="trial"&&<button onClick={()=>void patch(c.id,{extendTrialDays:7})}>+7 dias</button>}
              {c.plan_code==="trial"&&<button onClick={()=>void patch(c.id,{planCode:"basico",status:"active"})}>Converter para Básico</button>}
              <button className={c.status==="active"?"danger":"success"} onClick={()=>void patch(c.id,{status:c.status==="active"?"blocked":"active"})}>{c.status==="active"?"Bloquear":"Tentar liberar"}</button>
              {c.slug&&<a href={`https://${c.slug}.proar.online`} target="_blank" rel="noreferrer">Abrir ambiente</a>}
            </footer>
          </article>})}
          {!companies.length&&<div className="manager-empty">Nenhuma empresa cadastrada.</div>}
        </div>}
      </section>

      <section className="manager-panel manager-receivables-panel">
        <div className="panel-head"><div><h2>Contas a receber</h2><p>Últimas mensalidades geradas pelo Manager.</p></div></div>
        <div className="manager-table-wrap"><table className="manager-table"><thead><tr><th>Empresa</th><th>Referência</th><th>Vencimento</th><th>Valor</th><th>Forma</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {receivables.slice(0,80).map(row=>{const overdue=row.status==="pending"&&row.due_date<new Date().toISOString().slice(0,10);return <tr key={row.id}>
            <td><button className="manager-link-button" onClick={()=>{setSelectedCompanyId(row.company_id);setDetailTab("Cobrança")}}>{companyMap[row.company_id]?.trade_name||companyMap[row.company_id]?.legal_name||row.company_id}</button></td>
            <td>{date(row.reference_month)}</td><td>{date(row.due_date)}</td><td>{money(row.amount_cents)}</td><td>{row.payment_method==="boleto"?"Boleto":row.payment_method==="pix"?"Pix":row.payment_method==="card"?"Cartão":"Manual"}</td>
            <td><span className={`manager-payment-status ${overdue?"overdue":row.status}`}>{overdue?"VENCIDA":row.status==="paid"?"PAGA":row.status==="pending"?"EM ABERTO":row.status.toUpperCase()}</span></td>
            <td><div className="manager-row-actions">
              {row.payment_url&&<a href={row.payment_url} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Abrir</a>}
              {row.pix_qr_code&&<button onClick={()=>void copy(row.pix_qr_code)}><Copy size={14}/> Copiar Pix</button>}
              {row.boleto_digitable_line&&<button onClick={()=>void copy(row.boleto_digitable_line)}><Copy size={14}/> Linha</button>}
              {row.status==="pending"&&<button onClick={()=>void billingAction({action:"reissue",receivableId:row.id})}>Reemitir</button>}
              {row.status==="pending"&&<button onClick={()=>void billingAction({action:"mark-paid",receivableId:row.id})}>Baixa manual</button>}
              {row.status==="pending"&&<button className="danger" onClick={()=>void billingAction({action:"cancel",receivableId:row.id})}>Cancelar</button>}
            </div></td>
          </tr>})}
          {!receivables.length&&<tr><td colSpan={7}><div className="manager-empty">Nenhuma mensalidade gerada ainda.</div></td></tr>}
        </tbody></table></div>
      </section>

      <section className="manager-grid-secondary">
        <section className="manager-panel">
          <div className="panel-head"><div><h2>Health Center</h2><p>Visão consolidada dos bancos e ambientes de cada tenant.</p></div></div>
          <div className="manager-health-list">{companies.map(c=>{const inst=map[c.id];const state=inst?.provisioning_error?"error":inst?.provisioning_status==="ready"?"ok":"warning";return <button key={c.id} className={`manager-health-row ${state}`} onClick={()=>{setSelectedCompanyId(c.id);setDetailTab("Banco")}}><span><b>{c.trade_name||c.legal_name}</b><small>{c.tenant?.databaseName||c.slug||c.id}</small></span><em>{state==="ok"?"OK":state==="error"?"ERRO":"ATENÇÃO"}</em></button>})}</div>
        </section>
        <section className="manager-panel">
          <div className="panel-head"><div><h2>Versão e migrations</h2><p>Controle de rollout da plataforma.</p></div></div>
          <div className="manager-platform">{platform?<><strong>ProAR {platform.appVersion}</strong><span>{platform.releaseTitle} • {platform.releaseDate}</span><span>Schema {platform.schemaVersion} • canal {platform.channel}</span>{platform.migrations.map(m=><div key={m.id}><b>{m.title}</b><small>{m.status==="prepared"?"Preparada, não aplicada":"Ativa"} • {m.destructive?"requer confirmação":"aditiva"}</small><p>{m.description}</p></div>)}</>:<span>Metadados de versão indisponíveis.</span>}</div>
        </section>
      </section>

      <section className="manager-panel manager-audit-panel">
        <div className="panel-head"><div><h2>Auditoria recente</h2><p>Alterações administrativas e financeiras do ProAR Manager.</p></div></div>
        <div className="manager-audit-list">{audit.length?audit.slice(0,18).map(row=><article key={String(row.id||row.created_at)}><b>{row.action||"Ação administrativa"}</b><span>{row.actor||"Sistema"} • {row.company_id||"plataforma"}</span><small>{dateTime(row.created_at)}</small></article>):<div className="manager-empty">Nenhum evento administrativo recente.</div>}</div>
      </section>

      {selectedCompany&&<div className="manager-detail-layer" role="dialog" aria-modal="true">
        <button className="manager-detail-backdrop" onClick={()=>setSelectedCompanyId("")} aria-label="Fechar"/>
        <section className="manager-detail">
          <header><div><span>{selectedCompany.tenant?.role==="primary-pilot"?"TENANT 1 • PILOTO":"CLIENTE LOCATÁRIO"}</span><h2>{selectedCompany.trade_name||selectedCompany.legal_name}</h2><p>{selectedCompany.slug?selectedCompany.slug+".proar.online":"Sem domínio configurado"}</p></div><button onClick={()=>setSelectedCompanyId("")}>Fechar</button></header>
          <div className="manager-detail-grid">
            <article><b>Banco</b><span>{selectedCompany.tenant?.databaseName||"—"}</span><small>{selectedInstance?.provider||"—"} • {selectedInstance?.provisioning_status||"não provisionado"}</small></article>
            <article><b>Plano</b><span>{planLabel(selectedCompany.plan_code)}</span><small>{statusLabel(selectedCompany)}</small></article>
            <article><b>Mensalidade</b><span>{selectedCompany.billing_enabled?money(selectedCompany.monthly_fee_cents):"Desativada"}</span><small>{selectedCompany.billing_enabled?`Vence dia ${selectedCompany.billing_day||10}`:"Sem cobrança recorrente"}</small></article>
            <article><b>Saúde</b><span>{dateTime(selectedInstance?.last_health_at)}</span><small>{selectedInstance?.provisioning_error||"Sem erro registrado"}</small></article>
          </div>
          <div className="manager-detail-tabs">{["Visão Geral","Banco","Plano e módulos","Cobrança","Segurança","Logs"].map(tab=><button key={tab} className={detailTab===tab?"active":""} onClick={()=>setDetailTab(tab)}>{tab}</button>)}</div>

          {detailTab==="Visão Geral"&&<div className="manager-detail-tab"><p>Empresa <b>{statusLabel(selectedCompany)}</b>. O Manager preserva o banco operacional do tenant e controla plano, acesso, cobrança e integridade de forma independente.</p>{selectedCompany.suspended_reason&&<div className="manager-alert compact">{selectedCompany.suspended_reason}</div>}</div>}

          {detailTab==="Banco"&&<div className="manager-detail-tab"><p><b>{selectedCompany.tenant?.databaseName||"—"}</b> • {selectedInstance?.provider||"—"} • {selectedInstance?.provisioning_status||"não provisionado"}</p><p>{selectedInstance?.last_health_at?`Último health check: ${dateTime(selectedInstance.last_health_at)}`:"Health check ainda não executado."}</p><div className="manager-inline-actions"><button onClick={()=>void patch(selectedCompany.id,{checkTenantHealth:true})}>Verificar banco</button>{selectedCompany.tenant?.role==="primary-pilot"&&(!selectedInstance||selectedInstance.provisioning_status!=="ready")&&<button onClick={()=>void patch(selectedCompany.id,{registerPrimaryPilot:true})}>Consolidar Tenant 1</button>}{selectedInstance&&selectedInstance.provisioning_status!=="ready"&&selectedCompany.tenant?.role!=="primary-pilot"&&<button onClick={()=>void patch(selectedCompany.id,{retryProvisioning:true})}>Finalizar banco</button>}</div></div>}

          {detailTab==="Plano e módulos"&&<div className="manager-detail-tab">
            {selectedCompany.plan_code==="trial"&&<div className="manager-warning"><AlertTriangle size={16}/><span>O Trial usa os recursos e o limite de usuários do plano Básico. Ao selecionar um plano comercial, o período de teste é convertido.</span></div>}
            <div className="manager-plan-grid">{plans.map(plan=><button key={plan.code} className={"manager-plan-card "+(effectivePlanDraftCode===plan.code?"active":"")} disabled={selectedCompany.tenant?.role==="primary-pilot"&&plan.code!=="completo"} onClick={()=>setSelectedPlanDraftCode(plan.code)}>
              <header><div><b>{plan.name}</b><small>{userLimitLabel(plan.limits.users)} • {plan.modules.length} recursos</small></div>{effectivePlanDraftCode===plan.code&&<span>{planDirty?"SELECIONADO":"ATUAL"}</span>}</header>
              <p>{plan.description}</p>
              <div className="manager-plan-features">{plan.modules.slice(0,8).map(module=><span key={module}>{module}</span>)}{plan.modules.length>8&&<span>+ {plan.modules.length-8} recursos</span>}</div>
              <small>{userLimitLabel(plan.limits.users)} • {plan.limits.serviceOrdersPerMonth} OS/mês • {plan.limits.storageGb} GB</small>
            </button>)}</div>
            {selectedPlan&&<div className="manager-selected-plan"><b>{selectedPlan.name}</b><span>{userLimitLabel(selectedPlan.limits.users)} • {selectedPlan.modules.length} recursos liberados</span><div className="manager-module-chips">{selectedPlan.modules.map(module=><span key={module}>{module}</span>)}</div></div>}
          </div>}

          {detailTab==="Cobrança"&&<div className="manager-detail-tab">
            <div className="manager-billing-form">
              <label className="manager-check"><input type="checkbox" checked={billingDraft.enabled} onChange={e=>setBillingDraft(v=>({...v,enabled:e.target.checked}))}/><span>Ativar cobrança recorrente</span></label>
              <label>Valor mensal do plano<input inputMode="decimal" value={billingDraft.monthlyPrice} onChange={e=>setBillingDraft(v=>({...v,monthlyPrice:e.target.value}))}/></label>
              <label>Dia do vencimento<input type="number" min="1" max="28" value={billingDraft.billingDay} onChange={e=>setBillingDraft(v=>({...v,billingDay:e.target.value}))}/></label>
              <label>Gerar quantos dias antes<input type="number" min="0" max="20" value={billingDraft.leadDays} onChange={e=>setBillingDraft(v=>({...v,leadDays:e.target.value}))}/></label>
              <label>Forma<select value={billingDraft.method} onChange={e=>setBillingDraft(v=>({...v,method:e.target.value==="boleto"?"boleto":e.target.value==="card"?"card":"pix"}))}><option value="pix">Pix</option><option value="boleto">Boleto</option><option value="card">Cartão de crédito</option></select></label>
              <label>E-mail financeiro<input type="email" value={billingDraft.email} onChange={e=>setBillingDraft(v=>({...v,email:e.target.value}))}/></label>
              <label className="manager-check"><input type="checkbox" checked={billingDraft.autoBlock} onChange={e=>setBillingDraft(v=>({...v,autoBlock:e.target.checked}))}/><span>Bloquear automaticamente após vencimento</span></label>
            </div>
            <div className="manager-plan-billing-summary"><b>Plano {selectedPlan?.name||"Básico"}</b><span>{userLimitLabel(selectedPlan?.limits.users??2)} • {selectedPlan?.modules.length||0} recursos. A mensalidade é definida pelo plano, sem cobrança por recurso individual.</span></div>
            <div className="manager-inline-actions"><button onClick={()=>void billingAction({action:"issue-current",companyId:selectedCompany.id})}>Gerar mensalidade atual</button><button onClick={()=>void billingAction({action:"sync-access",companyId:selectedCompany.id})}>Revalidar acesso</button></div>
            <div className="manager-mini-receivables">{selectedReceivables.slice(0,8).map(row=><article key={row.id}><div><b>{row.description}</b><span>{date(row.due_date)} • {money(row.amount_cents)}</span></div><em>{row.status==="paid"?"PAGA":row.status==="pending"?"EM ABERTO":row.status.toUpperCase()}</em></article>)}{!selectedReceivables.length&&<div className="manager-empty">Nenhuma mensalidade desta empresa.</div>}</div>
          </div>}

          {detailTab==="Segurança"&&<div className="manager-detail-tab"><p>O bloqueio registra a origem. Pagamentos só removem bloqueios de cobrança; bloqueios manuais e trials vencidos não são liberados pelo webhook.</p><div className="manager-inline-actions"><button className={selectedCompany.status==="active"?"danger":"success"} onClick={()=>void patch(selectedCompany.id,{status:selectedCompany.status==="active"?"blocked":"active"})}>{selectedCompany.status==="active"?"Bloquear manualmente":"Tentar liberar"}</button>{selectedCompany.plan_code==="trial"&&<button onClick={()=>void patch(selectedCompany.id,{extendTrialDays:7})}>Prorrogar trial +7 dias</button>}</div></div>}

          {detailTab==="Logs"&&<div className="manager-detail-tab manager-mini-logs">{audit.filter(row=>row.company_id===selectedCompany.id).slice(0,12).map(row=><article key={String(row.id||row.created_at)}><b>{row.action||"Ação"}</b><span>{row.actor||"Sistema"}</span><small>{dateTime(row.created_at)}</small></article>)}</div>}

          {hasUnsavedCompanyChanges&&<div className="manager-save-bar" role="status" aria-live="polite">
            <div><span>Alterações não salvas</span><small>{planDirty&&billingDirty?"Plano e cobrança foram alterados.":planDirty?"O plano selecionado ainda não foi aplicado.":"Existem alterações na cobrança aguardando confirmação."}</small></div>
            <div>
              <button type="button" className="manager-save-cancel" onClick={resetCompanyDraft} disabled={savingCompanyChanges}><X size={15}/> Cancelar</button>
              <button type="button" className="manager-save-primary" onClick={()=>void saveCompanyChanges()} disabled={savingCompanyChanges}><Save size={15}/>{savingCompanyChanges?" Salvando...":" Salvar alterações"}</button>
            </div>
          </div>}

          <nav><a href={selectedCompany.slug?`https://${selectedCompany.slug}.proar.online`:"#"} target="_blank" rel="noreferrer">Abrir ambiente</a></nav>
        </section>
      </div>}
    </section>
  </main>;
}
