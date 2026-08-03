"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Bell, Boxes, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined,
  CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList,
  Clock3, FileChartColumn, FileText, Filter, Grid2X2, HandCoins, Headphones,
  ArrowLeft, Camera, Contact, Edit3, Eye, EyeOff, Hospital, Landmark, LayoutDashboard, LogIn, LogOut, MapPin,
  CreditCard, Keyboard, Menu, Minus, MoreHorizontal, Package, Phone, Plus, ReceiptText, ScanBarcode, School, Search, Settings,
  ShieldCheck, ShoppingBag, ShoppingCart, Store, TrendingUp, UserCheck, UserRound,
  MessageCircle, Send, Wifi, PenTool, Tag, Trash2,
  UsersRound, WalletCards, Warehouse, Wrench, X, Zap
} from "lucide-react";

type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type NavItem = { icon: IconType; name: string; badge?: string };

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "VISÃO GERAL", items: [
    { icon: LayoutDashboard, name: "Painel inicial" },
    { icon: CalendarDays, name: "Agenda" },
    { icon: Bell, name: "Notificações" },
  ]},
  { label: "COMERCIAL", items: [
    { icon: UsersRound, name: "Clientes" },
    { icon: Boxes, name: "Equipamentos" },
    { icon: FileText, name: "Orçamentos" },
    { icon: ShoppingBag, name: "Vendas" },
  ]},
  { label: "OPERAÇÃO", items: [
    { icon: ClipboardList, name: "Ordens de serviço" },
    { icon: Wrench, name: "Serviços" },
    { icon: Package, name: "Produtos" },
    { icon: Warehouse, name: "Estoque" },
    { icon: ShoppingCart, name: "Compras" },
    { icon: Store, name: "Fornecedores" },
  ]},
  { label: "GESTÃO", items: [
    { icon: WalletCards, name: "Financeiro" },
    { icon: BriefcaseBusiness, name: "Funcionários" },
    { icon: FileChartColumn, name: "Relatórios" },
    { icon: Settings, name: "Configurações" },
  ]},
];

type ServiceOrder = {
  id: string; client: string; unit: string; service: string; tech: string;
  date: string; time: string; address: string; status: string; tone: string; avatar: string;
  checkInAt?: string;
  checkOutAt?: string;
  photoBefore?: string;
  photoAfter?: string;
  clientSignature?: string;
  technicianSignature?: string;
  catalogItems?: { id: string; name: string; kind: "Serviço" | "Produto" }[];
  reminderEnabled?: boolean;
  reminderAmount?: number;
  reminderUnit?: "Dias" | "Meses";
  reminderDate?: string;
  reminderMessage?: string;
  reminderStatus?: "Pendente" | "Agendado" | "Enviado";
};

type Customer = {
  id: string; name: string; doc: string; contact: string; phone: string;
  address: string; units: number; status: string;
};

type ModuleRecord = {
  id: string;
  name: string;
  client: string;
  description: string;
  createdAt: string;
  kind?: "Serviço" | "Produto";
  status?: string;
  date?: string;
  value?: number;
  category?: string;
  purchaseItems?: PurchaseItem[];
  paymentType?: "À vista" | "A prazo";
  paymentMethod?: string;
  installments?: number;
  firstDueDate?: string;
  paymentInstallments?: PurchaseInstallment[];
  purchaseId?: string;
  installmentNumber?: number;
  reminderMessage?: string;
  serviceOrderId?: string;
};

type PurchaseItem = {
  id: string;
  description: string;
  quantity: number;
  unitValue: number;
  productId?: string;
  registerProduct?: boolean;
};

type PurchaseInstallment = { number: string; dueDate: string; value: number };

const orders: ServiceOrder[] = [];
const customers: Customer[] = [];
const linkedUnits: Record<string, { icon: IconType; name: string; type: string; doc: string; responsible: string; phone: string; address: string; orders: number }[]> = {};
const linkedSectors: Record<string, { icon: IconType; name: string; type: string; doc: string; responsible: string; phone: string; address: string; orders: number }[]> = {};

function Header({ title, subtitle, onMenu, onNewOrder, userName, userRole, onLogout }: { title: string; subtitle: string; onMenu: () => void; onNewOrder: () => void; userName: string; userRole: string; onLogout: () => void }) {
  const today = new Date();
  return <header className="topbar">
    <div className="headline">
      <button className="menu-toggle" aria-label="Abrir menu" onClick={onMenu}><Menu size={20}/></button>
      <div className="header-module-mark"><img src="/icon.png" alt="ProAR"/></div>
      <div className="headline-copy"><div className="eyebrow"><span>PROAR</span><ChevronRight size={10}/><b>Central de operações</b></div><h1>{title}</h1><p>{subtitle}</p></div>
    </div>
    <div className="top-actions">
      <label className="global-search"><Search size={16}/><input aria-label="Pesquisa global" placeholder="Pesquisar no ProAR..." /><kbd>⌘ K</kbd></label>
      <div className="header-status"><span><ShieldCheck size={14}/></span><div><b>Sistema operacional</b><small>{today.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</small></div></div>
      <button className="icon-btn notification-button" aria-label="Notificações"><Bell size={18}/><i/></button>
      <button className="primary-btn" onClick={onNewOrder}><Plus size={17}/> Nova ordem</button>
      <div className="profile"><div className="profile-avatar">{userName.split(" ").map(word => word[0]).slice(0,2).join("").toUpperCase()}<span /></div><div><strong>{userName}</strong><small>{userRole}</small></div></div>
      <button className="icon-btn" aria-label="Sair do sistema" title="Sair do sistema" onClick={onLogout}><LogOut size={18}/></button>
    </div>
  </header>;
}

function Sidebar({ current, setCurrent, open, close, permissions }: { current: string; setCurrent: (s: string) => void; open: boolean; close: () => void; permissions?: string[] }) {
  const allowed = (name: string) => Boolean(permissions?.includes("*") || permissions?.includes(name));
  return <>
    {open && <button className="backdrop" aria-label="Fechar menu" onClick={close} />}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark brand-logo"><img src="/icon.png" alt="Ícone ProAR"/></div><div><strong>Pro<span>AR</span></strong><small>GESTÃO DE SERVIÇOS</small></div></div>
      <nav>{navGroups.map(group => { const visibleItems = group.items.filter(item => allowed(item.name)); return visibleItems.length ? <div className="nav-group" key={group.label}>
        <p>{group.label}</p>
        {visibleItems.map(({icon: Icon, name, badge}) => <button key={name} className={current === name ? "active" : ""} onClick={() => { setCurrent(name); close(); }}>
          <span className="nav-icon"><Icon size={17} strokeWidth={1.9}/></span><span>{name}</span>{badge && <em>{badge}</em>}
        </button>)}
      </div> : null; })}</nav>
      <div className="help-card"><div><Headphones size={17}/></div><strong>Suporte ProAR</strong><p>Conte com a nossa equipe sempre que precisar.</p><button>Falar com especialista <ArrowRight size={12}/></button></div>
      <div className="secure"><ShieldCheck size={13}/><span>Ambiente seguro</span><b>v2.0</b></div>
    </aside>
  </>;
}

function Dashboard({ onNavigate, serviceOrders }: { onNavigate: (s: string) => void; serviceOrders: ServiceOrder[] }) {
  const [period, setPeriod] = useState("Este mês");
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = serviceOrders.filter(order => order.date === today);
  const dashboardStats = [
    { icon: ClipboardList, value: String(serviceOrders.filter(order => order.status !== "Concluída").length).padStart(2, "0"), label: "OS em aberto", note: `${todayOrders.length} programada(s) para hoje`, tone: "blue", trend: "Atual" },
    { icon: Activity, value: String(serviceOrders.filter(order => order.status === "Em andamento").length).padStart(2, "0"), label: "Em andamento", note: "Atendimentos ativos", tone: "cyan", trend: "Agora" },
    { icon: CheckCircle2, value: String(serviceOrders.filter(order => order.status === "Concluída").length).padStart(2, "0"), label: "Concluídas", note: "Total registrado", tone: "green", trend: "Atual" },
    { icon: AlertTriangle, value: "00", label: "Atrasadas", note: "Nenhuma pendência", tone: "red", trend: "Atual" },
  ];
  return <>
    <section className="command-row">
      <div className="periods">{["Hoje", "Semana", "Este mês", "Ano"].map(p => <button className={period === p ? "active" : ""} onClick={() => setPeriod(p)} key={p}>{p}</button>)}</div>
      <div className="live-status"><i/><span>Dados atualizados agora</span></div>
      <button className="filter-btn"><Filter size={14}/> Mais filtros <ChevronDown size={13}/></button>
    </section>
    <section className="stat-grid">{dashboardStats.map(({icon: Icon, ...s}) => <article className={`stat-card ${s.tone}`} key={s.label}>
      <div className="stat-top"><div className={`stat-icon ${s.tone}`}><Icon size={21} strokeWidth={1.8}/></div><span className={`trend ${s.tone}`}>{s.trend}</span></div>
      <div className="stat-value"><strong>{s.value}</strong><span>{s.label}</span></div><small>{s.note}</small>
      <button aria-label={`Detalhes de ${s.label}`}><ChevronRight size={15}/></button>
    </article>)}</section>
    <section className="content-grid">
      <div className="panel orders-panel">
        <div className="panel-head"><div><span className="section-kicker"><Zap size={12}/> OPERAÇÃO DE HOJE</span><h2>Ordens de serviço</h2><p>{new Date().toLocaleDateString("pt-BR")}</p></div><button onClick={() => onNavigate("Agenda")}>Ver agenda completa <ArrowRight size={13}/></button></div>
        <div className="table-wrap"><table><thead><tr><th>ORDEM</th><th>CLIENTE / UNIDADE</th><th>SERVIÇO</th><th>TÉCNICO</th><th>HORÁRIO</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>
          {todayOrders.map(o => <tr key={o.id}><td><b className="order-id">{o.id}</b></td><td><div className="client-cell"><span>{o.avatar}</span><div><strong>{o.client}</strong><small>{o.unit}</small></div></div></td><td>{o.service}</td><td><div className="tech"><span>{o.tech.split(" ").map(x => x[0]).slice(0,2).join("")}</span>{o.tech}</div></td><td><div className="time"><Clock3 size={12}/><b>{o.time}</b></div></td><td><span className={`status ${o.tone}`}><i/> {o.status}</span></td><td><button className="more" aria-label={`Opções da ${o.id}`}><MoreHorizontal size={16}/></button></td></tr>)}
        </tbody></table></div>
        {!todayOrders.length && <div className="linked-empty"><CalendarDays size={22}/><h4>Nenhum atendimento para hoje</h4><p>As ordens com data agendada aparecerão aqui.</p></div>}
      </div>
      <aside className="side-stack">
        <div className="panel financial">
          <div className="panel-head"><div><span className="section-kicker"><ChartNoAxesCombined size={12}/> PERFORMANCE</span><h2>Resumo financeiro</h2><p>Sem lançamentos</p></div><button aria-label="Mais opções"><MoreHorizontal size={17}/></button></div>
          <div className="finance-total"><small>RESULTADO PREVISTO</small><strong>R$ 0,00</strong><span><TrendingUp size={12}/> 0%</span></div>
          <div className="finance-split"><div><span className="money-icon green"><ArrowUpRight size={17}/></span><small>A receber</small><strong>R$ 0,00</strong></div><div><span className="money-icon red"><ArrowDownRight size={17}/></span><small>A pagar</small><strong>R$ 0,00</strong></div></div>
        </div>
        <div className="panel alerts">
          <div className="panel-head"><div><span className="section-kicker"><AlertTriangle size={12}/> ATENÇÃO</span><h2>Alertas importantes</h2><p>Nenhum alerta registrado</p></div><span>0</span></div>
          <div className="linked-empty"><CheckCircle2 size={22}/><h4>Tudo certo por aqui</h4><p>Os alertas reais aparecerão neste painel.</p></div>
        </div>
      </aside>
    </section>
  </>;
}

function CustomerDetail({ customerName, customers, onBack, onOpen }: { customerName: string; customers: Customer[]; onBack: () => void; onOpen: (name: string) => void }) {
  const customer = customers.find(c => c.name === customerName);
  if (!customer) return null;
  const units = linkedUnits[customerName] ?? [
    { icon: Building2, name: "Matriz", type: "Unidade principal", doc: customer.doc, responsible: customer.contact, phone: customer.phone, address: customer.address, orders: 0 },
  ];
  const sectors = linkedSectors[customerName] ?? [];
  const linkedRecords = [...units, ...sectors].filter((record, index, list) => list.findIndex(item => item.name === record.name) === index);
  const structureLimit = 20;
  const canAddStructure = linkedRecords.length < structureLimit;
  const [tab, setTab] = useState("Cadastro de unidade e setor");
  const [sectorQuery, setSectorQuery] = useState("");
  const tabs = ["Dados gerais", "Cadastro de unidade e setor", "Equipamentos", "Serviços", "Ordens de serviço", "Financeiro", "Documentos"];
  const isStructureTab = tab === "Cadastro de unidade e setor";
  const filteredSectors = sectors.filter(sector => `${sector.name} ${sector.type} ${sector.responsible} ${sector.doc}`.toLowerCase().includes(sectorQuery.toLowerCase()));
  return <section className="client-detail">
    <div className="detail-header">
      <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> Voltar aos clientes</button>
      <div className="detail-identity"><span>{customer.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><div><small>CLIENTE CADASTRADO</small><h2>{customer.name}</h2><p>{customer.doc || "Documento não informado"} • {customer.address || "Endereço não informado"}</p></div></div>
      <button className="outline-btn"><Edit3 size={14}/> Editar cliente</button>
    </div>
    <nav className="detail-tabs" aria-label="Abas do cliente">{tabs.map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}{item === "Cadastro de unidade e setor" && <em>{linkedRecords.length}</em>}</button>)}</nav>
    {isStructureTab ? <div className="units-content">
      <div className="units-intro"><div><span className="section-kicker"><Building2 size={12}/> VÍNCULO COM O CLIENTE PRINCIPAL</span><h3>Cadastro de unidade e setor</h3><p>Filiais, unidades e setores vinculados exclusivamente a <strong>{customer.name}</strong>.</p><div className="structure-capacity"><span><b>{linkedRecords.length}</b> de {structureLimit} cadastros utilizados</span><i><b style={{width:`${(linkedRecords.length / structureLimit) * 100}%`}}/></i></div></div><button className="primary-btn" disabled={!canAddStructure} onClick={() => canAddStructure && onOpen(`Nova unidade, filial ou setor • ${customer.name}`)}><Plus size={16}/> {canAddStructure ? "Cadastrar unidade ou setor" : "Limite de 20 atingido"}</button></div>
      {linkedRecords.length ? <div className="unit-grid">{linkedRecords.map(({icon: Icon, ...unit}) => <article className="unit-card" key={unit.name}>
        <div className="unit-card-top"><span><Icon size={20}/></span><div><small>{unit.type}</small><h4>{unit.name}</h4></div><button aria-label={`Opções de ${unit.name}`}><MoreHorizontal size={17}/></button></div>
        <div className="unit-meta"><p><FileText size={13}/><span><small>CNPJ</small>{unit.doc}</span></p><p><Contact size={13}/><span><small>Responsável</small>{unit.responsible}</span></p><p><Phone size={13}/><span><small>Telefone</small>{unit.phone}</span></p><p><MapPin size={13}/><span><small>Endereço</small>{unit.address}</span></p></div>
        <div className="unit-footer"><span className="status green"><i/> Ativa</span><button>{unit.orders} ordens de serviço <ChevronRight size={13}/></button></div>
      </article>)}</div> : <div className="linked-empty"><Building2 size={22}/><h4>Nenhum setor ou filial cadastrado</h4><p>Cadastre o primeiro registro vinculado a este cliente principal.</p></div>}
      <section className="sector-list">
        <div className="sector-list-head"><div><span className="section-kicker"><Grid2X2 size={12}/> SETORES DO CLIENTE</span><h3>Lista de setores</h3><p>Consulte rapidamente todos os setores vinculados a {customer.name}.</p></div><label><Search size={14}/><input value={sectorQuery} onChange={event => setSectorQuery(event.target.value)} placeholder="Buscar setor..."/></label></div>
        {filteredSectors.length ? <div className="table-wrap"><table><thead><tr><th>SETOR / FILIAL</th><th>TIPO</th><th>CNPJ</th><th>RESPONSÁVEL</th><th>TELEFONE</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>{filteredSectors.map(({icon: Icon, ...sector}) => <tr key={`list-${sector.name}`}><td><div className="sector-name"><span><Icon size={15}/></span><strong>{sector.name}</strong></div></td><td>{sector.type}</td><td>{sector.doc}</td><td>{sector.responsible}</td><td>{sector.phone}</td><td><span className="status green"><i/> Ativo</span></td><td><button className="open-client">Abrir histórico <ChevronRight size={13}/></button></td></tr>)}</tbody></table></div> : <div className="sector-list-empty"><Search size={18}/><span>Nenhum setor encontrado.</span></div>}
      </section>
    </div> : <div className="tab-placeholder panel"><span><Grid2X2 size={22}/></span><h3>{tab}</h3><p>Informações de {tab.toLowerCase()} vinculadas exclusivamente a este cliente.</p></div>}
  </section>;
}

