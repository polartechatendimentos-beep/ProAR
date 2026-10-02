"use client";
import { useState } from "react";
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, Bell, Boxes, CalendarDays, ChartNoAxesCombined, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, FileChartColumn, FileText, Filter, MoreHorizontal, ShieldCheck, ShoppingBag, ShoppingCart, TrendingUp, UsersRound, WalletCards, Zap } from "lucide-react";
import { deriveOperationalActions } from "@/lib/action-center";

type DashboardOrder = { id:string; client:string; unit:string; service:string; tech:string; date:string; time:string; status:string; tone:string; avatar:string };
type DashboardRecord = { id:string; name:string; category?:string; transactionType?:"Pagar"|"Receber"; value?:number; settledValue?:number; status?:string; date?:string; firstDueDate?:string; [key:string]:unknown };

export function DashboardWorkspace({ onNavigate, serviceOrders, modules, role }: { onNavigate: (s: string) => void; serviceOrders: DashboardOrder[]; modules: Record<string, DashboardRecord[]>; role?: string }) {
  const [period, setPeriod] = useState("Este mês");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [technician, setTechnician] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const startOfPeriod = (() => {
    const date = new Date(today);
    if (period === "Hoje") return todayIso;
    if (period === "Semana") { date.setDate(today.getDate() - ((today.getDay() + 6) % 7)); return date.toISOString().slice(0,10); }
    if (period === "Ano") return `${today.getFullYear()}-01-01`;
    return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`;
  })();
  const periodOrders = serviceOrders.filter(order => {
    const inPeriod = Boolean(order.date && order.date >= startOfPeriod && order.date <= todayIso);
    const techOk = technician === "Todos" || order.tech === technician;
    const statusOk = status === "Todos" || order.status === status;
    return inPeriod && techOk && statusOk;
  });
  const todayOrders = serviceOrders.filter(order => order.date === todayIso && (technician === "Todos" || order.tech === technician) && (status === "Todos" || order.status === status));
  const overdueOrders = serviceOrders.filter(order => order.date && order.date < todayIso && !/conclu[ií]d|cancelad/i.test(order.status) && (technician === "Todos" || order.tech === technician) && (status === "Todos" || order.status === status));
  const workItems = deriveOperationalActions(serviceOrders, modules).slice(0, 8);
  const financialRecords = (modules.Financeiro ?? []).filter(record => {
    const date = String(record.date || record.firstDueDate || "").slice(0,10);
    return !date || (date >= startOfPeriod && date <= todayIso);
  });
  const isPayable = (record: DashboardRecord) => record.transactionType === "Pagar" || /pagar|compra|fornecedor/i.test(`${record.name} ${record.category}`);
  const outstandingFinancial = (record: DashboardRecord) => /cancelad/i.test(record.status || "") ? 0 : Math.max(0, Number(record.value || 0) - Number(record.settledValue || 0));
  const receivableOpen = financialRecords.filter(record => !isPayable(record)).reduce((sum,record)=>sum+outstandingFinancial(record),0);
  const payableOpen = financialRecords.filter(record => isPayable(record)).reduce((sum,record)=>sum+outstandingFinancial(record),0);
  const predictedResult = receivableOpen - payableOpen;
  const moneyDashboard = (value:number) => value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const technicians = ["Todos", ...Array.from(new Set(serviceOrders.map(order=>order.tech).filter(Boolean)))];
  const statuses = ["Todos", ...Array.from(new Set(serviceOrders.map(order=>order.status).filter(Boolean)))];
  const roleShortcuts = /t[eé]cnico/i.test(role || "") ? [
    { label:"Minha agenda", module:"Agenda", icon:CalendarDays },
    { label:"Ordens de serviço", module:"Ordens de serviço", icon:ClipboardList },
    { label:"Equipamentos", module:"Equipamentos", icon:Boxes },
    { label:"PMOC", module:"PMOC e conformidade", icon:ShieldCheck },
  ] : /finance/i.test(role || "") ? [
    { label:"Financeiro", module:"Financeiro", icon:WalletCards },
    { label:"Central de pendências", module:"Central de pendências", icon:Bell },
    { label:"Compras", module:"Compras", icon:ShoppingCart },
    { label:"Relatórios", module:"Relatórios", icon:FileChartColumn },
  ] : /vendedor/i.test(role || "") ? [
    { label:"Clientes", module:"Clientes", icon:UsersRound },
    { label:"Orçamentos", module:"Orçamentos", icon:FileText },
    { label:"Vendas", module:"Vendas", icon:ShoppingBag },
    { label:"Central de pendências", module:"Central de pendências", icon:Bell },
  ] : [
    { label:"Central de pendências", module:"Central de pendências", icon:Bell },
    { label:"Ordens de serviço", module:"Ordens de serviço", icon:ClipboardList },
    { label:"Financeiro", module:"Financeiro", icon:WalletCards },
    { label:"Relatórios", module:"Relatórios", icon:FileChartColumn },
  ];
  const dashboardStats = [
    { icon: ClipboardList, value: String(periodOrders.filter(order => !/conclu[ií]d|cancelad/i.test(order.status)).length).padStart(2, "0"), label: "OS em aberto", note: `${todayOrders.length} programada(s) para hoje`, tone: "blue", trend: period, module:"Ordens de serviço" },
    { icon: Activity, value: String(periodOrders.filter(order => /Em andamento/i.test(order.status)).length).padStart(2, "0"), label: "Em andamento", note: "Atendimentos ativos no período", tone: "cyan", trend: period, module:"Ordens de serviço" },
    { icon: CheckCircle2, value: String(periodOrders.filter(order => /Conclu[ií]da/i.test(order.status)).length).padStart(2, "0"), label: "Concluídas", note: "Concluídas no período selecionado", tone: "green", trend: period, module:"Ordens de serviço" },
    { icon: AlertTriangle, value: String(overdueOrders.length).padStart(2, "0"), label: "Atrasadas", note: overdueOrders.length ? "Exigem ação imediata" : "Nenhuma pendência", tone: "red", trend: "Agora", module:"Central de pendências" },
  ];
  return <>
    <section className="role-shortcuts" aria-label="Atalhos do perfil">
      {roleShortcuts.map(({label,module,icon:Icon})=><button key={module} onClick={()=>onNavigate(module)}><Icon size={16}/><span>{label}</span><ChevronRight size={14}/></button>)}
    </section>
    <section className="command-row">
      <div className="periods">{["Hoje", "Semana", "Este mês", "Ano"].map(p => <button className={period === p ? "active" : ""} onClick={() => setPeriod(p)} key={p}>{p}</button>)}</div>
      <div className="live-status"><i/><span>Dados atualizados agora</span></div>
      <button className={`filter-btn ${filtersOpen?"active":""}`} onClick={()=>setFiltersOpen(value=>!value)} aria-expanded={filtersOpen}><Filter size={14}/> Mais filtros <ChevronDown size={13}/></button>
    </section>
    {filtersOpen && <section className="dashboard-filters" aria-label="Filtros do painel">
      <label>Técnico<select value={technician} onChange={event=>setTechnician(event.target.value)}>{technicians.map(item=><option key={item}>{item}</option>)}</select></label>
      <label>Situação<select value={status} onChange={event=>setStatus(event.target.value)}>{statuses.map(item=><option key={item}>{item}</option>)}</select></label>
      <button className="outline-btn" onClick={()=>{setTechnician("Todos");setStatus("Todos");}}>Limpar filtros</button>
    </section>}
    <section className="stat-grid">{dashboardStats.map(({icon: Icon, module, ...s}) => <article className={`stat-card ${s.tone}`} key={s.label} role="button" tabIndex={0} onClick={()=>onNavigate(module)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onNavigate(module)}}}>
      <div className="stat-top"><div className={`stat-icon ${s.tone}`}><Icon size={21} strokeWidth={1.8}/></div><span className={`trend ${s.tone}`}>{s.trend}</span></div>
      <div className="stat-value"><strong>{s.value}</strong><span>{s.label}</span></div><small>{s.note}</small>
      <button aria-label={`Detalhes de ${s.label}`} onClick={event=>{event.stopPropagation();onNavigate(module)}}><ChevronRight size={15}/></button>
    </article>)}</section>
    <section className="content-grid">
      <div className="panel orders-panel">
        <div className="panel-head"><div><span className="section-kicker"><Zap size={12}/> OPERAÇÃO DE HOJE</span><h2>Ordens de serviço</h2><p>{today.toLocaleDateString("pt-BR")}</p></div><button onClick={() => onNavigate("Agenda")}>Ver agenda completa <ArrowRight size={13}/></button></div>
        <div className="table-wrap"><table><thead><tr><th>ORDEM</th><th>CLIENTE / UNIDADE</th><th>SERVIÇO</th><th>TÉCNICO</th><th>HORÁRIO</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>
          {todayOrders.map(o => <tr key={o.id}><td><b className="order-id">{o.id}</b></td><td><div className="client-cell"><span>{o.avatar}</span><div><strong>{o.client}</strong><small>{o.unit}</small></div></div></td><td>{o.service}</td><td><div className="tech"><span>{o.tech.split(" ").map(x => x[0]).slice(0,2).join("")}</span>{o.tech}</div></td><td><div className="time"><Clock3 size={12}/><b>{o.time}</b></div></td><td><span className={`status ${o.tone}`}><i/> {o.status}</span></td><td><button className="more" aria-label={`Abrir ${o.id}`} onClick={()=>onNavigate("Ordens de serviço")}><ChevronRight size={16}/></button></td></tr>)}
        </tbody></table></div>
        {!todayOrders.length && <div className="linked-empty"><CalendarDays size={22}/><h4>Nenhum atendimento para hoje</h4><p>As ordens com data agendada aparecerão aqui.</p></div>}
      </div>
      <aside className="side-stack">
        <div className="panel financial">
          <div className="panel-head"><div><span className="section-kicker"><ChartNoAxesCombined size={12}/> PERFORMANCE</span><h2>Resumo financeiro</h2><p>{financialRecords.length ? `${financialRecords.length} título(s) no período` : "Sem lançamentos no período"}</p></div><button aria-label="Abrir financeiro" onClick={()=>onNavigate("Financeiro")}><MoreHorizontal size={17}/></button></div>
          <div className="finance-total"><small>RESULTADO PREVISTO</small><strong>{moneyDashboard(predictedResult)}</strong><span><TrendingUp size={12}/> {period}</span></div>
          <div className="finance-split"><div><span className="money-icon green"><ArrowUpRight size={17}/></span><small>A receber</small><strong>{moneyDashboard(receivableOpen)}</strong></div><div><span className="money-icon red"><ArrowDownRight size={17}/></span><small>A pagar</small><strong>{moneyDashboard(payableOpen)}</strong></div></div>
        </div>
        <div className="panel alerts">
          <div className="panel-head"><div><span className="section-kicker"><AlertTriangle size={12}/> CENTRAL DE TRABALHO DO DIA</span><h2>Próximas ações</h2><p>Somente o que precisa de atenção agora.</p></div><button className="outline-btn compact" onClick={()=>onNavigate("Central de pendências")}>{workItems.length} ação(ões)</button></div>
          {workItems.length ? <div className="workday-list">{workItems.map(item=><button key={item.id} className={item.tone} onClick={()=>onNavigate(item.module)}><i/><span><b>{item.title}</b><small>{item.detail}</small></span><ChevronRight size={15}/></button>)}</div> : <div className="linked-empty"><CheckCircle2 size={22}/><h4>Tudo certo por aqui</h4><p>Não há ações operacionais pendentes.</p></div>}
        </div>
      </aside>
    </section>
  </>;
}
