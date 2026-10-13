"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, CalendarDays, ChevronRight,
  ClipboardList, CloudOff, Home, MapPin, Menu, RefreshCw,
  Search, ShieldCheck, Smartphone, UserRound, Wrench, Wifi,
} from "lucide-react";
import { MobileRouteControls } from "./MobileRouteControls";
import { FieldSupportPanel } from "./FieldSupportPanel";
import { FieldOrderEditor } from "./FieldOrderEditor";
import type { MobileFieldOrder } from "@/lib/mobile-field";
import styles from "./ProARFieldMobile.module.css";

type FieldOrder = MobileFieldOrder;
type FieldData = {
  connected: boolean; stateFound: boolean; mode: "operational";
  user: { displayName: string; role: string; canEdit: boolean; canApprove: boolean; scope:string; linkedEmployee: boolean; manager: boolean };
  orders: FieldOrder[];
  summary: { today: number; inProgress: number; pending: number };
  lastReadAt: string; notice: string;
};
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
  return <button type="button" className={styles.orderCard} onClick={onOpen} aria-label={`Consultar ${order.id}`}>
    <span className={styles.orderTop}><strong>{order.id}</strong><span className={`${styles.status} ${statusTone(order.status)}`}>{order.status || "Sem status"}</span></span>
    <span className={styles.orderTitle}>{order.service || "Atendimento técnico"}</span>
    <span className={styles.orderClient}>{order.client || "Cliente não identificado"}</span>
    <span className={styles.orderMuted}>{[order.unit, order.equipmentIds.length ? `${order.equipmentIds.length} equipamento(s)` : ""].filter(Boolean).join(" · ")}</span>
    <span className={styles.orderBottom}><span><CalendarDays size={14}/>{formatDate(order.date)} · {displayTime(order.time)}</span><ChevronRight size={18}/></span>
  </button>;
}

