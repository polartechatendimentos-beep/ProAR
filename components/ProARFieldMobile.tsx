"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronRight,
  ClipboardList, CloudOff, Home, MapPin, Menu, RefreshCw,
  Search, ShieldCheck, Smartphone, UserRound, Wifi,
} from "lucide-react";
import { MobileRouteControls } from "./MobileRouteControls";
import { FieldSupportPanel } from "./FieldSupportPanel";
import { FieldOrderReceipt } from "./FieldOrderReceipt";
import {MobileRecoveryPanel} from "./MobileRecoveryPanel";
import {createDayPackage,readOfflineLease,rememberOfflineLease,clearOfflineLease,type MobileDayData} from "@/lib/mobile-day-policy";
import {loadDayPackage,saveDayPackage,removeDayOrder} from "@/lib/mobile-day-cache";
import { listPendingOrderDrafts } from "@/lib/mobile-order-drafts";
import { MOBILE_RELEASE } from "@/lib/mobile-release";
import { filterFieldOrders, fieldOrderTone, openFieldWorkQueue, type OrderFilter } from "@/lib/mobile-order-display";
import { FieldOrderEditor } from "./FieldOrderEditor";
import { mobileWeekDates } from "@/lib/mobile-agenda";
import { isOpenMobileOrder,type MobileFieldOrder } from "@/lib/mobile-field";
import styles from "./ProARFieldMobile.module.css";
import {MobileThemeControl,useMobileTheme} from "./MobileThemeControl";
import {mobileSupervision} from "@/lib/mobile-experience";

type FieldOrder = MobileFieldOrder;
type FieldData = MobileDayData;
const EMPTY_ORDERS:FieldOrder[]=[];
type Tab = "inicio" | "agenda" | "ordens" | "central" | "mais";

function todayISO() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return value || "Data a definir";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function statusTone(value: string) {
  if (!isOpenMobileOrder(value) && !/cancelad/i.test(value)) return styles.statusDone;
  if (/andamento|execu[cç][aã]o|iniciad/i.test(value)) return styles.statusActive;
  if (/cancelad|atrasad/i.test(value)) return styles.statusAlert;
  return styles.statusPending;
}
function displayTime(value: string) {
  return /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : value || "A definir";
}
function OrderCard({ order, onOpen, compact=false }: { order: FieldOrder; onOpen: () => void; compact?:boolean }) {
  return <button type="button" className={`${styles.orderCard} ${compact?styles.orderCompact:""} ${styles[`${fieldOrderTone(order,todayISO())}Card`]}`} onClick={onOpen} aria-label={`Consultar ${order.id}`}>
    <span className={styles.orderTop}><strong>{order.id}</strong><span className={`${styles.status} ${statusTone(order.status)}`}>{order.status || "Sem status"}</span></span>
    <span className={styles.orderTitle}>{order.service || "Atendimento técnico"}</span>
    <span className={styles.orderClient}>{order.client || "Cliente não identificado"}</span>
    <span className={styles.orderMuted}>{[order.unit, order.equipmentIds.length ? `${order.equipmentIds.length} equipamento(s)` : ""].filter(Boolean).join(" · ")}</span>
    <span className={styles.orderBottom}><span><CalendarDays size={14}/>{formatDate(order.date)} · {displayTime(order.time)}</span><ChevronRight size={18}/></span>
  </button>;
}