function Customers({ onOpen, onDelete, customers }: { onOpen: (name: string) => void; onDelete: (customer: Customer) => void; customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const filtered = useMemo(() => customers.filter(c => `${c.name} ${c.doc} ${c.contact}`.toLowerCase().includes(query.toLowerCase())), [query, customers]);
  if (selectedCustomer) return <CustomerDetail customerName={selectedCustomer} customers={customers} onBack={() => setSelectedCustomer("")} onOpen={onOpen}/>;
  return <section className="module-page">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar cliente, CPF ou CNPJ..." /></label><button className="outline-btn"><Filter size={14}/> Filtros</button><button className="primary-btn" onClick={() => onOpen("Novo cliente")}><Plus size={16}/> Novo cliente</button></div>
    <div className="module-summary">
      <article><span><UsersRound size={19}/></span><div><small>CLIENTES ATIVOS</small><strong>{customers.filter(item => item.status === "Ativo").length}</strong><em>Cadastros reais</em></div></article>
      <article><span><Building2 size={19}/></span><div><small>UNIDADES CADASTRADAS</small><strong>{customers.reduce((total, item) => total + item.units, 0)}</strong><em>Vinculadas aos clientes</em></div></article>
      <article><span><HandCoins size={19}/></span><div><small>FATURAMENTO NO MÊS</small><strong>R$ 0,00</strong><em>Sem vendas lançadas</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><UsersRound size={12}/> CARTEIRA</span><h2>Clientes cadastrados</h2><p>{filtered.length} registro(s) encontrado(s)</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>CPF / CNPJ</th><th>RESPONSÁVEL</th><th>TELEFONE</th><th>ENDEREÇO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id} onDoubleClick={() => setSelectedCustomer(c.name)}><td><div className="client-cell"><span>{c.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><strong>{c.name}</strong></div></td><td>{c.doc || "—"}</td><td>{c.contact || "—"}</td><td>{c.phone || "—"}</td><td>{c.address || "—"}</td><td><span className="status green"><i/> {c.status}</span></td><td><div className="row-actions"><button className="open-client" onClick={() => setSelectedCustomer(c.name)}>Abrir <ChevronRight size={14}/></button><button className="delete-action" aria-label={`Excluir ${c.name}`} onClick={() => onDelete(c)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="linked-empty"><UsersRound size={22}/><h4>Nenhum cliente cadastrado</h4><p>Use “Novo cliente” para iniciar sua base real.</p></div>}</div>
  </section>;
}

function ServiceOrders({ onOpen, onSelect, onDelete, serviceOrders }: { onOpen: (name: string) => void; onSelect: (order: ServiceOrder) => void; onDelete: (order: ServiceOrder) => void; serviceOrders: ServiceOrder[] }) {
  const today = new Date().toISOString().slice(0, 10);
  return <section className="module-page service-orders">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input placeholder="Pesquisar ordem, cliente ou técnico..."/></label><button className="outline-btn"><Filter size={14}/> Filtros</button><button className="primary-btn" onClick={() => onOpen("Nova ordem de serviço")}><Plus size={16}/> Nova ordem de serviço</button></div>
    <div className="module-summary">
      <article><span><ClipboardList size={19}/></span><div><small>ORDENS ABERTAS</small><strong>{serviceOrders.filter(item => item.status !== "Concluída").length}</strong><em>{serviceOrders.filter(item => item.date === today).length} para hoje</em></div></article>
      <article><span><UserCheck size={19}/></span><div><small>TÉCNICOS EMPENHADOS</small><strong>{new Set(serviceOrders.map(item => item.tech).filter(Boolean)).size}</strong><em>Cadastros reais</em></div></article>
      <article><span><CheckCircle2 size={19}/></span><div><small>FINALIZADAS</small><strong>{serviceOrders.filter(item => item.status === "Concluída").length}</strong><em>Total registrado</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><Wrench size={12}/> OPERAÇÃO TÉCNICA</span><h2>Ordens de serviço</h2><p>Duplo clique em uma linha para abrir a ordem completa.</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>ORDEM</th><th>CLIENTE / LOCAL</th><th>DATA / HORÁRIO</th><th>ENDEREÇO</th><th>TÉCNICO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>{serviceOrders.map(order => <tr className="clickable-row" title="Clique duas vezes para abrir a ordem" onDoubleClick={() => onSelect(order)} key={`manage-${order.id}`}><td><b className="order-id">{order.id}</b></td><td><div className="client-cell"><span>{order.avatar}</span><div><strong>{order.client}</strong><small>{order.unit}</small></div></div></td><td>{order.date ? new Date(`${order.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"} • {order.time || "Sem horário"}</td><td><button className="address-button" onClick={() => onSelect(order)}><MapPin size={13}/><span>{order.address || "Endereço não informado"}</span></button></td><td><div className="tech"><span>{order.tech.split(" ").map(name => name[0]).slice(0,2).join("")}</span>{order.tech}</div></td><td><span className={`status ${order.tone}`}><i/> {order.status}</span></td><td><div className="row-actions"><button className="open-client" onClick={() => onSelect(order)}>Abrir <ChevronRight size={13}/></button><button className="delete-action" aria-label={`Excluir ${order.id}`} onClick={() => onDelete(order)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>{!serviceOrders.length && <div className="linked-empty"><ClipboardList size={22}/><h4>Nenhuma ordem cadastrada</h4><p>Crie uma nova ordem para iniciar a operação.</p></div>}</div>
  </section>;
}

function Agenda({ serviceOrders, onOpen, onSelect }: { serviceOrders: ServiceOrder[]; onOpen: (name: string) => void; onSelect: (order: ServiceOrder) => void }) {
  const scheduled = [...serviceOrders].filter(order => order.date).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return <section className="module-page">
    <div className="module-toolbar"><div><span className="section-kicker"><CalendarDays size={12}/> AGENDA OPERACIONAL</span><h2>Serviços agendados</h2><p>Ordens com data definida aparecem automaticamente aqui.</p></div><button className="primary-btn" onClick={() => onOpen("Nova ordem de serviço")}><Plus size={16}/> Agendar serviço</button></div>
    <div className="panel customer-panel"><div className="agenda-hint"><Zap size={13}/> Clique duas vezes em um agendamento para abrir a ordem de serviço.</div><div className="table-wrap"><table><thead><tr><th>DATA</th><th>HORÁRIO</th><th>ORDEM</th><th>CLIENTE</th><th>ENDEREÇO</th><th>TÉCNICO</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>{scheduled.map(order => <tr className="clickable-row" title="Clique duas vezes para abrir a ordem" onDoubleClick={() => onSelect(order)} key={`agenda-${order.id}`}><td><strong>{new Date(`${order.date}T12:00:00`).toLocaleDateString("pt-BR")}</strong></td><td>{order.time || "A definir"}</td><td><b className="order-id">{order.id}</b></td><td>{order.client}<small className="agenda-unit">{order.unit}</small></td><td><button className="address-button" onClick={() => onSelect(order)}><MapPin size={13}/><span>{order.address || "Endereço não informado"}</span></button></td><td>{order.tech}</td><td><span className={`status ${order.tone}`}><i/> {order.status}</span></td><td><button className="open-client" onClick={() => onSelect(order)}>Abrir <ChevronRight size={13}/></button></td></tr>)}</tbody></table></div>{!scheduled.length && <div className="linked-empty"><CalendarDays size={24}/><h4>Nenhum serviço agendado</h4><p>Informe a data ao criar uma ordem de serviço.</p></div>}</div>
  </section>;
}

async function imageFileToDataUrl(file: File) {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const scale = Math.min(1, 1280 / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function SignaturePad({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = value;
    }
  }, [value]);

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d");
    const position = point(event);
    context?.beginPath();
    context?.moveTo(position.x, position.y);
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext("2d");
    const position = point(event);
    if (context) {
      context.strokeStyle = "#102b4b";
      context.lineWidth = 3;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineTo(position.x, position.y);
      context.stroke();
    }
  };
  const finish = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(event.currentTarget.toDataURL("image/png"));
  };

  return <div className={`signature-pad ${value ? "signed" : ""}`}>
    <div><span><PenTool size={15}/></span><div><b>{label}</b><small>{value ? "Assinatura registrada" : "Assine no quadro abaixo"}</small></div><button type="button" onClick={() => onChange("")}>Limpar</button></div>
    <canvas ref={canvasRef} width={720} height={180} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}/>
  </div>;
}

function OrderDetail({ order, customerPhone, close, onUpdate }: { order: ServiceOrder; customerPhone?: string; close: () => void; onUpdate: (order: ServiceOrder) => void }) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [itemsTab, setItemsTab] = useState<"Serviços" | "Produtos">("Serviços");
  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  const mapsEmbed = `https://www.google.com/maps?q=${encodeURIComponent(order.address)}&output=embed`;
  const update = (patch: Partial<ServiceOrder>) => {
    const updated = { ...currentOrder, ...patch };
    setCurrentOrder(updated);
    onUpdate(updated);
  };
  const uploadPhoto = async (field: "photoBefore" | "photoAfter", file?: File) => {
    if (!file) return;
    update({ [field]: await imageFileToDataUrl(file) });
  };
  const reminderDate = (amount: number, unit: "Dias" | "Meses", startAt?: string) => {
    const date = startAt ? new Date(startAt) : new Date();
    if (unit === "Meses") date.setMonth(date.getMonth() + amount);
    else date.setDate(date.getDate() + amount);
    return date.toISOString().slice(0, 10);
  };
  const configureReminder = (patch: Partial<ServiceOrder>) => {
    const amount = Number(patch.reminderAmount ?? currentOrder.reminderAmount ?? 6);
    const unit = (patch.reminderUnit ?? currentOrder.reminderUnit ?? "Meses") as "Dias" | "Meses";
    const enabled = Boolean(patch.reminderEnabled ?? currentOrder.reminderEnabled);
    update({ reminderAmount: amount, reminderUnit: unit, reminderEnabled: enabled, reminderDate: enabled ? reminderDate(amount, unit, currentOrder.checkOutAt) : "", reminderMessage: patch.reminderMessage ?? currentOrder.reminderMessage ?? "Olá! Está na hora de realizar a higienização preventiva do seu ar-condicionado. Vamos agendar?", reminderStatus: enabled ? (currentOrder.checkOutAt ? "Agendado" : "Pendente") : "Pendente", ...patch });
  };
  const formatMoment = (value?: string) => value ? new Date(value).toLocaleString("pt-BR") : "";
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Ordem ${order.id}`}>
    <button className="modal-backdrop" onClick={close} aria-label="Fechar ordem"/>
    <div className="modal order-detail-modal">
      <div className="modal-head"><div><span>ORDEM DE SERVIÇO</span><h2>{order.id} • {order.client}</h2><p>{order.unit}</p></div><button onClick={close} aria-label="Fechar"><X size={18}/></button></div>
      <div className="order-detail-content">
        <div className="order-overview">
          <article><CalendarDays size={17}/><div><small>AGENDAMENTO</small><strong>{order.date ? new Date(`${order.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"} • {order.time || "A definir"}</strong></div></article>
          <article><UserCheck size={17}/><div><small>TÉCNICO RESPONSÁVEL</small><strong>{currentOrder.tech || "Não definido"}</strong></div></article>
          <article><Wrench size={17}/><div><small>SERVIÇO</small><strong>{order.service}</strong></div></article>
          <article><Activity size={17}/><div><small>SITUAÇÃO</small><strong>{currentOrder.status}</strong></div></article>
        </div>
        <section className="order-items-panel">
          <div className="order-item-tabs"><button className={itemsTab === "Serviços" ? "active" : ""} onClick={() => setItemsTab("Serviços")}><Wrench size={15}/> Serviços</button><button className={itemsTab === "Produtos" ? "active" : ""} onClick={() => setItemsTab("Produtos")}><Package size={15}/> Produtos e lembrete</button></div>
          <div className="execution-head"><div><span>{itemsTab === "Serviços" ? "SERVIÇOS DA ORDEM" : "PRODUTOS UTILIZADOS"}</span><h3>{itemsTab === "Serviços" ? "Serviços executados" : "Produtos, materiais e pós-serviço"}</h3></div><small>{currentOrder.catalogItems?.filter(item => item.kind === itemsTab.slice(0, -1)).length ?? 0} item(ns)</small></div>
          {currentOrder.catalogItems?.some(item => item.kind === itemsTab.slice(0, -1)) ? <div className="order-item-list">{currentOrder.catalogItems.filter(item => item.kind === itemsTab.slice(0, -1)).map(item => <article key={item.id}><span>{item.kind === "Produto" ? <Package size={16}/> : <Wrench size={16}/>}</span><div><b>{item.name}</b><small>{item.kind}</small></div><CheckCircle2 size={16}/></article>)}</div> : <div className="catalog-empty">{itemsTab === "Produtos" ? <Package size={19}/> : <Wrench size={19}/>}<span>Nenhum {itemsTab.toLowerCase()} foi vinculado a esta ordem.</span></div>}
          {itemsTab === "Produtos" && <div className={`service-reminder ${currentOrder.reminderEnabled ? "enabled" : ""}`}>
            <div className="reminder-heading"><span><Bell size={18}/></span><div><small>RELACIONAMENTO PÓS-SERVIÇO</small><h4>Lembrete automático para o cliente</h4><p>Após o check-out, o ProAR agenda uma mensagem de manutenção ou higienização.</p></div><label className="reminder-switch"><input type="checkbox" checked={Boolean(currentOrder.reminderEnabled)} onChange={event => configureReminder({ reminderEnabled: event.target.checked })}/><i/></label></div>
            {currentOrder.reminderEnabled && <div className="reminder-fields"><label>Enviar após<input type="number" min="1" max="60" value={currentOrder.reminderAmount ?? 6} onChange={event => configureReminder({ reminderAmount: Math.max(1, Number(event.target.value) || 1) })}/></label><label>Período<select value={currentOrder.reminderUnit ?? "Meses"} onChange={event => configureReminder({ reminderUnit: event.target.value as "Dias" | "Meses" })}><option>Dias</option><option>Meses</option></select></label><label>Data prevista<input type="date" value={currentOrder.reminderDate ?? reminderDate(6, "Meses", currentOrder.checkOutAt)} onChange={event => update({ reminderDate: event.target.value })}/></label><label className="wide">Mensagem<textarea value={currentOrder.reminderMessage ?? "Olá! Está na hora de realizar a higienização preventiva do seu ar-condicionado. Vamos agendar?"} onChange={event => configureReminder({ reminderMessage: event.target.value })}/></label><div className="reminder-summary"><MessageCircle size={15}/><span><b>{customerPhone || "Cliente sem WhatsApp cadastrado"}</b><small>{currentOrder.checkOutAt ? `Agendado para ${new Date(`${currentOrder.reminderDate}T12:00:00`).toLocaleDateString("pt-BR")}` : "Será agendado automaticamente quando o técnico fizer o check-out."}</small></span></div></div>}
          </div>}
        </section>
        <section className="order-map">
          <div className="order-map-head"><div><span><MapPin size={16}/></span><div><small>ENDEREÇO DO ATENDIMENTO</small><strong>{order.address || "Endereço não informado"}</strong></div></div>{order.address && <a href={mapsSearch} target="_blank" rel="noreferrer">Abrir no Google Maps <ArrowRight size={13}/></a>}</div>
          {order.address ? <iframe title={`Mapa de ${order.address}`} src={mapsEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/> : <div className="map-empty"><MapPin size={24}/><p>Cadastre o endereço do cliente para visualizar o mapa.</p></div>}
        </section>
        <section className="field-execution">
          <div className="execution-head"><div><span>EXECUÇÃO EM CAMPO</span><h3>Registo do atendimento</h3></div><small>Os dados são sincronizados automaticamente</small></div>
          <div className="check-actions">
            <button type="button" className={currentOrder.checkInAt ? "done" : ""} onClick={() => !currentOrder.checkInAt && update({ checkInAt: new Date().toISOString(), status: "Em andamento", tone: "blue" })}><LogIn size={18}/><span><b>{currentOrder.checkInAt ? "Check-in realizado" : "Fazer check-in"}</b><small>{currentOrder.checkInAt ? formatMoment(currentOrder.checkInAt) : "Registrar chegada ao cliente"}</small></span></button>
            <button type="button" disabled={!currentOrder.checkInAt} className={currentOrder.checkOutAt ? "done" : ""} onClick={() => { if (currentOrder.checkOutAt) return; const checkOutAt = new Date().toISOString(); update({ checkOutAt, status: "Concluída", tone: "green", reminderDate: currentOrder.reminderEnabled ? reminderDate(currentOrder.reminderAmount ?? 6, currentOrder.reminderUnit ?? "Meses", checkOutAt) : currentOrder.reminderDate, reminderStatus: currentOrder.reminderEnabled ? "Agendado" : currentOrder.reminderStatus }); }}><LogOut size={18}/><span><b>{currentOrder.checkOutAt ? "Check-out realizado" : "Fazer check-out"}</b><small>{currentOrder.checkOutAt ? formatMoment(currentOrder.checkOutAt) : "Registrar saída do cliente"}</small></span></button>
          </div>
          <div className="evidence-grid">
            <label className={`upload-box photo-evidence ${currentOrder.photoBefore ? "has-photo" : ""}`}>{currentOrder.photoBefore ? <img src={currentOrder.photoBefore} alt="Antes do serviço"/> : <Camera size={23}/>}<b>Foto antes do serviço</b><small>{currentOrder.photoBefore ? "Toque para substituir" : "Abrir câmera ou galeria"}</small><input type="file" accept="image/*" capture="environment" onChange={event => uploadPhoto("photoBefore", event.target.files?.[0])}/></label>
            <label className={`upload-box photo-evidence ${currentOrder.photoAfter ? "has-photo" : ""}`}>{currentOrder.photoAfter ? <img src={currentOrder.photoAfter} alt="Depois do serviço"/> : <Camera size={23}/>}<b>Foto depois do serviço</b><small>{currentOrder.photoAfter ? "Toque para substituir" : "Abrir câmera ou galeria"}</small><input type="file" accept="image/*" capture="environment" onChange={event => uploadPhoto("photoAfter", event.target.files?.[0])}/></label>
          </div>
          <div className="signature-grid">
            <SignaturePad label="Assinatura do cliente" value={currentOrder.clientSignature} onChange={clientSignature => update({ clientSignature })}/>
            <SignaturePad label="Assinatura do técnico responsável" value={currentOrder.technicianSignature} onChange={technicianSignature => update({ technicianSignature })}/>
          </div>
        </section>
      </div>
      <div className="modal-actions"><button className="outline-btn" onClick={close}>Fechar</button><button className="primary-btn" onClick={() => window.print()}><FileText size={15}/> Imprimir ordem</button></div>
      <article className="print-service-order">
        <header className="print-order-header"><img src="/proar-logo.png" alt="ProAR — Gestão de Serviços"/><div><span>ORDEM DE SERVIÇO</span><h1>{currentOrder.id}</h1><p>Documento técnico de atendimento</p></div></header>
        <section className="print-order-status"><div><small>SITUAÇÃO</small><strong>{currentOrder.status}</strong></div><div><small>DATA AGENDADA</small><strong>{currentOrder.date ? new Date(`${currentOrder.date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"}</strong></div><div><small>HORÁRIO</small><strong>{currentOrder.time || "Não informado"}</strong></div></section>
        <section className="print-block"><h2>Cliente e local do atendimento</h2><div className="print-info-grid"><div><small>CLIENTE</small><strong>{currentOrder.client}</strong></div><div><small>UNIDADE / SETOR</small><strong>{currentOrder.unit || "Unidade principal"}</strong></div><div className="wide"><small>ENDEREÇO</small><strong>{currentOrder.address || "Não informado"}</strong></div><div><small>TÉCNICO RESPONSÁVEL</small><strong>{currentOrder.tech || "Não informado"}</strong></div><div><small>CHECK-IN</small><strong>{currentOrder.checkInAt ? formatMoment(currentOrder.checkInAt) : "Não realizado"}</strong></div><div><small>CHECK-OUT</small><strong>{currentOrder.checkOutAt ? formatMoment(currentOrder.checkOutAt) : "Não realizado"}</strong></div></div></section>
        <section className="print-block"><h2>Serviços prestados</h2>{currentOrder.catalogItems?.length ? <div className="print-service-list">{currentOrder.catalogItems.map((item, index) => <div key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{item.name}</strong><small>{item.kind}</small></span></div>)}</div> : <p className="print-description">{currentOrder.service || "Atendimento técnico"}</p>}</section>
        <section className="print-block print-evidence"><h2>Registo fotográfico</h2><div><figure>{currentOrder.photoBefore ? <img src={currentOrder.photoBefore} alt="Antes do serviço"/> : <div>Foto não adicionada</div>}<figcaption>ANTES DO SERVIÇO</figcaption></figure><figure>{currentOrder.photoAfter ? <img src={currentOrder.photoAfter} alt="Depois do serviço"/> : <div>Foto não adicionada</div>}<figcaption>DEPOIS DO SERVIÇO</figcaption></figure></div></section>
        <section className="print-block print-signatures"><h2>Confirmação do atendimento</h2><div><figure>{currentOrder.clientSignature ? <img src={currentOrder.clientSignature} alt="Assinatura do cliente"/> : <div/>}<figcaption><strong>Assinatura do cliente</strong><span>{currentOrder.client}</span></figcaption></figure><figure>{currentOrder.technicianSignature ? <img src={currentOrder.technicianSignature} alt="Assinatura do técnico"/> : <div/>}<figcaption><strong>Assinatura do técnico responsável</strong><span>{currentOrder.tech}</span></figcaption></figure></div></section>
        <footer className="print-order-footer"><span>ProAR — Gestão de Serviços</span><span>Documento gerado em {new Date().toLocaleString("pt-BR")}</span></footer>
      </article>
    </div>
  </div>;
}

type SaleItem = { id: string; name: string; code: string; price: number; kind: "Produto" | "Serviço" };
type CartItem = SaleItem & { quantity: number };

const quickSaleCatalog: SaleItem[] = [];

function SalesPDV({ customers }: { customers: Customer[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"itens" | "cliente" | "pagamento" | "opcoes">("itens");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState("PIX");
  const [notice, setNotice] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredCatalog = quickSaleCatalog.filter(item => `${item.name} ${item.code} ${item.kind}`.toLowerCase().includes(search.toLowerCase()));
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const addItem = (item: SaleItem) => setCart(current => {
    const existing = current.find(record => record.id === item.id);
    return existing ? current.map(record => record.id === item.id ? { ...record, quantity: record.quantity + 1 } : record) : [...current, { ...item, quantity: 1 }];
  });
  const changeQuantity = (id: string, amount: number) => setCart(current => current
    .map(item => item.id === id ? { ...item, quantity: item.quantity + amount } : item)
    .filter(item => item.quantity > 0));
  const finishSale = () => {
    if (!cart.length) {
      setNotice("Adicione pelo menos um item à venda.");
      return;
    }
    const sale = {
      id: `VEN-${Date.now().toString().slice(-6)}`,
      customer: customer || "Consumidor final",
      payment,
      subtotal,
      discount,
      total,
      items: cart,
      createdAt: new Date().toLocaleString("pt-BR"),
    };
    const previous = JSON.parse(localStorage.getItem("proar-v3-pdv-sales") || "[]");
    localStorage.setItem("proar-v3-pdv-sales", JSON.stringify([sale, ...previous]));
    setCart([]);
    setDiscount(0);
    setCustomer("");
    setActiveTab("itens");
    setNotice(`Venda ${sale.id} finalizada — R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F1") { event.preventDefault(); setShortcutsOpen(value => !value); }
      if (event.key === "F2") { event.preventDefault(); setActiveTab("itens"); searchRef.current?.focus(); }
      if (event.key === "F3") { event.preventDefault(); setActiveTab("cliente"); }
      if (event.key === "F4") { event.preventDefault(); setActiveTab("pagamento"); }
      if (event.key === "F8") { event.preventDefault(); setActiveTab("opcoes"); }
      if (event.key === "F10") { event.preventDefault(); finishSale(); }
      if (event.key === "Escape") setShortcutsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return <section className="pdv-page">
    <div className="pdv-command">
      <div><span className="section-kicker"><ShoppingBag size={12}/> VENDA RÁPIDA</span><h2>PDV ProAR</h2><p>Produtos e serviços em um fluxo direto, sem campos desnecessários.</p></div>
      <div className="pdv-shortcuts"><button onClick={() => setShortcutsOpen(true)}><Keyboard size={14}/><kbd>F1</kbd> Atalhos</button><span>Caixa aberto</span></div>
    </div>
    {notice && <div className="pdv-notice"><CheckCircle2 size={15}/>{notice}<button onClick={() => setNotice("")}><X size={13}/></button></div>}
    <nav className="pdv-tabs" aria-label="Etapas da venda">
      <button className={activeTab === "itens" ? "active" : ""} onClick={() => setActiveTab("itens")}><ScanBarcode size={15}/><span>Itens</span><kbd>F2</kbd></button>
      <button className={activeTab === "cliente" ? "active" : ""} onClick={() => setActiveTab("cliente")}><UserRound size={15}/><span>Cliente</span><kbd>F3</kbd></button>
      <button className={activeTab === "pagamento" ? "active" : ""} onClick={() => setActiveTab("pagamento")}><CreditCard size={15}/><span>Pagamento</span><kbd>F4</kbd></button>
      <button className={activeTab === "opcoes" ? "active" : ""} onClick={() => setActiveTab("opcoes")}><MoreHorizontal size={15}/><span>Mais opções</span><kbd>F8</kbd></button>
    </nav>
    <div className="pdv-layout">
      <div className="pdv-workspace panel">
        {activeTab === "itens" && <>
          <label className="pdv-search"><Search size={19}/><input ref={searchRef} autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Digite produto, serviço ou código..."/><kbd>F2</kbd></label>
          <div className="pdv-catalog">{filteredCatalog.map(item => <button key={item.id} onClick={() => addItem(item)}>
            <span className={item.kind === "Serviço" ? "service" : "product"}>{item.kind === "Serviço" ? <Wrench size={17}/> : <Package size={17}/>}</span>
            <div><small>{item.code} • {item.kind}</small><strong>{item.name}</strong></div>
            <b>R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b><Plus size={16}/>
          </button>)}</div>
          {!filteredCatalog.length && <div className="linked-empty"><Package size={23}/><h4>Nenhum produto ou serviço cadastrado</h4><p>Cadastre os itens reais nos módulos Produtos e Serviços.</p></div>}
        </>}
        {activeTab === "cliente" && <div className="pdv-hidden-panel"><div className="pdv-panel-title"><UserRound size={20}/><div><h3>Cliente da venda</h3><p>Opcional para vendas rápidas.</p></div></div><label>Selecionar cliente<select value={customer} onChange={event => setCustomer(event.target.value)}><option value="">Consumidor final</option>{customers.map(item => <option key={item.doc} value={item.name}>{item.name} • {item.doc}</option>)}</select></label><button className="outline-btn"><Plus size={14}/> Cadastro rápido</button></div>}
        {activeTab === "pagamento" && <div className="pdv-hidden-panel"><div className="pdv-panel-title"><CreditCard size={20}/><div><h3>Forma de pagamento</h3><p>Escolha uma opção para concluir.</p></div></div><div className="payment-grid">{["PIX", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Boleto", "Transferência"].map(option => <button className={payment === option ? "active" : ""} key={option} onClick={() => setPayment(option)}>{option}</button>)}</div></div>}
        {activeTab === "opcoes" && <div className="pdv-hidden-panel"><div className="pdv-panel-title"><Tag size={20}/><div><h3>Opções da venda</h3><p>Recursos menos utilizados ficam ocultos aqui.</p></div></div><label>Desconto em reais<input type="number" min="0" max={subtotal} value={discount || ""} onChange={event => setDiscount(Number(event.target.value))} placeholder="R$ 0,00"/></label><label>Observações<textarea placeholder="Informações adicionais para o comprovante..."/></label></div>}
      </div>
      <aside className="pdv-cart panel">
        <div className="pdv-cart-head"><div><ReceiptText size={17}/><span><strong>Venda atual</strong><small>{cart.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</small></span></div>{cart.length > 0 && <button onClick={() => setCart([])}><Trash2 size={13}/> Limpar</button>}</div>
        <div className="pdv-cart-items">{cart.length ? cart.map(item => <article key={item.id}><div><small>{item.code}</small><strong>{item.name}</strong><span>R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div><div className="quantity"><button onClick={() => changeQuantity(item.id, -1)}><Minus size={12}/></button><b>{item.quantity}</b><button onClick={() => changeQuantity(item.id, 1)}><Plus size={12}/></button></div><b>R$ {(item.price * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></article>) : <div className="pdv-empty"><ShoppingCart size={29}/><strong>Carrinho vazio</strong><p>Selecione um produto ou serviço para iniciar.</p></div>}</div>
        <div className="pdv-summary"><p><span>Subtotal</span><b>R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></p>{discount > 0 && <p className="discount"><span>Desconto</span><b>− R$ {discount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></p>}<div><span>TOTAL</span><strong>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div><small>{customer || "Consumidor final"} • {payment}</small><button className="finish-sale" disabled={!cart.length} onClick={finishSale}><CheckCircle2 size={17}/> Finalizar venda <kbd>F10</kbd></button></div>
      </aside>
    </div>
    {shortcutsOpen && <div className="shortcut-layer" role="dialog" aria-modal="true" aria-label="Atalhos do PDV"><button className="modal-backdrop" onClick={() => setShortcutsOpen(false)} aria-label="Fechar atalhos"/><div className="shortcut-card"><div><span><Keyboard size={19}/></span><div><small>PDV PROAR</small><h3>Atalhos de teclado</h3></div><button onClick={() => setShortcutsOpen(false)} aria-label="Fechar"><X size={16}/></button></div>{[["F1","Abrir esta ajuda"],["F2","Pesquisar produto ou serviço"],["F3","Selecionar cliente"],["F4","Forma de pagamento"],["F8","Desconto e outras opções"],["F10","Finalizar a venda"],["ESC","Fechar janela"]].map(([key,label]) => <p key={key}><kbd>{key}</kbd><span>{label}</span></p>)}</div></div>}
  </section>;
}

const moduleStatuses: Record<string, string[]> = {
  "Compras": ["Rascunho", "Aguardando aprovação", "Aprovada", "Enviada ao fornecedor", "Aguardando entrega", "Recebida parcialmente", "Recebida", "Cancelada", "Devolvida"],
  "Fornecedores": ["Ativo", "Inativo", "Bloqueado"],
  "Financeiro": ["Em aberto", "Aguardando aprovação", "Vencida", "Paga parcialmente", "Paga", "Recebida", "Cancelada"],
  "Funcionários": ["Ativo", "Em férias", "Afastado", "Inativo"],
};

const managementTabs: Record<string, string[]> = {
  "Compras": ["Visão geral", "Pedidos", "Aprovação", "Recebimento", "Histórico"],
  "Fornecedores": ["Visão geral", "Cadastro", "Produtos fornecidos", "Compras", "Avaliação"],
  "Financeiro": ["Visão geral", "Contas a pagar", "Contas a receber", "Fluxo de caixa", "Conciliação"],
  "Funcionários": ["Visão geral", "Equipe", "Funções e permissões", "Comissões", "Histórico"],
};

const managementFlows: Record<string, { title: string; text: string }[]> = {
  "Compras": [
    { title: "Solicitação", text: "Materiais e quantidades" },
    { title: "Aprovação", text: "Validação da gerência" },
    { title: "Pedido", text: "Envio ao fornecedor" },
    { title: "Recebimento", text: "Conferência e nota fiscal" },
    { title: "Integração", text: "Estoque e conta a pagar" },
  ],
  "Fornecedores": [
    { title: "Cadastro", text: "Dados fiscais e contato" },
    { title: "Catálogo", text: "Produtos e condições" },
    { title: "Cotação", text: "Preço e prazo" },
    { title: "Compras", text: "Pedidos vinculados" },
    { title: "Avaliação", text: "Qualidade e entrega" },
  ],
  "Financeiro": [
    { title: "Previsão", text: "Títulos e vencimentos" },
    { title: "Aprovação", text: "Conferência financeira" },
    { title: "Liquidação", text: "Pagamento ou recebimento" },
    { title: "Caixa", text: "Movimentação por conta" },
    { title: "Conciliação", text: "Comprovantes e diferenças" },
  ],
  "Funcionários": [
    { title: "Cadastro", text: "Dados e função" },
    { title: "Acesso", text: "Utilizador e senha" },
    { title: "Permissões", text: "Módulos autorizados" },
    { title: "Operação", text: "OS, vendas e tarefas" },
    { title: "Histórico", text: "Atividades e comissões" },
  ],
};

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(row => row.map(cell => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Reports({ modules, customers, serviceOrders }: { modules: Record<string, ModuleRecord[]>; customers: Customer[]; serviceOrders: ServiceOrder[] }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("Todas");
  const [selectedReport, setSelectedReport] = useState("Visão consolidada");
  const inPeriod = (record: ModuleRecord) => {
    if (!record.date) return !startDate && !endDate;
    return (!startDate || record.date >= startDate) && (!endDate || record.date <= endDate);
  };
  const matchesStatus = (record: ModuleRecord) => status === "Todas" || (record.status || "").toLowerCase().includes(status.toLowerCase());
  const filteredModules = Object.fromEntries(Object.entries(modules).map(([key, records]) => [key, records.filter(record => inPeriod(record) && matchesStatus(record))]));
  const reportGroups = [
    { title: "Compras", icon: ShoppingCart, count: filteredModules["Compras"]?.length ?? 0, items: ["Compras por período", "Compras por fornecedor", "Pedidos pendentes", "Comparação de preços"] },
    { title: "Fornecedores", icon: Store, count: filteredModules["Fornecedores"]?.length ?? 0, items: ["Fornecedores ativos", "Histórico de preços", "Avaliação dos fornecedores", "Total comprado"] },
    { title: "Financeiro", icon: WalletCards, count: filteredModules["Financeiro"]?.length ?? 0, items: ["Contas a pagar", "Contas a receber", "Fluxo de caixa", "Resultado por centro de custo"] },
    { title: "Funcionários", icon: BriefcaseBusiness, count: filteredModules["Funcionários"]?.length ?? 0, items: ["Equipe ativa", "Funções e permissões", "Comissões", "Histórico de atividades"] },
    { title: "Serviços", icon: Wrench, count: serviceOrders.length, items: ["Ordens abertas", "Ordens concluídas", "Serviços por cliente", "Produtividade técnica"] },
    { title: "Clientes", icon: UsersRound, count: customers.length, items: ["Clientes ativos", "Histórico de atendimento", "Faturamento por cliente", "Inadimplência"] },
    { title: "Estoque", icon: Warehouse, count: modules["Produtos"]?.length ?? 0, items: ["Estoque atual", "Produtos sem estoque", "Entradas e saídas", "Valor do estoque"] },
  ];
  const exportSummary = () => downloadCsv("relatorio-geral-proar.csv", [["Relatório", selectedReport], ["Período", startDate || "Início", endDate || "Hoje"], ["Situação", status], [], ["Módulo", "Quantidade", "Gerado em"], ...reportGroups.map(group => [group.title, String(group.count), new Date().toLocaleString("pt-BR")])]);
  return <section className="module-page reports-page">
    <div className="management-hero"><div><span className="section-kicker"><FileChartColumn size={12}/> INTELIGÊNCIA GERENCIAL</span><h2>Central de relatórios</h2><p>Indicadores comerciais, operacionais, financeiros e administrativos com dados reais do ProAR.</p></div><div className="management-actions"><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Imprimir</button><button className="primary-btn" onClick={exportSummary}><ArrowDownRight size={14}/> Exportar resumo</button></div></div>
    <div className="report-filter-bar"><label>Data inicial<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></label><label>Data final<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)}/></label><label>Situação<select value={status} onChange={event => setStatus(event.target.value)}><option>Todas</option><option>Ativo</option><option>Pendente</option><option>Concluído</option><option>Vencida</option><option>Paga</option></select></label><div className="report-active-filter"><Filter size={14}/><span>{selectedReport}</span><button onClick={() => { setStartDate(""); setEndDate(""); setStatus("Todas"); }}>Limpar</button></div></div>
    <div className="report-grid">{reportGroups.map(({ title, icon: Icon, count, items }) => <article className="report-card" key={title}><div className="report-card-head"><span><Icon size={20}/></span><div><small>MÓDULO</small><h3>{title}</h3></div><b>{count}</b></div><div className="report-links">{items.map(item => <button className={selectedReport === item ? "active" : ""} onClick={() => setSelectedReport(item)} key={item}>{item}<ChevronRight size={13}/></button>)}</div><footer><button onClick={() => window.print()}><FileText size={13}/> PDF / Imprimir</button><button onClick={() => downloadCsv(`relatorio-${title.toLowerCase()}.csv`, [["Relatório", selectedReport], ["Período", startDate || "Início", endDate || "Hoje"], ["Situação", status], ["Total", String(count)]])}><ArrowDownRight size={13}/> Excel</button></footer></article>)}</div>
  </section>;
}

type WhatsAppSettings = {
  active: boolean; phoneNumberId: string; wabaId: string; accessToken: string;
  apiVersion: string; defaultCountry: string; tenderTo: string;
  tenderTemplate: string; reminderTemplate: string;
  tokenConfigured?: boolean; tokenPreview?: string;
};

const whatsappDefaults: WhatsAppSettings = {
  active: false, phoneNumberId: "", wabaId: "", accessToken: "", apiVersion: "v23.0",
  defaultCountry: "55", tenderTo: "5517991567798", tenderTemplate: "nova_licitacao_proar",
  reminderTemplate: "lembrete_higienizacao",
};

function WhatsAppSettingsPage() {
  const [config, setConfig] = useState<WhatsAppSettings>(whatsappDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const update = (field: keyof WhatsAppSettings, value: string | boolean) => setConfig(current => ({ ...current, [field]: value }));
  useEffect(() => {
    fetch("/api/whatsapp", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar a configuração.");
      setConfig({ ...whatsappDefaults, ...result, accessToken: "" });
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Falha ao carregar."))
      .finally(() => setLoading(false));
  }, []);
  const save = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/whatsapp", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível guardar.");
      setConfig({ ...whatsappDefaults, ...result, accessToken: "" });
      setMessage("Configuração do WhatsApp guardada com segurança.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao guardar."); }
    finally { setSaving(false); }
  };
  const test = async () => {
    setTesting(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/whatsapp", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "A Meta recusou a conexão.");
      setMessage(`Conexão confirmada${result.verified_name ? `: ${result.verified_name}` : ""}${result.display_phone_number ? ` • ${result.display_phone_number}` : ""}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao testar."); }
    finally { setTesting(false); }
  };
  return <section className="whatsapp-settings">
    <div className="management-hero whatsapp-hero"><div><span className="section-kicker">CANAIS E AUTOMAÇÕES</span><h2>WhatsApp Business</h2><p>Envie alertas de novas licitações e lembretes de higienização pela API oficial da Meta.</p></div><div className={`whatsapp-state ${config.active && config.tokenConfigured ? "online" : ""}`}><span><MessageCircle size={20}/></span><div><small>ESTADO DA INTEGRAÇÃO</small><b>{config.active ? (config.tokenConfigured ? "Ativa e configurada" : "Aguardando token") : "Desativada"}</b></div></div></div>
    {loading ? <div className="settings-loading">A carregar configuração segura…</div> : <>
      {(message || error) && <div className={`whatsapp-feedback ${error ? "error" : "success"}`}>{error ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>} {error || message}</div>}
      <div className="whatsapp-grid">
        <article className="whatsapp-card"><header><span><Wifi size={19}/></span><div><small>CONEXÃO OFICIAL</small><h3>Credenciais da Meta</h3></div></header><div className="whatsapp-form">
          <label>Phone Number ID<input value={config.phoneNumberId} onChange={event => update("phoneNumberId", event.target.value)} placeholder="ID do número no WhatsApp Manager"/></label>
          <label>WhatsApp Business Account ID<input value={config.wabaId} onChange={event => update("wabaId", event.target.value)} placeholder="WABA ID"/></label>
          <label>Versão da Graph API<input value={config.apiVersion} onChange={event => update("apiVersion", event.target.value)} placeholder="v23.0"/></label>
          <label>Código do país<input value={config.defaultCountry} onChange={event => update("defaultCountry", event.target.value.replace(/\D/g, ""))} placeholder="55"/></label>
          <label className="wide">Token permanente<input type="password" autoComplete="new-password" value={config.accessToken} onChange={event => update("accessToken", event.target.value)} placeholder={config.tokenConfigured ? `Token protegido ${config.tokenPreview || ""} • deixe em branco para manter` : "Cole o token permanente da Meta"}/><small>O token é criptografado no servidor e não volta para o navegador.</small></label>
        </div></article>
        <article className="whatsapp-card"><header><span><Send size={19}/></span><div><small>ENVIO AUTOMÁTICO</small><h3>Destinos e modelos</h3></div></header><div className="whatsapp-form one-column">
          <label>Número para alertas de licitação<input value={config.tenderTo} onChange={event => update("tenderTo", event.target.value)} placeholder="5517999999999"/></label>
          <label>Modelo aprovado — licitações<input value={config.tenderTemplate} onChange={event => update("tenderTemplate", event.target.value)} placeholder="nova_licitacao_proar"/></label>
          <label>Modelo aprovado — lembrete ao cliente<input value={config.reminderTemplate} onChange={event => update("reminderTemplate", event.target.value)} placeholder="lembrete_higienizacao"/></label>
          <label className="integration-toggle"><input type="checkbox" checked={config.active} onChange={event => update("active", event.target.checked)}/><span/><div><b>Ativar envios automáticos</b><small>As mensagens só serão enviadas depois de guardar e validar a conexão.</small></div></label>
        </div></article>
      </div>
      <div className="whatsapp-actions"><a className="outline-btn" href="https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started" target="_blank" rel="noreferrer"><MessageCircle size={15}/> Abrir configuração oficial da Meta</a><button className="outline-btn" onClick={test} disabled={testing || !config.tokenConfigured}><Wifi size={15}/> {testing ? "A testar…" : "Testar conexão"}</button><button className="primary-btn" onClick={save} disabled={saving}><ShieldCheck size={15}/> {saving ? "A guardar…" : "Guardar integração"}</button></div>
      <p className="whatsapp-note"><ShieldCheck size={14}/> Os modelos precisam estar aprovados na Meta e usar o idioma Português (Brasil). Não envie o token por WhatsApp ou pelo chat; cadastre-o somente nesta tela.</p>
    </>}
  </section>;
}

function GenericModule({ name, onOpen, onDelete, onUpdate, records }: { name: string; onOpen: (name: string) => void; onDelete: (moduleName: string, record: ModuleRecord) => void; onUpdate: (moduleName: string, record: ModuleRecord) => void; records: ModuleRecord[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [activeView, setActiveView] = useState("Visão geral");
  const descriptions: Record<string,string> = {
    "Equipamentos": "Acompanhe o parque de equipamentos, histórico técnico, garantias e próximas manutenções.",
    "Ordens de serviço": "Planeje atendimentos, distribua equipes e acompanhe cada serviço até a assinatura.",
    "Estoque": "Controle entradas, saídas, reservas, inventários, perdas e alertas de reposição.",
    "Compras": "Solicitações, aprovações, recebimentos, estoque e contas a pagar integrados.",
    "Fornecedores": "Cadastro, produtos fornecidos, compras, financeiro, documentos e avaliação.",
    "Financeiro": "Contas a pagar e receber, caixa, bancos, conciliação e centros de custo.",
  };
  const statuses = moduleStatuses[name] ?? ["Ativo", "Pendente", "Concluído", "Inativo"];
  const tabs = managementTabs[name] ?? ["Visão geral", "Cadastros", "Histórico"];
  const viewMatches = (record: ModuleRecord) => {
    if (activeView === "Visão geral" || activeView === "Histórico" || activeView === "Cadastro" || activeView === "Equipe") return true;
    if (activeView === "Pedidos") return !/Recebida|Cancelada|Devolvida/i.test(record.status || "");
    if (activeView === "Aprovação") return /Aguardando aprovação|Aprovada/i.test(record.status || "");
    if (activeView === "Recebimento") return /Aguardando entrega|Recebida/i.test(record.status || "");
    if (activeView === "Contas a pagar") return /pagar|compra|fornecedor/i.test(`${record.name} ${record.category} ${record.description}`);
    if (activeView === "Contas a receber") return /receber|venda|cliente|serviço/i.test(`${record.name} ${record.category} ${record.description}`);
    if (activeView === "Fluxo de caixa") return /Paga|Recebida/i.test(record.status || "");
    if (activeView === "Produtos fornecidos") return Boolean(record.description || record.category);
    if (activeView === "Funções e permissões") return Boolean(record.category || record.description);
    if (activeView === "Comissões") return /comissão/i.test(`${record.category} ${record.description}`);
    return true;
  };
  const filtered = records.filter(record => `${record.id} ${record.name} ${record.client} ${record.description}`.toLowerCase().includes(query.toLowerCase()) && (statusFilter === "Todas" || (record.status || statuses[0]) === statusFilter) && viewMatches(record));
  const totalValue = records.reduce((total, record) => total + (record.value ?? 0), 0);
  const openValue = records.filter(record => /Rascunho|Aguardando|aberto|Vencida|Pendente/i.test(record.status || "")).reduce((total, record) => total + (record.value ?? 0), 0);
  const exportRecords = () => downloadCsv(`${name.toLowerCase()}-proar.csv`, [["Código", "Nome", "Responsável", "Situação", "Valor", "Data"], ...filtered.map(record => [record.id, record.name, record.client, record.status || statuses[0], String(record.value ?? 0), record.date || record.createdAt])]);
  const advance = (record: ModuleRecord) => {
    const currentIndex = statuses.indexOf(record.status || statuses[0]);
    onUpdate(name, { ...record, status: statuses[Math.min(currentIndex + 1, statuses.length - 1)] });
  };
  const duplicate = (record: ModuleRecord) => onUpdate(name, { ...record, id: `${name.slice(0,3).toUpperCase()}-${Date.now().toString().slice(-6)}`, name: `${record.name} (cópia)`, status: statuses[0], createdAt: new Date().toLocaleString("pt-BR") });
  return <section className="module-page management-module">
    <div className="management-hero"><div><span className="section-kicker"><Grid2X2 size={12}/> MÓDULO PROAR</span><h2>{name}</h2><p>{descriptions[name] || `Consulte, cadastre e acompanhe todas as informações de ${name.toLowerCase()} em um só lugar.`}</p></div><div className="management-actions"><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Imprimir</button><button className="outline-btn" onClick={exportRecords}><ArrowDownRight size={14}/> Exportar</button><button className="primary-btn" onClick={() => onOpen(`Novo registro • ${name}`)}><Plus size={16}/> {name === "Compras" ? "Nova compra" : name === "Fornecedores" ? "Novo fornecedor" : name === "Financeiro" ? "Novo lançamento" : "Novo registro"}</button></div></div>
    <div className="management-stats"><article><span><ClipboardList size={18}/></span><div><small>TOTAL DE REGISTROS</small><strong>{records.length}</strong></div></article><article><span><Clock3 size={18}/></span><div><small>PENDENTES / EM ABERTO</small><strong>{records.filter(record => /Rascunho|Aguardando|aberto|Vencida|Pendente/i.test(record.status || "")).length}</strong></div></article><article><span><CircleDollarSign size={18}/></span><div><small>VALOR REGISTRADO</small><strong>R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article></div>
    {managementFlows[name] && <div className="management-flow">{managementFlows[name].map((step, index) => <article key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{step.title}</b><small>{step.text}</small></div>{index < managementFlows[name].length - 1 && <ChevronRight size={14}/>}</article>)}</div>}
    <nav className="management-tabs" aria-label={`Áreas de ${name}`}>{tabs.map(tab => <button key={tab} className={activeView === tab ? "active" : ""} onClick={() => setActiveView(tab)}>{tab}</button>)}</nav>
    {name === "Financeiro" && <div className="finance-control-strip"><article><span className="money-icon red"><ArrowDownRight size={17}/></span><div><small>COMPROMISSOS EM ABERTO</small><strong>R$ {openValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article><article><span className="money-icon green"><ArrowUpRight size={17}/></span><div><small>MOVIMENTAÇÃO REALIZADA</small><strong>R$ {records.filter(record => /Paga|Recebida/i.test(record.status || "")).reduce((sum, record) => sum + (record.value ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article><article><span><Landmark size={17}/></span><div><small>CONCILIAÇÃO</small><strong>{records.filter(record => /Paga|Recebida/i.test(record.status || "")).length} movimento(s)</strong></div></article></div>}
    <div className="management-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Pesquisar em ${name.toLowerCase()}...`}/></label><label className="status-filter"><Filter size={14}/><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>Todas</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label></div>
    {records.length ? <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><ClipboardList size={12}/> {activeView.toUpperCase()}</span><h2>{activeView} de {name.toLowerCase()}</h2><p>{filtered.length} de {records.length} registro(s)</p></div></div><div className="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>NOME / IDENTIFICAÇÃO</th><th>FORNECEDOR / RESPONSÁVEL</th><th>SITUAÇÃO</th><th>VALOR</th><th>DATA</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(record => <tr key={record.id}><td><b className="order-id">{record.id}</b></td><td><strong>{record.name}</strong><small className="table-description">{name === "Compras" ? `${record.purchaseItems?.length ?? 0} item(ns) • ${record.paymentType ?? "Pagamento não informado"}${record.installments && record.installments > 1 ? ` • ${record.installments}x` : ""}` : record.description || "Sem observações"}</small></td><td>{record.client || "—"}</td><td><span className={`workflow-status ${/Recebida|Paga|Ativo|Concluído/i.test(record.status || "") ? "done" : /Cancelada|Inativo|Bloqueado|Devolvida/i.test(record.status || "") ? "blocked" : ""}`}>{record.status || statuses[0]}</span></td><td><b>R$ {(record.value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></td><td>{record.date ? new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR") : record.createdAt}</td><td><div className="record-actions"><button title="Avançar situação" onClick={() => advance(record)}><CheckCircle2 size={14}/></button>{name === "Compras" && <button title="Duplicar compra" onClick={() => duplicate(record)}><FileText size={14}/></button>}<button title="Imprimir" onClick={() => window.print()}><ReceiptText size={14}/></button><button className="danger" title="Excluir" onClick={() => onDelete(name, record)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="linked-empty"><Search size={22}/><h4>Nenhum registro encontrado</h4><p>Ajuste a pesquisa ou o filtro de situação.</p></div>}</div> :
    <div className="empty-grid">{[{t:"Visão geral",i:LayoutDashboard},{t:"Registros recentes",i:Clock3},{t:"Indicadores",i:TrendingUp}].map(({t,i:Icon})=><article className="panel" key={t}><span><Icon size={19}/></span><h3>{t}</h3><p>Use “Novo registro” para adicionar o primeiro cadastro deste módulo.</p><button onClick={() => onOpen(`Novo registro • ${name}`)}>Cadastrar agora <ArrowRight size={12}/></button></article>)}</div>}</section>;
}

type ModalSave = {
  title: string;
  name: string;
  client: string;
  doc: string;
  contact: string;
  phone: string;
  address: string;
  unit: string;
  tech: string;
  date: string;
  time: string;
  description: string;
  status: string;
  value: number;
  category: string;
  kind: "Serviço" | "Produto";
  catalogItems: { id: string; name: string; kind: "Serviço" | "Produto" }[];
  purchaseItems: PurchaseItem[];
  paymentType: "À vista" | "A prazo";
  paymentMethod: string;
  installments: number;
  firstDueDate: string;
  paymentInstallments: PurchaseInstallment[];
  xmlImported: boolean;
  supplierDoc: string;
  supplierId: string;
  registerSupplier: boolean;
};

type AuthenticatedUser = { username: string; displayName: string; role?: string; permissions?: string[] };

function LoginScreen({ onLogin }: { onLogin: (user: AuthenticatedUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar.");
      onLogin({ username: result.username, displayName: result.displayName, role: result.role, permissions: result.permissions });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };
  return <main className="login-page">
    <section className="login-brand">
      <img className="login-official-logo" src="/proar-logo.png" alt="ProAR — Gestão de Serviços"/>
      <span>SISTEMA INTEGRADO DE GESTÃO</span>
      <h1>Bem-vindo ao ProAR</h1>
      <p>Clientes, ordens de serviço, agenda, estoque e financeiro sincronizados num único sistema.</p>
      <div className="login-security"><ShieldCheck size={18}/><div><b>Acesso protegido</b><small>Os dados são compartilhados com segurança entre computador e celular.</small></div></div>
    </section>
    <section className="login-panel">
      <form onSubmit={submit}>
        <span className="section-kicker"><ShieldCheck size={12}/> ACESSO RESTRITO</span>
        <h2>Entrar no sistema</h2>
        <p>Utilize o seu nome de utilizador e senha.</p>
        <label>Utilizador<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Nome do utilizador"/></label>
        <label>Senha<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Digite a sua senha"/><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        {error && <div className="login-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
        <button className="login-submit" disabled={loading || !username || !password}>{loading ? "Verificando..." : <><LogIn size={17}/> Entrar</>}</button>
      </form>
    </section>
  </main>;
}

function Modal({ title, customers, catalogRecords, supplierRecords, close, onSave }: { title: string; customers: Customer[]; catalogRecords: ModuleRecord[]; supplierRecords: ModuleRecord[]; close: () => void; onSave: (data: ModalSave) => void }) {
  const isLinkedStructure = title.startsWith("Nova unidade, filial ou setor");
  const isNewOrder = title === "Nova ordem de serviço";
  const isNewCustomer = title === "Novo cliente";
  const isCatalogRegistration = title.includes("Serviços") || title.includes("Produtos");
  const [selectedClient, setSelectedClient] = useState("");
  const [unit, setUnit] = useState("");
  const [tech, setTech] = useState("");
  const [time, setTime] = useState("");
  const [recordName, setRecordName] = useState("");
  const [recordClient, setRecordClient] = useState("");
  const [doc, setDoc] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [addressValidated, setAddressValidated] = useState(false);
  const [showAddressMap, setShowAddressMap] = useState(false);
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const requestedModule = title.includes("•") ? title.split("•").pop()!.trim() : title.replace(/^Novo(a)?\s+/i, "");
  const [recordStatus, setRecordStatus] = useState(moduleStatuses[requestedModule]?.[0] ?? "Ativo");
  const [recordValue, setRecordValue] = useState("");
  const [recordCategory, setRecordCategory] = useState("");
  const [recordKind, setRecordKind] = useState<"Serviço" | "Produto">(title.includes("Produtos") ? "Produto" : "Serviço");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([{ id: `ITEM-${Date.now()}`, description: "", quantity: 1, unitValue: 0 }]);
  const [paymentType, setPaymentType] = useState<"À vista" | "A prazo">("À vista");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState("");
  const [paymentInstallments, setPaymentInstallments] = useState<PurchaseInstallment[]>([]);
  const [xmlImportStatus, setXmlImportStatus] = useState("");
  const [xmlImported, setXmlImported] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [supplierDoc, setSupplierDoc] = useState("");
  const purchaseTotal = purchaseItems.reduce((total, item) => total + item.quantity * item.unitValue, 0);
  const updatePurchaseItem = (id: string, changes: Partial<PurchaseItem>) => setPurchaseItems(items => items.map(item => item.id === id ? { ...item, ...changes } : item));
  const addPurchaseItem = () => setPurchaseItems(items => [...items, { id: `ITEM-${Date.now()}-${items.length}`, description: "", quantity: 1, unitValue: 0 }]);
  const removePurchaseItem = (id: string) => setPurchaseItems(items => items.length === 1 ? items : items.filter(item => item.id !== id));
  const normalizeKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const importPurchaseXml = async (file?: File) => {
    if (!file) return;
    setXmlImportStatus("A processar o XML...");
    try {
      const xml = new DOMParser().parseFromString(await file.text(), "application/xml");
      if (xml.querySelector("parsererror")) throw new Error("XML inválido");
      const byTag = (root: ParentNode, tag: string) => {
        const scoped = root as XMLDocument | Element;
        return scoped.getElementsByTagNameNS?.("*", tag)?.[0]?.textContent?.trim() || scoped.getElementsByTagName?.(tag)?.[0]?.textContent?.trim() || "";
      };
      const elements = (tag: string) => Array.from(xml.getElementsByTagNameNS("*", tag).length ? xml.getElementsByTagNameNS("*", tag) : xml.getElementsByTagName(tag));
      const emit = elements("emit")[0];
      const ide = elements("ide")[0];
      const supplier = emit ? byTag(emit, "xNome") : "";
      const supplierDoc = emit ? byTag(emit, "CNPJ") || byTag(emit, "CPF") : "";
      const invoiceNumber = ide ? byTag(ide, "nNF") : "";
      const issueDate = ide ? byTag(ide, "dhEmi") || byTag(ide, "dEmi") : "";
      const importedItems = elements("det").map((det, index) => {
        const product = Array.from(det.getElementsByTagNameNS("*", "prod"))[0] || det.getElementsByTagName("prod")[0];
        const description = byTag(product || det, "xProd") || `Item ${index + 1}`;
        const existingProduct = catalogRecords.find(item => (item.kind || "Serviço") === "Produto" && normalizeKey(item.name) === normalizeKey(description));
        return { id: `XML-${Date.now()}-${index}`, description, quantity: Number(byTag(product || det, "qCom")) || 1, unitValue: Number(byTag(product || det, "vUnCom")) || Number(byTag(product || det, "vProd")) || 0, productId: existingProduct?.id || "", registerProduct: !existingProduct };
      }).filter(item => item.description && item.quantity > 0);
      if (!importedItems.length) throw new Error("Nenhum item de compra encontrado");
      const importedInstallments = elements("dup").map((dup, index) => ({ number: byTag(dup, "nDup") || String(index + 1), dueDate: byTag(dup, "dVenc"), value: Number(byTag(dup, "vDup")) || 0 })).filter(item => item.dueDate || item.value > 0);
      const paymentCode = elements("detPag")[0] ? byTag(elements("detPag")[0], "tPag") : "";
      const paymentNames: Record<string, string> = { "01": "Dinheiro", "03": "Cartão de crédito", "04": "Cartão de débito", "15": "Boleto", "16": "Depósito bancário", "17": "PIX", "18": "Transferência bancária", "90": "Sem pagamento", "99": "Outros" };
      setPurchaseItems(importedItems);
      setRecordName(`NF-e ${invoiceNumber || file.name.replace(/\.xml$/i, "")}`);
      setRecordClient(supplier || "Fornecedor do XML");
      setDoc(supplierDoc);
      setSupplierDoc(supplierDoc);
      const existingSupplier = supplierRecords.find(item => normalizeKey(item.name) === normalizeKey(supplier));
      setSupplierId(existingSupplier?.id || "");
      if (existingSupplier) setRecordClient(existingSupplier.name);
      setDate(issueDate ? issueDate.slice(0, 10) : "");
      setRecordCategory("Compra importada por XML");
      setDescription(`NF-e ${invoiceNumber || "sem número"}${supplierDoc ? ` • CNPJ/CPF ${supplierDoc}` : ""} • Arquivo ${file.name}`);
      setPaymentMethod(paymentNames[paymentCode] || (importedInstallments.length ? "Boleto" : "Outros"));
      setPaymentInstallments(importedInstallments);
      setXmlImported(true);
      setPaymentType(importedInstallments.length ? "A prazo" : "À vista");
      setInstallments(Math.max(1, importedInstallments.length));
      setFirstDueDate(importedInstallments[0]?.dueDate || "");
      setXmlImportStatus(`XML importado: ${importedItems.length} item(ns)${importedInstallments.length ? ` e ${importedInstallments.length} parcela(s)` : ""}. Revise os dados antes de salvar.`);
    } catch (error) {
      setXmlImportStatus(error instanceof Error ? `Não foi possível importar: ${error.message}.` : "Não foi possível importar este XML.");
    }
  };
  const parentCustomer = isLinkedStructure ? title.split("•")[1]?.trim() : "";
  const selectedClientData = customers.find(customer => customer.name === selectedClient);
  const availableUnits = selectedClient ? [
    ...(selectedClientData ? [{ icon: Building2, name: "Endereço principal", type: "Cliente principal", doc: selectedClientData.doc, responsible: selectedClientData.contact, phone: selectedClientData.phone, address: selectedClientData.address, orders: 0 }] : []),
    ...(linkedUnits[selectedClient] ?? []),
    ...(linkedSectors[selectedClient] ?? []),
  ].filter((unit, index, list) => list.findIndex(item => item.name === unit.name) === index) : [];
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}><button className="modal-backdrop" onClick={close} aria-label="Fechar janela"/><div className="modal"><div className="modal-head"><div><span>{isLinkedStructure ? "ESTRUTURA DO CLIENTE • LIMITE DE 20" : "CADASTRO PROAR"}</span><h2>{isLinkedStructure ? "Nova unidade, filial ou setor" : title}</h2>{isLinkedStructure && <p>Este registro será vinculado a <strong>{parentCustomer}</strong>.</p>}</div><button onClick={close} aria-label="Fechar"><X size={18}/></button></div><div className="form-grid">
    {isLinkedStructure ? <>
      <label>Cliente principal<input value={parentCustomer} readOnly/></label>
      <label>Tipo de vínculo<select><option>Unidade</option><option>Filial</option><option>Setor</option><option>Secretaria</option><option>Departamento</option><option>Empresa vinculada</option></select></label>
      <label>Nome da unidade ou setor<input placeholder="Ex.: Filial Olímpia ou Secretaria de Saúde"/></label>
      <label>Razão social<input placeholder="Razão social vinculada"/></label>
      <label>Nome fantasia<input placeholder="Nome fantasia"/></label>
      <label>CNPJ<input placeholder="00.000.000/0000-00"/></label>
      <label>Responsável<input placeholder="Nome do responsável local"/></label>
      <label>Telefone / WhatsApp<input placeholder="(00) 00000-0000"/></label>
      <label className="wide">Endereço<input placeholder="CEP, rua, número, bairro, cidade e estado"/></label>
      <label className="wide">Observações<textarea placeholder="Informações específicas desta unidade, empresa ou setor..."/></label>
    </> : <>
      {isNewOrder ? <>
        <label>Cliente cadastrado<select value={selectedClient} onChange={event => setSelectedClient(event.target.value)}><option value="">Selecione o cliente</option>{customers.map(customer => <option key={customer.doc} value={customer.name}>{customer.name} • {customer.doc}</option>)}</select></label>
        <label>Unidade, filial ou setor<select value={unit} onChange={event => setUnit(event.target.value)} disabled={!selectedClient}><option value="">{selectedClient ? "Selecione o local do atendimento" : "Selecione primeiro o cliente"}</option>{availableUnits.map(item => <option key={item.name} value={item.name}>{item.name} • {item.type}</option>)}</select></label>
        <label>Responsável do cliente<input value={selectedClientData?.contact ?? ""} readOnly placeholder="Carregado pelo cadastro"/></label>
        <label>Telefone<input value={selectedClientData?.phone ?? ""} readOnly placeholder="Carregado pelo cadastro"/></label>
        <label className="wide">Endereço do atendimento<input value={unit ? availableUnits.find(item => item.name === unit)?.address ?? selectedClientData?.address ?? "" : selectedClientData?.address ?? ""} readOnly placeholder="Carregado pelo cadastro do cliente"/></label>
        <label>Data do atendimento<input type="date" value={date} onInput={event => setDate(event.currentTarget.value)} onChange={event => setDate(event.target.value)}/></label>
        <label>Horário<input type="time" value={time} onChange={event => setTime(event.target.value)}/></label>
        <label>Técnico empenhado<select value={tech} onChange={event => setTech(event.target.value)}><option value="">Selecione o técnico</option><option>Tiago Viana</option><option>João Carlos</option><option>Caio Henrique</option><option>Thiago Souza</option><option>Lucas Mendes</option></select></label>
        <label>Prioridade<select><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>
        <div className="wide order-catalog">
          <div className="execution-head"><div><span>SERVIÇOS CADASTRADOS</span><h3>Selecione os itens da ordem</h3></div><small>{selectedCatalogIds.length} selecionado(s)</small></div>
          <div className="catalog-check-list">{catalogRecords.filter(item => (item.kind || "Serviço") === "Serviço").map(item => <label key={item.id} className={selectedCatalogIds.includes(item.id) ? "selected" : ""}><input type="checkbox" checked={selectedCatalogIds.includes(item.id)} onChange={() => setSelectedCatalogIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}/><span><Wrench size={15}/></span><div><b>{item.name}</b><small>{item.description || "Serviço cadastrado"}</small></div><CheckCircle2 size={15}/></label>)}</div>
          {!catalogRecords.some(item => (item.kind || "Serviço") === "Serviço") && <div className="catalog-empty"><Wrench size={19}/><span>Nenhum serviço cadastrado. Cadastre no menu Serviços para selecionar aqui.</span></div>}
        </div>
        <label className="wide">Descrição / solicitação<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Descreva o atendimento, problema informado ou observações..."/></label>
        <div className="wide execution-notice"><ShieldCheck size={18}/><div><b>Execução disponível após salvar</b><small>Abra a ordem para fazer check-in, check-out, incluir fotos e recolher as duas assinaturas.</small></div></div>
      </> : isNewCustomer ? <>
        <label>Nome / Razão social<input value={recordName} onChange={event => setRecordName(event.target.value)} placeholder="Nome completo ou razão social"/></label>
        <label>CPF ou CNPJ<input value={doc} onChange={event => setDoc(event.target.value)} placeholder="00.000.000/0000-00"/></label>
        <label>Responsável<input value={contact} onChange={event => setContact(event.target.value)} placeholder="Nome do responsável"/></label>
        <label>Telefone / WhatsApp<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="(00) 00000-0000"/></label>
        <label className="wide">Endereço completo<input value={address} onChange={event => { setAddress(event.target.value); setAddressValidated(false); setShowAddressMap(false); }} placeholder="CEP, rua, número, complemento, bairro, cidade e estado"/></label>
        <div className="wide address-validation">
          <div><span className="map-validation-icon"><MapPin size={18}/></span><div><b>Validar endereço no Google Maps</b><small>Confira rua, número, bairro e cidade antes de salvar o cliente.</small></div></div>
          <button type="button" disabled={!address.trim()} onClick={() => { setShowAddressMap(true); setAddressValidated(true); }}>{addressValidated ? <CheckCircle2 size={15}/> : <Search size={15}/>} {addressValidated ? "Endereço validado" : "Buscar e validar"}</button>
          {showAddressMap && address.trim() && <div className="address-map-preview"><iframe title={`Validação de ${address}`} src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Ver resultado completo no Google Maps <ArrowRight size={12}/></a></div>}
        </div>
        <label className="wide">Observações<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Informações adicionais do cliente..."/></label>
      </> : <>
        {isCatalogRegistration && <div className="wide kind-selector"><span>TIPO DO CADASTRO</span><label className={recordKind === "Serviço" ? "active" : ""}><input type="radio" name="record-kind" checked={recordKind === "Serviço"} onChange={() => setRecordKind("Serviço")}/><Wrench size={17}/><div><b>Serviço</b><small>Será disponibilizado nas ordens de serviço</small></div></label><label className={recordKind === "Produto" ? "active" : ""}><input type="radio" name="record-kind" checked={recordKind === "Produto"} onChange={() => setRecordKind("Produto")}/><Package size={17}/><div><b>Produto</b><small>Item físico, peça ou material de estoque</small></div></label></div>}
        {managementFlows[requestedModule] && <div className="wide module-form-guidance"><span><Grid2X2 size={18}/></span><div><b>Cadastro integrado de ${requestedModule.toLowerCase()}</b><small>Ao salvar, o registro ficará disponível nas abas, filtros e relatórios deste fluxo.</small></div></div>}
        {requestedModule === "Compras" && <div className="wide purchase-xml-import">
          <span className="purchase-xml-icon"><FileText size={21}/></span><div><b>Importar XML da NF-e</b><small>Preenche automaticamente fornecedor, nota fiscal, itens, valores e parcelas do Contas a Pagar.</small>{xmlImportStatus && <em className={xmlImportStatus.startsWith("Não") ? "error" : "success"}>{xmlImportStatus}</em>}</div>
          <label className="xml-upload-button"><FileText size={15}/> Selecionar XML<input type="file" accept=".xml,text/xml,application/xml" onChange={event => { void importPurchaseXml(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label>
        </div>}
        {requestedModule === "Compras" && xmlImported && <div className="wide xml-registration-review">
          <div className="xml-review-head"><div><span>VINCULAÇÃO DOS CADASTROS</span><h3>Fornecedor e produtos encontrados no XML</h3></div><small>Escolha um cadastro existente ou autorize a criação automática.</small></div>
          <div className="xml-supplier-link"><div><Store size={17}/><span><b>{recordClient}</b><small>{supplierDoc || "Documento não informado no XML"}</small></span></div><label>Fornecedor<select value={supplierId || "__new__"} onChange={event => { const value = event.target.value; setSupplierId(value === "__new__" ? "" : value); const existing = supplierRecords.find(item => item.id === value); if (existing) setRecordClient(existing.name); }}><option value="__new__">Cadastrar novo fornecedor</option>{supplierRecords.map(item => <option key={item.id} value={item.id}>Usar cadastro: {item.name}</option>)}</select></label></div>
          <div className="xml-product-links">{purchaseItems.map(item => <div key={item.id}><span><Package size={15}/><b>{item.description}</b></span><select value={item.productId || "__new__"} onChange={event => updatePurchaseItem(item.id, { productId: event.target.value === "__new__" ? "" : event.target.value, registerProduct: event.target.value === "__new__" })}><option value="__new__">Cadastrar novo produto</option>{catalogRecords.filter(product => (product.kind || "Serviço") === "Produto").map(product => <option key={product.id} value={product.id}>Usar: {product.name}</option>)}</select></div>)}</div>
        </div>}
        {requestedModule === "Compras" && <div className="wide purchase-editor">
          <div className="purchase-editor-head"><div><span>ITENS DA COMPRA</span><h3>Produtos e materiais</h3></div><button type="button" onClick={addPurchaseItem}><Plus size={14}/> Adicionar item</button></div>
          <div className="purchase-item-labels"><span>DESCRIÇÃO DO ITEM</span><span>QUANTIDADE</span><span>VALOR UNITÁRIO</span><span>SUBTOTAL</span><span/></div>
          <div className="purchase-items">{purchaseItems.map(item => <div className="purchase-item-row" key={item.id}>
            <input value={item.description} onChange={event => updatePurchaseItem(item.id, { description: event.target.value })} placeholder="Produto, peça ou material"/>
            <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={event => updatePurchaseItem(item.id, { quantity: Math.max(0, Number(event.target.value)) })}/>
            <input type="number" min="0" step="0.01" value={item.unitValue || ""} onChange={event => updatePurchaseItem(item.id, { unitValue: Math.max(0, Number(event.target.value)) })} placeholder="R$ 0,00"/>
            <b>R$ {(item.quantity * item.unitValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>
            <button type="button" className="danger" disabled={purchaseItems.length === 1} onClick={() => removePurchaseItem(item.id)} aria-label="Excluir item"><Trash2 size={14}/></button>
          </div>)}</div>
          <div className="purchase-total"><span>{purchaseItems.filter(item => item.description.trim()).length} item(ns)</span><div><small>TOTAL DA COMPRA</small><strong>R$ {purchaseTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></div>
        </div>}
        {requestedModule === "Compras" && <div className="wide purchase-payment">
          <div className="purchase-payment-title"><span><CreditCard size={18}/></span><div><b>Condição de pagamento</b><small>Compras a prazo serão lançadas automaticamente em Contas a Pagar.</small></div></div>
          <div className="payment-type-options"><label className={paymentType === "À vista" ? "active" : ""}><input type="radio" name="purchase-payment-type" checked={paymentType === "À vista"} onChange={() => { setPaymentType("À vista"); setInstallments(1); setPaymentInstallments([]); }}/><b>À vista</b><small>Um único pagamento</small></label><label className={paymentType === "A prazo" ? "active" : ""}><input type="radio" name="purchase-payment-type" checked={paymentType === "A prazo"} onChange={() => { setPaymentType("A prazo"); setPaymentInstallments([]); }}/><b>A prazo</b><small>Gerar parcelas no financeiro</small></label></div>
          <div className="purchase-payment-fields"><label>Forma de pagamento<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option>PIX</option><option>Boleto</option><option>Transferência bancária</option><option>Cartão de crédito</option><option>Cheque</option><option>Dinheiro</option><option>Outros</option></select></label>{paymentType === "A prazo" && <><label>Número de parcelas<input type="number" min="1" max="48" value={installments} onChange={event => { setInstallments(Math.max(1, Math.min(48, Number(event.target.value)))); setPaymentInstallments([]); }}/></label><label>Primeiro vencimento<input type="date" value={firstDueDate} onChange={event => { setFirstDueDate(event.target.value); setPaymentInstallments([]); }}/></label><div className="installment-preview"><small>{paymentInstallments.length ? "PARCELAS IMPORTADAS DO XML" : "VALOR ESTIMADO POR PARCELA"}</small><b>{paymentInstallments.length ? `${paymentInstallments.length} vencimento(s)` : `R$ ${(purchaseTotal / Math.max(installments, 1)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}</b></div></>}</div>
        </div>}
        <label>{requestedModule === "Compras" ? "Produto, material ou pedido" : requestedModule === "Financeiro" ? "Descrição do lançamento" : requestedModule === "Fornecedores" ? "Razão social / Nome fantasia" : requestedModule === "Funcionários" ? "Nome completo do funcionário" : "Nome / identificação"}<input value={recordName} onChange={event => setRecordName(event.target.value)} placeholder={requestedModule === "Funcionários" ? "Nome completo" : "Digite o nome do registro"}/></label>
        <label>{requestedModule === "Compras" ? "Fornecedor" : requestedModule === "Financeiro" ? "Cliente ou fornecedor" : requestedModule === "Fornecedores" ? "Responsável comercial" : requestedModule === "Funcionários" ? "Utilizador de acesso" : "Cliente / responsável"}<input value={recordClient} onChange={event => setRecordClient(event.target.value)} placeholder={requestedModule === "Funcionários" ? "Ex.: nome.sobrenome" : "Nome relacionado ao cadastro"}/></label>
        <label>{requestedModule === "Fornecedores" ? "CNPJ / CPF" : requestedModule === "Funcionários" ? "CPF / documento" : "Código / documento"}<input placeholder="Código, CPF, CNPJ ou número interno"/></label>
        <label>Situação<select value={recordStatus} onChange={event => setRecordStatus(event.target.value)}>{(moduleStatuses[requestedModule] ?? ["Ativo", "Pendente", "Concluído", "Inativo"]).map(status => <option key={status}>{status}</option>)}</select></label>
        <label>{requestedModule === "Funcionários" ? "Função / nível de acesso" : requestedModule === "Financeiro" ? "Categoria / centro de custo" : requestedModule === "Compras" ? "Categoria da compra" : "Categoria / centro de custo"}<input value={recordCategory} onChange={event => setRecordCategory(event.target.value)} placeholder={requestedModule === "Funcionários" ? "Ex.: Técnico • acesso às ordens" : "Ex.: Materiais de serviço"}/></label>
        <label>{requestedModule === "Funcionários" ? "Comissão / valor de referência" : requestedModule === "Compras" ? "Valor total calculado" : "Valor total"}<input type="number" min="0" step="0.01" readOnly={requestedModule === "Compras"} value={requestedModule === "Compras" ? purchaseTotal : recordValue} onChange={event => setRecordValue(event.target.value)} placeholder="R$ 0,00"/></label>
        <label>{requestedModule === "Funcionários" ? "Telefone / WhatsApp" : "Telefone / contato"}<input placeholder="(00) 00000-0000"/></label><label>{requestedModule === "Funcionários" ? "Data de admissão" : requestedModule === "Compras" ? "Previsão de entrega" : requestedModule === "Financeiro" ? "Data de vencimento" : "Data"}<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label><label className="wide">{requestedModule === "Funcionários" ? "Permissões e observações" : "Descrição / observações"}<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder={requestedModule === "Funcionários" ? "Informe os módulos autorizados e observações do funcionário..." : "Inclua os detalhes deste cadastro..."}/></label>
      </>}
    </>}
  </div><div className="modal-actions"><button className="outline-btn" onClick={close}>Cancelar</button><button className="primary-btn" disabled={isNewOrder ? !selectedClient || !tech || !date : isNewCustomer ? !recordName || !address.trim() || !addressValidated : requestedModule === "Compras" ? !recordName || !recordClient || !purchaseItems.some(item => item.description.trim() && item.quantity > 0) || purchaseTotal <= 0 || (paymentType === "A prazo" && !firstDueDate) : (!isLinkedStructure && !recordName)} onClick={() => onSave({ title, name: recordName, client: isNewOrder ? selectedClient : recordClient, doc, contact, phone, address: isNewOrder ? (unit ? availableUnits.find(item => item.name === unit)?.address ?? selectedClientData?.address ?? "" : selectedClientData?.address ?? "") : address, unit, tech, date, time, description, status: recordStatus, value: requestedModule === "Compras" ? purchaseTotal : Number(recordValue) || 0, category: recordCategory, kind: recordKind, catalogItems: catalogRecords.filter(item => selectedCatalogIds.includes(item.id)).map(item => ({ id: item.id, name: item.name, kind: item.kind || "Serviço" })), purchaseItems: purchaseItems.filter(item => item.description.trim() && item.quantity > 0), paymentType, paymentMethod, installments: paymentType === "A prazo" ? Math.max(1, installments) : 1, firstDueDate, paymentInstallments, xmlImported, supplierDoc, supplierId, registerSupplier: xmlImported && !supplierId })}><CheckCircle2 size={15}/> Salvar registro</button></div></div></div>;
}

export default function Home() {
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [current, setCurrent] = useState("Painel inicial");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>(orders);
  const [customerRecords, setCustomerRecords] = useState<Customer[]>(customers);
  const [moduleRecords, setModuleRecords] = useState<Record<string, ModuleRecord[]>>({});
  const [savedMessage, setSavedMessage] = useState("");
  useEffect(() => {
    fetch("/api/auth").then(async response => response.ok ? response.json() : null).then(result => {
      if (result?.authenticated) setAuthenticatedUser({ username: result.username, displayName: result.displayName, role: result.role, permissions: result.permissions });
    }).finally(() => setCheckingSession(false));
  }, []);
  useEffect(() => {
    if (!authenticatedUser) return;
    const loadSharedState = async () => {
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const { state } = await response.json();
        if (state) {
          setServiceOrders(state.serviceOrders ?? []);
          setCustomerRecords(state.customers ?? []);
          setModuleRecords(state.moduleRecords ?? {});
          return;
        }
        const localState = {
          serviceOrders: JSON.parse(localStorage.getItem("proar-v3-service-orders") ?? "[]"),
          customers: JSON.parse(localStorage.getItem("proar-v3-customers") ?? "[]"),
          moduleRecords: JSON.parse(localStorage.getItem("proar-v3-module-records") ?? "{}"),
        };
        await fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(localState) });
        setServiceOrders(localState.serviceOrders);
        setCustomerRecords(localState.customers);
        setModuleRecords(localState.moduleRecords);
      } catch {
        setSavedMessage("A base compartilhada está temporariamente indisponível.");
      }
    };
    loadSharedState();
  }, [authenticatedUser]);
  const persistSharedState = (nextCustomers: Customer[], nextOrders: ServiceOrder[], nextModules: Record<string, ModuleRecord[]>) => {
    fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customers: nextCustomers, serviceOrders: nextOrders, moduleRecords: nextModules }),
    }).then(response => {
      if (!response.ok) setSavedMessage("Registro mantido neste aparelho, mas a sincronização falhou.");
    });
  };
  const updateServiceOrder = (updatedOrder: ServiceOrder) => {
    const updatedOrders = serviceOrders.map(order => order.id === updatedOrder.id ? updatedOrder : order);
    const reminderId = `LEM-${updatedOrder.id.replace(/\D/g, "")}`;
    let updatedModules = { ...moduleRecords };
    const currentReminders = updatedModules.Lembretes ?? [];
    if (updatedOrder.status === "Concluída" && updatedOrder.reminderEnabled && updatedOrder.reminderDate) {
      const customer = customerRecords.find(item => item.name === updatedOrder.client);
      const reminder: ModuleRecord = { id: reminderId, name: `Lembrete pós-serviço • ${updatedOrder.service}`, client: updatedOrder.client, description: updatedOrder.reminderMessage || "Está na hora de realizar a higienização preventiva do seu ar-condicionado.", reminderMessage: updatedOrder.reminderMessage || "Está na hora de realizar a higienização preventiva do seu ar-condicionado.", createdAt: new Date().toLocaleString("pt-BR"), status: "Agendado", date: updatedOrder.reminderDate, category: customer?.phone || "", serviceOrderId: updatedOrder.id };
      updatedModules = { ...updatedModules, Lembretes: [reminder, ...currentReminders.filter(item => item.id !== reminderId)] };
    } else if (!updatedOrder.reminderEnabled) {
      updatedModules = { ...updatedModules, Lembretes: currentReminders.filter(item => item.id !== reminderId) };
    }
    setServiceOrders(updatedOrders);
    setModuleRecords(updatedModules);
    setSelectedOrder(updatedOrder);
    localStorage.setItem("proar-v3-service-orders", JSON.stringify(updatedOrders));
    localStorage.setItem("proar-v3-module-records", JSON.stringify(updatedModules));
    persistSharedState(customerRecords, updatedOrders, updatedModules);
    setSavedMessage(updatedOrder.status === "Concluída" && updatedOrder.reminderEnabled ? `Ordem ${updatedOrder.id} concluída e lembrete agendado.` : `Ordem ${updatedOrder.id} atualizada e sincronizada.`);
    window.setTimeout(() => setSavedMessage(""), 2500);
  };
  const saveRecord = (data: ModalSave) => {
    if (data.title === "Novo cliente") {
      const newCustomer: Customer = {
        id: `CLI-${Date.now().toString().slice(-6)}`,
        name: data.name,
        doc: data.doc,
        contact: data.contact,
        phone: data.phone,
        address: data.address,
        units: 0,
        status: "Ativo",
      };
      const updatedCustomers = [newCustomer, ...customerRecords];
      setCustomerRecords(updatedCustomers);
      localStorage.setItem("proar-v3-customers", JSON.stringify(updatedCustomers));
      persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
      setCurrent("Clientes");
      setSavedMessage(`Cliente ${newCustomer.name} cadastrado com sucesso.`);
    } else if (data.title === "Nova ordem de serviço") {
      const sequence = Math.max(15499, ...serviceOrders.map(order => Number(order.id.replace(/\D/g, "")) || 0)) + 1;
      const newOrder: ServiceOrder = {
        id: `#OS-${String(sequence).padStart(5, "0")}`,
        client: data.client,
        unit: data.unit || "Unidade principal",
        service: data.catalogItems.length ? data.catalogItems.map(item => item.name).join(", ") : data.description || "Atendimento técnico",
        tech: data.tech,
        date: data.date,
        time: data.time || "A definir",
        address: data.address,
        status: "Agendada",
        tone: "violet",
        avatar: data.client.split(" ").map(word => word[0]).slice(0, 2).join("").toUpperCase(),
        catalogItems: data.catalogItems,
      };
      const updatedOrders = [newOrder, ...serviceOrders];
      setServiceOrders(updatedOrders);
      localStorage.setItem("proar-v3-service-orders", JSON.stringify(updatedOrders));
      persistSharedState(customerRecords, updatedOrders, moduleRecords);
      setCurrent("Ordens de serviço");
      setSavedMessage(`Ordem ${newOrder.id} gravada com sucesso.`);
    } else {
      const requestedModule = data.title.includes("•") ? data.title.split("•").pop()!.trim() : data.title.replace(/^Novo(a)?\s+/i, "");
      const moduleName = requestedModule === "Serviços" || requestedModule === "Produtos" ? `${data.kind}s` : requestedModule;
      const record: ModuleRecord = {
        id: `${moduleName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        name: data.name || moduleName,
        client: data.client,
        description: data.description,
        createdAt: new Date().toLocaleString("pt-BR"),
        kind: requestedModule === "Serviços" || requestedModule === "Produtos" ? data.kind : undefined,
        status: data.status,
        date: data.date,
        value: data.value,
        category: data.category,
        purchaseItems: data.purchaseItems,
        paymentType: data.paymentType,
        paymentMethod: data.paymentMethod,
        installments: data.installments,
        firstDueDate: data.firstDueDate,
        paymentInstallments: data.paymentInstallments,
      };
      let updatedRecords = { ...moduleRecords, [moduleName]: [record, ...(moduleRecords[moduleName] ?? [])] };
      if (moduleName === "Compras" && data.xmlImported) {
        const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const currentSuppliers = updatedRecords.Fornecedores ?? [];
        if (data.registerSupplier && !currentSuppliers.some(item => normalize(item.name) === normalize(data.client))) {
          const supplier: ModuleRecord = { id: `FOR-${Date.now().toString().slice(-6)}`, name: data.client, client: data.client, description: `${data.supplierDoc ? `CNPJ/CPF ${data.supplierDoc} • ` : ""}Fornecedor cadastrado automaticamente pela importação do XML`, createdAt: new Date().toLocaleString("pt-BR"), status: "Ativo", category: "Fornecedor de produtos" };
          updatedRecords = { ...updatedRecords, Fornecedores: [supplier, ...currentSuppliers] };
        }
        const currentProducts = updatedRecords.Produtos ?? [];
        const newProducts: ModuleRecord[] = [];
        data.purchaseItems.filter(item => item.registerProduct && !item.productId).forEach((item, index) => {
          const existing = [...currentProducts, ...newProducts].find(product => normalize(product.name) === normalize(item.description));
          if (existing) item.productId = existing.id;
          else {
            const product: ModuleRecord = { id: `PRO-${Date.now().toString().slice(-5)}-${index + 1}`, name: item.description, client: data.client, description: `Produto cadastrado automaticamente pela compra ${record.id}`, createdAt: new Date().toLocaleString("pt-BR"), kind: "Produto", status: "Ativo", value: item.unitValue, category: data.category || "Produto importado por XML" };
            item.productId = product.id;
            newProducts.push(product);
          }
        });
        record.purchaseItems = data.purchaseItems;
        if (newProducts.length) updatedRecords = { ...updatedRecords, Produtos: [...newProducts, ...currentProducts] };
      }
      if (moduleName === "Compras" && data.paymentType === "A prazo") {
        const baseDueDate = new Date(`${data.firstDueDate}T12:00:00`);
        const installmentCount = Math.max(1, data.paymentInstallments.length || data.installments);
        const baseInstallmentValue = Number((data.value / installmentCount).toFixed(2));
        const payables: ModuleRecord[] = Array.from({ length: installmentCount }, (_, index) => {
          const xmlInstallment = data.paymentInstallments[index];
          const dueDate = xmlInstallment?.dueDate ? new Date(`${xmlInstallment.dueDate}T12:00:00`) : new Date(baseDueDate);
          if (!xmlInstallment?.dueDate) dueDate.setMonth(baseDueDate.getMonth() + index);
          const installmentValue = xmlInstallment?.value || (index === installmentCount - 1 ? Number((data.value - baseInstallmentValue * (installmentCount - 1)).toFixed(2)) : baseInstallmentValue);
          return {
            id: `FIN-${record.id}-${String(index + 1).padStart(2, "0")}`,
            name: `Conta a pagar • ${record.name} • ${index + 1}/${installmentCount}`,
            client: data.client,
            description: `Compra ${record.id} • ${data.paymentMethod}${xmlInstallment ? " • Importado do XML" : ""}`,
            createdAt: new Date().toLocaleString("pt-BR"),
            status: "Em aberto",
            date: dueDate.toISOString().slice(0, 10),
            value: installmentValue,
            category: data.category || "Compra de produtos",
            paymentType: data.paymentType,
            paymentMethod: data.paymentMethod,
            purchaseId: record.id,
            installmentNumber: index + 1,
            installments: installmentCount,
          };
        });
        updatedRecords = { ...updatedRecords, Financeiro: [...payables, ...(moduleRecords.Financeiro ?? [])] };
      }
      setModuleRecords(updatedRecords);
      localStorage.setItem("proar-v3-module-records", JSON.stringify(updatedRecords));
      persistSharedState(customerRecords, serviceOrders, updatedRecords);
      setCurrent(moduleName);
      setSavedMessage(moduleName === "Compras" && data.paymentType === "A prazo" ? `Compra gravada e ${Math.max(1, data.paymentInstallments.length || data.installments)} parcela(s) lançada(s) em Contas a Pagar.` : "Registro gravado com sucesso.");
    }
    setModal("");
    window.setTimeout(() => setSavedMessage(""), 3500);
  };
  const titles: Record<string,string> = { "Painel inicial": "Bom dia, Tiago", "Clientes": "Gestão de clientes" };
  const subtitles: Record<string,string> = { "Painel inicial": "Uma visão completa da sua empresa em tempo real.", "Clientes": "Cadastros, unidades, histórico e relacionamento." };
  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthenticatedUser(null);
  };
  const deleteCustomer = (customer: Customer) => {
    if (!window.confirm(`Excluir o cliente “${customer.name}”? Esta ação também remove o cadastro da base compartilhada.`)) return;
    const updatedCustomers = customerRecords.filter(item => item.id !== customer.id);
    setCustomerRecords(updatedCustomers);
    localStorage.setItem("proar-v3-customers", JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
    setSavedMessage("Cliente excluído com sucesso.");
  };
  const deleteOrder = (order: ServiceOrder) => {
    if (!window.confirm(`Excluir definitivamente a ordem ${order.id}?`)) return;
    const updatedOrders = serviceOrders.filter(item => item.id !== order.id);
    setServiceOrders(updatedOrders);
    localStorage.setItem("proar-v3-service-orders", JSON.stringify(updatedOrders));
    persistSharedState(customerRecords, updatedOrders, moduleRecords);
    setSelectedOrder(null);
    setSavedMessage(`Ordem ${order.id} excluída.`);
  };
  const deleteModuleRecord = (moduleName: string, record: ModuleRecord) => {
    if (!window.confirm(`Excluir o registro “${record.name}”?`)) return;
    const updatedModules = { ...moduleRecords, [moduleName]: (moduleRecords[moduleName] ?? []).filter(item => item.id !== record.id) };
    setModuleRecords(updatedModules);
    localStorage.setItem("proar-v3-module-records", JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage("Registro excluído com sucesso.");
  };
  const updateModuleRecord = (moduleName: string, record: ModuleRecord) => {
    const currentRecords = moduleRecords[moduleName] ?? [];
    const exists = currentRecords.some(item => item.id === record.id);
    let updatedModules = { ...moduleRecords, [moduleName]: exists ? currentRecords.map(item => item.id === record.id ? record : item) : [record, ...currentRecords] };
    if (moduleName === "Compras" && record.status === "Recebida") {
      const payableId = `FIN-${record.id}`;
      const stockId = `EST-${record.id}`;
      const hasPayable = (updatedModules["Financeiro"] ?? []).some(item => item.id === payableId || item.purchaseId === record.id);
      const hasStockEntry = (updatedModules["Estoque"] ?? []).some(item => item.id === stockId);
      if (!hasPayable) updatedModules = { ...updatedModules, "Financeiro": [{ ...record, id: payableId, name: `Conta a pagar • ${record.name}`, status: "Em aberto", category: record.category || "Compra de produtos", purchaseId: record.id, createdAt: new Date().toLocaleString("pt-BR") }, ...(updatedModules["Financeiro"] ?? [])] };
      if (!hasStockEntry) updatedModules = { ...updatedModules, "Estoque": [{ ...record, id: stockId, name: `Entrada • ${record.name}`, status: "Concluído", category: "Entrada por compra", createdAt: new Date().toLocaleString("pt-BR") }, ...(updatedModules["Estoque"] ?? [])] };
    }
    setModuleRecords(updatedModules);
    localStorage.setItem("proar-v3-module-records", JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage(moduleName === "Compras" && record.status === "Recebida" ? "Compra recebida: estoque e conta a pagar atualizados." : "Registro atualizado e sincronizado.");
    window.setTimeout(() => setSavedMessage(""), 3000);
  };
  if (checkingSession) return <div className="session-loading"><div className="brand-mark brand-logo"><img src="/icon.png" alt="ProAR"/></div><p>A carregar o ProAR...</p></div>;
  if (!authenticatedUser) return <LoginScreen onLogin={setAuthenticatedUser}/>;
  return <div className="app-shell">
    <Sidebar current={current} setCurrent={setCurrent} open={menuOpen} close={() => setMenuOpen(false)} permissions={authenticatedUser.permissions}/>
    <main className="main">
      <Header title={current === "Painel inicial" ? `Bom dia, ${authenticatedUser.displayName.split(" ")[0]}` : titles[current] || current} subtitle={subtitles[current] || "Controle integrado da sua operação."} onMenu={() => setMenuOpen(true)} onNewOrder={() => setModal("Nova ordem de serviço")} userName={authenticatedUser.displayName} userRole={authenticatedUser.role ?? "Utilizador"} onLogout={logout}/>
      {savedMessage && <div className="save-toast" role="status"><CheckCircle2 size={16}/>{savedMessage}</div>}
      <div className="page-content">{current === "Painel inicial" ? <Dashboard onNavigate={setCurrent} serviceOrders={serviceOrders}/> : current === "Clientes" ? <Customers onOpen={setModal} onDelete={deleteCustomer} customers={customerRecords}/> : current === "Agenda" ? <Agenda serviceOrders={serviceOrders} onOpen={setModal} onSelect={setSelectedOrder}/> : current === "Vendas" ? <SalesPDV customers={customerRecords}/> : current === "Relatórios" ? <Reports modules={moduleRecords} customers={customerRecords} serviceOrders={serviceOrders}/> : current === "Configurações" ? <WhatsAppSettingsPage/> : current === "Ordens de serviço" ? <ServiceOrders onOpen={setModal} onSelect={setSelectedOrder} onDelete={deleteOrder} serviceOrders={serviceOrders}/> : <GenericModule name={current} onOpen={setModal} onDelete={deleteModuleRecord} onUpdate={updateModuleRecord} records={moduleRecords[current] ?? []}/>}</div>
      <footer><span>© 2026 ProAR Gestão de Serviços</span><span><ShieldCheck size={12}/> Gestão segura e inteligente para prestadores de serviços.</span></footer>
    </main>
    {modal && <Modal title={modal} customers={customerRecords} catalogRecords={[...(moduleRecords["Serviços"] ?? []), ...(moduleRecords["Produtos"] ?? [])]} supplierRecords={moduleRecords["Fornecedores"] ?? []} close={() => setModal("")} onSave={saveRecord}/>}
    {selectedOrder && <OrderDetail order={selectedOrder} customerPhone={customerRecords.find(customer => customer.name === selectedOrder.client)?.phone} close={() => setSelectedOrder(null)} onUpdate={updateServiceOrder}/>} 
  </div>;
}

  
