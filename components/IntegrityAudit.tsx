"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Database, RefreshCw, ShieldCheck, ServerCog } from "lucide-react";
import type { IntegrityResult } from "@/lib/integrity-audit";
import { integrityDashboard } from "@/lib/integrity-dashboard";

export function IntegrityAudit() {
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<{checkedAt:string;overall?:"ok"|"warning"|"error";services:{id:string;label:string;state:"ok"|"warning"|"error";message:string;code?:string;latencyMs?:number;attempts?:number}[];totals:{ok:number;warning:number;error:number}} | null>(null);
  const [dbHealth,setDbHealth]=useState<{database:"ok"|"degraded"|"error";provider?:string;latencyMs?:number;connections?:number|null;activeConnections?:number|null;waitingConnections?:number|null;databaseSizeBytes?:number|null;neonQuota?:string;quota?:{plan?:string|null;quotaMode?:string|null;usagePercent?:number|null;status?:string;note?:string};observedErrors24h?:{http5xx:number;http401:number;http403:number;http429:number};lastSuccessfulSync?:string|null;lastConfirmedBackup?:string|null;code?:string;reason?:string;message?:string;checkedAt:string} | null>(null);
  const [integrationHealth,setIntegrationHealth]=useState<{integrations:"ok"|"degraded"|"error";pncp:"ok"|"degraded"|"error";cnpj:"ok"|"degraded"|"error";services:{id:string;label:string;state:"ok"|"degraded"|"error";status:number|null;latencyMs:number;message:string;code?:string}[];checkedAt:string}|null>(null);
  const [testLab, setTestLab] = useState<{checkedAt:string;scenarios:{id:string;name:string;status:"pass"|"warning"|"fail";detail:string}[];totals:{pass:number;warning:number;fail:number};readOnly:boolean} | null>(null);
  const run = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/integrity", { cache: "no-store", headers: { Accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "O diagnóstico não pôde ser concluído.");
      setResult(payload as IntegrityResult);
      const healthResponse = await fetch("/api/system-health", { cache:"no-store", headers:{ Accept:"application/json" } });
      if (healthResponse.ok) setHealth(await healthResponse.json());
      const [dbHealthResponse,integrationHealthResponse,testLabResponse] = await Promise.all([
        fetch("/api/health/database",{cache:"no-store",headers:{Accept:"application/json"}}),
        fetch("/api/health/integrations",{cache:"no-store",headers:{Accept:"application/json"}}),
        fetch("/api/test-lab", { cache:"no-store", headers:{ Accept:"application/json" } }),
      ]);
      setDbHealth(await dbHealthResponse.json());
      if(integrationHealthResponse.ok)setIntegrationHealth(await integrationHealthResponse.json());
      if (testLabResponse.ok) setTestLab(await testLabResponse.json());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao consultar a base."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/integrity", { cache: "no-store", headers: { Accept: "application/json" } }).then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "O diagnóstico não pôde ser concluído.");
        if (active) setResult(payload as IntegrityResult);
      }),
      fetch("/api/system-health", { cache:"no-store", headers:{ Accept:"application/json" } }).then(async response => {
        if (!response.ok) return;
        const payload = await response.json();
        if (active) setHealth(payload);
      }),
      fetch("/api/health/database",{cache:"no-store",headers:{Accept:"application/json"}}).then(async response=>{const payload=await response.json();if(active)setDbHealth(payload);}),
      fetch("/api/health/integrations",{cache:"no-store",headers:{Accept:"application/json"}}).then(async response=>{if(!response.ok)return;const payload=await response.json();if(active)setIntegrationHealth(payload);}),
      fetch("/api/test-lab", { cache:"no-store", headers:{ Accept:"application/json" } }).then(async response => {
        if (!response.ok) return;
        const payload = await response.json();
        if (active) setTestLab(payload);
      }),
    ]).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Falha ao consultar a base."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const dashboard=result?integrityDashboard(result):null;
  const formatTime = (value: string | null | undefined) => value ? new Date(value).toLocaleString("pt-BR") : "Sem informação";
  return <section className="integrity-page">
    <div className="integrity-hero"><div><span className="integrity-kicker"><ShieldCheck size={14}/> CONTROLES DA EMPRESA</span><h2>Integridade do Sistema</h2><p>Diagnóstico somente leitura para localizar divergências operacionais na base carregada.</p><small><Database size={13}/> Base examinada: {result?.source || "aguardando consulta"} {result ? `• revisão ${result.revision}` : ""}</small></div><button className="primary-btn" onClick={() => void run()} disabled={loading}><RefreshCw size={15} className={loading ? "integrity-spin" : ""}/>{loading ? "Analisando base…" : "Executar diagnóstico"}</button></div>
    {error && <div className="integrity-error" role="alert"><AlertTriangle size={17}/><span>{error}</span></div>}
    {loading && !result && <div className="integrity-empty" role="status">Consultando os dados persistidos no banco…</div>}
    {result && <>
      <div className="integrity-meta"><span>Executado em <b>{formatTime(result.checkedAt)}</b></span><span>Snapshot atualizado em <b>{formatTime(result.updatedAt)}</b></span><span>Os registros não foram alterados.</span></div>
      <div className="integrity-kpis">{dashboard&&<article className={dashboard.status==="critical"?"critical":dashboard.status==="attention"?"attention":"clear"}><span><ShieldCheck size={17}/> ÍNDICE DE INTEGRIDADE</span><strong>{dashboard.score}/100</strong><small>{dashboard.clean} de {dashboard.checks} verificações sem divergência</small></article>}
        <article className={result.totals.critical ? "critical" : "clear"}><span>{result.totals.critical ? <CircleAlert size={17}/> : <CheckCircle2 size={17}/>} CRÍTICO</span><strong>{result.totals.critical}</strong><small>{result.totals.critical ? "Divergências que exigem conferência" : "Nenhuma divergência crítica localizada"}</small></article>
        <article className={result.totals.attention ? "attention" : "clear"}><span>{result.totals.attention ? <AlertTriangle size={17}/> : <CheckCircle2 size={17}/>} ATENÇÃO</span><strong>{result.totals.attention}</strong><small>{result.totals.attention ? "Registros a revisar" : "Nenhum ponto de atenção localizado"}</small></article>
        <article className="clear"><span><CheckCircle2 size={17}/> VERIFICAÇÕES OK</span><strong>{result.totals.ok}</strong><small>Sem divergências encontradas nessas regras</small></article>
      </div>
      <section className="integrity-panel"><header><div><h3>Regras verificadas</h3><p>Contagens calculadas sobre o snapshot operacional mais recente.</p></div><span>{result.checks.length} verificações</span></header><div className="integrity-checks">{result.checks.map(check => <article key={check.name} className={`integrity-check ${check.status.toLowerCase()}`}><div><span className="integrity-state">{check.status === "OK" ? <CheckCircle2 size={14}/> : check.status === "Crítico" ? <CircleAlert size={14}/> : <AlertTriangle size={14}/>} {check.status}</span><b>{check.name}</b><small>{check.summary}</small></div><strong>{check.count}</strong></article>)}</div></section>
      <section className="integrity-panel"><header><div><h3>Ocorrências encontradas</h3><p>Use os identificadores para conferir cada registro nos módulos correspondentes. O diagnóstico não corrige nem exclui dados.</p></div><span>{result.findings.length} registros</span></header>{result.findings.length ? <div className="integrity-findings">{result.findings.map((finding,index) => <article className={`integrity-finding ${finding.severity === "Crítico" ? "critical" : "attention"}`} key={`${finding.check}-${finding.recordId}-${index}`}><span className="integrity-state">{finding.severity === "Crítico" ? <CircleAlert size={14}/> : <AlertTriangle size={14}/>} {finding.severity}</span><div><b>{finding.title}</b><small>{finding.check} • ID {finding.recordId}</small><p>{finding.detail}</p></div></article>)}</div> : <div className="integrity-empty"><CheckCircle2 size={18}/> Nenhuma divergência foi encontrada nas regras avaliadas.</div>}</section>
      {health && <section className="integrity-panel"><header><div><h3>Central de Saúde do Sistema</h3><p>Banco, aplicação, fiscal, pagamentos e serviços essenciais verificados sem expor credenciais.</p></div><span>{health.totals.ok} OK • {health.totals.warning} atenção • {health.totals.error} erro</span></header><div className="integrity-checks">{health.services.map(service=><article key={service.id} className={`integrity-check ${service.state === "ok" ? "ok" : service.state === "error" ? "crítico" : "atenção"}`}><div><span className="integrity-state">{service.state==="ok"?<CheckCircle2 size={14}/>:service.state==="error"?<CircleAlert size={14}/>:<AlertTriangle size={14}/>} {service.state==="ok"?"OK":service.state==="error"?"Erro":"Atenção"}</span><b><ServerCog size={13}/> {service.label}</b><small>{service.message}{typeof service.latencyMs === "number" ? ` • ${service.latencyMs} ms` : ""}{service.attempts && service.attempts > 1 ? ` • ${service.attempts} tentativas` : ""}{service.code ? ` • ${service.code}` : ""}</small></div></article>)}</div></section>}
      {dbHealth && <section className="integrity-panel"><header><div><h3>Saúde operacional do banco</h3><p>Diagnóstico separado de disponibilidade, latência, conexões, quota, sincronismo e backup.</p></div><span>{dbHealth.database==="ok"?"Banco OK":dbHealth.database==="degraded"?"Banco degradado":"Banco com erro"}</span></header><div className="integrity-checks">
        <article className={`integrity-check ${dbHealth.database==="ok"?"ok":dbHealth.database==="error"?"crítico":"atenção"}`}><div><span className="integrity-state">{dbHealth.database==="ok"?<CheckCircle2 size={14}/>:<CircleAlert size={14}/>} {dbHealth.database}</span><b>Banco / resposta</b><small>{dbHealth.provider||"—"} • {typeof dbHealth.latencyMs==="number"?dbHealth.latencyMs+" ms":"sem latência"}{dbHealth.code?" • "+dbHealth.code:""}{dbHealth.reason?" • "+dbHealth.reason:""}</small></div></article>
        <article className="integrity-check ok"><div><span className="integrity-state"><Database size={14}/> Conexões</span><b>{dbHealth.connections??"—"} total</b><small>{dbHealth.activeConnections??"—"} ativas • {dbHealth.waitingConnections??"—"} aguardando</small></div></article>
        <article className={`integrity-check ${dbHealth.neonQuota==="available"?"ok":"atenção"}`}><div><span className="integrity-state"><ServerCog size={14}/> Quota Neon</span><b>{dbHealth.quota?.plan||"não informado"}</b><small>{dbHealth.quota?.quotaMode||dbHealth.neonQuota||"—"}{typeof dbHealth.quota?.usagePercent==="number"?" • "+dbHealth.quota.usagePercent+"% utilizado":""}</small></div></article>
        <article className={`integrity-check ${dbHealth.lastSuccessfulSync?"ok":"atenção"}`}><div><span className="integrity-state"><RefreshCw size={14}/> Sincronismo</span><b>{formatTime(dbHealth.lastSuccessfulSync)}</b><small>Último sincronismo operacional confirmado.</small></div></article>
        <article className={`integrity-check ${dbHealth.lastConfirmedBackup?"ok":"atenção"}`}><div><span className="integrity-state"><ShieldCheck size={14}/> Backup</span><b>{formatTime(dbHealth.lastConfirmedBackup)}</b><small>Último snapshot confirmado pela aplicação.</small></div></article>
        <article className={`integrity-check ${(dbHealth.observedErrors24h?.http5xx||dbHealth.observedErrors24h?.http401||dbHealth.observedErrors24h?.http403||dbHealth.observedErrors24h?.http429)?"atenção":"ok"}`}><div><span className="integrity-state"><AlertTriangle size={14}/> Erros observados • 24h</span><b>5xx {dbHealth.observedErrors24h?.http5xx??0}</b><small>401 {dbHealth.observedErrors24h?.http401??0} • 403 {dbHealth.observedErrors24h?.http403??0} • 429 {dbHealth.observedErrors24h?.http429??0}</small></div></article>
      </div></section>}
      {integrationHealth && <section className="integrity-panel"><header><div><h3>Saúde das integrações externas</h3><p>PNCP e consulta CNPJ são avaliados separadamente do banco.</p></div><span>{integrationHealth.integrations}</span></header><div className="integrity-checks">{integrationHealth.services.map(service=><article key={service.id} className={`integrity-check ${service.state==="ok"?"ok":service.state==="error"?"crítico":"atenção"}`}><div><span className="integrity-state">{service.state==="ok"?<CheckCircle2 size={14}/>:service.state==="error"?<CircleAlert size={14}/>:<AlertTriangle size={14}/>} {service.state}</span><b>{service.label}</b><small>{service.message} • {service.latencyMs} ms{service.status?" • HTTP "+service.status:""}{service.code?" • "+service.code:""}</small></div></article>)}</div></section>}
      {testLab && <section className="integrity-panel"><header><div><h3>ProAR Test Lab</h3><p>Validação ponta a ponta somente leitura dos principais vínculos operacionais.</p></div><span>{testLab.totals.pass} OK • {testLab.totals.warning} atenção • {testLab.totals.fail} falha</span></header><div className="integrity-checks">{testLab.scenarios.map(item=><article key={item.id} className={`integrity-check ${item.status==="pass"?"ok":item.status==="fail"?"crítico":"atenção"}`}><div><span className="integrity-state">{item.status==="pass"?<CheckCircle2 size={14}/>:item.status==="fail"?<CircleAlert size={14}/>:<AlertTriangle size={14}/>} {item.status==="pass"?"OK":item.status==="fail"?"Falha":"Atenção"}</span><b>{item.name}</b><small>{item.detail}</small></div></article>)}</div></section>}
      <p className="integrity-scope">Escopo atual: dados consolidados no snapshot operacional do ProAR. Registros independentes antigos que não estejam refletidos nesse snapshot não são inferidos por este diagnóstico.</p>
    </>}
  </section>;
}
