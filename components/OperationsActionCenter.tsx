"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, Filter, Search, ShieldAlert, TimerReset } from "lucide-react";
import { deriveOperationalActions, summarizeOperationalActions, type OperationalAction } from "@/lib/action-center";
import { resolutionPlan } from "@/lib/action-resolution";
import { buildCommandCenter } from "@/lib/command-center";
import "./operations-action-center.css";

type Props = {
  serviceOrders: Record<string, unknown>[];
  modules: Record<string, Record<string, unknown>[]>;
  onNavigate: (module: string) => void;
};

const categories = ["Todas", "OS", "Financeiro", "Estoque", "PMOC", "Fiscal", "Compras", "Comercial", "Aprovação", "Operação"] as const;
const priorityLabel: Record<number,string> = {1:"Crítica",2:"Atenção",3:"Follow-up"};

export function OperationsActionCenter({ serviceOrders, modules, onNavigate }: Props) {
  const [category,setCategory]=useState<(typeof categories)[number]>("Todas");
  const [priority,setPriority]=useState("Todas");
  const [query,setQuery]=useState("");
  const actions=useMemo(()=>deriveOperationalActions(serviceOrders,modules),[serviceOrders,modules]);
  const summary=useMemo(()=>summarizeOperationalActions(actions),[actions]);
  const command=useMemo(()=>buildCommandCenter(serviceOrders,modules),[serviceOrders,modules]);
  const visible=actions.filter(item =>
    (category==="Todas" || item.category===category) &&
    (priority==="Todas" || String(item.priority)===priority) &&
    `${item.title} ${item.detail} ${item.module} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  const resolve = (item: OperationalAction) => {
    const plan=resolutionPlan(item);
    onNavigate(plan.module);
    window.dispatchEvent(new CustomEvent("proar:focus-record",{detail:{module:plan.module,recordId:plan.recordId,actionId:plan.actionId,resolutionMode:plan.mode,resolutionMessage:plan.message}}));
  };

  return <section className="operations-center module-page">
    <div className="management-hero">
      <div><span className="section-kicker"><Bell size={12}/> CENTRAL OPERACIONAL</span><h2>Pendências e próximas ações</h2><p>Prioridades consolidadas de OS, financeiro, estoque, PMOC, fiscal, compras e comercial.</p></div>
      <div className="operations-health"><CheckCircle2 size={18}/><span><b>{summary.total}</b> ação(ões) identificada(s)</span></div>
    </div>
    <div className="operations-summary">
      <article className="critical"><ShieldAlert size={19}/><div><small>CRÍTICAS</small><strong>{summary.critical}</strong><span>Exigem ação imediata</span></div></article>
      <article className="attention"><AlertTriangle size={19}/><div><small>ATENÇÃO</small><strong>{summary.attention}</strong><span>Prazo próximo ou risco operacional</span></div></article>
      <article className="follow"><TimerReset size={19}/><div><small>FOLLOW-UP</small><strong>{summary.followUp}</strong><span>Acompanhamento comercial/operacional</span></div></article>
      <article><Bell size={19}/><div><small>TOTAL</small><strong>{summary.total}</strong><span>Fila única de trabalho</span></div></article>
    </div>
    <div className="management-toolbar operations-filters">
      <label className="list-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente, OS, título, produto..." /></label>
      <label className="status-filter"><Filter size={14}/><select value={category} onChange={e=>setCategory(e.target.value as (typeof categories)[number])}>{categories.map(item=><option key={item}>{item}</option>)}</select></label>
      <label className="status-filter"><select value={priority} onChange={e=>setPriority(e.target.value)}><option>Todas</option><option value="1">Crítica</option><option value="2">Atenção</option><option value="3">Follow-up</option></select></label>
    </div>
    <div className="panel" style={{marginBottom:16}}><div className="panel-head"><div><span className="section-kicker">FECHAMENTO E INTEGRIDADE</span><h2>{command.dayClose.canClose?"Dia pronto para fechamento":"Fechamento com pendências"}</h2><p>{command.dayClose.canClose?"Todas as verificações automáticas estão consistentes.":`${command.dayClose.pending} verificação(ões) precisam de atenção antes do fechamento.`}</p></div><button className="outline-btn compact" onClick={()=>onNavigate("Financeiro")}>{command.dayClose.canClose?"Revisar fechamento":"Resolver pendências"}</button></div>{!command.dayClose.canClose&&<div className="workday-list">{command.dayClose.checks.filter(x=>!x.ok).map(x=><button key={x.key} onClick={()=>onNavigate(x.module)}><i/><span><b>{x.label}</b><small>{x.count} ocorrência(s){x.amount?` • R$ ${Math.abs(x.amount).toLocaleString("pt-BR",{minimumFractionDigits:2})}`:""}</small></span><ChevronRight size={15}/></button>)}</div>}</div>
    <div className="operations-list">
      {visible.map(item=><article key={item.id} className={`operation-action priority-${item.priority}`}>
        <span className="operation-marker"/>
        <div className="operation-main"><div className="operation-meta"><b>{item.category}</b><span>{priorityLabel[item.priority]}</span>{item.dueDate&&<time>{item.dueDate}</time>}</div><h3>{item.title}</h3><p>{item.detail}</p><small>{item.module}</small></div>
        <button className="primary-btn" onClick={()=>resolve(item)}>Resolver agora <ChevronRight size={14}/></button>
      </article>)}
      {!visible.length&&<div className="linked-empty"><CheckCircle2 size={25}/><h4>Nenhuma ação neste filtro</h4><p>As novas pendências aparecerão automaticamente conforme os dados operacionais.</p></div>}
    </div>
  </section>;
}
