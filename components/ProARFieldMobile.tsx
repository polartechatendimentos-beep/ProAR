"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronRight,
  ClipboardList, CloudOff, Home, MapPin, Menu, RefreshCw,
  Search, ShieldCheck, Smartphone, UserRound, Wifi,
} from "lucide-react";
import { MobileRouteControls } from "./MobileRouteControls";
import { FieldSupportPanel } from "./FieldSupportPanel";
import { FieldOrderReceipt } from "./FieldOrderReceipt";
import { listPendingOrderDrafts } from "@/lib/mobile-order-drafts";
import { MOBILE_RELEASE } from "@/lib/mobile-release";
import { filterFieldOrders, fieldOrderTone, type OrderFilter } from "@/lib/mobile-order-display";
import { FieldOrderEditor } from "./FieldOrderEditor";
import { mobileWeekDates } from "@/lib/mobile-agenda";
import type { MobileFieldOrder } from "@/lib/mobile-field";
import styles from "./ProARFieldMobile.module.css";
import {MobileThemeControl,useMobileTheme} from "./MobileThemeControl";
import {mobileSupervision} from "@/lib/mobile-experience";

type FieldOrder = MobileFieldOrder;
type FieldData = {
  connected: boolean; stateFound: boolean; mode: "operational";
  user: { displayName: string; role: string; canEdit: boolean; canApprove: boolean; scope:string; linkedEmployee: boolean; manager: boolean };
  orders: FieldOrder[];
  summary: { today: number; inProgress: number; pending: number };
  lastReadAt: string; notice: string;
};
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
  if (/conclu[ií]d|finalizad|encerrad/i.test(value)) return styles.statusDone;
  if (/andamento|execu[cç][aã]o|iniciad/i.test(value)) return styles.statusActive;
  if (/cancelad|atrasad/i.test(value)) return styles.statusAlert;
  return styles.statusPending;
}
function displayTime(value: string) {
  return /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : value || "A definir";
}
function OrderCard({ order, onOpen }: { order: FieldOrder; onOpen: () => void }) {
  return <button type="button" className={`${styles.orderCard} ${styles[`${fieldOrderTone(order,todayISO())}Card`]}`} onClick={onOpen} aria-label={`Consultar ${order.id}`}>
    <span className={styles.orderTop}><strong>{order.id}</strong><span className={`${styles.status} ${statusTone(order.status)}`}>{order.status || "Sem status"}</span></span>
    <span className={styles.orderTitle}>{order.service || "Atendimento técnico"}</span>
    <span className={styles.orderClient}>{order.client || "Cliente não identificado"}</span>
    <span className={styles.orderMuted}>{[order.unit, order.equipmentIds.length ? `${order.equipmentIds.length} equipamento(s)` : ""].filter(Boolean).join(" · ")}</span>
    <span className={styles.orderBottom}><span><CalendarDays size={14}/>{formatDate(order.date)} · {displayTime(order.time)}</span><ChevronRight size={18}/></span>
  </button>;
}

