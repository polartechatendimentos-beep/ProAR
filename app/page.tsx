"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type Dispatch, type FormEvent, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Bell, Boxes, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined,
  CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList,
  Clock3, FileChartColumn, FileText, Filter, Grid2X2, HandCoins, Headphones,
  ArrowLeft, Camera, Contact, Edit3, Eye, EyeOff, Hospital, Landmark, LayoutDashboard, LogIn, LogOut, MapPin,
  CreditCard, Keyboard, Menu, Minus, MoreHorizontal, Package, Phone, Plus, ReceiptText, ScanBarcode, School, Search, Settings,
  ShieldCheck, ShoppingBag, ShoppingCart, Store, TrendingUp, UserCheck, UserRound,
  PenTool, Tag, Trash2, Save, UploadCloud, KeyRound, LockKeyhole, BadgeCheck, ServerCog,
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
    { icon: Landmark, name: "Licitações" },
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

function OrderDetail({ order, close, onUpdate }: { order: ServiceOrder; close: () => void; onUpdate: (order: ServiceOrder) => void }) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [pdfMessage, setPdfMessage] = useState("");
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
  const formatMoment = (value?: string) => value ? new Date(value).toLocaleString("pt-BR") : "";
  const createOrderPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const pageWidth = 210;
    const margin = 13;
    const contentWidth = pageWidth - margin * 2;
    const blue = [15, 92, 190] as [number, number, number];
    const dark = [30, 43, 61] as [number, number, number];
    const gray = [102, 116, 135] as [number, number, number];
    const line = [205, 214, 225] as [number, number, number];
    const addImage = async (source: string | undefined, x: number, y: number, width: number, height: number) => {
      if (!source) return false;
      try { pdf.addImage(source, source.includes("image/png") ? "PNG" : "JPEG", x, y, width, height, undefined, "FAST"); return true; } catch { return false; }
    };
    const sectionTitle = (title: string, y: number) => {
      pdf.setFillColor(...blue); pdf.roundedRect(margin, y, contentWidth, 7, 1.2, 1.2, "F");
      pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text(title.toUpperCase(), margin + 3, y + 4.7);
      return y + 9;
    };
    const field = (label: string, value: string, x: number, y: number, width: number, height = 13) => {
      pdf.setDrawColor(...line); pdf.setFillColor(249, 251, 253); pdf.roundedRect(x, y, width, height, 1, 1, "FD");
      pdf.setTextColor(...gray); pdf.setFont("helvetica", "bold"); pdf.setFontSize(6); pdf.text(label.toUpperCase(), x + 2.3, y + 3.6);
      pdf.setTextColor(...dark); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text(pdf.splitTextToSize(value || "Não informado", width - 4.6), x + 2.3, y + 8);
    };
    try {
      const logoBlob = await fetch("/proar-logo.png").then(response => response.blob());
      const logoData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(logoBlob); });
      await addImage(logoData, margin, 9, 48, 25);
    } catch { /* mantém o cabeçalho textual se a logo não carregar */ }
    pdf.setTextColor(...dark); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.text("POLARTECH AR CONDICIONADO", 66, 15);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.2); pdf.text("Telefone: (17) 2122-2806", 66, 20); pdf.text("E-mail: atendimentos@polartechsolucoes.com.br", 66, 24); pdf.text("Mirassol - SP", 66, 28);
    pdf.setTextColor(...blue); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("ORDEM DE SERVIÇO", 197, 14, { align: "right" });
    pdf.setTextColor(...dark); pdf.setFontSize(16); pdf.text(currentOrder.id, 197, 22, { align: "right" });
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.text(`Gerada em ${new Date().toLocaleString("pt-BR")}`, 197, 28, { align: "right" });
    pdf.setDrawColor(...blue); pdf.setLineWidth(.8); pdf.line(margin, 37, 197, 37);

    let y = sectionTitle("Informações do cliente", 42);
    field("Cliente", currentOrder.client, margin, y, 88); field("Unidade / setor", currentOrder.unit || "Unidade principal", 103, y, 94); y += 15;
    field("Endereço do atendimento", currentOrder.address || "Não informado", margin, y, contentWidth); y += 15;

    y = sectionTitle("Informações da atividade", y + 1);
    field("Serviço", currentOrder.service || "Atendimento técnico", margin, y, 88); field("Técnico responsável", currentOrder.tech || "Não informado", 103, y, 94); y += 15;
    field("Data / horário", `${currentOrder.date ? new Date(`${currentOrder.date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"} - ${currentOrder.time || "A definir"}`, margin, y, 58);
    field("Situação", currentOrder.status, 73, y, 42); field("Check-in", currentOrder.checkInAt ? formatMoment(currentOrder.checkInAt) : "Não realizado", 117, y, 39); field("Check-out", currentOrder.checkOutAt ? formatMoment(currentOrder.checkOutAt) : "Não realizado", 158, y, 39); y += 15;

    y = sectionTitle("Serviços prestados", y + 1);
    const serviceLines = currentOrder.catalogItems?.length ? currentOrder.catalogItems.map((item, index) => `${index + 1}. ${item.name} (${item.kind})`) : [currentOrder.service || "Atendimento técnico"];
    const serviceHeight = Math.max(16, serviceLines.length * 6 + 5);
    pdf.setDrawColor(...line); pdf.roundedRect(margin, y, contentWidth, serviceHeight, 1, 1, "S"); pdf.setTextColor(...dark); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    serviceLines.forEach((text, index) => pdf.text(pdf.splitTextToSize(text, contentWidth - 6), margin + 3, y + 5 + index * 6)); y += serviceHeight + 2;

    y = sectionTitle("Checklist técnico", y);
    const checks = ["Atendimento e diagnóstico realizados", "Equipamento inspecionado", "Área de trabalho organizada", "Teste de funcionamento executado", "Orientações repassadas ao cliente"];
    checks.forEach((check, index) => { const rowY = y + index * 7; pdf.setDrawColor(...line); pdf.rect(margin, rowY, contentWidth, 7); pdf.setTextColor(...dark); pdf.setFontSize(7.5); pdf.text("✓", margin + 3, rowY + 4.7); pdf.text(check, margin + 8, rowY + 4.7); }); y += checks.length * 7 + 3;

    y = sectionTitle("Registro fotográfico - antes e depois", y);
    const photoY = y; const photoW = 88; const photoH = 55;
    pdf.setDrawColor(...line); pdf.roundedRect(margin, photoY, photoW, photoH, 1, 1, "S"); pdf.roundedRect(109, photoY, photoW, photoH, 1, 1, "S");
    const beforeAdded = await addImage(currentOrder.photoBefore, margin + 3, photoY + 3, photoW - 6, photoH - 11); const afterAdded = await addImage(currentOrder.photoAfter, 112, photoY + 3, photoW - 6, photoH - 11);
    pdf.setTextColor(...gray); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); if (!beforeAdded) pdf.text("FOTO NÃO ADICIONADA", margin + photoW / 2, photoY + 27, { align: "center" }); if (!afterAdded) pdf.text("FOTO NÃO ADICIONADA", 109 + photoW / 2, photoY + 27, { align: "center" });
    pdf.text("ANTES DO SERVIÇO", margin + photoW / 2, photoY + photoH - 3, { align: "center" }); pdf.text("DEPOIS DO SERVIÇO", 109 + photoW / 2, photoY + photoH - 3, { align: "center" });

    pdf.addPage();
    pdf.setTextColor(...blue); pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text(`ORDEM DE SERVIÇO ${currentOrder.id}`, margin, 13); pdf.setTextColor(...gray); pdf.setFontSize(7); pdf.text("REGISTRO TÉCNICO E CONFIRMAÇÃO DO ATENDIMENTO", 197, 13, { align: "right" }); pdf.setDrawColor(...blue); pdf.line(margin, 17, 197, 17);
    y = sectionTitle("Observações e conclusão", 23);
    field("Resultado do atendimento", currentOrder.status === "Concluída" ? "Serviço concluído e atendimento finalizado." : `Atendimento em situação: ${currentOrder.status}.`, margin, y, contentWidth, 20); y += 24;
    y = sectionTitle("Assinaturas", y);
    const signatureY = y; const signatureW = 88; const signatureH = 43;
    pdf.setDrawColor(...line); pdf.roundedRect(margin, signatureY, signatureW, signatureH, 1, 1, "S"); pdf.roundedRect(109, signatureY, signatureW, signatureH, 1, 1, "S");
    await addImage(currentOrder.clientSignature, margin + 8, signatureY + 4, signatureW - 16, 23); await addImage(currentOrder.technicianSignature, 117, signatureY + 4, signatureW - 16, 23);
    pdf.setTextColor(...dark); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.text("ASSINATURA DO CLIENTE", margin + signatureW / 2, signatureY + 32, { align: "center" }); pdf.text("ASSINATURA DO TÉCNICO", 109 + signatureW / 2, signatureY + 32, { align: "center" });
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.text(currentOrder.client, margin + signatureW / 2, signatureY + 37, { align: "center" }); pdf.text(currentOrder.tech || "Técnico responsável", 109 + signatureW / 2, signatureY + 37, { align: "center" }); y += signatureH + 5;
    y = sectionTitle("Evidências do atendimento", y);
    const evidenceY = y; const evidenceH = 92;
    pdf.setDrawColor(...line); pdf.roundedRect(margin, evidenceY, contentWidth, evidenceH, 1, 1, "S");
    await addImage(currentOrder.photoBefore, margin + 4, evidenceY + 4, 84, 72); await addImage(currentOrder.photoAfter, 109, evidenceY + 4, 84, 72);
    pdf.setTextColor(...gray); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.text("ANTES", 55, evidenceY + 82, { align: "center" }); pdf.text("DEPOIS", 151, evidenceY + 82, { align: "center" });
    pdf.setDrawColor(...line); pdf.line(margin, 282, 197, 282); pdf.setTextColor(...gray); pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.5); pdf.text("POLARTECH AR CONDICIONADO - Documento técnico gerado pelo ProAR", margin, 287); pdf.text("Página 2 de 2", 197, 287, { align: "right" });
    const filename = `Ordem-de-Servico-${currentOrder.id.replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;
    return { blob: pdf.output("blob"), filename };
  };
  const downloadOrderPdf = async () => {
    setPdfMessage("A gerar o PDF...");
    try { const { blob, filename } = await createOrderPdf(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 2000); setPdfMessage("PDF gerado com sucesso."); }
    catch { setPdfMessage("Não foi possível gerar o PDF."); }
  };
  const shareOrder = async (channel: "WhatsApp" | "E-mail") => {
    setPdfMessage(`A preparar envio por ${channel}...`);
    try {
      const { blob, filename } = await createOrderPdf();
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `Ordem de Serviço ${currentOrder.id}`, text: `Segue a Ordem de Serviço ${currentOrder.id} - ${currentOrder.client}.`, files: [file] });
        setPdfMessage("Ordem compartilhada com sucesso."); return;
      }
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 3000);
      const text = encodeURIComponent(`Segue a Ordem de Serviço ${currentOrder.id} referente ao atendimento de ${currentOrder.client}. O PDF foi gerado para anexação.`);
      if (channel === "WhatsApp") window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
      else window.location.href = `mailto:?subject=${encodeURIComponent(`Ordem de Serviço ${currentOrder.id}`)}&body=${text}`;
      setPdfMessage(`PDF baixado. Anexe-o ao envio por ${channel}.`);
    } catch (error) { if ((error as Error)?.name !== "AbortError") setPdfMessage("Não foi possível preparar o compartilhamento."); }
  };
  const prepareNfse = async () => {
    const fiscalPortal = window.open("about:blank", "_blank");
    setPdfMessage("A preparar a OS para emissão da NFS-e...");
    try {
      const { blob, filename } = await createOrderPdf();
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 3000);
      if (fiscalPortal) fiscalPortal.location.href = "https://webapp1-mirassol.cidade360.cloud/NFSe.Portal/Prestador/Nota/Index";
      setPdfMessage("OS gerada. Portal fiscal aberto para confirmar a emissão da NFS-e.");
    } catch { fiscalPortal?.close(); setPdfMessage("Não foi possível preparar a emissão da NFS-e."); }
  };
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
          <div className="execution-head"><div><span>SERVIÇOS DA ORDEM</span><h3>Serviços e itens cadastrados</h3></div><small>{currentOrder.catalogItems?.length ?? 0} item(ns)</small></div>
          {currentOrder.catalogItems?.length ? <div className="order-item-list">{currentOrder.catalogItems.map(item => <article key={item.id}><span>{item.kind === "Produto" ? <Package size={16}/> : <Wrench size={16}/>}</span><div><b>{item.name}</b><small>{item.kind}</small></div><CheckCircle2 size={16}/></article>)}</div> : <div className="catalog-empty"><Wrench size={19}/><span>Nenhum serviço cadastrado foi vinculado a esta ordem.</span></div>}
        </section>
        <section className="order-map">
          <div className="order-map-head"><div><span><MapPin size={16}/></span><div><small>ENDEREÇO DO ATENDIMENTO</small><strong>{order.address || "Endereço não informado"}</strong></div></div>{order.address && <a href={mapsSearch} target="_blank" rel="noreferrer">Abrir no Google Maps <ArrowRight size={13}/></a>}</div>
          {order.address ? <iframe title={`Mapa de ${order.address}`} src={mapsEmbed} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/> : <div className="map-empty"><MapPin size={24}/><p>Cadastre o endereço do cliente para visualizar o mapa.</p></div>}
        </section>
        <section className="field-execution">
          <div className="execution-head"><div><span>EXECUÇÃO EM CAMPO</span><h3>Registo do atendimento</h3></div><small>Os dados são sincronizados automaticamente</small></div>
          <div className="check-actions">
            <button type="button" className={currentOrder.checkInAt ? "done" : ""} onClick={() => !currentOrder.checkInAt && update({ checkInAt: new Date().toISOString(), status: "Em andamento", tone: "blue" })}><LogIn size={18}/><span><b>{currentOrder.checkInAt ? "Check-in realizado" : "Fazer check-in"}</b><small>{currentOrder.checkInAt ? formatMoment(currentOrder.checkInAt) : "Registrar chegada ao cliente"}</small></span></button>
            <button type="button" disabled={!currentOrder.checkInAt} className={currentOrder.checkOutAt ? "done" : ""} onClick={() => !currentOrder.checkOutAt && update({ checkOutAt: new Date().toISOString(), status: "Concluída", tone: "green" })}><LogOut size={18}/><span><b>{currentOrder.checkOutAt ? "Check-out realizado" : "Fazer check-out"}</b><small>{currentOrder.checkOutAt ? formatMoment(currentOrder.checkOutAt) : "Registrar saída do cliente"}</small></span></button>
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
      {pdfMessage && <div className="order-pdf-message"><CheckCircle2 size={15}/>{pdfMessage}</div>}
      <div className="modal-actions order-document-actions"><button className="outline-btn" onClick={close}>Fechar</button><button className="outline-btn" onClick={() => void shareOrder("E-mail")}><ArrowRight size={15}/> E-mail</button><button className="outline-btn whatsapp-share" onClick={() => void shareOrder("WhatsApp")}><Phone size={15}/> WhatsApp</button><button className="outline-btn" onClick={() => void downloadOrderPdf()}><FileText size={15}/> Gerar PDF</button><button className="primary-btn order-nfse-button" onClick={() => void prepareNfse()}><ReceiptText size={15}/> Emitir NFS-e</button></div>
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
      <div className="pdv-shortcuts"><a className="nfse-link" href="https://webapp1-mirassol.cidade360.cloud/NFSe.Portal/Prestador/Nota/Index" target="_blank" rel="noreferrer"><ReceiptText size={14}/> Emitir NFS-e</a><button onClick={() => setShortcutsOpen(true)}><Keyboard size={14}/><kbd>F1</kbd> Atalhos</button><span>Caixa aberto</span></div>
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

type PublicTender = { numeroControlePNCP?: string; objetoCompra?: string; modalidadeNome?: string; dataEncerramentoProposta?: string; valorTotalEstimado?: number; linkSistemaOrigem?: string; anoCompra?: number; sequencialCompra?: number; orgaoEntidade?: { razaoSocial?: string; cnpj?: string }; unidadeOrgao?: { municipioNome?: string; ufSigla?: string; nomeUnidade?: string } };

function Licitacoes() {
  const today = new Date();
  const prior = new Date(today); prior.setDate(today.getDate() - 30);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  const [keyword, setKeyword] = useState("empresa especializada para prestar serviços de manutenção preventiva e corretiva em aparelho de ar condicionado");
  const [kindFilter, setKindFilter] = useState("Todos");
  const [uf, setUf] = useState("SP");
  const [modality, setModality] = useState("6");
  const [startDate, setStartDate] = useState(iso(prior));
  const [endDate, setEndDate] = useState(iso(today));
  const [radius, setRadius] = useState("150");
  const [results, setResults] = useState<PublicTender[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const distances: Record<string, number> = { mirassol:0, "sao jose do rio preto":15, jaci:21, "bady bassitt":22, balsamo:29, "neves paulista":32, "monte aprazivel":41, cedral:34, potirendaba:43, tanabi:45, ibira:48, catanduva:58, olimpia:62, votuporanga:77, barretos:105, bebedouro:112, fernandopolis:120, aracatuba:135, jaboticabal:145, franca:220, "ribeirao preto":225 };
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const distanceOf = (item: PublicTender) => distances[normalize(item.unidadeOrgao?.municipioNome || "")];
  const tenderKind = (item: PublicTender) => {
    const text = normalize(item.objetoCompra || "");
    const service = /manutenc|instalac|higieniz|limpeza|pmoc|assistencia tecnica|servico|reparo|conserto/.test(text);
    const product = /aquisic|fornecimento|compra|registro de precos|aparelho|equipamento|peca|material|compressor|evaporadora|condensadora/.test(text);
    return service && product ? "Misto" : product ? "Produto" : "Serviço";
  };
  const visible = results.filter(item => {
    const haystack = normalize(`${item.objetoCompra || ""} ${item.orgaoEntidade?.razaoSocial || ""}`);
    const climateFocus = /ar\s*-?\s*condicionado|condicionador(?:es)? de ar|climatiz|refrigerac|pmoc|hvac|split|multi split|cassete|piso teto|evaporador|condensador|chiller|vrf|fluido refrigerante|gas refrigerante/.test(haystack);
    const ignored = new Set(["de","da","do","das","dos","e","em","para","por","uma","um","empresa","especializada","prestar"]);
    const terms = normalize(keyword).split(/\s+/).filter(term => term.length > 2 && !ignored.has(term));
    const matchesKeyword = !terms.length || terms.some(term => haystack.includes(term));
    const kind = tenderKind(item);
    const matchesKind = kindFilter === "Todos" || kind === kindFilter || kind === "Misto";
    const distance = distanceOf(item);
    return climateFocus && matchesKeyword && matchesKind && (!radius || distance === undefined || distance <= Number(radius));
  });
  const searchTenders = async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ dataInicial: startDate, dataFinal: endDate, modalidade: modality, uf });
      const response = await fetch(`/api/licitacoes?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("O PNCP não respondeu à consulta");
      const payload = await response.json();
      setResults(Array.isArray(payload.data) ? payload.data : []);
      if (payload.warning) setError(payload.warning);
    } catch (searchError) { setError(searchError instanceof Error ? searchError.message : "Não foi possível consultar as licitações."); }
    finally { setLoading(false); }
  };
  return <section className="module-page tenders-page">
    <div className="management-hero tender-hero"><div><span className="section-kicker"><Landmark size={12}/> OPORTUNIDADES PÚBLICAS</span><h2>Central de Licitações</h2><p>Consulta oficial de editais e avisos publicados no PNCP, incluindo o link do sistema de origem utilizado por cada órgão.</p></div><div className="management-actions"><a className="outline-btn" href="https://pncp.gov.br/app/editais" target="_blank" rel="noreferrer"><Landmark size={14}/> Abrir PNCP</a><button className="primary-btn" onClick={searchTenders} disabled={loading}><Search size={15}/> {loading ? "Consultando..." : "Buscar oportunidades"}</button></div></div>
    <div className="tender-sources"><a href="https://www.gov.br/compras/pt-br" target="_blank" rel="noreferrer">Compras.gov.br</a><a href="https://pncp.gov.br" target="_blank" rel="noreferrer">PNCP</a><a href="https://www.bec.sp.gov.br" target="_blank" rel="noreferrer">BEC/SP</a><a href="https://www.licitardigital.com.br" target="_blank" rel="noreferrer">Licitar Digital</a><a href="https://bllcompras.com" target="_blank" rel="noreferrer">BLL Compras</a></div>
    <div className="tender-filter-panel"><label className="wide-search">Objeto / palavra-chave<input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="Ex.: ar-condicionado, PMOC, climatização, manutenção"/></label><label>Foco da oportunidade<select value={kindFilter} onChange={event => setKindFilter(event.target.value)}><option>Todos</option><option>Serviço</option><option>Produto</option></select></label><label>UF<select value={uf} onChange={event => setUf(event.target.value)}><option>SP</option><option>MG</option><option>PR</option><option>RJ</option><option>MS</option><option>GO</option><option value="">Brasil</option></select></label><label>Modalidade<select value={modality} onChange={event => setModality(event.target.value)}><option value="6">Pregão eletrônico</option><option value="4">Concorrência eletrônica</option><option value="8">Dispensa de licitação</option><option value="9">Inexigibilidade</option><option value="12">Credenciamento</option><option value="all">Todas as principais</option></select></label><label>Data inicial<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></label><label>Data final<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)}/></label><label>Distância de Mirassol<select value={radius} onChange={event => setRadius(event.target.value)}><option value="50">Até 50 km</option><option value="100">Até 100 km</option><option value="150">Até 150 km</option><option value="250">Até 250 km</option><option value="">Sem limite</option></select></label></div>
    <div className="tender-focus-note"><ShieldCheck size={16}/><div><b>Filtro técnico de climatização ativado</b><small>Resultados genéricos de manutenção, mobiliário, purificadores e outros equipamentos são descartados. A busca aceita serviços e também aquisição de aparelhos, peças e materiais de ar-condicionado.</small></div></div>
    <div className="tender-summary"><article><span><Search size={17}/></span><div><small>RESULTADOS LOCALIZADOS</small><strong>{visible.length}</strong></div></article><article><span><MapPin size={17}/></span><div><small>CIDADE DE REFERÊNCIA</small><strong>Mirassol/SP</strong></div></article><article><span><Clock3 size={17}/></span><div><small>PERÍODO CONSULTADO</small><strong>{new Date(`${startDate}T12:00:00`).toLocaleDateString("pt-BR")} — {new Date(`${endDate}T12:00:00`).toLocaleDateString("pt-BR")}</strong></div></article></div>
    {error && <div className="tender-warning"><AlertTriangle size={16}/>{error}</div>}
    <div className="tender-results">{visible.map((item, index) => { const distance = distanceOf(item); const pncpUrl = item.orgaoEntidade?.cnpj && item.anoCompra && item.sequencialCompra ? `https://pncp.gov.br/app/editais/${item.orgaoEntidade.cnpj}/${item.anoCompra}/${item.sequencialCompra}` : "https://pncp.gov.br/app/editais"; return <article key={item.numeroControlePNCP || index}><header><div><span>{item.modalidadeNome || "Contratação pública"}</span><em className={`tender-kind ${tenderKind(item).toLowerCase()}`}>{tenderKind(item)}</em></div><b>{distance === undefined ? "Distância a confirmar" : `${distance} km de Mirassol`}</b></header><h3>{item.objetoCompra || "Objeto não informado"}</h3><div className="tender-meta"><span><Landmark size={13}/>{item.orgaoEntidade?.razaoSocial || "Órgão público"}</span><span><MapPin size={13}/>{item.unidadeOrgao?.municipioNome || "Município não informado"}/{item.unidadeOrgao?.ufSigla || uf}</span><span><Clock3 size={13}/>Encerramento: {item.dataEncerramentoProposta ? new Date(item.dataEncerramentoProposta).toLocaleString("pt-BR") : "Consultar edital"}</span></div><footer><strong>{item.valorTotalEstimado ? `R$ ${item.valorTotalEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "Valor não informado"}</strong><div><a href={pncpUrl} target="_blank" rel="noreferrer">Ver no PNCP</a>{item.linkSistemaOrigem && <a href={item.linkSistemaOrigem} target="_blank" rel="noreferrer">Sistema do órgão <ArrowRight size={12}/></a>}</div></footer></article>; })}{!loading && !visible.length && <div className="linked-empty"><Landmark size={24}/><h4>Faça uma consulta oficial</h4><p>Defina os filtros e clique em “Buscar oportunidades”.</p></div>}</div>
  </section>;
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

type FiscalSection = Record<string, string | boolean>;
type FiscalCertificate = { fileName: string; subject: string; issuer: string; document: string; serialNumber: string; validFrom: string; validTo: string; fingerprint: string; importedAt: string; status: string };

const emptyCompany: FiscalSection = { corporateName: "", tradeName: "", cnpj: "", stateRegistration: "", municipalRegistration: "", cnae: "", taxRegime: "Simples Nacional", email: "", phone: "", cep: "", street: "", number: "", complement: "", neighborhood: "", city: "Mirassol", state: "SP" };
const emptyNfe: FiscalSection = { environment: "Homologação", nfeSeries: "1", nextNfe: "1", nfceSeries: "1", nextNfce: "1", cscId: "", cscToken: "", defaultCfop: "", defaultNcm: "", taxCode: "", autoIssueOrder: false };
const emptyNfse: FiscalSection = { provider: "Cidade360 — Mirassol/SP", apiBase: "https://webapp1-mirassol.cidade360.cloud/NFSe.Api", environment: "Homologação", dpsSeries: "", nextDps: "1", lc116Item: "", nationalTaxCode: "", municipalTaxCode: "", contributorInternalCode: "", nbs: "", issRate: "", issWithheld: false, defaultDescription: "", autoIssueServiceOrder: false };

function SettingsPage() {
  const [tab, setTab] = useState("Empresa");
  const [company, setCompany] = useState<FiscalSection>(emptyCompany);
  const [nfe, setNfe] = useState<FiscalSection>(emptyNfe);
  const [nfse, setNfse] = useState<FiscalSection>(emptyNfse);
  const [certificate, setCertificate] = useState<FiscalCertificate | null>(null);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/fiscal-config", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCompany({ ...emptyCompany, ...(result.company ?? {}) });
      setNfe({ ...emptyNfe, ...(result.nfe ?? {}) });
      setNfse({ ...emptyNfse, ...(result.nfse ?? {}) });
      setCertificate(result.certificate ?? null);
    }).catch(reason => setError(reason.message || "Não foi possível carregar a configuração fiscal."));
  }, []);

  const update = (setter: Dispatch<SetStateAction<FiscalSection>>, key: string, value: string | boolean) => setter(current => ({ ...current, [key]: value }));
  const field = (label: string, value: string, setter: Dispatch<SetStateAction<FiscalSection>>, key: string, options?: string[]) => <label><span>{label}</span>{options ? <select value={value} onChange={event => update(setter, key, event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select> : <input value={value} onChange={event => update(setter, key, event.target.value)} />}</label>;

  async function saveSettings() {
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/fiscal-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company, nfe, nfse }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage("Configuração fiscal guardada com segurança.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao guardar."); }
    finally { setBusy(false); }
  }

  async function importCertificate(event: FormEvent) {
    event.preventDefault();
    if (!certificateFile || !certificatePassword) { setError("Selecione o arquivo A1 e informe a senha."); return; }
    setBusy(true); setMessage(""); setError("");
    try {
      const body = new FormData(); body.append("certificate", certificateFile); body.append("password", certificatePassword);
      const response = await fetch("/api/fiscal-config", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCertificate(result.certificate); setCertificatePassword(""); setCertificateFile(null);
      setMessage("Certificado A1 validado e importado no cofre fiscal.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao importar o certificado."); }
    finally { setBusy(false); }
  }

  async function removeCertificate() {
    if (!confirm("Remover o certificado digital do cofre fiscal? As emissões ficarão bloqueadas.")) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/fiscal-config", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setCertificate(null); setMessage("Certificado removido.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao remover."); }
    finally { setBusy(false); }
  }

  const companyReady = Boolean(company.corporateName && company.cnpj && company.municipalRegistration && company.city && company.state);
  const tabs = [{ name: "Empresa", icon: Building2 }, { name: "NF-e / NFC-e", icon: ReceiptText }, { name: "NFS-e", icon: FileText }, { name: "Certificado A1", icon: KeyRound }];
  return <section className="settings-page">
    <div className="fiscal-hero"><div><span className="section-kicker"><ShieldCheck size={12}/> CENTRAL FISCAL</span><h2>Configuração da empresa e documentos fiscais</h2><p>Dados usados na emissão de NF-e, NFC-e em pedidos e NFS-e nas ordens de serviço.</p></div><button className="primary-btn" disabled={busy} onClick={saveSettings}><Save size={16}/>{busy ? "Guardando..." : "Guardar configurações"}</button></div>
    <div className="fiscal-readiness">
      <article className={companyReady ? "ready" : "pending"}><span><Building2 size={19}/></span><div><small>CADASTRO DA EMPRESA</small><strong>{companyReady ? "Dados essenciais completos" : "Preenchimento pendente"}</strong></div>{companyReady ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}</article>
      <article className={certificate?.status === "Válido" ? "ready" : "pending"}><span><BadgeCheck size={19}/></span><div><small>CERTIFICADO DIGITAL</small><strong>{certificate ? `${certificate.status} até ${new Date(certificate.validTo).toLocaleDateString("pt-BR")}` : "A1 não importado"}</strong></div>{certificate?.status === "Válido" ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}</article>
      <article className={companyReady && certificate?.status === "Válido" ? "ready" : "pending"}><span><ServerCog size={19}/></span><div><small>PRONTIDÃO FISCAL</small><strong>{companyReady && certificate?.status === "Válido" ? "Habilitado para integração" : "Revise as pendências"}</strong></div><LockKeyhole size={18}/></article>
    </div>
    {(message || error) && <div className={`settings-alert ${error ? "error" : "success"}`}>{error ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}<span>{error || message}</span><button onClick={() => { setError(""); setMessage(""); }}><X size={14}/></button></div>}
    <div className="settings-shell">
      <nav className="settings-nav">{tabs.map(({name, icon: Icon}) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}><Icon size={17}/><span>{name}</span><ChevronRight size={14}/></button>)}</nav>
      <div className="settings-content">
        {tab === "Empresa" && <><div className="settings-section-head"><div><small>IDENTIFICAÇÃO DO EMITENTE</small><h3>Cadastro da empresa</h3><p>Informe os dados exatamente como constam nos cadastros fiscais.</p></div><Building2 size={24}/></div><div className="fiscal-form-grid">{field("Razão social *", String(company.corporateName), setCompany, "corporateName")}{field("Nome fantasia", String(company.tradeName), setCompany, "tradeName")}{field("CNPJ *", String(company.cnpj), setCompany, "cnpj")}{field("Inscrição Estadual", String(company.stateRegistration), setCompany, "stateRegistration")}{field("Inscrição Municipal *", String(company.municipalRegistration), setCompany, "municipalRegistration")}{field("CNAE principal", String(company.cnae), setCompany, "cnae")}{field("Regime tributário", String(company.taxRegime), setCompany, "taxRegime", ["Simples Nacional", "Simples Nacional — excesso de sublimite", "Regime Normal", "MEI"])}{field("E-mail fiscal", String(company.email), setCompany, "email")}{field("Telefone", String(company.phone), setCompany, "phone")}</div><div className="form-divider"><MapPin size={14}/> Endereço fiscal</div><div className="fiscal-form-grid address-grid">{field("CEP *", String(company.cep), setCompany, "cep")}{field("Logradouro *", String(company.street), setCompany, "street")}{field("Número *", String(company.number), setCompany, "number")}{field("Complemento", String(company.complement), setCompany, "complement")}{field("Bairro *", String(company.neighborhood), setCompany, "neighborhood")}{field("Cidade *", String(company.city), setCompany, "city")}{field("UF *", String(company.state), setCompany, "state", ["SP", "MG", "PR", "RJ", "MS", "GO", "SC", "RS", "BA", "DF"])}</div></>}
        {tab === "NF-e / NFC-e" && <><div className="settings-section-head"><div><small>PEDIDOS E VENDAS</small><h3>Parâmetros de NF-e e NFC-e</h3><p>Numeração, ambiente fiscal e códigos padrão usados nos pedidos.</p></div><ReceiptText size={24}/></div><div className="fiscal-form-grid">{field("Ambiente", String(nfe.environment), setNfe, "environment", ["Homologação", "Produção"])}{field("Série NF-e", String(nfe.nfeSeries), setNfe, "nfeSeries")}{field("Próxima NF-e", String(nfe.nextNfe), setNfe, "nextNfe")}{field("Série NFC-e", String(nfe.nfceSeries), setNfe, "nfceSeries")}{field("Próxima NFC-e", String(nfe.nextNfce), setNfe, "nextNfce")}{field("Identificador CSC", String(nfe.cscId), setNfe, "cscId")}{field("Token CSC", String(nfe.cscToken), setNfe, "cscToken")}{field("CFOP padrão", String(nfe.defaultCfop), setNfe, "defaultCfop")}{field("NCM padrão", String(nfe.defaultNcm), setNfe, "defaultNcm")}{field("CST / CSOSN padrão", String(nfe.taxCode), setNfe, "taxCode")}</div><label className="fiscal-switch"><input type="checkbox" checked={Boolean(nfe.autoIssueOrder)} onChange={event => update(setNfe, "autoIssueOrder", event.target.checked)}/><span/><div><strong>Preparar emissão pelo pedido</strong><small>Exibe a ação fiscal após salvar ou faturar um pedido.</small></div></label></>}
        {tab === "NFS-e" && <><div className="settings-section-head"><div><small>ORDENS DE SERVIÇO</small><h3>Parâmetros de NFS-e</h3><p>Configuração do prestador e dos códigos de serviço usados na DPS.</p></div><FileText size={24}/></div><div className="fiscal-form-grid">{field("Provedor / município", String(nfse.provider), setNfse, "provider")}{field("Ambiente", String(nfse.environment), setNfse, "environment", ["Homologação", "Produção"])}<label className="span-2"><span>Endereço da API</span><input value={String(nfse.apiBase)} onChange={event => update(setNfse, "apiBase", event.target.value)}/></label>{field("Série DPS", String(nfse.dpsSeries), setNfse, "dpsSeries")}{field("Próxima DPS", String(nfse.nextDps), setNfse, "nextDps")}{field("Item LC 116", String(nfse.lc116Item), setNfse, "lc116Item")}{field("Código tributação nacional", String(nfse.nationalTaxCode), setNfse, "nationalTaxCode")}{field("Código tributação municipal", String(nfse.municipalTaxCode), setNfse, "municipalTaxCode")}{field("Código interno contribuinte", String(nfse.contributorInternalCode), setNfse, "contributorInternalCode")}{field("Código NBS", String(nfse.nbs), setNfse, "nbs")}{field("Alíquota ISS (%)", String(nfse.issRate), setNfse, "issRate")}<label className="span-2"><span>Descrição padrão do serviço</span><textarea value={String(nfse.defaultDescription)} onChange={event => update(setNfse, "defaultDescription", event.target.value)}/></label></div><div className="switch-row"><label className="fiscal-switch"><input type="checkbox" checked={Boolean(nfse.issWithheld)} onChange={event => update(setNfse, "issWithheld", event.target.checked)}/><span/><div><strong>ISS retido por padrão</strong><small>Pode ser alterado em cada emissão.</small></div></label><label className="fiscal-switch"><input type="checkbox" checked={Boolean(nfse.autoIssueServiceOrder)} onChange={event => update(setNfse, "autoIssueServiceOrder", event.target.checked)}/><span/><div><strong>Habilitar emissão na OS</strong><small>Libera o botão “Emitir NFS-e” na ordem concluída.</small></div></label></div></>}
        {tab === "Certificado A1" && <><div className="settings-section-head"><div><small>ASSINATURA E AUTENTICAÇÃO</small><h3>Certificado digital A1</h3><p>Importe um arquivo .PFX ou .P12. O arquivo e sua senha ficam criptografados no cofre privado do servidor.</p></div><KeyRound size={24}/></div>{certificate ? <div className="certificate-card"><div className="certificate-status"><span><BadgeCheck size={24}/></span><div><small>CERTIFICADO {certificate.status.toUpperCase()}</small><h4>{certificate.fileName}</h4><p>{certificate.subject}</p></div><em className={certificate.status === "Válido" ? "valid" : "expired"}>{certificate.status}</em></div><dl><div><dt>Documento</dt><dd>{certificate.document || "Identificado no titular"}</dd></div><div><dt>Validade</dt><dd>{new Date(certificate.validFrom).toLocaleDateString("pt-BR")} a {new Date(certificate.validTo).toLocaleDateString("pt-BR")}</dd></div><div><dt>Emissor</dt><dd>{certificate.issuer}</dd></div><div><dt>Serial</dt><dd>{certificate.serialNumber}</dd></div><div className="wide"><dt>Impressão digital SHA-256</dt><dd>{certificate.fingerprint}</dd></div></dl><div className="certificate-actions"><button className="outline-btn" onClick={() => setCertificate(null)}><UploadCloud size={15}/> Substituir certificado</button><button className="delete-button" onClick={removeCertificate}><Trash2 size={15}/> Remover</button></div></div> : <form className="certificate-upload" onSubmit={importCertificate}><div className="certificate-drop"><UploadCloud size={28}/><h4>Selecione o certificado A1</h4><p>Arquivo .PFX ou .P12 com até 2 MB</p><label className="outline-btn">Escolher arquivo<input type="file" hidden accept=".pfx,.p12,application/x-pkcs12" onChange={event => setCertificateFile(event.target.files?.[0] ?? null)}/></label>{certificateFile && <strong>{certificateFile.name}</strong>}</div><label className="certificate-password"><span>Senha do certificado</span><div><LockKeyhole size={16}/><input type="password" value={certificatePassword} onChange={event => setCertificatePassword(event.target.value)} placeholder="Informe a senha do A1"/></div><small>A senha não é exibida novamente e nunca é enviada ao navegador após a importação.</small></label><button className="primary-btn" disabled={busy || !certificateFile || !certificatePassword}><ShieldCheck size={16}/>{busy ? "Validando..." : "Validar e importar certificado"}</button></form>}<div className="security-note"><LockKeyhole size={18}/><div><strong>Proteção do certificado</strong><p>O conteúdo é validado no servidor e guardado com criptografia AES-256-GCM em armazenamento privado. Nenhuma chave ou senha fiscal é salva no navegador.</p></div></div></>}
      </div>
    </div>
  </section>;
}

function GenericModule({ name, onOpen, onDelete, onUpdate, records }: { name: string; onOpen: (name: string) => void; onDelete: (moduleName: string, record: ModuleRecord) => void; onUpdate: (moduleName: string, record: ModuleRecord) => void; records: ModuleRecord[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [activeView, setActiveView] = useState("Visão geral");
  const [editingRecord, setEditingRecord] = useState<ModuleRecord | null>(null);
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
  return <><section className="module-page management-module">
    <div className="management-hero"><div><span className="section-kicker"><Grid2X2 size={12}/> MÓDULO PROAR</span><h2>{name}</h2><p>{descriptions[name] || `Consulte, cadastre e acompanhe todas as informações de ${name.toLowerCase()} em um só lugar.`}</p></div><div className="management-actions"><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Imprimir</button><button className="outline-btn" onClick={exportRecords}><ArrowDownRight size={14}/> Exportar</button><button className="primary-btn" onClick={() => onOpen(`Novo registro • ${name}`)}><Plus size={16}/> {name === "Compras" ? "Nova compra" : name === "Fornecedores" ? "Novo fornecedor" : name === "Financeiro" ? "Novo lançamento" : "Novo registro"}</button></div></div>
    <div className="management-stats"><article><span><ClipboardList size={18}/></span><div><small>TOTAL DE REGISTROS</small><strong>{records.length}</strong></div></article><article><span><Clock3 size={18}/></span><div><small>PENDENTES / EM ABERTO</small><strong>{records.filter(record => /Rascunho|Aguardando|aberto|Vencida|Pendente/i.test(record.status || "")).length}</strong></div></article><article><span><CircleDollarSign size={18}/></span><div><small>VALOR REGISTRADO</small><strong>R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article></div>
    {managementFlows[name] && <div className="management-flow">{managementFlows[name].map((step, index) => <article key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{step.title}</b><small>{step.text}</small></div>{index < managementFlows[name].length - 1 && <ChevronRight size={14}/>}</article>)}</div>}
    <nav className="management-tabs" aria-label={`Áreas de ${name}`}>{tabs.map(tab => <button key={tab} className={activeView === tab ? "active" : ""} onClick={() => setActiveView(tab)}>{tab}</button>)}</nav>
    {name === "Financeiro" && <div className="finance-control-strip"><article><span className="money-icon red"><ArrowDownRight size={17}/></span><div><small>COMPROMISSOS EM ABERTO</small><strong>R$ {openValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article><article><span className="money-icon green"><ArrowUpRight size={17}/></span><div><small>MOVIMENTAÇÃO REALIZADA</small><strong>R$ {records.filter(record => /Paga|Recebida/i.test(record.status || "")).reduce((sum, record) => sum + (record.value ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article><article><span><Landmark size={17}/></span><div><small>CONCILIAÇÃO</small><strong>{records.filter(record => /Paga|Recebida/i.test(record.status || "")).length} movimento(s)</strong></div></article></div>}
    <div className="management-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Pesquisar em ${name.toLowerCase()}...`}/></label><label className="status-filter"><Filter size={14}/><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>Todas</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label></div>
    {records.length ? <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><ClipboardList size={12}/> {activeView.toUpperCase()}</span><h2>{activeView} de {name.toLowerCase()}</h2><p>{filtered.length} de {records.length} registro(s)</p></div></div><div className="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>NOME / IDENTIFICAÇÃO</th><th>FORNECEDOR / RESPONSÁVEL</th><th>SITUAÇÃO</th><th>VALOR</th><th>DATA</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(record => <tr key={record.id} className={name === "Produtos" || name === "Compras" ? "editable-record-row" : ""} onClick={() => { if (name === "Produtos") setEditingRecord({ ...record }); }} onDoubleClick={() => { if (name === "Compras") setEditingRecord({ ...record }); }}><td><b className="order-id">{record.id}</b></td><td><strong>{record.name}</strong><small className="table-description">{name === "Compras" ? `${record.purchaseItems?.length ?? 0} item(ns) • ${record.paymentType ?? "Pagamento não informado"}${record.installments && record.installments > 1 ? ` • ${record.installments}x` : ""}` : record.description || "Sem observações"}</small></td><td>{record.client || "—"}</td><td>{name === "Compras" ? <select className={`workflow-status status-quick-select ${/Recebida|Paga|Ativo|Concluído/i.test(record.status || "") ? "done" : /Cancelada|Inativo|Bloqueado|Devolvida/i.test(record.status || "") ? "blocked" : ""}`} value={record.status || statuses[0]} onClick={event => event.stopPropagation()} onChange={event => onUpdate(name, { ...record, status: event.target.value })}>{statuses.map(status => <option key={status}>{status}</option>)}</select> : <span className={`workflow-status ${/Recebida|Paga|Ativo|Concluído/i.test(record.status || "") ? "done" : /Cancelada|Inativo|Bloqueado|Devolvida/i.test(record.status || "") ? "blocked" : ""}`}>{record.status || statuses[0]}</span>}</td><td><b>R$ {(record.value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></td><td>{record.date ? new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR") : record.createdAt}</td><td><div className="record-actions" onClick={event => event.stopPropagation()}><button title="Avançar situação" onClick={() => advance(record)}><CheckCircle2 size={14}/></button>{name === "Compras" && <button title="Duplicar compra" onClick={() => duplicate(record)}><FileText size={14}/></button>}<button title="Imprimir" onClick={() => window.print()}><ReceiptText size={14}/></button><button className="danger" title="Excluir" onClick={() => onDelete(name, record)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="linked-empty"><Search size={22}/><h4>Nenhum registro encontrado</h4><p>Ajuste a pesquisa ou o filtro de situação.</p></div>}</div> :
    <div className="empty-grid">{[{t:"Visão geral",i:LayoutDashboard},{t:"Registros recentes",i:Clock3},{t:"Indicadores",i:TrendingUp}].map(({t,i:Icon})=><article className="panel" key={t}><span><Icon size={19}/></span><h3>{t}</h3><p>Use “Novo registro” para adicionar o primeiro cadastro deste módulo.</p><button onClick={() => onOpen(`Novo registro • ${name}`)}>Cadastrar agora <ArrowRight size={12}/></button></article>)}</div>}</section>{editingRecord && <div className="modal-layer record-edit-layer" role="dialog" aria-modal="true" aria-label={`Editar ${editingRecord.name}`}><button className="modal-backdrop" onClick={() => setEditingRecord(null)} aria-label="Fechar edição"/><div className="modal record-edit-modal"><div className="modal-head"><div><span>{name === "Compras" ? "EDIÇÃO DA NOTA DE COMPRA" : "EDIÇÃO DO PRODUTO"}</span><h2>{editingRecord.name}</h2><p>{name === "Compras" ? "Altere os dados da nota; os vínculos financeiros permanecem identificados pela compra." : "Atualize o cadastro e salve para aplicar em todo o sistema."}</p></div><button onClick={() => setEditingRecord(null)} aria-label="Fechar"><X size={18}/></button></div><div className="form-grid"><label>Nome / identificação<input value={editingRecord.name} onChange={event => setEditingRecord({ ...editingRecord, name: event.target.value })}/></label><label>{name === "Compras" ? "Fornecedor" : "Fornecedor principal"}<input value={editingRecord.client} onChange={event => setEditingRecord({ ...editingRecord, client: event.target.value })}/></label><label>Situação<select value={editingRecord.status || statuses[0]} onChange={event => setEditingRecord({ ...editingRecord, status: event.target.value })}>{statuses.map(status => <option key={status}>{status}</option>)}</select></label><label>{name === "Compras" ? "Valor total" : "Preço de referência"}<input type="number" min="0" step="0.01" value={editingRecord.value ?? 0} onChange={event => setEditingRecord({ ...editingRecord, value: Number(event.target.value) })}/></label><label>Categoria<input value={editingRecord.category || ""} onChange={event => setEditingRecord({ ...editingRecord, category: event.target.value })}/></label><label>Data<input type="date" value={editingRecord.date || ""} onChange={event => setEditingRecord({ ...editingRecord, date: event.target.value })}/></label><label className="wide">Descrição / observações<textarea value={editingRecord.description || ""} onChange={event => setEditingRecord({ ...editingRecord, description: event.target.value })}/></label></div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditingRecord(null)}>Cancelar</button><button className="primary-btn" onClick={() => { onUpdate(name, editingRecord); setEditingRecord(null); }}><CheckCircle2 size={15}/> Salvar alterações</button></div></div></div>}</>;
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
    setServiceOrders(updatedOrders);
    setSelectedOrder(updatedOrder);
    localStorage.setItem("proar-v3-service-orders", JSON.stringify(updatedOrders));
    persistSharedState(customerRecords, updatedOrders, moduleRecords);
    setSavedMessage(`Ordem ${updatedOrder.id} atualizada e sincronizada.`);
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
    const isPurchase = moduleName === "Compras";
    if (!window.confirm(isPurchase ? `Excluir a compra “${record.name}”? As entradas de estoque e contas financeiras vinculadas a esta nota também serão removidas.` : `Excluir o registro “${record.name}”?`)) return;
    let updatedModules = { ...moduleRecords, [moduleName]: (moduleRecords[moduleName] ?? []).filter(item => item.id !== record.id) };
    let removedFinance = 0;
    let removedStock = 0;
    if (isPurchase) {
      const financeBefore = updatedModules.Financeiro ?? [];
      const stockBefore = updatedModules.Estoque ?? [];
      const financeAfter = financeBefore.filter(item => item.purchaseId !== record.id && item.id !== `FIN-${record.id}` && !item.id.startsWith(`FIN-${record.id}-`));
      const stockAfter = stockBefore.filter(item => item.purchaseId !== record.id && item.id !== `EST-${record.id}`);
      removedFinance = financeBefore.length - financeAfter.length;
      removedStock = stockBefore.length - stockAfter.length;
      updatedModules = { ...updatedModules, Financeiro: financeAfter, Estoque: stockAfter };
    }
    setModuleRecords(updatedModules);
    localStorage.setItem("proar-v3-module-records", JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage(isPurchase ? `Compra excluída. ${removedFinance} lançamento(s) financeiro(s) e ${removedStock} entrada(s) de estoque removidos.` : "Registro excluído com sucesso.");
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
      <div className="page-content">{current === "Painel inicial" ? <Dashboard onNavigate={setCurrent} serviceOrders={serviceOrders}/> : current === "Clientes" ? <Customers onOpen={setModal} onDelete={deleteCustomer} customers={customerRecords}/> : current === "Agenda" ? <Agenda serviceOrders={serviceOrders} onOpen={setModal} onSelect={setSelectedOrder}/> : current === "Vendas" ? <SalesPDV customers={customerRecords}/> : current === "Licitações" ? <Licitacoes/> : current === "Relatórios" ? <Reports modules={moduleRecords} customers={customerRecords} serviceOrders={serviceOrders}/> : current === "Ordens de serviço" ? <ServiceOrders onOpen={setModal} onSelect={setSelectedOrder} onDelete={deleteOrder} serviceOrders={serviceOrders}/> : current === "Configurações" ? <SettingsPage/> : <GenericModule name={current} onOpen={setModal} onDelete={deleteModuleRecord} onUpdate={updateModuleRecord} records={moduleRecords[current] ?? []}/>}</div>
      <footer><span>© 2026 ProAR Gestão de Serviços</span><span><ShieldCheck size={12}/> Gestão segura e inteligente para prestadores de serviços.</span></footer>
    </main>
    {modal && <Modal title={modal} customers={customerRecords} catalogRecords={[...(moduleRecords["Serviços"] ?? []), ...(moduleRecords["Produtos"] ?? [])]} supplierRecords={moduleRecords["Fornecedores"] ?? []} close={() => setModal("")} onSave={saveRecord}/>}
    {selectedOrder && <OrderDetail order={selectedOrder} close={() => setSelectedOrder(null)} onUpdate={updateServiceOrder}/>}
  </div>;
}

  
