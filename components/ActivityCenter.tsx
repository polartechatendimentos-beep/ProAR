"use client";

import { useMemo, useState } from "react";
import { Activity, Clock3, Filter, Search, UserRound } from "lucide-react";

type AuditRecord = Record<string, any>;

export function ActivityCenter({ records }: { records: AuditRecord[] }) {
  const [query,setQuery]=useState("");
  const [moduleFilter,setModuleFilter]=useState("Todos");
  const [userFilter,setUserFilter]=useState("Todos");
  const modules=useMemo(()=>Array.from(new Set(records.map(item=>String(item.auditModule||item.category||"Sistema")).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR")),[records]);
  const users=useMemo(()=>Array.from(new Set(records.map(item=>String(item.auditUser||item.client||"Sistema")).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"pt-BR")),[records]);
  const filtered=useMemo(()=>records.filter(item=>{
    const moduleName=String(item.auditModule||item.category||"Sistema");
    const user=String(item.auditUser||item.client||"Sistema");
    const text=`${item.name||""} ${item.description||""} ${item.recordId||""} ${moduleName} ${user}`.toLocaleLowerCase("pt-BR");
    return (!query||text.includes(query.toLocaleLowerCase("pt-BR"))) && (moduleFilter==="Todos"||moduleName===moduleFilter) && (userFilter==="Todos"||user===userFilter);
  }),[records,query,moduleFilter,userFilter]);
  const today=new Date().toLocaleDateString("pt-BR");
  const todayCount=records.filter(item=>String(item.createdAt||"").includes(today)).length;

  return <section className="activity-center">
    <div className="activity-hero"><div><span><Activity size={14}/> RASTREABILIDADE</span><h2>Central de atividades</h2><p>Acompanhe alterações, cadastros, cancelamentos e ações relevantes realizadas no ProAR.</p></div><div className="activity-today"><Clock3 size={18}/><span><small>HOJE</small><strong>{todayCount}</strong></span></div></div>
    <div className="activity-toolbar">
      <label className="list-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar ação, registro, usuário ou módulo..."/></label>
      <label><Filter size={14}/><select value={moduleFilter} onChange={event=>setModuleFilter(event.target.value)}><option>Todos</option>{modules.map(item=><option key={item}>{item}</option>)}</select></label>
      <label><UserRound size={14}/><select value={userFilter} onChange={event=>setUserFilter(event.target.value)}><option>Todos</option>{users.map(item=><option key={item}>{item}</option>)}</select></label>
    </div>
    <div className="activity-stats">
      <article><small>EVENTOS REGISTRADOS</small><strong>{records.length}</strong></article>
      <article><small>RESULTADOS DO FILTRO</small><strong>{filtered.length}</strong></article>
      <article><small>USUÁRIOS IDENTIFICADOS</small><strong>{users.length}</strong></article>
      <article><small>MÓDULOS COM ATIVIDADE</small><strong>{modules.length}</strong></article>
    </div>
    <div className="activity-list">
      {filtered.length?filtered.map((item,index)=>{
        const changes=Array.isArray(item.auditChanges)?item.auditChanges:[];
        return <article key={item.id||index}>
          <span className="activity-dot"><Activity size={14}/></span>
          <div className="activity-main">
            <header><div><b>{item.name||item.auditAction||"Atividade registrada"}</b><small>{item.auditModule||item.category||"Sistema"}{item.recordId?` • ${item.recordId}`:""}</small></div><time>{item.createdAt||"—"}</time></header>
            <p>{item.auditDetail||item.description||"Sem detalhes adicionais."}</p>
            {changes.length>0&&<div className="activity-changes">{changes.slice(0,8).map((change:any,changeIndex:number)=><span key={changeIndex}><b>{change.field}</b><em>{change.before}</em><i>→</i><strong>{change.after}</strong></span>)}</div>}
            <footer><UserRound size={12}/>{item.auditUser||item.client||"Sistema"}</footer>
          </div>
        </article>;
      }):<div className="activity-empty"><Activity size={25}/><b>Nenhuma atividade encontrada.</b><span>Ajuste os filtros ou aguarde novas operações no sistema.</span></div>}
    </div>
  </section>;
}
