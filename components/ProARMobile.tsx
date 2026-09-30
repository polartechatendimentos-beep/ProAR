"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, ClipboardList, Gauge, MapPin, Navigation, PlusCircle, QrCode, RefreshCw, Search, Signature, UserCheck, Wifi, WifiOff, Wrench } from "lucide-react";

type MobileTab = "orders" | "execute" | "new" | "route" | "profile";
type ExecTab = "checklist" | "measurements" | "photos" | "report";
type OS = { id:string; numero:string; cliente:string; local:string; endereco:string; servico:string; status:string; prioridade?:string; equipamento?:string; dataAgendamento?:string };

const emptyOS: OS[] = [];

export function ProARMobile() {
  const [tab,setTab]=useState<MobileTab>("orders");
  const [execTab,setExecTab]=useState<ExecTab>("checklist");
  const [orders,setOrders]=useState<OS[]>(emptyOS);
  const [selected,setSelected]=useState<OS|null>(null);
  const [query,setQuery]=useState("");
  const [online,setOnline]=useState(true);
  const [loading,setLoading]=useState(true);
  const [checkin,setCheckin]=useState<{lat:number;lng:number;at:string}|null>(null);
  const [checks,setChecks]=useState([false,false,false,false,false]);
  const [signature,setSignature]=useState(false);
  const canvasRef=useRef<HTMLCanvasElement|null>(null);

  useEffect(()=>{ setOnline(navigator.onLine); const on=()=>setOnline(true),off=()=>setOnline(false); window.addEventListener("online",on); window.addEventListener("offline",off); return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off)}},[]);
  useEffect(()=>{(async()=>{try{const r=await fetch("/api/relatorios",{cache:"no-store"});if(r.ok){const d=await r.json();const raw=Array.isArray(d)?d:(d?.ordens||d?.serviceOrders||d?.data||[]);if(Array.isArray(raw)) setOrders(raw.map((x:any)=>({id:String(x.id??x.numeroTarefa??x.numero??crypto.randomUUID()),numero:String(x.numeroTarefa??x.numero??x.id??""),cliente:x.clienteNome??x.cliente?.nome??"Cliente",local:x.unidadeNome??x.local??x.setor??"",endereco:x.endereco??x.cliente?.endereco??"",servico:x.tipoTarefa??x.servico??x.descricao??"Ordem de Serviço",status:x.status??"Em aberto",prioridade:x.prioridade,equipamento:x.equipamento?.modelo??x.equipamentoNome,dataAgendamento:x.dataAgendamento??x.data})));}}catch{}finally{setLoading(false)}})()},[]);
  const filtered=useMemo(()=>orders.filter(o=>(o.numero+" "+o.cliente+" "+o.local+" "+o.endereco).toLowerCase().includes(query.toLowerCase())),[orders,query]);
  const openOS=(o:OS)=>{setSelected(o);setTab("execute");setExecTab("checklist")};
  const gps=()=>navigator.geolocation?.getCurrentPosition(p=>setCheckin({lat:p.coords.latitude,lng:p.coords.longitude,at:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}),()=>alert("Não foi possível obter o GPS. Verifique a permissão de localização."));
  const sync=async()=>{setLoading(true);try{const r=await fetch("/api/relatorios",{cache:"no-store"});if(r.ok) location.reload()}finally{setLoading(false)}};
  const progress=Math.round(checks.filter(Boolean).length/checks.length*100);

  return <div className="min-h-dvh bg-[#050a14] text-slate-100 flex justify-center">
    <div className="w-full max-w-[480px] min-h-dvh bg-[#050a14] border-x border-[#14253e] flex flex-col">
      <header className="sticky top-0 z-30 bg-[#081120] border-b border-[#14253e]">
        <div className="px-4 py-2 flex justify-between items-center text-[10px] font-mono text-slate-400">
          <span>{new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} • ProAR Campo</span>
          <span className={"flex items-center gap-1 font-bold "+(online?"text-emerald-400":"text-amber-400")}>{online?<Wifi className="w-3 h-3"/>:<WifiOff className="w-3 h-3"/>}{online?"Online":"Offline Ready"}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <div><div className="font-black tracking-wide">ProAR <span className="text-cyan-400 text-[10px]">MOBILE</span></div><div className="text-[10px] text-slate-400">Operação técnica em campo</div></div>
          <div className="flex gap-2"><button className="p-2 rounded-xl bg-[#0b1628] border border-[#14253e]" title="QR Code"><QrCode className="w-4 h-4 text-cyan-400"/></button><button onClick={sync} className="p-2 rounded-xl bg-[#0b1628] border border-[#14253e]" title="Sincronizar"><RefreshCw className={"w-4 h-4 "+(loading?"animate-spin":"")}/></button></div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {tab==="orders"&&<section className="space-y-4">
          <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0c1f3d] to-[#081120] border border-blue-500/30"><span className="text-[10px] text-cyan-400 font-bold tracking-widest">MINHAS ORDENS DE SERVIÇO</span><div className="flex justify-between items-end mt-1"><div><h1 className="font-bold">Rota operacional</h1><p className="text-xs text-slate-400">{orders.length} atendimento(s) carregado(s)</p></div><ClipboardList className="text-cyan-400"/></div></div>
          <div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-slate-500"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar O.S., cliente, unidade..." className="w-full bg-[#0b1628] border border-[#14253e] rounded-xl pl-9 pr-3 py-2.5 text-xs outline-none focus:border-cyan-400"/></div>
          {loading?<div className="text-center text-xs text-slate-500 py-10">Sincronizando ordens...</div>:filtered.length===0?<div className="rounded-2xl border border-dashed border-[#1f385c] p-8 text-center"><ClipboardList className="w-8 h-8 mx-auto text-slate-600 mb-2"/><p className="text-sm font-bold">Nenhuma O.S. disponível</p><p className="text-xs text-slate-500 mt-1">O aplicativo não cria dados fictícios. Sincronize para carregar as ordens reais atribuídas ao usuário.</p></div>:filtered.map(o=><article key={o.id} className="rounded-2xl bg-[#0b1628] border border-[#14253e] p-4 space-y-3"><div className="flex justify-between"><span className="font-mono text-xs font-bold text-cyan-400">OS #{o.numero}</span><span className="text-[9px] px-2 py-1 rounded bg-blue-500/10 text-blue-300">{o.status}</span></div><div><h3 className="text-sm font-bold">{o.cliente}</h3><p className="text-xs text-slate-400">{o.local}</p><p className="text-[11px] text-slate-500 mt-1">{o.servico}</p></div><div className="flex gap-2"><button onClick={()=>window.open("https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(o.endereco),"_blank")} className="p-2 rounded-xl bg-[#081120] border border-[#14253e]"><Navigation className="w-4 h-4 text-cyan-400"/></button><button onClick={()=>openOS(o)} className="flex-1 py-2 rounded-xl bg-blue-600 font-bold text-xs flex justify-center gap-2"><Wrench className="w-4 h-4"/>Executar Ordem</button></div></article>)}
        </section>}

        {tab==="execute"&&<section className="space-y-4">
          {!selected?<div className="text-center py-12"><Wrench className="mx-auto text-slate-600"/><p className="text-sm font-bold mt-2">Selecione uma O.S.</p><button onClick={()=>setTab("orders")} className="mt-3 text-xs text-cyan-400">Ir para Minhas O.S.</button></div>:<>
          <div className="rounded-2xl bg-[#0b1628] border border-cyan-500/30 p-4"><div className="flex justify-between"><span className="font-mono text-cyan-400 font-bold text-xs">OS #{selected.numero}</span><span className="text-[9px] text-slate-400">{selected.status}</span></div><h2 className="font-bold text-sm mt-2">{selected.cliente}</h2><p className="text-xs text-slate-400">{selected.local}</p><button onClick={gps} className={"mt-3 w-full p-2 rounded-xl border text-xs font-bold flex justify-center gap-2 "+(checkin?"border-emerald-500/30 text-emerald-300 bg-emerald-500/10":"border-[#14253e] text-cyan-400 bg-[#081120]")}><MapPin className="w-4 h-4"/>{checkin?`Check-in ${checkin.at} • ${checkin.lat.toFixed(5)}, ${checkin.lng.toFixed(5)}`:"Registrar Check-in GPS"}</button></div>
          <div className="grid grid-cols-4 bg-[#081120] border border-[#14253e] rounded-xl p-1">{(["checklist","measurements","photos","report"] as ExecTab[]).map((x,i)=><button key={x} onClick={()=>setExecTab(x)} className={"py-2 rounded-lg text-[10px] font-bold "+(execTab===x?"bg-blue-600":"text-slate-400")}>{["Checklist","Medições","Fotos","Laudo"][i]}</button>)}</div>
          {execTab==="checklist"&&<div className="space-y-2"><div className="flex justify-between text-xs"><span>Progresso PMOC</span><b className="text-cyan-400">{progress}%</b></div>{["Inspeção e higienização de filtros","Serpentina e bandeja de condensado","Teste e desobstrução de dreno","Terminais elétricos e aterramento","Fixação, vibração e condição geral"].map((x,i)=><label key={x} className="flex gap-3 p-3 rounded-xl bg-[#0b1628] border border-[#14253e] text-xs"><input type="checkbox" checked={checks[i]} onChange={()=>setChecks(v=>v.map((a,j)=>j===i?!a:a))}/><span>{x}</span></label>)}</div>}
          {execTab==="measurements"&&<div className="grid grid-cols-2 gap-3">{["Pressão baixa (PSI)","Pressão alta (PSI)","Corrente (A)","Tensão (V)","Temp. retorno (°C)","Temp. insuflamento (°C)"].map(x=><label key={x} className="text-[10px] text-slate-400">{x}<input inputMode="decimal" className="mt-1 w-full bg-[#0b1628] border border-[#14253e] rounded-xl px-3 py-2 text-sm text-white"/></label>)}</div>}
          {execTab==="photos"&&<div className="grid grid-cols-2 gap-3">{["Antes","Depois"].map(x=><label key={x} className="h-36 rounded-2xl bg-[#0b1628] border border-dashed border-[#1f385c] flex flex-col justify-center items-center text-xs text-slate-400"><Camera className="w-6 h-6 text-cyan-400 mb-2"/>{x}<input type="file" accept="image/*" capture="environment" className="hidden"/></label>)}</div>}
          {execTab==="report"&&<div className="space-y-3"><textarea rows={5} placeholder="Diagnóstico e parecer técnico final..." className="w-full bg-[#0b1628] border border-[#14253e] rounded-xl p-3 text-xs"/><div className="rounded-xl bg-[#0b1628] border border-[#14253e] p-3"><div className="flex justify-between text-xs mb-2"><b>Assinatura no local</b><span className={signature?"text-emerald-400":"text-slate-500"}>{signature?"Registrada":"Pendente"}</span></div><canvas ref={canvasRef} onPointerDown={()=>setSignature(true)} className="w-full h-28 bg-[#040810] rounded-lg border border-cyan-500/20 touch-none"/><p className="text-[9px] text-slate-500 mt-1">Assine com o dedo ou caneta touch.</p></div><button disabled={!signature} className="w-full py-3 rounded-xl bg-emerald-600 disabled:opacity-40 font-bold text-xs flex justify-center gap-2"><CheckCircle2 className="w-4 h-4"/>Concluir O.S. e preparar laudo</button></div>}
          </>}
        </section>}

        {tab==="new"&&<section className="space-y-3"><h2 className="font-bold">Nova O.S. em Campo</h2><p className="text-xs text-slate-400">Cadastro express. O envio definitivo deve respeitar as regras e permissões do backend ProAR.</p>{["Cliente / Secretaria","Unidade / Setor / Ambiente","Tipo de serviço","Descrição da solicitação"].map((x,i)=><label key={x} className="text-[11px] font-bold text-slate-300 block">{x}{i===3?<textarea rows={4} className="mt-1 w-full bg-[#0b1628] border border-[#14253e] rounded-xl p-3"/>:<input className="mt-1 w-full bg-[#0b1628] border border-[#14253e] rounded-xl p-3"/>}</label>)}<button className="w-full py-3 rounded-xl bg-blue-600 font-bold text-xs">Salvar quando conectado ao backend</button></section>}
        {tab==="route"&&<section className="text-center py-12"><Navigation className="w-10 h-10 mx-auto text-cyan-400"/><h2 className="font-bold mt-3">Rota GPS</h2><p className="text-xs text-slate-400 mt-2">Abra a rota diretamente a partir do endereço real de cada ordem de serviço.</p><button onClick={()=>setTab("orders")} className="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-xs font-bold">Ver atendimentos</button></section>}
        {tab==="profile"&&<section className="space-y-4"><div className="rounded-2xl bg-[#0b1628] border border-[#14253e] p-5 text-center"><UserCheck className="w-10 h-10 mx-auto text-cyan-400"/><h2 className="font-bold mt-2">Técnico ProAR</h2><p className="text-xs text-slate-400">Perfil e permissões devem vir da sessão autenticada do sistema.</p></div><div className="rounded-xl bg-[#081120] border border-[#14253e] p-3 text-xs flex justify-between"><span>Conectividade</span><b className={online?"text-emerald-400":"text-amber-400"}>{online?"Online":"Offline Ready"}</b></div></section>}
      </main>

      <nav className="fixed bottom-0 w-full max-w-[480px] h-18 bg-[#060c18]/95 backdrop-blur border-t border-[#14253e] grid grid-cols-5 z-40">{([{k:"orders",i:ClipboardList,l:"Minhas O.S."},{k:"execute",i:Wrench,l:"Execução"},{k:"new",i:PlusCircle,l:"Nova O.S."},{k:"route",i:Navigation,l:"Rota GPS"},{k:"profile",i:UserCheck,l:"Perfil"}] as const).map(x=><button key={x.k} onClick={()=>setTab(x.k)} className={"flex flex-col items-center justify-center gap-1 text-[9px] font-bold "+(tab===x.k?"text-cyan-400":"text-slate-500")}><x.i className="w-5 h-5"/>{x.l}</button>)}</nav>
    </div>
  </div>
}