"use client";

import {useEffect,useMemo,useState} from "react";
import {Camera,ChevronRight,ClipboardList,CloudOff,Clock3,MapPin,Package,Phone,ShoppingCart,UsersRound,Wrench} from "lucide-react";
import {useOfflineQueue,useOnlineState} from "@/lib/mobile-operations";
import {MobileRouteControls} from "./MobileRouteControls";

type Data={
  employee?:{employeeName:string;role?:string;permissions?:string[]};
  routes:Array<{id:string;status:string;startedAt:string;distanceKm:number}>;
  orders:Array<{id:string;client:string;status:string;date?:string;unit?:string}>;
};

const go=(name:string)=>window.dispatchEvent(new CustomEvent("proar:navigate",{detail:name}));

export function MobileToday({manager=false}:{manager?:boolean}){
  const online=useOnlineState();
  const queue=useOfflineQueue();
  const[data,setData]=useState<Data|null>(null);
  const[routeOpen,setRouteOpen]=useState(false);

  useEffect(()=>{
    let live=true;
    const load=async()=>{
      try{
        const r=await fetch("/api/work-routes",{cache:"no-store"});
        if(r.ok&&live)setData(await r.json());
      }catch{}
    };
    void load();
    const t=setInterval(load,60000);
    return()=>{live=false;clearInterval(t)};
  },[]);

  const today=new Date().toISOString().slice(0,10);
  const orders=useMemo(()=>data?.orders.filter(o=>!o.date||o.date.slice(0,10)===today)||[],[data,today]);
  const done=orders.filter(o=>/conclu|finaliz/.test(o.status.toLowerCase())).length;
  const active=data?.routes.find(r=>r.status==="active");
  const firstName=data?.employee?.employeeName?.split(" ")[0];

  return <section className="mobile-today">
    <header className="mobile-today-hero">
      <div>
        <small>PROAR MOBILE • {manager?"GESTÃO EM CAMPO":"OPERAÇÃO EM CAMPO"}</small>
        <h2>{firstName?`Olá, ${firstName}`:"Operação de hoje"}</h2>
        <p>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"})}</p>
      </div>
      <span className={online?"online":"offline"}>{online?"Online":"Offline"}</span>
    </header>

    {manager&&<div className="mobile-manager-strip">
      <button onClick={()=>go("Funcionários")}><UsersRound size={18}/><span><b>Equipe</b><small>Jornadas e acompanhamento</small></span><ChevronRight size={16}/></button>
      <button onClick={()=>go("Ordens de serviço")}><Wrench size={18}/><span><b>Operação</b><small>OS, atrasos e distribuição</small></span><ChevronRight size={16}/></button>
    </div>}

    <button className={active?"mobile-route-summary active":"mobile-route-summary"} onClick={()=>setRouteOpen(value=>!value)}>
      <Clock3 size={19}/>
      <span><b>{active?"Jornada ativa":"Jornada e localização"}</b><small>{active?"Toque para check-in, pausa ou encerramento":"Inicie a rota quando começar o expediente"}</small></span>
      <ChevronRight size={17} className={routeOpen?"expanded":""}/>
    </button>
    {routeOpen&&<div className="mobile-route-inline"><MobileRouteControls/></div>}

    <div className="mobile-today-kpis">
      <article><small>OS DE HOJE</small><strong>{orders.length}</strong></article>
      <article><small>CONCLUÍDAS</small><strong>{done}</strong></article>
      <article><small>PENDENTES</small><strong>{Math.max(0,orders.length-done)}</strong></article>
      <article className={queue.length?"attention":""}><small>A SINCRONIZAR</small><strong>{queue.length}</strong></article>
    </div>

    <div className="mobile-field-flow"><span>ROTA</span><i>→</i><span>CHECK-IN</span><i>→</i><span>EXECUÇÃO</span><i>→</i><span>FOTOS</span><i>→</i><span>FINALIZAR</span></div>

    <div className="mobile-quick-actions">
      <button onClick={()=>go("Agenda")}><MapPin size={17}/><span>Minha rota</span></button>
      <button onClick={()=>go("Ordens de serviço")}><Camera size={17}/><span>Fotos / OS</span></button>
      <button onClick={()=>go("Estoque")}><Package size={17}/><span>Materiais</span></button>
      <button onClick={()=>go("Vendas")}><ShoppingCart size={17}/><span>Venda rápida</span></button>
    </div>

    <div className="mobile-today-list">
      <div className="mobile-today-title"><b>Próximos atendimentos</b><button onClick={()=>go("Ordens de serviço")}>Ver todas</button></div>
      {orders.slice(0,4).map(order=><button key={order.id} onClick={()=>go("Ordens de serviço")}>
        <i><ClipboardList size={17}/></i>
        <span>
          <b>{order.id} • {order.client}</b>
          <small>{order.unit||"Atendimento"} • {order.status}</small>
          <em><Phone size={12}/> contato <MapPin size={12}/> rota</em>
        </span>
        <ChevronRight size={16}/>
      </button>)}
      {!orders.length&&<div className="mobile-empty"><ClipboardList size={22}/><b>Nenhuma OS programada para hoje</b><small>Use Agenda ou Ordens de serviço para consultar outros atendimentos.</small></div>}
    </div>

    {queue.length>0&&<div className="mobile-sync-card"><CloudOff size={18}/><span><b>{queue.length} alteração(ões) aguardando sincronização</b><small>Os dados de campo foram preservados neste aparelho.</small></span></div>}
  </section>;
}