export function ProARFieldMobile() {
  const appearance=useMobileTheme();
  const requestAbort=useRef<AbortController|null>(null),generation=useRef(0);
  const [offlineNotice,setOfflineNotice]=useState(""),[offlineCopy,setOfflineCopy]=useState(false),[recovery,setRecovery]=useState<{scope:string;order:FieldOrder}|null>(null);
  const [tab, setTab] = useState<Tab>("inicio");
  const [data, setData] = useState<FieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sunlightMode, setSunlightMode] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [online, setOnline] = useState(true);
  const [query, setQuery] = useState("");
  const [visibleLimit,setVisibleLimit]=useState(100);
  const [orderFilter,setOrderFilter]=useState<OrderFilter>("open"),[pendingState,setPendingState]=useState<{scope:string;orders:FieldOrder[]}>({scope:"",orders:[]}),[versionNotice,setVersionNotice]=useState(""),[updateAvailable,setUpdateAvailable]=useState(false);
  const [orderSort,setOrderSort]=useState<"date"|"recent"|"client">("date");
  const [compactOrders,setCompactOrders]=useState(true);
  const [favoriteFilter,setFavoriteFilter]=useState<OrderFilter|null>(null);
  const [groupOrders,setGroupOrders]=useState(false);
  const [showMoreOrderFilters,setShowMoreOrderFilters]=useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState(todayISO);
  const [agendaMode,setAgendaMode]=useState<"day"|"week">("day");
  const [mapApp,setMapApp]=useState("google");
  const [completion,setCompletion]=useState<{orderId:string;completedAt:string}|null>(null);
  const refresh = useCallback(async () => {
    const run=++generation.current;requestAbort.current?.abort();const controller=new AbortController();requestAbort.current=controller;
    setLoading(true); setError("");
    try {
      if (!navigator.onLine) {
        const lease=readOfflineLease(sessionStorage),cached=lease?await loadDayPackage(lease.scope):null;
        if(run!==generation.current)return;
        if(!lease||!cached||cached.validUntil>lease.validUntil){setData(null);setSelected(null);throw new Error("Conecte para validar a sessão e preparar as OS do dia. Os rascunhos permanecem no aparelho.");}
        setData({...cached.data,connected:false});setOfflineCopy(true);setLoginRequired(false);setOfflineNotice(`Cópia local de ${new Date(cached.preparedAt).toLocaleString("pt-BR")}. Atualizações de outros usuários só aparecem com conexão.`);return;
      }
      const response = await fetch("/api/mobile/bootstrap", { cache:"no-store", credentials:"same-origin",signal:controller.signal });
      const result = await response.json();
      if(run!==generation.current||controller.signal.aborted)return;
      if (!response.ok) {
        setLoginRequired(response.status === 401);
        if(response.status===401||response.status===403){setData(null);setSelected(null);setRecovery(null);try{clearOfflineLease(sessionStorage);}catch{}}
        throw new Error(result.error || "Não foi possível carregar os atendimentos.");
      }
      setLoginRequired(false);
      setData(result as FieldData);setOfflineCopy(false);setOfflineNotice("");
      try{const pack=createDayPackage(result as FieldData);await saveDayPackage(pack);if(run!==generation.current||controller.signal.aborted)return;rememberOfflineLease(sessionStorage,pack);setOfflineNotice(`${pack.data.orders.length} OS preparadas neste aparelho para uso offline.${pack.truncated?" Pacote parcial: limite de 200 OS.":""}`);}catch{setOfflineNotice("Dados carregados do servidor; pacote offline não confirmado. Seus rascunhos continuam separados.");}
    } catch (reason) {
      if(run!==generation.current||controller.signal.aborted)return;
      if(!navigator.onLine){setData(null);setSelected(null);setRecovery(null);}
      setError(reason instanceof Error ? reason.message : "Falha de conexão com o ProAR.");
    } finally {
      if(run===generation.current)setLoading(false);
    }
  }, []);
  useEffect(() => {
    setOnline(navigator.onLine);
    const change = () => {setOnline(navigator.onLine);if(navigator.onLine)void refresh();};
    const focus = () => { void refresh(); };
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    window.addEventListener("focus", focus);
    void refresh();
    const expiryTimer=setInterval(()=>{if(!navigator.onLine){let valid=false;try{valid=Boolean(readOfflineLease(sessionStorage));}catch{}if(!valid){setData(null);setSelected(null);setRecovery(null);setError("A leitura offline expirou. Conecte para validar a sessão.");}}},60000);
    return () => {
      clearInterval(expiryTimer);generation.current++;requestAbort.current?.abort();
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  const orders = data?.orders ?? EMPTY_ORDERS;
  const pendingOrders=pendingState.scope===data?.user.scope?pendingState.orders:EMPTY_ORDERS;
  const filtered = useMemo(()=>filterFieldOrders(orders,query,orderFilter,todayISO()),[orders,query,orderFilter]);
  const sortedOrders=useMemo(()=>[...filtered].sort((a,b)=>orderSort==="client"?(a.client||"").localeCompare(b.client||"","pt-BR"):orderSort==="recent"?(b.date||"").localeCompare(a.date||""):(a.date||"").localeCompare(b.date||"")),[filtered,orderSort]);
  const groupedOrders=useMemo(()=>{const groups:{label:string;orders:FieldOrder[]}[]=[];for(const order of sortedOrders.slice(0,visibleLimit)){const label=!/^\d{4}-\d{2}-\d{2}$/.test(order.date)?"Sem data":order.date===todayISO()?"Hoje":order.date>todayISO()?"Próximas":"Anteriores";let group=groups.find(g=>g.label===label);if(!group){group={label,orders:[]};groups.push(group);}group.orders.push(order);}return groups;},[sortedOrders,visibleLimit]);
  const pendingScope=data?.user.scope;
  useEffect(()=>{
    if(!pendingScope)return;
    let cancelled=false;
    void listPendingOrderDrafts(pendingScope).then(rows=>{if(!cancelled)setPendingState({scope:pendingScope,orders:rows.map(row=>row.orderSnapshot!)});}).catch(()=>{if(!cancelled)setPendingState({scope:pendingScope,orders:[]});});
    return()=>{cancelled=true;};
  },[pendingScope,selected,data?.lastReadAt]);
  async function checkVersion(){try{const response=await fetch("/api/mobile/version",{cache:"no-store"});if(!response.ok)throw new Error();const result=await response.json();const changed=result.version!==MOBILE_RELEASE;setUpdateAvailable(changed);setVersionNotice(changed?"Nova versão disponível. Seus rascunhos permanecem neste aparelho.":"Você está usando a versão atual.");}catch{setVersionNotice("Não foi possível consultar a versão. Tente novamente com conexão.");}}
  const openOrders = useMemo(() => openFieldWorkQueue(orders,todayISO()), [orders]);
  const week=useMemo(()=>mobileWeekDates(day),[day]);
  const agendaOrders = useMemo(() => orders.filter(order => agendaMode==="week"?week.includes(order.date):order.date === day), [orders, day,agendaMode,week]);
  const current = orders.find(order => order.id === selected)||pendingOrders.find(order=>order.id===selected)||(recovery?.scope===data?.user.scope&&recovery?.order.id===selected?recovery.order:undefined);
  const supervision=mobileSupervision(orders,todayISO());
  const firstName = data?.user.displayName?.split(" ")[0] || "equipe";
  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id:"inicio", label:"Início", icon:Home },
    { id:"agenda", label:"Agenda", icon:CalendarDays },
    { id:"ordens", label:"Ordens", icon:ClipboardList },
    { id:"central", label:"Central", icon:ShieldCheck },
    { id:"mais", label:"Mais", icon:Menu },
  ];
  return <div data-mobile-theme={appearance.resolved} className={`${styles.app} ${sunlightMode ? styles.sunlightMode : ""}`}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.brandIcon}><img src="/brand/proar-mobile.svg?v=20261015" alt="" width={39} height={39}/></span><span><strong>ProAR <b>Mobile</b></strong><small>OPERAÇÃO EM CAMPO</small></span></div>
        <div className={styles.headerRight}>
          <button type="button" className={styles.iconButton} aria-label={sunlightMode ? "Desativar modo sol forte" : "Ativar modo sol forte"} aria-pressed={sunlightMode} title="Modo sol forte" onClick={()=>setSunlightMode(value=>!value)}><span aria-hidden="true">☀</span></button>
          <span className={`${styles.connection} ${online && !error ? styles.connectionOn : styles.connectionOff}`}><span className={styles.connectionDot}/>{online && !error ? "Conectado" : "Sem sincronização"}</span>
          <button type="button" className={styles.iconButton} aria-label="Atualizar dados" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={19} className={loading ? styles.spin : ""}/></button>
        </div>
      </header>
      <main className={styles.content}>
        {offlineNotice&&<p role="status" className={styles.syncBanner}>{offlineCopy?"Leitura offline • ":""}{offlineNotice}</p>}
        {!online && <div className={styles.warning}><CloudOff size={19}/>Sem conexão. Você pode preencher o rascunho da OS neste aparelho. Você também pode deixar o envio preparado e sincronizar ao retornar a conexão. A conclusão só é confirmada pelo servidor.</div>}
        {completion&&<div role="status" className={styles.successPanel}><h2>OS concluída • {completion.orderId}</h2><p>Confirmada no servidor em {new Date(completion.completedAt).toLocaleString("pt-BR")}.</p><FieldOrderReceipt orderId={completion.orderId}/><button type="button" className={styles.secondaryAction} onClick={()=>setCompletion(null)}>Fechar confirmação</button></div>}
        {error && <div role="alert" className={styles.error}>{error}{loginRequired && <Link href="/">Entrar no ProAR</Link>}{!loginRequired && <button type="button" onClick={()=>void refresh()}>Tentar novamente</button>}</div>}
        {loading && !data && <div role="status" aria-label="Carregando atendimentos" className={styles.skeletonGrid}><p>Conectando aos atendimentos reais do ProAR...</p>{[1,2,3].map(i=><div key={i} className={styles.skeletonCard} aria-hidden="true"/>)}</div>}
        {data && <>
          {pendingOrders.length>0&&!current&&<section className={styles.pendingPanel}><h2>{pendingOrders.length} envio(s) aguardando confirmação</h2><p>Retome cada envio para sincronizar ou consultar a confirmação, sem duplicar o registro.</p>{pendingOrders.map(order=><button key={order.id} type="button" className={styles.secondaryAction} onClick={()=>setSelected(order.id)}>Retomar envio • {order.id}</button>)}</section>}
          <button type="button" className={styles.secondaryAction} onClick={()=>{setSelected(null);setTab("mais");}}>Central de sincronização • pacote offline e rascunhos</button>
          <details className={styles.journeyPanel}><summary>Minha jornada • entrada, pausa e saída</summary><MobileRouteControls /></details>
          {tab === "central" && !current && data.user.manager && <section className={styles.detailCard}><h2>Supervisão • ordens autorizadas</h2><p>Resumo da última leitura do servidor. Envios locais aparecem separadamente e não representam a fila dos outros aparelhos.</p><div className={styles.metrics}>{Object.entries({"Em aberto":supervision.open,"Atrasadas":supervision.overdue,"Com check-in":supervision.active,"Hoje":supervision.today}).map(([label,count])=><div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div><p>{pendingOrders.length} envio(s) pendente(s) neste aparelho e usuário.</p></section>}
          <FieldSupportPanel visible={tab === "central" && !current}/>
          {tab==="central"&&!current&&data.user.manager&&<section className={styles.detailCard}><h2>Solicitações e atrasos de atendimento</h2>{orders.filter(order=>order.requests?.some(item=>item.status==="Pendente")||order.delay).map(order=><button key={order.id} type="button" className={styles.secondaryAction} onClick={()=>setSelected(order.id)}>Revisar {order.id} • {order.delay?`Atraso ${order.delay.minutes} min`:"Solicitação pendente"}</button>)}{!orders.some(order=>order.requests?.some(item=>item.status==="Pendente")||order.delay)&&<p>Nenhuma solicitação ou atraso registrado.</p>}</section>}
          {tab==="central"&&!current&&data.user.canApprove&&<section className={styles.detailCard}><h2>Exceções de OS aguardando aprovação</h2>{orders.filter(order=>order.fieldExceptions?.some(item=>item.status==="Pendente")).map(order=><button key={order.id} type="button" className={styles.secondaryAction} onClick={()=>setSelected(order.id)}>Revisar {order.id} • {order.client}</button>)}{!orders.some(order=>order.fieldExceptions?.some(item=>item.status==="Pendente"))&&<p>Nenhuma solicitação pendente.</p>}</section>}
          {current ? <section className={styles.screen}>
            <button type="button" className={styles.back} onClick={()=>setSelected(null)}><ArrowLeft size={18}/> Voltar</button>
            <p className={styles.eyebrow}>ORDEM DE SERVIÇO</p>
            <h1 className={styles.title}>{current.id}</h1>
            <div className={styles.detailCard}>
              <span className={`${styles.status} ${statusTone(current.status)}`}>{current.status || "Sem status"}</span>
              <h2>{current.service || "Atendimento técnico"}</h2>
              <dl className={styles.detailList}>
                <div><dt>Cliente</dt><dd>{current.client || "Não informado"}</dd></div>
                <div><dt>Unidade</dt><dd>{current.unit || "Não informada"}</dd></div>
                <div><dt>Data e horário</dt><dd>{formatDate(current.date)} · {displayTime(current.time)}</dd></div>
                <div><dt>Técnico responsável</dt><dd>{current.tech || "Não definido"}</dd></div>
                <div><dt>Endereço</dt><dd>{current.address || "Não informado"}</dd></div>
                <div><dt>Equipamentos vinculados</dt><dd>{current.equipmentIds.length ? current.equipmentIds.join(", ") : "Nenhum vínculo informado"}</dd></div>
                {current.checkInAt && <div><dt>Check-in registrado</dt><dd>{current.checkInAt}</dd></div>}
                {!isOpenMobileOrder(current.status)&&<><div><dt>Diagnóstico</dt><dd>{current.diagnosis||"Não informado"}</dd></div><div><dt>Serviço executado</dt><dd>{current.executedService||"Não informado"}</dd></div></>}
              </dl>
            </div>
            {current.address && <><label className={styles.formLabel}>Aplicativo de navegação<select value={mapApp} onChange={e=>setMapApp(e.target.value)}><option value="google">Google Maps</option><option value="waze">Waze</option></select></label><a className={styles.primaryAction} href={mapApp==="waze"?`https://www.waze.com/ul?q=${encodeURIComponent(current.address)}&navigate=yes`:`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(current.address)}`} target="_blank" rel="noopener noreferrer"><MapPin size={18}/> Abrir navegação <ArrowRight size={18}/></a></>}
            {!isOpenMobileOrder(current.status)&&<p className={styles.disclaimer}>OS encerrada: consulta do histórico. Os dados de execução permanecem preservados.</p>}
            {!data.user.canEdit && <p role="alert" className={styles.warning}>Seu perfil não tem permissão para alterar esta OS. Solicite a liberação ao administrador.</p>}
            {data.user.canEdit && isOpenMobileOrder(current.status) && <FieldOrderEditor key={`${current.id}:${current.fieldVersion}:${current.editToken}`} scope={data.user.scope} canApprove={data.user.canApprove} order={current} requiresJourney={/tecnico|prestador/i.test(data.user.role.normalize("NFD").replace(/[\u0300-\u036f]/g,""))} onSaved={async result=>{if(result){setCompletion(result);setSelected(null);setTab("ordens");setData(previous=>previous?{...previous,orders:previous.orders.filter(order=>order.id!==result.orderId)}:previous);}if(result){try{await removeDayOrder(data.user.scope,result.orderId);}catch{try{clearOfflineLease(sessionStorage);}catch{}}}await refresh();}}/>}
            <p className={styles.disclaimer}>Alterações são confirmadas no banco. Durante a pausa ou fora da jornada, técnicos podem apenas consultar.</p>
          </section> : <>
            {tab === "inicio" && <section className={styles.screen}>
              <p className={styles.eyebrow}>PAINEL OPERACIONAL</p>
              <h1 className={styles.title}>Olá, {firstName}<span className={styles.titleAccent}>.</span></h1>
              <p className={styles.subtitle}>Seus atendimentos em aberto conectados ao ProAR.</p>
              <div className={styles.hero}>
                <span className={styles.heroTop}><Smartphone size={18}/> PROAR MOBILE · DADOS REAIS</span>
                <strong>{openOrders.length}</strong>
                <span>ordens em aberto • todas as datas</span>
                <div className={styles.heroBottom}><span>Somente OS em aberto</span><span>{todayISO().split("-").reverse().join("/")}</span></div>
              </div>
              <div className={styles.metrics}>
                <div><strong>{data.summary.inProgress}</strong><span>Em andamento</span></div>
                <div><strong>{data.summary.pending}</strong><span>Pendentes</span></div>
              </div>
              <div className={styles.sectionHeading}><h2>Atendimentos em aberto</h2><button type="button" onClick={()=>setTab("agenda")}>Ver agenda <ArrowRight size={14}/></button></div>
              <p className={styles.subtitle}>Em andamento primeiro, depois atrasados e demais atendimentos.{openOrders.length>8?` Mostrando 8 de ${openOrders.length}.`:""}</p>
              {openOrders.length ? openOrders.slice(0, 8).map(order=><OrderCard key={order.id} order={order} onOpen={()=>setSelected(order.id)}/>) : <div className={styles.empty}>Nenhuma OS em aberto disponível para o seu perfil.</div>}
              <button type="button" className={styles.secondaryAction} onClick={()=>{setOrderFilter("open");setQuery("");setVisibleLimit(100);setTab("ordens");}}>Consultar todas as ordens em aberto <ArrowRight size={17}/></button>
            </section>}
            {tab === "agenda" && <section className={styles.screen}>
              <p className={styles.eyebrow}>PLANEJAMENTO</p><h1 className={styles.title}>Agenda</h1>
              <p className={styles.subtitle}>Atendimentos agendados no ProAR.</p>
              <div className={styles.sectionHeading}><button type="button" aria-pressed={agendaMode==="day"} onClick={()=>setAgendaMode("day")}>Dia</button><button type="button" aria-pressed={agendaMode==="week"} onClick={()=>setAgendaMode("week")}>Semana</button></div>{agendaMode==="week"&&<p>Semana de {formatDate(week[0]||day)} a {formatDate(week[6]||day)}</p>}
              <label className={styles.dayPicker}>Selecionar data <input type="date" value={day} onChange={event=>setDay(event.target.value)}/></label>
              <div className={styles.sectionHeading}><h2>{agendaOrders.length} atendimento(s)</h2><button type="button" onClick={()=>setDay(todayISO())}>Hoje</button></div>
              {agendaOrders.length ? agendaOrders.map(order=><OrderCard key={order.id} order={order} onOpen={()=>setSelected(order.id)}/>) : <div className={styles.empty}>Nenhum atendimento para {agendaMode==="week"?"esta semana":formatDate(day)}.</div>}
            </section>}
            {tab === "ordens" && <section className={styles.screen}>
              <p className={styles.eyebrow}>OPERAÇÃO</p><h1 className={styles.title}>Ordens de serviço</h1>
              <div className={styles.orderStats} aria-label="Resumo de ordens">
                <span><strong>{filterFieldOrders(orders,"","open",todayISO()).length}</strong>Abertas</span>
                <span><strong>{filterFieldOrders(orders,"","active",todayISO()).length}</strong>Em andamento</span>
                <span><strong>{filterFieldOrders(orders,"","completed",todayISO()).length}</strong>Concluídas</span>
              </div>
              <label className={styles.search}><Search size={18}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar OS, cliente ou equipamento" aria-label="Buscar atendimento"/></label>
              <div className={styles.filterChips} role="group" aria-label="Filtrar ordens">
                {([["all","Todas"],["today","Hoje"],["open","Abertas"],["active","Em andamento"],...(data.user.manager?[["completed","Concluídas"],["cancelled","Canceladas"]]:[]),...(showMoreOrderFilters?[["overdue","Atrasadas"],["upcoming","Próximas"],...(data.user.manager?[["unassigned","Sem técnico"]]:[])]:[])] as [OrderFilter,string][]).map(([key,label])=><button key={key} type="button" aria-pressed={orderFilter===key} onClick={()=>{setOrderFilter(key);setVisibleLimit(100);}}>{label}</button>)}
                <button type="button" aria-expanded={showMoreOrderFilters} onClick={()=>setShowMoreOrderFilters(v=>!v)}>{showMoreOrderFilters?"Menos filtros":"Mais filtros"}</button>
              </div>
              <div className={styles.orderToolbar}><strong>{filtered.length} resultado(s)</strong><button type="button" onClick={()=>setFavoriteFilter(orderFilter)} title="Salvar filtro favorito">★ {favoriteFilter===orderFilter?"Favorito":"Salvar filtro"}</button>{favoriteFilter&&<button type="button" onClick={()=>{setOrderFilter(favoriteFilter);setVisibleLimit(100);}}>Meu filtro</button>}<button type="button" aria-pressed={groupOrders} onClick={()=>setGroupOrders(v=>!v)}>{groupOrders?"Lista":"Agrupar"}</button><label>Ordenar <select value={orderSort} onChange={e=>setOrderSort(e.target.value as typeof orderSort)}><option value="date">Mais antigas</option><option value="recent">Mais recentes</option><option value="client">Cliente</option></select></label><button type="button" aria-pressed={compactOrders} onClick={()=>setCompactOrders(v=>!v)}>{compactOrders?"Detalhado":"Compacto"}</button></div>
              {sortedOrders.length ? (groupOrders?groupedOrders.map(group=><div key={group.label}><h2 className={styles.orderGroupTitle}>{group.label} · {group.orders.length}</h2>{group.orders.map(order=><OrderCard key={order.id} order={order} compact={compactOrders} onOpen={()=>setSelected(order.id)}/>)}</div>):sortedOrders.slice(0,visibleLimit).map(order=><OrderCard key={order.id} order={order} compact={compactOrders} onOpen={()=>setSelected(order.id)}/>)) : <div className={styles.empty}>Nenhuma OS encontrada com esse filtro.</div>}
              {filtered.length>visibleLimit&&<button className={styles.secondaryAction} type="button" onClick={()=>setVisibleLimit(limit=>limit+100)}>Carregar mais OS ({filtered.length-visibleLimit} restantes)</button>}
            </section>}
            {tab === "mais" && <section className={styles.screen}>
              <p className={styles.eyebrow}>PERFIL E CONTROLE</p><h1 className={styles.title}>Mais</h1>
              <MobileThemeControl theme={appearance.theme} onChange={appearance.changeTheme} notice={appearance.storageNotice}/>
              <MobileRecoveryPanel key={data.user.scope} scope={data.user.scope} orderIds={orders.map(o=>o.id)} readAt={data.lastReadAt} onCentral={()=>setTab("central")} onSessionExpired={()=>void refresh()} onResume={draft=>{if(draft.orderSnapshot){setRecovery({scope:data.user.scope,order:draft.orderSnapshot});setSelected(draft.orderSnapshot.id);setTab("ordens");}}}/>
              <div className={styles.profile}><div className={styles.avatar}><UserRound size={26}/></div><div><strong>{data.user.displayName}</strong><span>{data.user.role}</span></div></div>
              <div className={styles.detailCard}><h2><ShieldCheck size={20}/> Integração segura</h2><p>O aplicativo utiliza sua sessão do ProAR, respeita a empresa e mostra somente as OS permitidas para o perfil. Não há usuários ou atendimentos fictícios.</p>
              <p><strong>Sincronização:</strong> OS podem ser preparadas offline e ficam pendentes até sincronizar. Jornada, GPS, permissões e conflitos são validados no envio; checklist da frota, abastecimento e ajustes também usam fila local.</p>
              <p><strong>Última leitura:</strong> {new Date(data.lastReadAt).toLocaleString("pt-BR")}</p></div>
              <div className={styles.detailCard}><h2>Versão do aplicativo</h2><p>ProAR Mobile • {MOBILE_RELEASE}</p><button type="button" className={styles.secondaryAction} onClick={()=>void checkVersion()}>Verificar atualizações</button>{versionNotice&&<p role="status">{versionNotice}</p>}{updateAvailable&&<button type="button" className={styles.primaryAction} onClick={()=>window.location.reload()}>Carregar nova versão</button>}</div>
              <div className={styles.detailCard}><h2>Recursos de campo</h2><p>Abra a Central para consultar frota, abastecimentos, marcações operacionais e ajustes. A gestão acompanha jornadas e recebe SOS. Localização em segundo plano exige APK Android atualizado.</p><p>Reconhecimento facial, ponto legal REP-P, OCR, áudio SOS, IA por voz e comunicação entre aparelhos dependem das integrações específicas.</p></div>
              <Link className={styles.secondaryAction} href="/">Abrir ProAR completo <ArrowRight size={17}/></Link>
            </section>}
          </>}
        </>}
      </main>
      <nav className={styles.bottomNav} aria-label="Navegação ProAR Mobile">
        {tabs.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" aria-current={tab===item.id&&!selected?"page":undefined} className={`${styles.navItem} ${tab===item.id&&!selected?styles.navActive:""}`} onClick={()=>{setSelected(null);setTab(item.id)}}><Icon size={22}/><span>{item.label}</span></button>})}
      </nav>
      <footer className={styles.footer}><span><Wifi size={12}/> {online ? "Rede disponível" : "Offline"}</span><span>ProAR Mobile · operação integrada</span></footer>
    </div>
  </div>;
}