export function ProARFieldMobile() {
  const [tab, setTab] = useState<Tab>("inicio");
  const [data, setData] = useState<FieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [online, setOnline] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [day, setDay] = useState(todayISO);
  const [completion,setCompletion]=useState<{orderId:string;completedAt:string}|null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!navigator.onLine) throw new Error("Sem conexão. O ProAR Field ainda não possui sincronização offline segura.");
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
  const orders = data?.orders ?? [];
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return orders.filter(order => !term || [order.id, order.client, order.service, order.unit, order.status, ...order.equipmentIds].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  }, [orders, query]);
  const todayOrders = useMemo(() => orders.filter(order => order.date === todayISO()), [orders]);
  const agendaOrders = useMemo(() => orders.filter(order => order.date === day), [orders, day]);
  const current = orders.find(order => order.id === selected);
  const firstName = data?.user.displayName?.split(" ")[0] || "equipe";
  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id:"inicio", label:"Início", icon:Home },
    { id:"agenda", label:"Agenda", icon:CalendarDays },
    { id:"ordens", label:"Ordens", icon:ClipboardList },
    { id:"central", label:"Central", icon:ShieldCheck },
    { id:"mais", label:"Mais", icon:Menu },
  ];
  return <div className={styles.app}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}><span className={styles.brandIcon}><Wrench size={19}/></span><span><strong>ProAR <b>Field</b></strong><small>OPERAÇÃO EM CAMPO</small></span></div>
        <div className={styles.headerRight}>
          <span className={`${styles.connection} ${online && !error ? styles.connectionOn : styles.connectionOff}`}><span className={styles.connectionDot}/>{online && !error ? "Conectado" : "Sem sincronização"}</span>
          <button type="button" className={styles.iconButton} aria-label="Atualizar dados" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={19} className={loading ? styles.spin : ""}/></button>
        </div>
      </header>
      <main className={styles.content}>
        {!online && <div className={styles.warning}><CloudOff size={19}/>Sem conexão. Você pode preencher o rascunho da OS neste aparelho. A gravação no servidor e a conclusão precisam de conexão.</div>}
        {completion&&<div role="status" className={styles.detailCard}><h2>OS concluída • {completion.orderId}</h2><p>Confirmada no servidor em {new Date(completion.completedAt).toLocaleString("pt-BR")}.</p><button type="button" className={styles.secondaryAction} onClick={()=>setCompletion(null)}>Fechar confirmação</button></div>}
        {error && <div role="alert" className={styles.error}>{error}{loginRequired && <Link href="/">Entrar no ProAR</Link>}{!loginRequired && <button type="button" onClick={()=>void refresh()}>Tentar novamente</button>}</div>}
        {loading && !data && <div role="status" className={styles.loading}>Conectando aos atendimentos reais do ProAR...</div>}
        {data && <>
          <details className={styles.journeyPanel}><summary>Minha jornada • entrada, pausa e saída</summary><MobileRouteControls /></details>
          <FieldSupportPanel visible={tab === "central" && !current}/>
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
            {current.address && <a className={styles.primaryAction} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(current.address)}`} target="_blank" rel="noopener noreferrer"><MapPin size={18}/> Abrir rota no mapa <ArrowRight size={18}/></a>}
            {!data.user.canEdit && <p role="alert" className={styles.warning}>Seu perfil não tem permissão para alterar esta OS. Solicite a liberação ao administrador.</p>}
            {data.user.canEdit && <FieldOrderEditor key={`${current.id}:${current.fieldVersion}`} scope={data.user.scope} canApprove={data.user.canApprove} order={current} requiresJourney={/tecnico|prestador/i.test(data.user.role.normalize("NFD").replace(/[\u0300-\u036f]/g,""))} onSaved={async result=>{if(result){setCompletion(result);setSelected(null);setTab("ordens");setData(previous=>previous?{...previous,orders:previous.orders.filter(order=>order.id!==result.orderId)}:previous);}await refresh();}}/>}
            <p className={styles.disclaimer}>Alterações são confirmadas no banco. Durante a pausa ou fora da jornada, técnicos podem apenas consultar.</p>
          </section> : <>
            {tab === "inicio" && <section className={styles.screen}>
              <p className={styles.eyebrow}>PAINEL OPERACIONAL</p>
              <h1 className={styles.title}>Olá, {firstName}<span className={styles.titleAccent}>.</span></h1>
              <p className={styles.subtitle}>Seus atendimentos em aberto conectados ao ProAR.</p>
              <div className={styles.hero}>
                <span className={styles.heroTop}><Smartphone size={18}/> PROAR FIELD · DADOS REAIS</span>
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
              <label className={styles.dayPicker}>Selecionar data <input type="date" value={day} onChange={event=>setDay(event.target.value)}/></label>
              <div className={styles.sectionHeading}><h2>{agendaOrders.length} atendimento(s)</h2><button type="button" onClick={()=>setDay(todayISO())}>Hoje</button></div>
              {agendaOrders.length ? agendaOrders.map(order=><OrderCard key={order.id} order={order} onOpen={()=>setSelected(order.id)}/>) : <div className={styles.empty}>Nenhum atendimento para {formatDate(day)}.</div>}
            </section>}
            {tab === "ordens" && <section className={styles.screen}>
              <p className={styles.eyebrow}>OPERAÇÃO</p><h1 className={styles.title}>Ordens de serviço</h1>
              <p className={styles.subtitle}>Busque por OS, cliente, serviço ou equipamento.</p>
              <label className={styles.search}><Search size={19}/><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar atendimento" aria-label="Buscar atendimento"/></label>
              <div className={styles.sectionHeading}><h2>{filtered.length} resultado(s)</h2></div>
              {filtered.length ? filtered.map(order=><OrderCard key={order.id} order={order} onOpen={()=>setSelected(order.id)}/>) : <div className={styles.empty}>Nenhuma OS encontrada com esse filtro.</div>}
            </section>}
            {tab === "mais" && <section className={styles.screen}>
              <p className={styles.eyebrow}>PERFIL E CONTROLE</p><h1 className={styles.title}>Mais</h1>
              <div className={styles.profile}><div className={styles.avatar}><UserRound size={26}/></div><div><strong>{data.user.displayName}</strong><span>{data.user.role}</span></div></div>
              <div className={styles.detailCard}><h2><ShieldCheck size={20}/> Integração segura</h2><p>O aplicativo utiliza sua sessão do ProAR, respeita a empresa e mostra somente as OS permitidas para o perfil. Não há usuários ou atendimentos fictícios.</p>
              <p><strong>Sincronização:</strong> OS e jornada com confirmação online; checklist da frota, abastecimento e solicitações de ajuste podem aguardar na fila local.</p>
              <p><strong>Última leitura:</strong> {new Date(data.lastReadAt).toLocaleString("pt-BR")}</p></div>
              <div className={styles.detailCard}><h2>Recursos de campo</h2><p>Abra a Central para consultar frota, abastecimentos, marcações operacionais e ajustes. A gestão acompanha jornadas e recebe SOS. Localização em segundo plano exige APK Android atualizado.</p><p>Reconhecimento facial, ponto legal REP-P, OCR, áudio SOS, IA por voz e comunicação entre aparelhos dependem das integrações específicas.</p></div>
              <Link className={styles.secondaryAction} href="/">Abrir ProAR completo <ArrowRight size={17}/></Link>
            </section>}
          </>}
        </>}
      </main>
      <nav className={styles.bottomNav} aria-label="Navegação ProAR Field">
        {tabs.map(item=>{const Icon=item.icon;return <button key={item.id} type="button" aria-current={tab===item.id&&!selected?"page":undefined} className={`${styles.navItem} ${tab===item.id&&!selected?styles.navActive:""}`} onClick={()=>{setSelected(null);setTab(item.id)}}><Icon size={22}/><span>{item.label}</span></button>})}
      </nav>
      <footer className={styles.footer}><span><Wifi size={12}/> {online ? "Rede disponível" : "Offline"}</span><span>ProAR Field · operação integrada</span></footer>
    </div>
  </div>;
}