export function ProARFieldMobile() {
  const appearance=useMobileTheme();
  const [tab, setTab] = useState<Tab>("inicio");
  const [data, setData] = useState<FieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sunlightMode, setSunlightMode] = useState(false);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [online, setOnline] = useState(true);
  const [query, setQuery] = useState("");
  const [orderFilter,setOrderFilter]=useState<OrderFilter>("all"),[pendingState,setPendingState]=useState<{scope:string;orders:FieldOrder[]}>({scope:"",orders:[]}),[versionNotice,setVersionNotice]=useState(""),[updateAvailable,setUpdateAvailable]=useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState(todayISO);
  const [agendaMode,setAgendaMode]=useState<"day"|"week">("day");
  const [mapApp,setMapApp]=useState("google");
  const [completion,setCompletion]=useState<{orderId:string;completedAt:string}|null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!navigator.onLine) throw new Error("Sem conexão. Os rascunhos e envios pendentes permanecem no aparelho; conecte para confirmar o envio.");
      const response = await fetch("/api/mobile/bootstrap", { cache:"no-store", credentials:"same-origin" });
      const result = await response.json();
      if (!response.ok) {
        setLoginRequired(response.status === 401);
        if(response.status===401||response.status===403){setData(null);setSelected(null);}
        throw new Error(result.error || "Não foi possível carregar os atendimentos.");
      }
      setLoginRequired(false);
      setData(result as FieldData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha de conexão com o ProAR.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    setOnline(navigator.onLine);
    const change = () => setOnline(navigator.onLine);
    const focus = () => { if (navigator.onLine) void refresh(); };
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    window.addEventListener("focus", focus);
    void refresh();
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  const orders = data?.orders ?? EMPTY_ORDERS;
  const pendingOrders=pendingState.scope===data?.user.scope?pendingState.orders:EMPTY_ORDERS;
  const filtered = useMemo(()=>filterFieldOrders(orders,query,orderFilter,todayISO()),[orders,query,orderFilter]);
  const pendingScope=data?.user.scope;
  useEffect(()=>{
    if(!pendingScope)return;
    let cancelled=false;
    void listPendingOrderDrafts(pendingScope).then(rows=>{if(!cancelled)setPendingState({scope:pendingScope,orders:rows.map(row=>row.orderSnapshot!)});}).catch(()=>{if(!cancelled)setPendingState({scope:pendingScope,orders:[]});});
    return()=>{cancelled=true;};
  },[pendingScope,selected,data?.lastReadAt]);
  async function checkVersion(){try{const response=await fetch("/api/mobile/version",{cache:"no-store"});if(!response.ok)throw new Error();const result=await response.json();const changed=result.version!==MOBILE_RELEASE;setUpdateAvailable(changed);setVersionNotice(changed?"Nova versão disponível. Seus rascunhos permanecem neste aparelho.":"Você está usando a versão atual.");}catch{setVersionNotice("Não foi possível consultar a versão. Tente novamente com conexão.");}}
  const todayOrders = useMemo(() => orders.filter(order => order.date === todayISO()), [orders]);
  const week=useMemo(()=>mobileWeekDates(day),[day]);
  const agendaOrders = useMemo(() => orders.filter(order => agendaMode==="week"?week.includes(order.date):order.date === day), [orders, day,agendaMode,week]);
  const current = orders.find(order => order.id === selected)||pendingOrders.find(order=>order.id===selected);
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
        {!online && <div className={styles.warning}><CloudOff size={19}/>Sem conexão. Você pode preencher o rascunho da OS neste aparelho. Você também pode deixar o envio preparado e sincronizar ao retornar a conexão. A conclusão só é confirmada pelo servidor.</div>}
        {completion&&<div role="status" className={styles.successPanel}><h2>OS concluída • {completion.orderId}</h2><p>Confirmada no servidor em {new Date(completion.completedAt).toLocaleString("pt-BR")}.</p><FieldOrderReceipt orderId={completion.orderId}/><button type="button" className={styles.secondaryAction} onClick={()=>setCompletion(null)}>Fechar confirmação</button></div>}
        {error && <div role="alert" className={styles.error}>{error}{loginRequired && <Link href="/">Entrar no ProAR</Link>}{!loginRequired && <button type="button" onClick={()=>void refresh()}>Tentar novamente</button>}</div>}
        {loading && !data && <div role="status" aria-label="Carregando atendimentos" className={styles.skeletonGrid}><p>Conectando aos atendimentos reais do ProAR...</p>{[1,2,3].map(i=><div key={i} className={styles.skeletonCard} aria-hidden="true"/>)}</div>}
        {data && <>
          {pendingOrders.length>0&&!current&&<section className={styles.pendingPanel}><h2>{pendingOrders.length} envio(s) aguardando confirmação</h2><p>Retome cada envio para sincronizar ou consultar a confirmação, sem duplicar o registro.</p>{pendingOrders.map(order=><button key={order.id} type="button" className={styles.secondaryAction} onClick={()=>setSelected(order.id)}>Retomar envio • {order.id}</button>)}</section>}
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
              </dl>
            </div>
            {current.address && <><label className={styles.formLabel}>Aplicativo de navegação<select value={mapApp} onChange={e=>setMapApp(e.target.value)}><option value="google">Google Maps</option><option value="waze">Waze</option></select></label><a className={styles.primaryAction} href={mapApp==="waze"?`https://www.waze.com/ul?q=${encodeURIComponent(current.address)}&navigate=yes`:`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(current.address)}`} target="_blank" rel="noopener noreferrer"><MapPin size={18}/> Abrir navegação <ArrowRight size={18}/></a></>}
            {!data.user.canEdit && <p role="alert" className={styles.warning}>Seu perfil não tem permissão para alterar esta OS. Solicite a liberação ao administrador.</p>}
            {data.user.canEdit && <FieldOrderEditor key={`${current.id}:${current.fieldVersion}:${current.editToken}`} scope={data.user.scope} canApprove={data.user.canApprove} order={current} requiresJourney={/tecnico|prestador/i.test(data.user.role.normalize("NFD").replace(/[\u0300-\u036f]/g,""))} onSaved={async result=>{if(result){setCompletion(result);setSelected(null);setTab("ordens");setData(previous=>previous?{...previous,orders:previous.orders.filter(order=>order.id!==result.orderId)}:previous);}await refresh();}}/>}
            <p className={styles.disclaimer}>Alterações são confirmadas no banco. Durante a pausa ou fora da jornada, técnicos podem apenas consultar.</p>
          </section> : <>
            {tab === "inicio" && <section className={styles.screen}>
              <p className={styles.eyebrow}>PAINEL OPERACIONAL</p>
              <h1 className={styles.title}>Olá, {firstName}<span className={styles.titleAccent}>.</span></h1>
              <p className={styles.subtitle}>Seus atendimentos em aberto conectados ao ProAR.</p>
              <div className={styles.hero}>
                <span className={styles.heroTop}><Smartphone size={18}/> PROAR MOBILE · DADOS REAIS</span>
                <strong>{data.summary.today}</strong>
                <span>ordens programadas para hoje</span>
                <div className={styles.heroBottom}><span>Somente OS em aberto</span><span>{todayISO().split("-").reverse().join("/")}</span></div>
              </div>
              <div className={styles.metrics}>
                <div><strong>{data.summary.inProgress}</strong><span>Em andamento</span></div>
                <div><strong>{data.summary.pending}</strong><span>Pendentes</span></div>
              </div>
              <div className={styles.sectionHeading}><h2>Atendimentos de hoje</h2><button type="button" onClick={()=>setTab("agenda")}>Ver agenda <ArrowRight size={14}/></button></div>
              {todayOrders.length ? todayOrders.slice(0, 8).map(order=><OrderCard key={order.id} order={order} onOpen={()=>setSelected(order.id)}/>) : <div className={styles.empty}>Nenhuma OS vinculada a você para hoje.</div>}
              <button type="button" className={styles.secondaryAction} onClick={()=>setTab("ordens")}>Consultar ordens em aberto <ArrowRight size={17}/></button>
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
              <p className={styles.subtitle}>Busque por OS, cliente, endereço, serviço ou equipamento.</p>
              <label className={styles.search}><Search size={19}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar atendimento" aria-label="Buscar atendimento"/></label>
              <div className={styles.filterChips} role="group" aria-label="Filtrar ordens">{([["all","Todas"],["today","Hoje"],["overdue","Atrasadas"],["upcoming","Próximas"]] as const).map(([key,label])=><button key={key} type="button" aria-pressed={orderFilter===key} onClick={()=>setOrderFilter(key)}>{label}</button>)}</div>
              <div className={styles.sectionHeading}><h2>{filtered.length} resultado(s)</h2></div>
              {filtered.length ? filtered.map(order=><OrderCard key={order.id} order={order} onOpen={()=>setSelected(order.id)}/>) : <div className={styles.empty}>Nenhuma OS encontrada com esse filtro.</div>}
            </section>}
            {tab === "mais" && <section className={styles.screen}>
              <p className={styles.eyebrow}>PERFIL E CONTROLE</p><h1 className={styles.title}>Mais</h1>
              <MobileThemeControl theme={appearance.theme} onChange={appearance.changeTheme} notice={appearance.storageNotice}/>
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


