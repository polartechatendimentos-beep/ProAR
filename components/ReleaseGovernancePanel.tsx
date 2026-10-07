"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, FlaskConical, Flag, GitBranch, RefreshCw, Rocket, RotateCcw, Save, ShieldCheck } from "lucide-react";

type Channel="internal"|"homologation"|"canary"|"production";
type Environment={code:Channel;name:string;alias?:string|null;description?:string;customer_facing:boolean;requires_approval:boolean;deploymentId?:string|null;aliasStatus?:string;aliasError?:string|null};
type Release={id:string;version:string;commit_sha:string;deployment_id:string;schema_version:string;minimum_schema_version:string;channel:Channel;status:string;title:string;summary?:string;approval_required:boolean;created_by:string;approved_by?:string|null;scheduled_at?:string|null;created_at?:string};
type Target={id:number;release_id:string;company_id?:string|null;environment_code:Channel;alias:string;previous_version?:string|null;previous_deployment_id?:string|null;target_version:string;target_deployment_id:string;status:string;health_status?:string|null;snapshot_id?:number|null;error_code?:string|null;error_message?:string|null;scheduled_at?:string|null;applied_at?:string|null};
type TenantSettings={company_id:string;release_channel:Channel;update_policy:"automatic"|"manual"|"pinned"|"scheduled";pinned_version?:string|null;current_version?:string|null;current_deployment_id?:string|null;schema_version:string;maintenance_mode:boolean;maintenance_message?:string|null;scheduled_update_at?:string|null;last_health_status?:string|null;last_error_code?:string|null};
type FeatureFlag={flag_key:string;name:string;description?:string|null;module_name?:string|null;status:string;default_enabled:boolean;internal_enabled:boolean;homologation_enabled:boolean;canary_percent:number;production_enabled:boolean};
type FlagOverride={flag_key:string;company_id:string;enabled:boolean;reason?:string|null;updated_by?:string|null;updated_at?:string};
type Company={id:string;slug?:string;trade_name?:string;legal_name?:string;status?:string;plan_code?:string};
type Check={id:number;release_id:string;company_id?:string|null;environment_code:Channel;stage:string;check_key:string;status:string;code?:string|null;detail?:string|null;latency_ms?:number|null;checked_at:string};
type Data={ready:boolean;schema?:{ready:boolean;reason?:string|null};environments:Environment[];releases:Release[];targets:Target[];settings:TenantSettings[];flags:FeatureFlag[];overrides:FlagOverride[];companies:Company[];checks:Check[];dualApproval?:boolean};

const channelLabel:Record<Channel,string>={internal:"ProAR Interno",homologation:"Homologação",canary:"Canary",production:"Produção"};
const statusTone=(value?:string)=>value==="active"||value==="ok"||value==="approved"?"ok":value==="failed"||value==="error"||value==="blocked"?"error":"warning";
const formatDate=(value?:string|null)=>value?new Date(value).toLocaleString("pt-BR"):"—";

