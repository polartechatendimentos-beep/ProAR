"use client";

import React, { useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Navigation, Route, Search, ShieldCheck } from "lucide-react";

export type EmployeeRouteHistoryItem = {
  id: string;
  date: string;
  startedAt: string;
  endedAt?: string;
  distanceKm?: number;
  osCount: number;
  status: "active" | "completed";
  stops: Array<{ id:string; osNumber?:string; customer?:string; address?:string; arrivedAt?:string; departedAt?:string; lat?:number; lng?:number }>;
};

export function EmployeeRoutesTab({ employeeId, employeeName, routes = [] }: { employeeId:string; employeeName:string; routes?:EmployeeRouteHistoryItem[] }) {
  const [query,setQuery]=useState("");
  const filtered=useMemo(()=>routes.filter(r=>(r.date+" "+r.stops.map(s=>s.customer+" "+s.osNumber+" "+s.address).join(" ")).toLowerCase().includes(query.toLowerCase())),[routes,query]);
  return <section className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div><div className="flex items-center gap-2"><Route className="w-5 h-5 text-blue-600"/><h2 className="font-bold text-slate-900">Rotas & Localização</h2></div><p className="text-xs text-slate-500 mt-1">Histórico operacional de {employeeName}. Rastreamento limitado às rotas/jornadas de trabalho iniciadas no ProAR Mobile.</p></div>
        <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl"><ShieldCheck className="w-4 h-4"/>Registro operacional auditável</div>
      </div>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="Rotas registradas" value={String(routes.length)}/>
      <Metric label="O.S. visitadas" value={String(routes.reduce((a,r)=>a+r.osCount,0))}/>
      <Metric label="Distância registrada" value={routes.reduce((a,r)=>a+(r.distanceKm||0),0).toFixed(1)+" km"}/>
      <Metric label="Em rota agora" value={String(routes.filter(r=>r.status==="active").length)}/>
    </div>
    <div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por data, O.S., cliente ou endereço..." className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-xs outline-none focus:border-blue-500"/></div>
    {filtered.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center"><Navigation className="w-8 h-8 mx-auto text-slate-300"/><p className="font-bold text-sm text-slate-700 mt-2">Nenhuma rota registrada</p><p className="text-xs text-slate-400 mt-1">As rotas aparecerão aqui depois que o colaborador iniciar o rastreamento de trabalho pelo ProAR Mobile.</p></div>:filtered.map(r=><article key={r.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden"><div className="p-4 flex flex-wrap justify-between gap-3 bg-slate-50 border-b border-slate-100"><div className="flex items-center gap-3"><CalendarDays className="w-4 h-4 text-blue-600"/><div><b className="text-sm text-slate-900">{new Date(r.date+"T12:00:00").toLocaleDateString("pt-BR")}</b><p className="text-[11px] text-slate-500">{r.startedAt} → {r.endedAt||"em andamento"}</p></div></div><div className="flex gap-2 text-[10px]"><span className="px-2 py-1 rounded bg-blue-50 text-blue-700">{r.osCount} O.S.</span><span className="px-2 py-1 rounded bg-slate-100 text-slate-700">{(r.distanceKm||0).toFixed(1)} km</span></div></div><div className="p-4 space-y-3">{r.stops.map((s,i)=><div key={s.id} className="flex gap-3"><div className="flex flex-col items-center"><span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{i+1}</span>{i<r.stops.length-1&&<span className="w-px h-full bg-slate-200"/>}</div><div className="pb-3"><div className="text-xs font-bold text-slate-800">{s.osNumber?"OS #"+s.osNumber+" • ":""}{s.customer||"Parada registrada"}</div><div className="text-[11px] text-slate-500 flex items-start gap-1 mt-1"><MapPin className="w-3 h-3 mt-0.5"/>{s.address||"Coordenadas registradas"}</div><div className="text-[10px] text-slate-400 mt-1 flex gap-3"><span>Chegada: {s.arrivedAt||"—"}</span><span>Saída: {s.departedAt||"—"}</span></div></div></div>)}</div></article>)}
    <p className="text-[10px] text-slate-400">ID do colaborador: {employeeId}. A localização deve ser coletada somente durante o rastreamento de trabalho ativo e conforme as permissões definidas pela empresa.</p>
  </section>
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-[10px] text-slate-500">{label}</span><div className="font-bold text-slate-900 mt-1">{value}</div></div>}