export function ReleaseGovernancePanel(){
  const[data,setData]=useState<Data|null>(null);
  const[loading,setLoading]=useState(false);
  const[busy,setBusy]=useState("");
  const[notice,setNotice]=useState("");
  const[error,setError]=useState("");
  const[releaseDraft,setReleaseDraft]=useState({version:"",deploymentId:"",commitSha:"",title:"",summary:"",minimumSchemaVersion:"2026.10.06"});
  const[canaryCompany,setCanaryCompany]=useState("");
  const[scheduleAt,setScheduleAt]=useState("");
  const[flagDraft,setFlagDraft]=useState({flagKey:"",name:"",description:"",moduleName:"",canaryPercent:"10"});
  const[overrideDraft,setOverrideDraft]=useState({flagKey:"",companyId:"",enabled:true,reason:"Liberação controlada pelo ProAR Manager"});
  const[tenantDraft,setTenantDraft]=useState<Record<string,{channel:Channel;policy:"automatic"|"manual"|"pinned"|"scheduled";pinnedVersion:string;schemaVersion:string;maintenance:boolean;maintenanceMessage:string}>>({});

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/manager/releases",{cache:"no-store"});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||"Falha ao carregar governança de releases.");
      setData(result);
      const drafts:typeof tenantDraft={};
      for(const company of result.companies||[]){
        const current=(result.settings||[]).find((row:TenantSettings)=>row.company_id===company.id);
        drafts[company.id]={
          channel:current?.release_channel||"production",
          policy:current?.update_policy||"automatic",
          pinnedVersion:current?.pinned_version||"",
          schemaVersion:current?.schema_version||"2026.10.06",
          maintenance:Boolean(current?.maintenance_mode),
          maintenanceMessage:current?.maintenance_message||"",
        };
      }
      setTenantDraft(drafts);
    }catch(e){setError(e instanceof Error?e.message:"Falha ao carregar Central de Versões.");}
    finally{setLoading(false)}
  };

  useEffect(()=>{void load()},[]);

  const act=async(action:string,payload:Record<string,unknown>={},success="Operação concluída.")=>{
    setBusy(action);setError("");setNotice("");
    try{
      const response=await fetch("/api/manager/releases",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||"Operação de release recusada.");
      setNotice(success);
      await load();
      return result;
    }catch(e){setError(e instanceof Error?e.message:"Falha na operação.");return null}
    finally{setBusy("")}
  };

  const companyMap=useMemo(()=>Object.fromEntries((data?.companies||[]).map(company=>[company.id,company])),[data?.companies]);
  const eligibleCanary=(data?.companies||[]).filter(company=>company.id!=="proar-internal"&&company.status==="active");
  const latestChecks=(data?.checks||[]).slice(0,18);

  const promote=async(release:Release,channel:Channel)=>{
    const payload:Record<string,unknown>={releaseId:release.id,channel};
    if(channel==="canary"){
      if(!canaryCompany){setError("Selecione um tenant para o Canary.");return}
      payload.companyIds=[canaryCompany];
    }
    if(scheduleAt)payload.scheduledAt=new Date(scheduleAt).toISOString();
    const confirmation=channel==="production"
      ?"Liberar esta versão para os tenants elegíveis de Produção? O rollout será interrompido automaticamente se um health check falhar."
      :"Promover "+release.version+" para "+channelLabel[channel]+"?";
    if(!window.confirm(confirmation))return;
    await act("promote",payload,"Release "+release.version+" enviada para "+channelLabel[channel]+".");
  };

  const saveTenant=async(companyId:string)=>{
    const draft=tenantDraft[companyId];if(!draft)return;
    await act("tenant-policy",{
      companyId,releaseChannel:draft.channel,updatePolicy:draft.policy,pinnedVersion:draft.pinnedVersion,
      schemaVersion:draft.schemaVersion,maintenanceMode:draft.maintenance,maintenanceMessage:draft.maintenanceMessage,
    },"Política de atualização do tenant salva.");
  };

  const createRelease=async()=>{
    if(!releaseDraft.version||!releaseDraft.deploymentId){setError("Informe versão e deployment.");return}
    const result=await act("create-release",{
      version:releaseDraft.version,deploymentId:releaseDraft.deploymentId,commitSha:releaseDraft.commitSha,
      title:releaseDraft.title||("ProAR "+releaseDraft.version),summary:releaseDraft.summary,
      minimumSchemaVersion:releaseDraft.minimumSchemaVersion,approvalRequired:true,
    },"Release criada e publicada primeiro no ProAR Interno.");
    if(result)setReleaseDraft({version:"",deploymentId:"",commitSha:"",title:"",summary:"",minimumSchemaVersion:"2026.10.06"});
  };

  const saveFlagOverride=async()=>{
    if(!overrideDraft.flagKey||!overrideDraft.companyId){setError("Selecione a feature flag e a empresa.");return}
    await act("feature-override",{
      flagKey:overrideDraft.flagKey,companyId:overrideDraft.companyId,enabled:overrideDraft.enabled,reason:overrideDraft.reason,
    },"Exceção da feature flag salva para a empresa.");
  };

  const createFlag=async()=>{
    if(!flagDraft.flagKey){setError("Informe a chave da feature flag.");return}
    const result=await act("feature-flag",{
      flagKey:flagDraft.flagKey,name:flagDraft.name||flagDraft.flagKey,description:flagDraft.description,moduleName:flagDraft.moduleName,
      internalEnabled:true,homologationEnabled:false,canaryPercent:Number(flagDraft.canaryPercent)||0,productionEnabled:false,status:"active",
    },"Feature flag criada. Ela inicia ativa apenas no ProAR Interno.");
    if(result)setFlagDraft({flagKey:"",name:"",description:"",moduleName:"",canaryPercent:"10"});
  };

  if(loading&&!data)return <section className="manager-panel manager-release-center"><div className="manager-empty">Carregando Central de Versões...</div></section>;

  return <section className="manager-panel manager-release-center">
    <div className="panel-head manager-panel-head-inline">
      <div><h2>Central de Versões e Ambientes</h2><p>Desenvolvimento → ProAR Interno → Homologação → Canary → Produção. Clientes nunca recebem uma versão apenas porque ela foi compilada.</p></div>
      <div className="manager-inline-actions"><button onClick={()=>void act("bootstrap-internal",{},"Ambiente interno preparado.")} disabled={Boolean(busy)}><FlaskConical size={15}/> Preparar ProAR Interno</button><button onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Atualizar</button></div>
    </div>

    {error&&<div className="manager-alert">{error}</div>}
    {notice&&<div className="manager-notice">{notice}</div>}
    {data&&!data.ready&&<div className="manager-warning"><AlertTriangle size={16}/><span>{data.schema?.reason||"A estrutura de governança ainda não está disponível."}</span></div>}

    <div className="release-environment-grid">
      {(data?.environments||[]).map(env=><article key={env.code} className={"release-environment-card "+statusTone(env.aliasStatus==="error"?"error":"ok")}>
        <header><div><span>{env.code.toUpperCase()}</span><b>{env.name}</b></div>{env.customer_facing?<ShieldCheck size={18}/>:<FlaskConical size={18}/>}</header>
        <p>{env.description}</p>
        <dl><div><dt>Alias</dt><dd>{env.alias||"Por tenant"}</dd></div><div><dt>Deployment servido</dt><dd>{env.deploymentId||"Não promovido"}</dd></div><div><dt>Aprovação</dt><dd>{env.requires_approval?"Obrigatória":"Não exigida"}</dd></div></dl>
      </article>)}
    </div>

    <div className="release-center-grid">
      <section className="release-subpanel">
        <header><div><GitBranch size={17}/><span><b>Nova release</b><small>Cadastre um deployment READY. Ele entra sempre no canal Interno.</small></span></div></header>
        <div className="release-form-grid">
          <label>Versão<input value={releaseDraft.version} onChange={e=>setReleaseDraft(v=>({...v,version:e.target.value}))} placeholder="2026.10.07.1"/></label>
          <label>Deployment Vercel<input value={releaseDraft.deploymentId} onChange={e=>setReleaseDraft(v=>({...v,deploymentId:e.target.value}))} placeholder="dpl_..."/></label>
          <label>Commit SHA<input value={releaseDraft.commitSha} onChange={e=>setReleaseDraft(v=>({...v,commitSha:e.target.value}))} placeholder="opcional: validado contra o deployment"/></label>
          <label>Schema mínimo<input value={releaseDraft.minimumSchemaVersion} onChange={e=>setReleaseDraft(v=>({...v,minimumSchemaVersion:e.target.value}))}/></label>
          <label className="wide">Título<input value={releaseDraft.title} onChange={e=>setReleaseDraft(v=>({...v,title:e.target.value}))} placeholder="Resumo da versão"/></label>
          <label className="wide">Descrição<textarea value={releaseDraft.summary} onChange={e=>setReleaseDraft(v=>({...v,summary:e.target.value}))} rows={3}/></label>
        </div>
        <button className="release-primary-button" onClick={()=>void createRelease()} disabled={Boolean(busy)}><Save size={15}/> Criar release interna</button>
      </section>

      <section className="release-subpanel">
        <header><div><Rocket size={17}/><span><b>Controles de rollout</b><small>Canary exige tenant explícito. Produção respeita pinagem e políticas individuais.</small></span></div></header>
        <div className="release-form-grid">
          <label>Tenant Canary<select value={canaryCompany} onChange={e=>setCanaryCompany(e.target.value)}><option value="">Selecione...</option>{eligibleCanary.map(company=><option key={company.id} value={company.id}>{company.trade_name||company.legal_name||company.slug||company.id}</option>)}</select></label>
          <label>Agendar promoção (opcional)<input type="datetime-local" value={scheduleAt} onChange={e=>setScheduleAt(e.target.value)}/></label>
        </div>
        <div className="release-flow-note"><Clock3 size={15}/><span>Se houver horário futuro, a versão fica agendada. O cron de rollout executa somente quando o gate continuar saudável.</span></div>
      </section>
    </div>

    <section className="release-subpanel">
      <header><div><Rocket size={17}/><span><b>Releases</b><small>Promoção sequencial com health check, snapshot prévio, compatibilidade de schema e parada automática em regressão.</small></span></div></header>
      <div className="manager-table-wrap"><table className="manager-table release-table"><thead><tr><th>Versão</th><th>Canal</th><th>Status</th><th>Deployment</th><th>Aprovação</th><th>Ações</th></tr></thead><tbody>
        {(data?.releases||[]).map(release=>{const sourceTarget=(data?.targets||[]).find(target=>target.release_id===release.id&&target.environment_code===release.channel&&target.status==="active"&&target.health_status==="ok");return <tr key={release.id}>
          <td><b>{release.version}</b><small className="manager-cell-detail">{release.title}</small></td>
          <td>{channelLabel[release.channel]}</td>
          <td><span className={"manager-health "+statusTone(sourceTarget?"active":release.status)}>{sourceTarget?"VALIDADA":release.status.toUpperCase()}</span></td>
          <td><code>{release.deployment_id}</code><small className="manager-cell-detail">{release.commit_sha?.slice(0,10)||"sem SHA"}</small></td>
          <td>{release.approved_by?<><b>{release.approved_by}</b><small className="manager-cell-detail">Aprovada</small></>:<span>Pendente</span>}</td>
          <td><div className="manager-row-actions">
            {release.channel==="internal"&&!sourceTarget&&<button onClick={()=>void act("publish-internal",{releaseId:release.id},"Release publicada no ProAR Interno.")}>Publicar/Repetir Interno</button>}
            {release.channel==="internal"&&sourceTarget&&<button onClick={()=>void promote(release,"homologation")}>→ Homologação</button>}
            {release.channel==="homologation"&&!release.approved_by&&sourceTarget&&<button onClick={()=>void act("approve",{releaseId:release.id},"Release aprovada para rollout em clientes.")}>Aprovar</button>}
            {release.channel==="homologation"&&release.approved_by&&sourceTarget&&<button onClick={()=>void promote(release,"canary")}>→ Canary</button>}
            {release.channel==="canary"&&sourceTarget&&<button className="success" onClick={()=>void promote(release,"production")}>→ Produção</button>}
          </div></td>
        </tr>})}
        {!(data?.releases||[]).length&&<tr><td colSpan={6}>Nenhuma release registrada.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="release-subpanel">
      <header><div><RotateCcw size={17}/><span><b>Targets, pinagem e rollback</b><small>Cada alias mantém deployment anterior e snapshot pré-release para recuperação.</small></span></div></header>
      <div className="manager-table-wrap"><table className="manager-table release-table"><thead><tr><th>Versão</th><th>Ambiente/tenant</th><th>Alias</th><th>Status</th><th>Snapshot</th><th>Ações</th></tr></thead><tbody>
        {(data?.targets||[]).slice(0,80).map(target=><tr key={target.id}>
          <td>{target.target_version}</td><td>{channelLabel[target.environment_code]}<small className="manager-cell-detail">{target.company_id?companyMap[target.company_id]?.trade_name||target.company_id:"Plataforma"}</small></td>
          <td><code>{target.alias}</code></td><td><span className={"manager-health "+statusTone(target.health_status||target.status)}>{target.status.toUpperCase()}</span>{target.error_code&&<small className="manager-cell-detail">{target.error_code}</small>}</td>
          <td>{target.snapshot_id||"—"}</td>
          <td><div className="manager-row-actions">{target.previous_deployment_id&&target.status!=="rolled_back"&&<button className="danger" onClick={()=>{if(window.confirm("Executar rollback do código e restaurar o snapshot pré-release deste target?"))void act("rollback-target",{targetId:target.id,restoreData:true},"Rollback concluído.")}}><RotateCcw size={13}/> Rollback</button>}</div></td>
        </tr>)}
        {!(data?.targets||[]).length&&<tr><td colSpan={6}>Nenhum rollout executado.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="release-subpanel">
      <header><div><ShieldCheck size={17}/><span><b>Política por tenant</b><small>Canal, atualização automática/manual, pinagem de versão, schema e manutenção sem derrubar outros clientes.</small></span></div></header>
      <div className="release-tenant-grid">
        {(data?.companies||[]).map(company=>{const draft=tenantDraft[company.id];const current=(data?.settings||[]).find(row=>row.company_id===company.id);if(!draft)return null;return <article key={company.id}>
          <header><div><b>{company.trade_name||company.legal_name||company.id}</b><small>{company.slug?company.slug+".proar.online":company.id}</small></div><span className={"manager-health "+statusTone(current?.last_health_status||"warning")}>{current?.current_version||"SEM VERSÃO"}</span></header>
          <div className="release-tenant-form">
            <label>Canal<select value={draft.channel} onChange={e=>setTenantDraft(v=>({...v,[company.id]:{...draft,channel:e.target.value as Channel}}))}><option value="production">Produção</option><option value="canary">Canary</option><option value="homologation">Homologação</option><option value="internal">Interno</option></select></label>
            <label>Política<select value={draft.policy} onChange={e=>setTenantDraft(v=>({...v,[company.id]:{...draft,policy:e.target.value as typeof draft.policy}}))}><option value="automatic">Automática</option><option value="manual">Manual</option><option value="pinned">Fixada</option><option value="scheduled">Agendada</option></select></label>
            <label>Versão fixada<input value={draft.pinnedVersion} onChange={e=>setTenantDraft(v=>({...v,[company.id]:{...draft,pinnedVersion:e.target.value}}))} disabled={draft.policy!=="pinned"}/></label>
            <label>Schema<input value={draft.schemaVersion} onChange={e=>setTenantDraft(v=>({...v,[company.id]:{...draft,schemaVersion:e.target.value}}))}/></label>
            <label className="release-maintenance-toggle"><input type="checkbox" checked={draft.maintenance} onChange={e=>setTenantDraft(v=>({...v,[company.id]:{...draft,maintenance:e.target.checked}}))}/><span>Modo manutenção</span></label>
            <label className="wide">Mensagem<input value={draft.maintenanceMessage} onChange={e=>setTenantDraft(v=>({...v,[company.id]:{...draft,maintenanceMessage:e.target.value}}))}/></label>
          </div>
          <button onClick={()=>void saveTenant(company.id)} disabled={Boolean(busy)}><Save size={13}/> Salvar política</button>
        </article>})}
      </div>
    </section>

    <section className="release-subpanel">
      <header><div><Flag size={17}/><span><b>Feature Flags</b><small>Recursos podem existir no código sem aparecer em Produção. Interno → Homologação → Canary % → Produção.</small></span></div></header>
      <div className="release-form-grid">
        <label>Chave<input value={flagDraft.flagKey} onChange={e=>setFlagDraft(v=>({...v,flagKey:e.target.value}))} placeholder="orcamento.novo-editor"/></label>
        <label>Nome<input value={flagDraft.name} onChange={e=>setFlagDraft(v=>({...v,name:e.target.value}))}/></label>
        <label>Módulo relacionado<input value={flagDraft.moduleName} onChange={e=>setFlagDraft(v=>({...v,moduleName:e.target.value}))} placeholder="Orçamentos"/></label>
        <label>Canary %<input type="number" min="0" max="100" value={flagDraft.canaryPercent} onChange={e=>setFlagDraft(v=>({...v,canaryPercent:e.target.value}))}/></label>
        <label className="wide">Descrição<input value={flagDraft.description} onChange={e=>setFlagDraft(v=>({...v,description:e.target.value}))}/></label>
      </div>
      <button className="release-primary-button" onClick={()=>void createFlag()} disabled={Boolean(busy)}><Flag size={14}/> Criar feature flag</button>
      <div className="release-flag-override">
        <div><b>Exceção por empresa</b><small>Libere ou bloqueie uma funcionalidade para um tenant específico sem alterar o canal inteiro.</small></div>
        <label>Feature<select value={overrideDraft.flagKey} onChange={e=>setOverrideDraft(v=>({...v,flagKey:e.target.value}))}><option value="">Selecione...</option>{(data?.flags||[]).map(flag=><option key={flag.flag_key} value={flag.flag_key}>{flag.name}</option>)}</select></label>
        <label>Empresa<select value={overrideDraft.companyId} onChange={e=>setOverrideDraft(v=>({...v,companyId:e.target.value}))}><option value="">Selecione...</option>{eligibleCanary.map(company=><option key={company.id} value={company.id}>{company.trade_name||company.legal_name||company.slug||company.id}</option>)}</select></label>
        <label>Estado<select value={overrideDraft.enabled?"on":"off"} onChange={e=>setOverrideDraft(v=>({...v,enabled:e.target.value==="on"}))}><option value="on">Liberada</option><option value="off">Bloqueada</option></select></label>
        <label className="wide">Motivo<input value={overrideDraft.reason} onChange={e=>setOverrideDraft(v=>({...v,reason:e.target.value}))}/></label>
        <button onClick={()=>void saveFlagOverride()} disabled={Boolean(busy)}><Save size={13}/> Salvar exceção</button>
      </div>
      {(data?.overrides||[]).length>0&&<div className="release-overrides-list">{data!.overrides.slice(0,12).map(row=><article key={row.flag_key+":"+row.company_id}><b>{(data?.flags||[]).find(flag=>flag.flag_key===row.flag_key)?.name||row.flag_key}</b><span>{companyMap[row.company_id]?.trade_name||row.company_id} • {row.enabled?"LIBERADA":"BLOQUEADA"}</span><small>{row.reason||"Sem motivo informado."}</small></article>)}</div>}
      <div className="release-flag-grid">{(data?.flags||[]).map(flag=><article key={flag.flag_key}><header><div><b>{flag.name}</b><code>{flag.flag_key}</code></div><span className={"manager-health "+statusTone(flag.status==="active"?"ok":"warning")}>{flag.status.toUpperCase()}</span></header><p>{flag.description||"Sem descrição."}</p><small>{flag.module_name?("Módulo: "+flag.module_name+" • "):""}Interno {flag.internal_enabled?"ON":"OFF"} • Homologação {flag.homologation_enabled?"ON":"OFF"} • Canary {flag.canary_percent}% • Produção {flag.production_enabled?"ON":"OFF"}</small><div className="manager-row-actions"><button onClick={()=>void act("feature-flag",{...flag,flagKey:flag.flag_key,homologationEnabled:!flag.homologation_enabled,internalEnabled:flag.internal_enabled,canaryPercent:flag.canary_percent,productionEnabled:flag.production_enabled},"Feature flag atualizada.")}>Homologação {flag.homologation_enabled?"OFF":"ON"}</button><button onClick={()=>void act("feature-flag",{...flag,flagKey:flag.flag_key,homologationEnabled:flag.homologation_enabled,internalEnabled:flag.internal_enabled,canaryPercent:flag.canary_percent,productionEnabled:!flag.production_enabled},"Feature flag atualizada.")}>Produção {flag.production_enabled?"OFF":"ON"}</button></div></article>)}</div>
    </section>

    <section className="release-subpanel">
      <header><div><CheckCircle2 size={17}/><span><b>Quality Gate e observabilidade</b><small>Últimos checks de snapshot, health pós-deploy e regressão por tenant.</small></span></div></header>
      <div className="release-check-list">{latestChecks.map(check=><article key={check.id} className={statusTone(check.status)}><span>{check.status==="ok"?<CheckCircle2 size={15}/>:<AlertTriangle size={15}/>}</span><div><b>{check.check_key}</b><small>{check.environment_code} • {check.company_id?companyMap[check.company_id]?.trade_name||check.company_id:"plataforma"} • {formatDate(check.checked_at)}</small><p>{check.code?check.code+" • ":""}{check.detail||"Check concluído."}{check.latency_ms?(" • "+check.latency_ms+" ms"):""}</p></div></article>)}</div>
    </section>
  </section>;
}
