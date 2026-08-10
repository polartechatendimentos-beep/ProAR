"use client";

import "./settings.css";
import "./multiempresa.css";
import "./obra-142.css";
import "./workflow-fixes.css";

import { useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Bell, Boxes, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined,
  CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList,
  Clock3, FileChartColumn, FileText, Filter, Grid2X2, HandCoins, Headphones,
  ArrowLeft, Camera, Contact, Edit3, Eye, EyeOff, Hospital, Landmark, LayoutDashboard, LogIn, LogOut, MapPin,
  CreditCard, Keyboard, Menu, Minus, MoreHorizontal, Package, Phone, Plus, ReceiptText, ScanBarcode, School, Search, Settings,
  ShieldCheck, ShoppingBag, ShoppingCart, Store, TrendingUp, UserCheck, UserRound,
  MessageCircle, PenTool, Tag, Trash2, Database, LockKeyhole, UnlockKeyhole, ImagePlus,
  UsersRound, WalletCards, Warehouse, Wrench, X, Zap, House, History, ImageIcon
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
    { icon: Building2, name: "Obras" },
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
  lastMaintenanceDate?: string;
  reviewPeriodMonths?: 3 | 6 | 12;
  notifyDaysBefore?: number;
};

type Customer = {
  id: string; name: string; doc: string; contact: string; phone: string;
  address: string; units: number; status: string;
};

type HouseWorkStatus = "AG FRIGORÍGENA" | "AG VENTO KIT" | "VENTOKIT E FRIGORÍGENA OK" | "AG ACABAMENTO" | "AG EXAUSTOR" | "AG TAMPA FRIGORÍGENA" | "FIM";
type HouseWorkUpdate = { id: string; status: HouseWorkStatus; note: string; photo?: string; createdAt: string };
type HouseWorkItem = { id: string; block: string; lot: number; status: HouseWorkStatus; photo?: string; note?: string; updatedAt?: string; history: HouseWorkUpdate[] };

const HOUSE_BLOCKS = [
  { block: "A", houses: 5 }, { block: "B", houses: 24 }, { block: "C1", houses: 16 },
  { block: "C2", houses: 16 }, { block: "D", houses: 6 }, { block: "E", houses: 5 },
  { block: "F", houses: 27 }, { block: "G", houses: 12 }, { block: "H1", houses: 10 },
  { block: "H2", houses: 10 }, { block: "I", houses: 12 },
] as const;
const HOUSE_STATUSES: { name: HouseWorkStatus; color: string }[] = [
  { name: "AG FRIGORÍGENA", color: "#ef4444" }, { name: "AG VENTO KIT", color: "#f97316" },
  { name: "VENTOKIT E FRIGORÍGENA OK", color: "#eab308" }, { name: "AG ACABAMENTO", color: "#8b5cf6" },
  { name: "AG EXAUSTOR", color: "#06b6d4" }, { name: "AG TAMPA FRIGORÍGENA", color: "#3b82f6" },
  { name: "FIM", color: "#16a34a" },
];

type TenantCompany = {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  address: string;
  logo?: string;
  status: "Ativa" | "Bloqueada";
  createdAt: string;
};

const DEFAULT_COMPANY: TenantCompany = {
  id: "polartech-principal",
  legalName: "PolarTech Mirassol Ar Condicionado",
  tradeName: "PolarTech",
  cnpj: "",
  city: "Mirassol",
  state: "SP",
  phone: "+55 17 2122-2806",
  email: "",
  address: "",
  status: "Ativa",
  createdAt: new Date().toISOString(),
};

const companyStorageKey = (companyId: string, resource: string) => `proar-v4:${companyId}:${resource}`;
const normalizeCnpj = (value: string) => value.replace(/\D/g, "").slice(0, 14);
const formatCnpj = (value: string) => normalizeCnpj(value).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, "$1.$2.$3/$4-$5");
const companyIdFromCnpj = (cnpj: string) => normalizeCnpj(cnpj) || `empresa-${Date.now()}`;

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
  engineer?: string;
  address?: string;
  blockLot?: string;
  endDate?: string;
  progress?: number;
  commission?: number;
  cost?: number;
  transactionType?: "Pagar" | "Receber";
  settledValue?: number;
  settlementDate?: string;
  settlementMethod?: string;
  settlementAccount?: string;
  interestValue?: number;
  discountValue?: number;
  employeeRole?: string;
  employeePermissions?: Record<string, ("Visualizar" | "Criar" | "Editar" | "Excluir")[]>;
  employeeUsername?: string;
  employeePasswordHash?: string;
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
const tiagoEmployee: ModuleRecord = { id: "FUN-000001", name: "Tiago Viana", client: "tiago.viana", description: "Funcionário e técnico responsável", createdAt: "Cadastro principal", status: "Ativo", category: "Técnico", employeeRole: "Técnico de Campo", employeePermissions: { Clientes: ["Visualizar"], "Ordens de serviço": ["Visualizar", "Editar"], Agenda: ["Visualizar", "Editar"], Serviços: ["Visualizar"] }, employeeUsername: "tiago.viana" };
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

function CustomerDetail({ customerName, customers, structures, canEdit, onBack, onOpen, onUpdateStructure }: { customerName: string; customers: Customer[]; structures: ModuleRecord[]; canEdit: boolean; onBack: () => void; onOpen: (name: string) => void; onUpdateStructure: (record: ModuleRecord) => void }) {
  const customer = customers.find(c => c.name === customerName);
  if (!customer) return null;
  const units = linkedUnits[customerName] ?? [
    { icon: Building2, name: "Matriz", type: "Unidade principal", doc: customer.doc, responsible: customer.contact, phone: customer.phone, address: customer.address, orders: 0 },
  ];
  const sectors = structures.filter(item => item.client === customerName).map(item => ({ icon: Building2, name:item.name, type:item.category || "Setor", doc:item.description || "", responsible:"", phone:"", address:item.address || "", orders:0 }));
  const [editingStructure, setEditingStructure] = useState<ModuleRecord | null>(null);
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
      {linkedRecords.length ? <div className="unit-grid">{linkedRecords.map(({icon: Icon, ...unit}) => <article className="unit-card" key={unit.name} onDoubleClick={() => { const record = structures.find(item => item.client === customerName && item.name === unit.name); if (canEdit && record) setEditingStructure({...record}); }}>
        <div className="unit-card-top"><span><Icon size={20}/></span><div><small>{unit.type}</small><h4>{unit.name}</h4></div><button aria-label={`Opções de ${unit.name}`}><MoreHorizontal size={17}/></button></div>
        <div className="unit-meta"><p><FileText size={13}/><span><small>CNPJ</small>{unit.doc}</span></p><p><Contact size={13}/><span><small>Responsável</small>{unit.responsible}</span></p><p><Phone size={13}/><span><small>Telefone</small>{unit.phone}</span></p><p><MapPin size={13}/><span><small>Endereço</small>{unit.address}</span></p></div>
        <div className="unit-footer"><span className="status green"><i/> Ativa</span><button>{unit.orders} ordens de serviço <ChevronRight size={13}/></button></div>
      </article>)}</div> : <div className="linked-empty"><Building2 size={22}/><h4>Nenhum setor ou filial cadastrado</h4><p>Cadastre o primeiro registro vinculado a este cliente principal.</p></div>}
      <section className="sector-list">
        <div className="sector-list-head"><div><span className="section-kicker"><Grid2X2 size={12}/> SETORES DO CLIENTE</span><h3>Lista de setores</h3><p>Consulte rapidamente todos os setores vinculados a {customer.name}.</p></div><label><Search size={14}/><input value={sectorQuery} onChange={event => setSectorQuery(event.target.value)} placeholder="Buscar setor..."/></label></div>
        {filteredSectors.length ? <div className="table-wrap"><table><thead><tr><th>SETOR / FILIAL</th><th>TIPO</th><th>CNPJ</th><th>RESPONSÁVEL</th><th>TELEFONE</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>{filteredSectors.map(({icon: Icon, ...sector}) => <tr key={`list-${sector.name}`}><td><div className="sector-name"><span><Icon size={15}/></span><strong>{sector.name}</strong></div></td><td>{sector.type}</td><td>{sector.doc}</td><td>{sector.responsible}</td><td>{sector.phone}</td><td><span className="status green"><i/> Ativo</span></td><td><button className="open-client">Abrir histórico <ChevronRight size={13}/></button></td></tr>)}</tbody></table></div> : <div className="sector-list-empty"><Search size={18}/><span>Nenhum setor encontrado.</span></div>}
      </section>
      {editingStructure && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setEditingStructure(null)} aria-label="Fechar"/><div className="modal catalog-edit-modal"><div className="modal-head"><div><span>ALTERAR SETOR / FILIAL</span><h2>{editingStructure.name}</h2><p>Vinculado a {customerName}</p></div><button onClick={() => setEditingStructure(null)}><X size={18}/></button></div><div className="catalog-edit-form"><label>Nome<input value={editingStructure.name} onChange={event => setEditingStructure({...editingStructure,name:event.target.value})}/></label><label>Tipo<select value={editingStructure.category || "Setor"} onChange={event => setEditingStructure({...editingStructure,category:event.target.value})}><option>Setor</option><option>Unidade</option><option>Filial</option><option>Empresa vinculada</option></select></label><label className="wide">Endereço<input value={editingStructure.address || ""} onChange={event => setEditingStructure({...editingStructure,address:event.target.value})}/></label><label className="wide">CNPJ / observações<input value={editingStructure.description || ""} onChange={event => setEditingStructure({...editingStructure,description:event.target.value})}/></label></div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditingStructure(null)}>Cancelar</button><button className="primary-btn" onClick={() => {onUpdateStructure(editingStructure);setEditingStructure(null);}}><CheckCircle2 size={15}/> Salvar alterações</button></div></div></div>}
    </div> : <div className="tab-placeholder panel"><span><Grid2X2 size={22}/></span><h3>{tab}</h3><p>Informações de {tab.toLowerCase()} vinculadas exclusivamente a este cliente.</p></div>}
  </section>;
}

function Customers({ onOpen, onDelete, onUpdate, onUpdateStructure, canEdit, customers, structures }: { onOpen: (name: string) => void; onDelete: (customer: Customer) => void; onUpdate: (customer: Customer) => void; onUpdateStructure: (record: ModuleRecord) => void; canEdit: boolean; customers: Customer[]; structures: ModuleRecord[] }) {
  const [query, setQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const filtered = useMemo(() => customers.filter(c => `${c.name} ${c.doc} ${c.contact}`.toLowerCase().includes(query.toLowerCase())), [query, customers]);
  if (selectedCustomer) return <CustomerDetail customerName={selectedCustomer} customers={customers} structures={structures} canEdit={canEdit} onUpdateStructure={onUpdateStructure} onBack={() => setSelectedCustomer("")} onOpen={onOpen}/>;
  return <section className="module-page">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar cliente, CPF ou CNPJ..." /></label><button className="outline-btn"><Filter size={14}/> Filtros</button><button className="primary-btn" onClick={() => onOpen("Novo cliente")}><Plus size={16}/> Novo cliente</button></div>
    <div className="module-summary">
      <article><span><UsersRound size={19}/></span><div><small>CLIENTES ATIVOS</small><strong>{customers.filter(item => item.status === "Ativo").length}</strong><em>Cadastros reais</em></div></article>
      <article><span><Building2 size={19}/></span><div><small>UNIDADES CADASTRADAS</small><strong>{customers.reduce((total, item) => total + item.units, 0)}</strong><em>Vinculadas aos clientes</em></div></article>
      <article><span><HandCoins size={19}/></span><div><small>FATURAMENTO NO MÊS</small><strong>R$ 0,00</strong><em>Sem vendas lançadas</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><UsersRound size={12}/> CARTEIRA</span><h2>Clientes cadastrados</h2><p>{filtered.length} registro(s) encontrado(s) • {canEdit ? "Duplo clique para alterar" : "Somente consulta"}</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>CPF / CNPJ</th><th>RESPONSÁVEL</th><th>TELEFONE</th><th>ENDEREÇO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id} onDoubleClick={() => canEdit && setEditingCustomer({...c})}><td><div className="client-cell"><span>{c.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><strong>{c.name}</strong></div></td><td>{c.doc || "—"}</td><td>{c.contact || "—"}</td><td>{c.phone || "—"}</td><td>{c.address || "—"}</td><td><span className="status green"><i/> {c.status}</span></td><td><div className="row-actions"><button className="open-client" onClick={() => setSelectedCustomer(c.name)}>Abrir <ChevronRight size={14}/></button>{canEdit && <button onClick={() => setEditingCustomer({...c})} title="Alterar"><Edit3 size={14}/></button>}<button className="delete-action" aria-label={`Excluir ${c.name}`} onClick={() => onDelete(c)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="linked-empty"><UsersRound size={22}/><h4>Nenhum cliente cadastrado</h4><p>Use “Novo cliente” para iniciar sua base real.</p></div>}</div>
    {editingCustomer && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setEditingCustomer(null)} aria-label="Fechar"/><div className="modal catalog-edit-modal"><div className="modal-head"><div><span>ALTERAR CLIENTE</span><h2>{editingCustomer.name}</h2><p>Atualize cadastro, endereço e situação.</p></div><button onClick={() => setEditingCustomer(null)}><X size={18}/></button></div><div className="catalog-edit-form"><label>Nome / razão social<input value={editingCustomer.name} onChange={event => setEditingCustomer({...editingCustomer,name:event.target.value})}/></label><label>CPF / CNPJ<input value={editingCustomer.doc} onChange={event => setEditingCustomer({...editingCustomer,doc:event.target.value})}/></label><label>Responsável<input value={editingCustomer.contact} onChange={event => setEditingCustomer({...editingCustomer,contact:event.target.value})}/></label><label>Telefone<input value={editingCustomer.phone} onChange={event => setEditingCustomer({...editingCustomer,phone:event.target.value})}/></label><label className="wide">Endereço completo<input value={editingCustomer.address} onChange={event => setEditingCustomer({...editingCustomer,address:event.target.value})}/></label><label>Situação<select value={editingCustomer.status} onChange={event => setEditingCustomer({...editingCustomer,status:event.target.value})}><option>Ativo</option><option>Inativo</option></select></label></div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditingCustomer(null)}>Cancelar</button><button className="primary-btn" onClick={() => {onUpdate(editingCustomer);setEditingCustomer(null);}}><CheckCircle2 size={15}/> Salvar alterações</button></div></div></div>}
  </section>;
}

function serviceOrderReviewDate(order: ServiceOrder) {
  if (!order.lastMaintenanceDate || !order.reviewPeriodMonths) return "";
  const date = new Date(`${order.lastMaintenanceDate}T12:00:00`);
  date.setMonth(date.getMonth() + order.reviewPeriodMonths);
  return date.toISOString().slice(0, 10);
}

function quickPrintServiceOrder(order: ServiceOrder) {
  const popup = window.open("", "_blank", "width=900,height=700");
  if (!popup) return;
  const safe = (value?: string) => String(value || "—").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
  popup.document.write(`<!doctype html><html><head><title>${safe(order.id)}</title><style>body{font-family:Arial;color:#17304f;padding:32px}header{display:flex;justify-content:space-between;border-bottom:3px solid #1768df;padding-bottom:18px}h1{margin:0;color:#1768df}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:24px 0}.box{border:1px solid #dce5ef;border-radius:8px;padding:12px}.box small{display:block;color:#76879b;margin-bottom:5px}.service{padding:18px;background:#f4f8fd;border-radius:10px}footer{margin-top:35px;border-top:1px solid #dce5ef;padding-top:12px;font-size:12px;color:#76879b}@media print{body{padding:10mm}}</style></head><body><header><div><small>POLARTECH • PROAR</small><h1>Ordem de Serviço</h1></div><strong>${safe(order.id)}</strong></header><div class="grid"><div class="box"><small>CLIENTE</small><b>${safe(order.client)}</b></div><div class="box"><small>UNIDADE</small><b>${safe(order.unit)}</b></div><div class="box"><small>DATA / HORÁRIO</small><b>${safe(order.date)} • ${safe(order.time)}</b></div><div class="box"><small>TÉCNICO</small><b>${safe(order.tech)}</b></div><div class="box"><small>ENDEREÇO</small><b>${safe(order.address)}</b></div><div class="box"><small>SITUAÇÃO</small><b>${safe(order.status)}</b></div></div><section class="service"><small>SERVIÇO PRESTADO</small><h2>${safe(order.service)}</h2></section><footer>Documento gerado pelo ProAR — Gestão de Serviços</footer><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

function ServiceOrders({ onOpen, onSelect, onDelete, serviceOrders, customers }: { onOpen: (name: string) => void; onSelect: (order: ServiceOrder) => void; onDelete: (order: ServiceOrder) => void; serviceOrders: ServiceOrder[]; customers: Customer[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const reviewAlerts = serviceOrders.filter(order => {
    const reviewDate = serviceOrderReviewDate(order);
    if (!reviewDate) return false;
    const alertDate = new Date(`${reviewDate}T12:00:00`);
    alertDate.setDate(alertDate.getDate() - (order.notifyDaysBefore ?? 15));
    return alertDate <= new Date() && new Date(`${reviewDate}T23:59:59`) >= new Date();
  });
  const sendWhatsApp = (order: ServiceOrder) => {
    const phone = customers.find(customer => customer.name === order.client)?.phone?.replace(/\D/g, "");
    if (!phone) return window.alert("O cliente desta OS não possui WhatsApp cadastrado.");
    const internationalPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const message = `Olá ${order.client}, segue sua Ordem de Serviço nº ${order.id} da PolarTech. Serviço: ${order.service}. Acesse o ProAR para consultar o documento completo.`;
    window.open(`https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };
  return <section className="module-page service-orders">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input placeholder="Pesquisar ordem, cliente ou técnico..."/></label><button className="outline-btn"><Filter size={14}/> Filtros</button><button className="primary-btn" onClick={() => onOpen("Nova ordem de serviço")}><Plus size={16}/> Nova ordem de serviço</button></div>
    <div className="module-summary">
      <article><span><ClipboardList size={19}/></span><div><small>ORDENS ABERTAS</small><strong>{serviceOrders.filter(item => item.status !== "Concluída").length}</strong><em>{serviceOrders.filter(item => item.date === today).length} para hoje</em></div></article>
      <article><span><UserCheck size={19}/></span><div><small>TÉCNICOS EMPENHADOS</small><strong>{new Set(serviceOrders.map(item => item.tech).filter(Boolean)).size}</strong><em>Cadastros reais</em></div></article>
      <article><span><CheckCircle2 size={19}/></span><div><small>FINALIZADAS</small><strong>{serviceOrders.filter(item => item.status === "Concluída").length}</strong><em>Total registrado</em></div></article>
      <article><span><Bell size={19}/></span><div><small>REVISÕES PRÓXIMAS</small><strong>{reviewAlerts.length}</strong><em>Alertas preventivos</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><Wrench size={12}/> OPERAÇÃO TÉCNICA</span><h2>Ordens de serviço</h2><p>Duplo clique para abrir • PDF e WhatsApp disponíveis em um clique.</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>ORDEM</th><th>CLIENTE / LOCAL</th><th>DATA / HORÁRIO</th><th>REVISÃO</th><th>TÉCNICO</th><th>SITUAÇÃO</th><th>AÇÕES RÁPIDAS</th></tr></thead><tbody>{serviceOrders.map(order => { const reviewDate = serviceOrderReviewDate(order); return <tr className="clickable-row" title="Clique duas vezes para abrir a ordem" onDoubleClick={() => onSelect(order)} key={`manage-${order.id}`}><td><b className="order-id">{order.id}</b></td><td><div className="client-cell"><span>{order.avatar}</span><div><strong>{order.client}</strong><small>{order.unit}</small></div></div></td><td>{order.date ? new Date(`${order.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"} • {order.time || "Sem horário"}</td><td>{reviewDate ? <span className="review-date"><Bell size={12}/>{new Date(`${reviewDate}T12:00:00`).toLocaleDateString("pt-BR")}</span> : "—"}</td><td><div className="tech"><span>{order.tech.split(" ").map(name => name[0]).slice(0,2).join("")}</span>{order.tech}</div></td><td><span className={`status ${order.tone}`}><i/> {order.status}</span></td><td><div className="row-actions quick-order-actions"><button title="Abrir OS" onClick={() => onSelect(order)}><Eye size={14}/></button><button title="Imprimir PDF" onClick={() => quickPrintServiceOrder(order)}><FileText size={14}/></button><button className="whatsapp-action" title="Enviar por WhatsApp" onClick={() => sendWhatsApp(order)}><MessageCircle size={14}/></button><button className="delete-action" aria-label={`Excluir ${order.id}`} onClick={() => onDelete(order)}><Trash2 size={14}/></button></div></td></tr>; })}</tbody></table></div>{!serviceOrders.length && <div className="linked-empty"><ClipboardList size={22}/><h4>Nenhuma ordem cadastrada</h4><p>Crie uma nova ordem para iniciar a operação.</p></div>}</div>
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

function OrderDetail({ order, customerPhone, company, close, onUpdate }: { order: ServiceOrder; customerPhone?: string; company: TenantCompany; close: () => void; onUpdate: (order: ServiceOrder) => void }) {
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
        <section className="preventive-engine">
          <div className="execution-head"><div><span>MANUTENÇÃO PREVENTIVA</span><h3>Garantia, revisão e alerta automático</h3></div><small>{serviceOrderReviewDate(currentOrder) ? `Próxima revisão: ${new Date(`${serviceOrderReviewDate(currentOrder)}T12:00:00`).toLocaleDateString("pt-BR")}` : "Configure a recorrência"}</small></div>
          <div className="preventive-fields"><label>Última manutenção<input type="date" value={currentOrder.lastMaintenanceDate ?? currentOrder.date ?? ""} onChange={event => update({ lastMaintenanceDate: event.target.value })}/></label><label>Garantia / revisão<select value={currentOrder.reviewPeriodMonths ?? 6} onChange={event => update({ reviewPeriodMonths: Number(event.target.value) as 3 | 6 | 12 })}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label><label>Notificar antes<input type="number" min="1" max="90" value={currentOrder.notifyDaysBefore ?? 15} onChange={event => update({ notifyDaysBefore: Math.max(1, Number(event.target.value) || 15) })}/><small>dias antes</small></label></div>
        </section>
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
        <header className="print-order-header"><img src={company.logo || "/proar-logo.png"} alt={company.tradeName}/><div><span>ORDEM DE SERVIÇO</span><h1>{currentOrder.id}</h1><p>{company.tradeName} • {company.city}/{company.state}</p></div></header>
        <section className="print-order-status"><div><small>SITUAÇÃO</small><strong>{currentOrder.status}</strong></div><div><small>DATA AGENDADA</small><strong>{currentOrder.date ? new Date(`${currentOrder.date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"}</strong></div><div><small>HORÁRIO</small><strong>{currentOrder.time || "Não informado"}</strong></div></section>
        <section className="print-block"><h2>Cliente e local do atendimento</h2><div className="print-info-grid"><div><small>CLIENTE</small><strong>{currentOrder.client}</strong></div><div><small>UNIDADE / SETOR</small><strong>{currentOrder.unit || "Unidade principal"}</strong></div><div className="wide"><small>ENDEREÇO</small><strong>{currentOrder.address || "Não informado"}</strong></div><div><small>TÉCNICO RESPONSÁVEL</small><strong>{currentOrder.tech || "Não informado"}</strong></div><div><small>CHECK-IN</small><strong>{currentOrder.checkInAt ? formatMoment(currentOrder.checkInAt) : "Não realizado"}</strong></div><div><small>CHECK-OUT</small><strong>{currentOrder.checkOutAt ? formatMoment(currentOrder.checkOutAt) : "Não realizado"}</strong></div></div></section>
        <section className="print-block"><h2>Serviços prestados</h2>{currentOrder.catalogItems?.length ? <div className="print-service-list">{currentOrder.catalogItems.map((item, index) => <div key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{item.name}</strong><small>{item.kind}</small></span></div>)}</div> : <p className="print-description">{currentOrder.service || "Atendimento técnico"}</p>}</section>
        <section className="print-block print-evidence"><h2>Registo fotográfico</h2><div><figure>{currentOrder.photoBefore ? <img src={currentOrder.photoBefore} alt="Antes do serviço"/> : <div>Foto não adicionada</div>}<figcaption>ANTES DO SERVIÇO</figcaption></figure><figure>{currentOrder.photoAfter ? <img src={currentOrder.photoAfter} alt="Depois do serviço"/> : <div>Foto não adicionada</div>}<figcaption>DEPOIS DO SERVIÇO</figcaption></figure></div></section>
        <section className="print-block print-signatures"><h2>Confirmação do atendimento</h2><div><figure>{currentOrder.clientSignature ? <img src={currentOrder.clientSignature} alt="Assinatura do cliente"/> : <div/>}<figcaption><strong>Assinatura do cliente</strong><span>{currentOrder.client}</span></figcaption></figure><figure>{currentOrder.technicianSignature ? <img src={currentOrder.technicianSignature} alt="Assinatura do técnico"/> : <div/>}<figcaption><strong>Assinatura do técnico responsável</strong><span>{currentOrder.tech}</span></figcaption></figure></div></section>
        <footer className="print-order-footer"><span>{company.legalName} • {company.cnpj || "CNPJ não informado"}</span><span>Documento gerado pelo ProAR em {new Date().toLocaleString("pt-BR")}</span></footer>
      </article>
    </div>
  </div>;
}

type SaleItem = { id: string; name: string; code: string; price: number; kind: "Produto" | "Serviço" };
type CartItem = SaleItem & { quantity: number };

function SalesPDV({ customers, records }: { customers: Customer[]; records: ModuleRecord[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"itens" | "cliente" | "pagamento" | "opcoes">("itens");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState("");
  const [payment, setPayment] = useState("PIX");
  const [notice, setNotice] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const pdvRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const quickSaleCatalog: SaleItem[] = records.filter(item => (item.kind === "Produto" || item.kind === "Serviço") && item.status !== "Inativo").map(item => ({ id:item.id, name:item.name, code:item.id, price:item.value ?? 0, kind:item.kind! }));
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

  const toggleFullScreen = async () => {
    if (!document.fullscreenElement) { await pdvRef.current?.requestFullscreen(); setFullScreen(true); }
    else { await document.exitFullscreen(); setFullScreen(false); }
  };
  return <section className={`pdv-page ${fullScreen ? "pdv-fullscreen" : ""}`} ref={pdvRef}>
    <div className="pdv-command">
      <div><span className="section-kicker"><ShoppingBag size={12}/> VENDA RÁPIDA</span><h2>PDV ProAR</h2><p>Produtos e serviços em um fluxo direto, sem campos desnecessários.</p></div>
      <div className="pdv-shortcuts"><button onClick={toggleFullScreen}><Grid2X2 size={14}/>{fullScreen ? "Sair da tela cheia" : "Maximizar PDV"}</button><button onClick={() => setShortcutsOpen(true)}><Keyboard size={14}/><kbd>F1</kbd> Atalhos</button><span>Caixa aberto</span></div>
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
  "Obras": ["Planejamento", "Em andamento", "Pausada", "Aguardando material", "Concluída", "Cancelada"],
};

const managementTabs: Record<string, string[]> = {
  "Compras": ["Visão geral", "Pedidos", "Aprovação", "Recebimento", "Histórico"],
  "Fornecedores": ["Visão geral", "Cadastro", "Produtos fornecidos", "Compras", "Avaliação"],
  "Financeiro": ["Visão geral", "Contas a pagar", "Contas a receber", "Fluxo de caixa", "Conciliação"],
  "Funcionários": ["Visão geral", "Equipe", "Funções e permissões", "Comissões", "Histórico"],
  "Obras": ["Visão geral", "Planejamento", "Execução", "Perdas", "Financeiro", "Histórico"],
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
  "Obras": [
    { title: "Cadastro", text: "Cliente, endereço e responsáveis" },
    { title: "Planejamento", text: "Prazo, orçamento e equipe" },
    { title: "Execução", text: "Serviços, fotos e progresso" },
    { title: "Controle", text: "Materiais, perdas e ocorrências" },
    { title: "Conclusão", text: "Financeiro, relatório e entrega" },
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
  const [client, setClient] = useState("Todos");
  const [technician, setTechnician] = useState("Todos");
  const [paymentMethod, setPaymentMethod] = useState("Todas");
  const [selectedReport, setSelectedReport] = useState("Visão consolidada");
  const inPeriod = (record: ModuleRecord) => {
    if (!record.date) return !startDate && !endDate;
    return (!startDate || record.date >= startDate) && (!endDate || record.date <= endDate);
  };
  const matchesStatus = (record: ModuleRecord) => status === "Todas" || (record.status || "").toLowerCase().includes(status.toLowerCase());
  const filteredModules = Object.fromEntries(Object.entries(modules).map(([key, records]) => [key, records.filter(record => inPeriod(record) && matchesStatus(record) && (client === "Todos" || record.client === client) && (paymentMethod === "Todas" || record.paymentMethod === paymentMethod))]));
  const filteredOrders = serviceOrders.filter(order => (client === "Todos" || order.client === client) && (technician === "Todos" || order.tech === technician) && (status === "Todas" || order.status.toLowerCase().includes(status.toLowerCase())) && (!startDate || order.date >= startDate) && (!endDate || order.date <= endDate));
  const financial = filteredModules.Financeiro ?? [];
  const billed = financial.filter(record => /Recebida|Paga|aberto|Vencida/i.test(record.status || "")).reduce((sum, record) => sum + (record.value ?? 0), 0);
  const pending = financial.filter(record => /aberto|Vencida|Pendente|parcial/i.test(record.status || "")).reduce((sum, record) => sum + Math.max(0, (record.value ?? 0) - (record.settledValue ?? 0)), 0);
  const reportGroups = [
    { title: "Compras", icon: ShoppingCart, count: filteredModules["Compras"]?.length ?? 0, items: ["Compras por período", "Compras por fornecedor", "Pedidos pendentes", "Comparação de preços"] },
    { title: "Fornecedores", icon: Store, count: filteredModules["Fornecedores"]?.length ?? 0, items: ["Fornecedores ativos", "Histórico de preços", "Avaliação dos fornecedores", "Total comprado"] },
    { title: "Financeiro", icon: WalletCards, count: filteredModules["Financeiro"]?.length ?? 0, items: ["Contas a pagar", "Contas a receber", "Fluxo de caixa", "Resultado por centro de custo"] },
    { title: "Funcionários", icon: BriefcaseBusiness, count: filteredModules["Funcionários"]?.length ?? 0, items: ["Equipe ativa", "Funções e permissões", "Comissões", "Histórico de atividades"] },
    { title: "Obras", icon: Building2, count: filteredModules["Obras"]?.length ?? 0, items: ["Obras em andamento", "Progresso por obra", "Perdas e ocorrências", "Resultado financeiro"] },
    { title: "Serviços", icon: Wrench, count: filteredOrders.length, items: ["Ordens abertas", "Ordens concluídas", "Serviços por cliente", "Produtividade técnica"] },
    { title: "Clientes", icon: UsersRound, count: customers.length, items: ["Clientes ativos", "Histórico de atendimento", "Faturamento por cliente", "Inadimplência"] },
    { title: "Estoque", icon: Warehouse, count: modules["Produtos"]?.length ?? 0, items: ["Estoque atual", "Produtos sem estoque", "Entradas e saídas", "Valor do estoque"] },
  ];
  const exportSummary = () => downloadCsv("relatorio-geral-proar.csv", [["Relatório", selectedReport], ["Período", startDate || "Início", endDate || "Hoje"], ["Situação", status], [], ["Módulo", "Quantidade", "Gerado em"], ...reportGroups.map(group => [group.title, String(group.count), new Date().toLocaleString("pt-BR")])]);
  return <section className="module-page reports-page">
    <div className="management-hero"><div><span className="section-kicker"><FileChartColumn size={12}/> INTELIGÊNCIA GERENCIAL</span><h2>Central de relatórios</h2><p>Indicadores comerciais, operacionais, financeiros e administrativos com dados reais do ProAR.</p></div><div className="management-actions"><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Imprimir</button><button className="primary-btn" onClick={exportSummary}><ArrowDownRight size={14}/> Exportar resumo</button></div></div>
    <div className="report-kpis"><article><small>TOTAL FATURADO</small><strong>R$ {billed.toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></article><article><small>TOTAL PENDENTE</small><strong>R$ {pending.toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></article><article><small>OS CONCLUÍDAS</small><strong>{filteredOrders.filter(order => order.status === "Concluída").length}</strong></article><article><small>REGISTROS FILTRADOS</small><strong>{Object.values(filteredModules).reduce((sum, records) => sum + records.length, 0)}</strong></article></div>
    <div className="report-filter-bar"><label>Data inicial<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></label><label>Data final<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)}/></label><label>Situação<select value={status} onChange={event => setStatus(event.target.value)}><option>Todas</option><option>Ativo</option><option>Pendente</option><option>Concluído</option><option>Vencida</option><option>Paga</option></select></label><label>Cliente<select value={client} onChange={event => setClient(event.target.value)}><option>Todos</option>{customers.map(customer => <option key={customer.id}>{customer.name}</option>)}</select></label><label>Técnico<select value={technician} onChange={event => setTechnician(event.target.value)}><option>Todos</option>{[...new Set(serviceOrders.map(order => order.tech).filter(Boolean))].map(name => <option key={name}>{name}</option>)}</select></label><label>Pagamento<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option>Todas</option><option>Pix</option><option>Boleto</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option></select></label><div className="report-active-filter"><Filter size={14}/><span>{selectedReport}</span><button onClick={() => { setStartDate(""); setEndDate(""); setStatus("Todas"); setClient("Todos"); setTechnician("Todos"); setPaymentMethod("Todas"); }}>Limpar</button></div></div>
    <div className="report-grid">{reportGroups.map(({ title, icon: Icon, count, items }) => <article className="report-card" key={title}><div className="report-card-head"><span><Icon size={20}/></span><div><small>MÓDULO</small><h3>{title}</h3></div><b>{count}</b></div><div className="report-links">{items.map(item => <button className={selectedReport === item ? "active" : ""} onClick={() => setSelectedReport(item)} key={item}>{item}<ChevronRight size={13}/></button>)}</div><footer><button onClick={() => window.print()}><FileText size={13}/> PDF</button><button onClick={() => downloadCsv(`relatorio-${title.toLowerCase()}.xls`, [["Relatório", selectedReport], ["Período", startDate || "Início", endDate || "Hoje"], ["Situação", status], ["Cliente", client], ["Técnico", technician], ["Pagamento", paymentMethod], ["Total", String(count)]])}><ArrowDownRight size={13}/> Excel</button><button onClick={() => downloadCsv(`relatorio-${title.toLowerCase()}.csv`, [["Relatório", selectedReport], ["Total", String(count)]])}><ArrowDownRight size={13}/> CSV</button></footer></article>)}</div>
  </section>;
}

function FinancialModule({ records, onOpen, onUpdate }: { records: ModuleRecord[]; onOpen: (name: string) => void; onUpdate: (moduleName: string, record: ModuleRecord) => void }) {
  const [view, setView] = useState<"Títulos" | "Fluxo de caixa">("Títulos");
  const [settling, setSettling] = useState<ModuleRecord | null>(null);
  const [amount, setAmount] = useState(0);
  const [interest, setInterest] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState("Pix");
  const [account, setAccount] = useState("Conta bancária");
  const isFullySettled = (record: ModuleRecord) => /^(Paga|Recebida|Cancelada)$/i.test(record.status || "");
  const open = records.filter(record => !isFullySettled(record));
  const realized = records.filter(record => (record.settledValue ?? 0) > 0 || /^(Paga|Recebida)$/i.test(record.status || ""));
  const payable = (record: ModuleRecord) => record.transactionType === "Pagar" || /pagar|compra|fornecedor/i.test(`${record.name} ${record.category}`);
  const total = (items: ModuleRecord[]) => items.reduce((sum, record) => sum + (record.settledValue ?? record.value ?? 0), 0);
  const incoming = realized.filter(record => !payable(record));
  const outgoing = realized.filter(payable);
  const maxChart = Math.max(1, total(incoming), total(outgoing), total(open.filter(record => !payable(record))), total(open.filter(payable)));
  const startSettlement = (record: ModuleRecord) => { setSettling(record); setAmount(Math.max(0, (record.value ?? 0) - (record.settledValue ?? 0))); setInterest(0); setDiscount(0); };
  const settle = () => {
    if (!settling) return;
    const finalValue = Math.max(0, amount + interest - discount);
    const accumulated = (settling.settledValue ?? 0) + finalValue;
    const isPaid = accumulated >= (settling.value ?? 0);
    onUpdate("Financeiro", { ...settling, transactionType: payable(settling) ? "Pagar" : "Receber", settledValue: accumulated, settlementDate: new Date().toISOString().slice(0, 10), settlementMethod: method, settlementAccount: account, interestValue: (settling.interestValue ?? 0) + interest, discountValue: (settling.discountValue ?? 0) + discount, status: isPaid ? (payable(settling) ? "Paga" : "Recebida") : "Baixa parcial" });
    setSettling(null);
  };
  return <section className="module-page financial-module">
    <div className="management-hero"><div><span className="section-kicker"><WalletCards size={12}/> CONTROLE FINANCEIRO</span><h2>Financeiro e fluxo de caixa</h2><p>Separe compromissos previstos da movimentação efetivamente liquidada.</p></div><div className="management-actions"><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Relatório</button><button className="primary-btn" onClick={() => onOpen("Novo registro • Financeiro")}><Plus size={15}/> Novo lançamento</button></div></div>
    <div className="finance-kpis"><article><small>A RECEBER</small><strong>R$ {total(open.filter(record => !payable(record))).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong><span>Previsto</span></article><article><small>A PAGAR</small><strong>R$ {total(open.filter(payable)).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong><span>Previsto</span></article><article><small>ENTRADAS REALIZADAS</small><strong>R$ {total(incoming).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong><span>Liquidado</span></article><article><small>SALDO REALIZADO</small><strong>R$ {(total(incoming)-total(outgoing)).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong><span>Caixa e bancos</span></article></div>
    <nav className="management-tabs"><button className={view === "Títulos" ? "active" : ""} onClick={() => setView("Títulos")}>Contas a pagar e receber</button><button className={view === "Fluxo de caixa" ? "active" : ""} onClick={() => setView("Fluxo de caixa")}>Fluxo de caixa</button></nav>
    {view === "Fluxo de caixa" ? <div className="cashflow-panel panel"><div className="panel-head"><div><span className="section-kicker"><ChartNoAxesCombined size={12}/> PREVISTO × REALIZADO</span><h2>Movimentação consolidada</h2><p>Comparativo dos títulos cadastrados e efetivamente baixados.</p></div></div><div className="cashflow-chart">{[{label:"Receitas previstas",value:total(open.filter(record => !payable(record))),tone:"blue"},{label:"Receitas realizadas",value:total(incoming),tone:"green"},{label:"Despesas previstas",value:total(open.filter(payable)),tone:"orange"},{label:"Despesas realizadas",value:total(outgoing),tone:"red"}].map(item => <div key={item.label}><span><b>{item.label}</b><strong>R$ {item.value.toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></span><i><b className={item.tone} style={{width:`${Math.max(2,item.value/maxChart*100)}%`}}/></i></div>)}</div><div className="cashflow-balance"><span>Saldo acumulado realizado</span><strong>R$ {(total(incoming)-total(outgoing)).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></div></div> : <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><ReceiptText size={12}/> TÍTULOS</span><h2>Liquidação de contas</h2><p>{open.length} título(s) aguardando baixa</p></div></div><div className="table-wrap"><table><thead><tr><th>DESCRIÇÃO</th><th>TIPO</th><th>VENCIMENTO</th><th>VALOR</th><th>LIQUIDADO</th><th>SITUAÇÃO</th><th>AÇÃO</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td><strong>{record.name}</strong><small className="table-description">{record.client || record.category}</small></td><td>{payable(record) ? "A pagar" : "A receber"}</td><td>{record.date ? new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td><td><b>R$ {(record.value ?? 0).toLocaleString("pt-BR", {minimumFractionDigits:2})}</b></td><td>R$ {(record.settledValue ?? 0).toLocaleString("pt-BR", {minimumFractionDigits:2})}</td><td><span className={`workflow-status ${/Paga|Recebida/i.test(record.status || "") ? "done" : ""}`}>{record.status || "Em aberto"}</span></td><td>{!/Paga|Recebida|Cancelada/i.test(record.status || "") ? <button className="settle-button" onClick={() => startSettlement(record)}><HandCoins size={14}/> Dar baixa</button> : <span className="settled-label"><CheckCircle2 size={13}/> Liquidado</span>}</td></tr>)}</tbody></table></div>{!records.length && <div className="linked-empty"><WalletCards size={22}/><h4>Nenhum lançamento financeiro</h4><p>Cadastre uma conta a pagar ou receber.</p></div>}</div>}
    {settling && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Baixar título"><button className="modal-backdrop" onClick={() => setSettling(null)} aria-label="Fechar"/><div className="modal settlement-modal"><div className="modal-head"><div><span>BAIXA FINANCEIRA</span><h2>{settling.name}</h2><p>Liquidação parcial ou total com rastreabilidade.</p></div><button onClick={() => setSettling(null)}><X size={18}/></button></div><div className="settlement-form"><label>Valor da baixa<input type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(Number(event.target.value)||0)}/></label><label>Juros / multa<input type="number" min="0" step="0.01" value={interest} onChange={event => setInterest(Number(event.target.value)||0)}/></label><label>Desconto<input type="number" min="0" step="0.01" value={discount} onChange={event => setDiscount(Number(event.target.value)||0)}/></label><label>Forma de pagamento<select value={method} onChange={event => setMethod(event.target.value)}><option>Pix</option><option>Boleto</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option><option>Transferência</option></select></label><label>Conta / caixa de destino<select value={account} onChange={event => setAccount(event.target.value)}><option>Conta bancária</option><option>Caixa</option><option>Conta digital</option><option>Cartão</option></select></label><div className="settlement-total"><span>VALOR EFETIVO</span><strong>R$ {Math.max(0,amount+interest-discount).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></div></div><div className="modal-actions"><button className="outline-btn" onClick={() => setSettling(null)}>Cancelar</button><button className="primary-btn" onClick={settle}><CheckCircle2 size={15}/> Confirmar baixa</button></div></div></div>}
  </section>;
}

function SettingsModule({ companies, activeCompany, onCompaniesChange, onSelectCompany }: { companies: TenantCompany[]; activeCompany: TenantCompany; onCompaniesChange: (companies: TenantCompany[]) => void; onSelectCompany: (company: TenantCompany) => void }) {
  const [tab, setTab] = useState<"Empresa" | "Gerenciador" | "WhatsApp" | "Fiscal" | "Segurança">("Empresa");
  const [companyName, setCompanyName] = useState(activeCompany.legalName);
  const [tradeName, setTradeName] = useState(activeCompany.tradeName);
  const [companyDoc, setCompanyDoc] = useState(activeCompany.cnpj);
  const [city, setCity] = useState(activeCompany.city);
  const [state, setState] = useState(activeCompany.state || "SP");
  const [email, setEmail] = useState(activeCompany.email);
  const [address, setAddress] = useState(activeCompany.address);
  const [logo, setLogo] = useState(activeCompany.logo || "");
  const [phoneNumberId, setPhoneNumberId] = useState("473138105880735");
  const [wabaId, setWabaId] = useState("449236708270435");
  const [businessPhone, setBusinessPhone] = useState("+55 17 2122-2806");
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(companyStorageKey(activeCompany.id, "settings")) || "{}");
    setCompanyName(activeCompany.legalName);
    setTradeName(activeCompany.tradeName);
    setCompanyDoc(activeCompany.cnpj);
    setCity(activeCompany.city);
    setState(activeCompany.state || "SP");
    setEmail(activeCompany.email);
    setAddress(activeCompany.address);
    setLogo(activeCompany.logo || "");
    setPhoneNumberId(stored.phoneNumberId || "473138105880735");
    setWabaId(stored.wabaId || "449236708270435");
    setBusinessPhone(stored.businessPhone || "+55 17 2122-2806");
  }, [activeCompany]);
  const updateCompany = () => {
    const normalizedDocument = normalizeCnpj(companyDoc);
    const updatedId = !normalizeCnpj(activeCompany.cnpj) && normalizedDocument.length === 14 ? normalizedDocument : activeCompany.id;
    const updated: TenantCompany = { ...activeCompany, id: updatedId, legalName: companyName.trim(), tradeName: tradeName.trim() || companyName.trim(), cnpj: formatCnpj(companyDoc), city: city.trim(), state, email: email.trim(), address: address.trim(), phone: businessPhone, logo };
    if (updatedId !== activeCompany.id) ["settings", "customers", "service-orders", "module-records"].forEach(resource => {
      const previous = localStorage.getItem(companyStorageKey(activeCompany.id, resource));
      if (previous) localStorage.setItem(companyStorageKey(updatedId, resource), previous);
    });
    const next = companies.map(company => company.id === activeCompany.id ? updated : company);
    onCompaniesChange(next);
    onSelectCompany(updated);
    return updated;
  };
  const save = () => {
    const updated = updateCompany();
    localStorage.setItem(companyStorageKey(updated.id, "settings"), JSON.stringify({ companyName, companyDoc, city, state, logo, phoneNumberId, wabaId, businessPhone, tokenConfigured: Boolean(token) }));
    setToken("");
    setSaved(tab === "WhatsApp" ? "Identificadores salvos. O token foi mascarado e não será exibido novamente." : "Configurações salvas com sucesso.");
    window.setTimeout(() => setSaved(""), 3500);
  };
  const readLogo = (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) { setSaved("A logomarca deve ter no máximo 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  const createCompany = () => {
    const cnpj = normalizeCnpj(companyDoc);
    if (cnpj.length !== 14) { setSaved("Informe um CNPJ válido com 14 números."); return; }
    if (companies.some(company => normalizeCnpj(company.cnpj) === cnpj && company.id !== activeCompany.id)) { setSaved("Este CNPJ já possui uma empresa cadastrada."); return; }
    const company: TenantCompany = { id: companyIdFromCnpj(cnpj), legalName: companyName.trim() || "Nova empresa", tradeName: tradeName.trim() || companyName.trim() || "Nova empresa", cnpj: formatCnpj(cnpj), city: city.trim(), state, phone: businessPhone, email: email.trim(), address: address.trim(), logo, status: "Ativa", createdAt: new Date().toISOString() };
    onCompaniesChange([...companies, company]);
    onSelectCompany(company);
    setTab("Empresa");
    setSaved("Empresa criada com uma base de dados independente.");
  };
  const toggleCompany = (company: TenantCompany) => {
    const nextStatus = company.status === "Ativa" ? "Bloqueada" : "Ativa";
    const next = companies.map(item => item.id === company.id ? { ...item, status: nextStatus } as TenantCompany : item);
    onCompaniesChange(next);
    if (company.id === activeCompany.id && nextStatus === "Bloqueada") setSaved("Empresa bloqueada. Os utilizadores deste CNPJ não poderão acessar os dados.");
  };
  const cities = ["Mirassol", "São José do Rio Preto", "Olímpia", "Monte Aprazível", "Bálsamo", "Jaci", "Bady Bassitt", "Neves Paulista", "Barretos"];
  return <section className="settings-page">
    <div className="management-hero settings-hero"><div><span className="section-kicker"><Settings size={12}/> CENTRAL DE CONFIGURAÇÕES</span><h2>Configurações do ProAR</h2><p>Dados empresariais, integrações, emissão fiscal e segurança em uma área centralizada.</p></div><div className="settings-health"><ShieldCheck size={19}/><span><b>Ambiente protegido</b><small>Credenciais sensíveis permanecem mascaradas</small></span></div></div>
    <div className="settings-layout"><nav className="settings-nav">{[{name:"Empresa",icon:Building2,text:"Dados e logomarca"},{name:"Gerenciador",icon:Database,text:"Empresas e bloqueios"},{name:"WhatsApp",icon:MessageCircle,text:"API oficial da Meta"},{name:"Fiscal",icon:FileText,text:"NF-e, NFC-e e NFS-e"},{name:"Segurança",icon:ShieldCheck,text:"Acessos e proteção"}].map(item => <button key={item.name} className={tab === item.name ? "active" : ""} onClick={() => setTab(item.name as typeof tab)}><item.icon size={17}/><span><b>{item.name}</b><small>{item.text}</small></span></button>)}</nav>
      <div className="settings-card"><header><div><small>CONFIGURAÇÃO • {tab.toUpperCase()}</small><h3>{tab === "WhatsApp" ? "WhatsApp Business Platform" : tab === "Empresa" ? "Cadastro da empresa" : tab === "Gerenciador" ? "Gerenciador multiempresa" : tab === "Fiscal" ? "Configuração fiscal" : "Segurança do sistema"}</h3></div><span className="settings-status"><i/> Configuração disponível</span></header>
        {tab === "Empresa" && <div className="settings-form company-settings-form"><label>Razão social / Nome empresarial<input value={companyName} onChange={event => setCompanyName(event.target.value)}/></label><label>Nome fantasia<input value={tradeName} onChange={event => setTradeName(event.target.value)}/></label><label>CNPJ<input value={companyDoc} onChange={event => setCompanyDoc(formatCnpj(event.target.value))} placeholder="00.000.000/0000-00"/></label><label>Telefone<input value={businessPhone} onChange={event => setBusinessPhone(event.target.value)}/></label><label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="contato@empresa.com.br"/></label><label>Cidade<input list="proar-cities" value={city} onChange={event => setCity(event.target.value)} placeholder="Selecione ou digite a cidade"/><datalist id="proar-cities">{cities.map(item => <option key={item}>{item}</option>)}</datalist></label><label>Estado<select value={state} onChange={event => setState(event.target.value)}>{["SP","MG","PR","RJ","MS","GO","SC","RS"].map(item => <option key={item}>{item}</option>)}</select></label><label className="wide">Endereço completo<input value={address} onChange={event => setAddress(event.target.value)} placeholder="Rua, número e bairro"/></label><div className="wide company-logo-field"><div className="company-logo-preview">{logo ? <img src={logo} alt="Logomarca da empresa"/> : <Building2 size={30}/>}</div><div><b>Logomarca dos relatórios</b><p>Será utilizada nos cabeçalhos de PDF, impressão, orçamentos e ordens de serviço.</p><label className="logo-upload"><ImagePlus size={15}/> Selecionar logomarca<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => readLogo(event.target.files?.[0])}/></label>{logo && <button className="logo-remove" type="button" onClick={() => setLogo("")}><Trash2 size={13}/> Remover</button>}</div></div></div>}
        {tab === "Gerenciador" && <div className="tenant-manager"><div className="tenant-toolbar"><div><b>Gerenciador multiempresa</b><p>Cada CNPJ usa um espaço de dados isolado. Bloqueios interrompem o acesso da empresa.</p></div><button className="primary-btn" onClick={() => { setCompanyName(""); setTradeName(""); setCompanyDoc(""); setCity("Mirassol"); setState("SP"); setEmail(""); setAddress(""); setLogo(""); setTab("Empresa"); }}><Plus size={15}/> Preparar nova empresa</button></div><div className="tenant-grid">{companies.map(company => <article key={company.id} className={company.status === "Bloqueada" ? "blocked" : ""}><div className="tenant-brand">{company.logo ? <img src={company.logo} alt=""/> : <Building2 size={21}/>}<div><strong>{company.tradeName}</strong><small>{company.legalName}</small></div></div><dl><div><dt>CNPJ</dt><dd>{company.cnpj || "Não informado"}</dd></div><div><dt>Cidade</dt><dd>{company.city}/{company.state}</dd></div><div><dt>Base</dt><dd>{company.id}</dd></div></dl><div className="tenant-status"><span className={company.status === "Ativa" ? "active" : "blocked"}>{company.status === "Ativa" ? <UnlockKeyhole size={13}/> : <LockKeyhole size={13}/>} {company.status}</span>{company.id === activeCompany.id && <em>Empresa em uso</em>}</div><footer><button disabled={company.status === "Bloqueada"} onClick={() => onSelectCompany(company)}><Building2 size={13}/> Acessar</button><button className={company.status === "Ativa" ? "danger" : "success"} onClick={() => toggleCompany(company)}>{company.status === "Ativa" ? <><LockKeyhole size={13}/> Bloquear</> : <><UnlockKeyhole size={13}/> Desbloquear</>}</button></footer></article>)}</div></div>}
        {tab === "WhatsApp" && <div className="settings-form whatsapp-settings-form"><div className="wide whatsapp-account-status"><MessageCircle size={20}/><div><small>CONTA LOCALIZADA NA META</small><b>POLARTECH AR CONDICIONADO</b><span>{businessPhone} • Conectado • Qualidade alta</span></div><CheckCircle2 size={19}/></div><label>Phone Number ID<input value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} inputMode="numeric"/><small>ID do número, diferente do telefone.</small></label><label>WABA ID<input value={wabaId} onChange={event => setWabaId(event.target.value)} inputMode="numeric"/><small>ID da conta WhatsApp Business.</small></label><label className="wide">Token permanente<input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="new-password" placeholder="Cole o token gerado pelo Utilizador do Sistema"/><small>Por segurança, o token nunca será mostrado depois de salvo.</small></label><div className="wide settings-security-note"><ShieldCheck size={17}/><span><b>Permissões necessárias</b><small>whatsapp_business_management e whatsapp_business_messaging</small></span></div></div>}
        {tab === "Fiscal" && <div className="settings-form"><label>Ambiente<select><option>Homologação</option><option>Produção</option></select></label><label>Regime tributário<select><option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option></select></label><label className="wide">Certificado digital A1<input type="file" accept=".pfx,.p12"/></label></div>}
        {tab === "Segurança" && <div className="settings-form"><label className="wide settings-switch"><span><b>Exigir autenticação individual</b><small>Somente funcionários ativos podem entrar.</small></span><input type="checkbox" defaultChecked/></label><label className="wide settings-switch"><span><b>Encerrar sessão por inatividade</b><small>Protege o sistema em computadores compartilhados.</small></span><input type="checkbox" defaultChecked/></label></div>}
        {saved && <p className="settings-message">{saved}</p>}<footer><small>Empresa ativa: {activeCompany.tradeName} • base {activeCompany.id}</small>{tab !== "Gerenciador" && <div className="settings-footer-actions">{tab === "Empresa" && normalizeCnpj(companyDoc) !== normalizeCnpj(activeCompany.cnpj) && <button className="outline-btn" onClick={createCompany}><Plus size={15}/> Criar como nova empresa</button>}<button className="primary-btn" onClick={save}><CheckCircle2 size={15}/> Salvar configurações</button></div>}</footer>
      </div></div>
  </section>;
}

function HousesWorkModule({ companyId }: { companyId: string }) {
  const storageKey = companyStorageKey(companyId, "obra-142-casas");
  const createHouses = () => HOUSE_BLOCKS.flatMap(({ block, houses }) => Array.from({ length: houses }, (_, index): HouseWorkItem => ({ id: `${block}-${String(index + 1).padStart(2, "0")}`, block, lot: index + 1, status: "AG FRIGORÍGENA", history: [] })));
  const [houses, setHouses] = useState<HouseWorkItem[]>(createHouses);
  const [blockFilter, setBlockFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<HouseWorkItem | null>(null);
  const [nextStatus, setNextStatus] = useState<HouseWorkStatus>("AG FRIGORÍGENA");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState("");
  const [historyHouse, setHistoryHouse] = useState<HouseWorkItem | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) { const initial = createHouses(); setHouses(initial); localStorage.setItem(storageKey, JSON.stringify(initial)); return; }
    try {
      const parsed = JSON.parse(stored) as HouseWorkItem[];
      const byId = new Map(parsed.map(item => [item.id, item]));
      setHouses(createHouses().map(item => byId.get(item.id) ?? item));
    } catch { setHouses(createHouses()); }
  }, [storageKey]);
  const persist = (next: HouseWorkItem[]) => { setHouses(next); localStorage.setItem(storageKey, JSON.stringify(next)); };
  const openUpdate = (house: HouseWorkItem) => { setEditing(house); setNextStatus(house.status); setNote(""); setPhoto(""); };
  const readPhoto = async (file?: File) => { if (file) setPhoto(await imageFileToDataUrl(file)); };
  const saveUpdate = () => {
    if (!editing) return;
    const createdAt = new Date().toISOString();
    const update: HouseWorkUpdate = { id: `${editing.id}-${Date.now()}`, status: nextStatus, note: note.trim(), photo: photo || undefined, createdAt };
    const next = houses.map(item => item.id === editing.id ? { ...item, status: nextStatus, note: note.trim() || item.note, photo: photo || item.photo, updatedAt: createdAt, history: [update, ...(item.history ?? [])] } : item);
    persist(next); setEditing(null);
  };
  const visible = houses.filter(house => (blockFilter === "Todas" || house.block === blockFilter) && (statusFilter === "Todos" || house.status === statusFilter) && `${house.block} ${house.lot} ${house.id}`.toLowerCase().includes(query.toLowerCase()));
  const completed = houses.filter(house => house.status === "FIM").length;
  const completion = houses.length ? Math.round(completed / houses.length * 100) : 0;
  const grouped = HOUSE_BLOCKS.map(({ block }) => ({ block, houses: visible.filter(house => house.block === block) })).filter(group => group.houses.length);
  const statusColor = (status: HouseWorkStatus) => HOUSE_STATUSES.find(item => item.name === status)?.color ?? "#64748b";
  return <section className="houses-app">
    <div className="houses-hero"><div><span className="section-kicker"><House size={12}/> CONTROLE DE EXECUÇÃO</span><h2>Obra — 142 Casas</h2><p>Acompanhamento individual por quadra e lote, com evidências e histórico de execução.</p></div><div className="houses-progress"><div><small>PROGRESSO GERAL</small><strong>{completion}%</strong></div><i><b style={{ width: `${completion}%` }}/></i><span>{completed} finalizadas de {houses.length} casas cadastradas</span></div></div>
    <div className="houses-kpis"><article><span><House size={18}/></span><div><small>TOTAL CADASTRADO</small><strong>{houses.length}</strong><em>11 quadras</em></div></article>{HOUSE_STATUSES.map(status => <article key={status.name}><i style={{background:status.color}}/><div><small>{status.name}</small><strong>{houses.filter(house => house.status === status.name).length}</strong><em>{Math.round(houses.filter(house => house.status === status.name).length / houses.length * 100)}% da obra</em></div></article>)}</div>
    <div className="houses-toolbar"><label><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar quadra ou lote..."/></label><select value={blockFilter} onChange={event => setBlockFilter(event.target.value)}><option>Todas</option>{HOUSE_BLOCKS.map(item => <option key={item.block}>{item.block}</option>)}</select><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>Todos</option>{HOUSE_STATUSES.map(item => <option key={item.name}>{item.name}</option>)}</select><span>{visible.length} casa(s) exibida(s)</span></div>
    <div className="houses-legend">{HOUSE_STATUSES.map(status => <span key={status.name}><i style={{background:status.color}}/>{status.name}</span>)}</div>
    <div className="block-list">{grouped.map(group => <section className="block-section" key={group.block}><header><div><span>QUADRA</span><strong>{group.block}</strong></div><p>{group.houses.length} lote(s) exibido(s)</p><b>{houses.filter(house => house.block === group.block && house.status === "FIM").length}/{houses.filter(house => house.block === group.block).length} concluídas</b></header><div className="house-grid">{group.houses.map(house => <article key={house.id} style={{"--house-color":statusColor(house.status)} as React.CSSProperties} onDoubleClick={() => openUpdate(house)}><div className="house-card-top"><span><House size={15}/></span><div><small>QUADRA {house.block}</small><h3>Lote {String(house.lot).padStart(2,"0")}</h3></div>{house.photo && <img src={house.photo} alt={`Casa ${house.id}`}/>}</div><div className="house-status"><i/><span>{house.status}</span></div>{house.note && <p>{house.note}</p>}<small className="house-date">{house.updatedAt ? `Atualizado em ${new Date(house.updatedAt).toLocaleString("pt-BR")}` : "Sem alterações registradas"}</small><footer><button onClick={() => openUpdate(house)}><Edit3 size={13}/> Alterar status</button><button disabled={!house.history?.length} onClick={() => setHistoryHouse(house)}><History size={13}/> Histórico</button></footer></article>)}</div></section>)}</div>
    {!visible.length && <div className="linked-empty"><Search size={22}/><h4>Nenhuma casa encontrada</h4><p>Altere os filtros para visualizar outros lotes.</p></div>}
    {editing && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setEditing(null)} aria-label="Fechar"/><div className="modal house-update-modal"><div className="modal-head"><div><span>ATUALIZAÇÃO DA OBRA</span><h2>Quadra {editing.block} • Lote {String(editing.lot).padStart(2,"0")}</h2><p>Registre o novo status, foto e observações do serviço.</p></div><button onClick={() => setEditing(null)}><X size={18}/></button></div><div className="house-update-body"><label>Novo status<select value={nextStatus} onChange={event => setNextStatus(event.target.value as HouseWorkStatus)}>{HOUSE_STATUSES.map(status => <option key={status.name}>{status.name}</option>)}</select></label><div className="status-preview" style={{"--preview-color":statusColor(nextStatus)} as React.CSSProperties}><i/><span>{nextStatus}</span></div><label className={`house-photo-upload ${photo ? "has-photo" : ""}`}>{photo ? <img src={photo} alt="Evidência"/> : <ImageIcon size={25}/>}<b>{photo ? "Foto pronta para anexar" : "Anexar foto da etapa"}</b><small>Câmera ou galeria do aparelho</small><input type="file" accept="image/*" capture="environment" onChange={event => readPhoto(event.target.files?.[0])}/></label><label>Observações<textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Descreva o serviço executado, pendências ou materiais utilizados..."/></label></div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditing(null)}>Cancelar</button><button className="primary-btn" onClick={saveUpdate}><CheckCircle2 size={15}/> Salvar alteração</button></div></div></div>}
    {historyHouse && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setHistoryHouse(null)} aria-label="Fechar"/><div className="modal house-history-modal"><div className="modal-head"><div><span>HISTÓRICO DA CASA</span><h2>Quadra {historyHouse.block} • Lote {String(historyHouse.lot).padStart(2,"0")}</h2><p>{historyHouse.history.length} alteração(ões) registrada(s)</p></div><button onClick={() => setHistoryHouse(null)}><X size={18}/></button></div><div className="house-timeline">{historyHouse.history.map(item => <article key={item.id}><i style={{background:statusColor(item.status)}}/><div><header><strong>{item.status}</strong><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></header>{item.note && <p>{item.note}</p>}{item.photo && <img src={item.photo} alt="Foto da atualização"/>}</div></article>)}</div><div className="modal-actions"><button className="primary-btn" onClick={() => setHistoryHouse(null)}>Fechar histórico</button></div></div></div>}
  </section>;
}

function GenericModule({ name, onOpen, onDelete, onUpdate, onConvert, companyCnpj, canEdit, records }: { name: string; onOpen: (name: string) => void; onDelete: (moduleName: string, record: ModuleRecord) => void; onUpdate: (moduleName: string, record: ModuleRecord) => void; onConvert?: (record: ModuleRecord, target: "Pedido" | "Ordem de serviço") => void; companyCnpj?: string; canEdit: boolean; records: ModuleRecord[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [activeView, setActiveView] = useState("Visão geral");
  const [editingCatalogRecord, setEditingCatalogRecord] = useState<ModuleRecord | null>(null);
  const [nfeStatus, setNfeStatus] = useState("");
  const catalogEditable = canEdit;
  const descriptions: Record<string,string> = {
    "Equipamentos": "Acompanhe o parque de equipamentos, histórico técnico, garantias e próximas manutenções.",
    "Ordens de serviço": "Planeje atendimentos, distribua equipes e acompanhe cada serviço até a assinatura.",
    "Estoque": "Controle entradas, saídas, reservas, inventários, perdas e alertas de reposição.",
    "Compras": "Solicitações, aprovações, recebimentos, estoque e contas a pagar integrados.",
    "Fornecedores": "Cadastro, produtos fornecidos, compras, financeiro, documentos e avaliação.",
    "Financeiro": "Contas a pagar e receber, caixa, bancos, conciliação e centros de custo.",
    "Obras": "Planeje e acompanhe obras, responsáveis, prazos, execução, perdas, materiais e resultado financeiro.",
  };
  const statuses = moduleStatuses[name] ?? ["Ativo", "Pendente", "Concluído", "Inativo"];
  const tabs = managementTabs[name] ?? ["Visão geral", "Cadastros", "Histórico"];
  const viewMatches = (record: ModuleRecord) => {
    if (activeView === "Visão geral" || activeView === "Histórico" || activeView === "Cadastro" || activeView === "Equipe") return true;
    if (activeView === "Planejamento") return /Planejamento/i.test(record.status || "");
    if (activeView === "Execução") return /Em andamento|Pausada|Aguardando material/i.test(record.status || "");
    if (activeView === "Perdas") return /perda|avaria|ocorrência/i.test(`${record.category} ${record.description}`);
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
  const searchDestinedNfe = async () => {
    setNfeStatus("Consultando o Ambiente Nacional da NF-e...");
    try { const response = await fetch("/api/nfe/distribution",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cnpj:companyCnpj})}); const result = await response.json(); setNfeStatus(response.ok ? `${result.count ?? 0} nota(s) nova(s) localizada(s).` : result.error || "Não foi possível consultar as notas."); }
    catch { setNfeStatus("Consulta indisponível. Verifique o certificado A1 nas Configurações Fiscais."); }
  };
  return <section className="module-page management-module">
    <div className="management-hero"><div><span className="section-kicker"><Grid2X2 size={12}/> MÓDULO PROAR</span><h2>{name}</h2><p>{descriptions[name] || `Consulte, cadastre e acompanhe todas as informações de ${name.toLowerCase()} em um só lugar.`}</p>{name === "Compras" && nfeStatus && <small className="nfe-search-status">{nfeStatus}</small>}</div><div className="management-actions">{name === "Compras" && <button className="outline-btn" onClick={searchDestinedNfe}><Search size={14}/> Buscar NF-e destinadas</button>}<button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Imprimir</button><button className="outline-btn" onClick={exportRecords}><ArrowDownRight size={14}/> Exportar</button><button className="primary-btn" onClick={() => onOpen(`Novo registro • ${name}`)}><Plus size={16}/> {name === "Compras" ? "Nova compra" : name === "Fornecedores" ? "Novo fornecedor" : name === "Financeiro" ? "Novo lançamento" : name === "Obras" ? "Nova obra" : "Novo registro"}</button></div></div>
    <div className="management-stats"><article><span><ClipboardList size={18}/></span><div><small>TOTAL DE REGISTROS</small><strong>{records.length}</strong></div></article><article><span><Clock3 size={18}/></span><div><small>PENDENTES / EM ABERTO</small><strong>{records.filter(record => /Rascunho|Aguardando|aberto|Vencida|Pendente/i.test(record.status || "")).length}</strong></div></article><article><span><CircleDollarSign size={18}/></span><div><small>VALOR REGISTRADO</small><strong>R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article></div>
    {managementFlows[name] && <div className="management-flow">{managementFlows[name].map((step, index) => <article key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{step.title}</b><small>{step.text}</small></div>{index < managementFlows[name].length - 1 && <ChevronRight size={14}/>}</article>)}</div>}
    <nav className="management-tabs" aria-label={`Áreas de ${name}`}>{tabs.map(tab => <button key={tab} className={activeView === tab ? "active" : ""} onClick={() => setActiveView(tab)}>{tab}</button>)}</nav>
    {name === "Financeiro" && <div className="finance-control-strip"><article><span className="money-icon red"><ArrowDownRight size={17}/></span><div><small>COMPROMISSOS EM ABERTO</small><strong>R$ {openValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article><article><span className="money-icon green"><ArrowUpRight size={17}/></span><div><small>MOVIMENTAÇÃO REALIZADA</small><strong>R$ {records.filter(record => /Paga|Recebida/i.test(record.status || "")).reduce((sum, record) => sum + (record.value ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article><article><span><Landmark size={17}/></span><div><small>CONCILIAÇÃO</small><strong>{records.filter(record => /Paga|Recebida/i.test(record.status || "")).length} movimento(s)</strong></div></article></div>}
    <div className="management-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Pesquisar em ${name.toLowerCase()}...`}/></label><label className="status-filter"><Filter size={14}/><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>Todas</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label></div>
    {name === "Orçamentos" && filtered.length > 0 && <div className="budget-conversion-strip"><div><FileText size={17}/><span><b>Conversão rápida de orçamento</b><small>Transforme um orçamento sem digitar novamente os dados.</small></span></div>{filtered.map(record => <article key={`convert-${record.id}`}><span><b>{record.name}</b><small>{record.client} • R$ {(record.value ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</small></span><button disabled={!canEdit} onClick={() => onConvert?.(record,"Pedido")}><ShoppingBag size={13}/> Transformar em pedido</button><button disabled={!canEdit} onClick={() => onConvert?.(record,"Ordem de serviço")}><ClipboardList size={13}/> Transformar em OS</button></article>)}</div>}
    {records.length ? <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><ClipboardList size={12}/> {activeView.toUpperCase()}</span><h2>{activeView} de {name.toLowerCase()}</h2><p>{filtered.length} de {records.length} registro(s){catalogEditable ? " • Clique duas vezes para editar" : ""}</p></div></div>{name === "Obras" && <div className="works-grid">{filtered.map(record => <article key={record.id}><header><span><Building2 size={18}/></span><div><small>{record.id}</small><h3>{record.name}</h3></div><em className={`workflow-status ${record.status === "Concluída" ? "done" : record.status === "Cancelada" ? "blocked" : ""}`}>{record.status}</em></header><p><MapPin size={13}/>{record.address || "Endereço não informado"}</p><div className="work-meta"><span><small>CLIENTE</small><b>{record.client || "—"}</b></span><span><small>RESPONSÁVEL</small><b>{record.engineer || "—"}</b></span><span><small>QUADRA / LOTE</small><b>{record.blockLot || "—"}</b></span><span><small>ORÇAMENTO</small><b>R$ {(record.value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></span></div><div className="work-progress"><span><b>Progresso da obra</b><strong>{record.progress ?? 0}%</strong></span><i><b style={{width:`${Math.min(100, Math.max(0, record.progress ?? 0))}%`}}/></i></div><footer><button onClick={() => advance(record)}><CheckCircle2 size={14}/> Avançar etapa</button><button onClick={() => window.print()}><FileText size={14}/> Relatório</button><button className="danger" onClick={() => onDelete(name, record)}><Trash2 size={14}/></button></footer></article>)}</div>} {name !== "Obras" && <div className="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>NOME / IDENTIFICAÇÃO</th><th>FORNECEDOR / RESPONSÁVEL</th><th>SITUAÇÃO</th><th>VALOR</th><th>DATA</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(record => <tr key={record.id} className={catalogEditable ? "editable-row" : ""} title={catalogEditable ? "Clique duas vezes para editar" : undefined} onDoubleClick={() => catalogEditable && setEditingCatalogRecord({ ...record })}><td><b className="order-id">{record.id}</b></td><td><strong>{record.name}</strong><small className="table-description">{name === "Compras" ? `${record.purchaseItems?.length ?? 0} item(ns) • ${record.paymentType ?? "Pagamento não informado"}${record.installments && record.installments > 1 ? ` • ${record.installments}x` : ""}` : catalogEditable ? `${record.category || record.kind || "Cadastro"} • Custo R$ ${(record.cost ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : record.description || "Sem observações"}</small></td><td>{record.client || "—"}</td><td><span className={`workflow-status ${/Recebida|Paga|Ativo|Concluído/i.test(record.status || "") ? "done" : /Cancelada|Inativo|Bloqueado|Devolvida/i.test(record.status || "") ? "blocked" : ""}`}>{record.status || statuses[0]}</span></td><td><b>R$ {(record.value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></td><td>{record.date ? new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR") : record.createdAt}</td><td><div className="record-actions">{catalogEditable && <button title="Editar cadastro" onClick={() => setEditingCatalogRecord({ ...record })}><Edit3 size={14}/></button>}<button title="Avançar situação" onClick={() => advance(record)}><CheckCircle2 size={14}/></button>{name === "Compras" && <button title="Duplicar compra" onClick={() => duplicate(record)}><FileText size={14}/></button>}<button title="Imprimir" onClick={() => window.print()}><ReceiptText size={14}/></button><button className="danger" title="Excluir" onClick={() => onDelete(name, record)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>}{!filtered.length && <div className="linked-empty"><Search size={22}/><h4>Nenhum registro encontrado</h4><p>Ajuste a pesquisa ou o filtro de situação.</p></div>}</div> :
    <div className="empty-grid">{[{t:"Visão geral",i:LayoutDashboard},{t:"Registros recentes",i:Clock3},{t:"Indicadores",i:TrendingUp}].map(({t,i:Icon})=><article className="panel" key={t}><span><Icon size={19}/></span><h3>{t}</h3><p>Use “Novo registro” para adicionar o primeiro cadastro deste módulo.</p><button onClick={() => onOpen(`Novo registro • ${name}`)}>Cadastrar agora <ArrowRight size={12}/></button></article>)}</div>}
    {editingCatalogRecord && <div className="modal-layer catalog-edit-layer" role="dialog" aria-modal="true" aria-label={`Editar ${editingCatalogRecord.name}`}><button className="modal-backdrop" aria-label="Fechar edição" onClick={() => setEditingCatalogRecord(null)}/><div className="modal catalog-edit-modal"><div className="modal-head"><div><span>EDIÇÃO RÁPIDA • {name.toUpperCase()}</span><h2>{editingCatalogRecord.name}</h2><p>Altere nome, preço e custo do cadastro.</p></div><button onClick={() => setEditingCatalogRecord(null)} aria-label="Fechar"><X size={18}/></button></div><div className="catalog-edit-form"><label className="wide">Nome / identificação<input autoFocus value={editingCatalogRecord.name} onChange={event => setEditingCatalogRecord(record => record ? { ...record, name: event.target.value } : record)}/></label><label>Preço de venda<input type="number" min="0" step="0.01" value={editingCatalogRecord.value ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, value: Number(event.target.value) || 0 } : record)}/></label><label>Preço de custo<input type="number" min="0" step="0.01" value={editingCatalogRecord.cost ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, cost: Number(event.target.value) || 0 } : record)}/></label><label>Categoria<input value={editingCatalogRecord.category ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, category: event.target.value } : record)}/></label><label>Situação<select value={editingCatalogRecord.status ?? "Ativo"} onChange={event => setEditingCatalogRecord(record => record ? { ...record, status: event.target.value } : record)}><option>Ativo</option><option>Inativo</option><option>Pendente</option></select></label><label className="wide">Descrição / observações<textarea value={editingCatalogRecord.description ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, description: event.target.value } : record)}/></label><div className="wide catalog-margin-preview"><span><CircleDollarSign size={18}/><div><small>MARGEM BRUTA ESTIMADA</small><b>R$ {Math.max(0, (editingCatalogRecord.value ?? 0) - (editingCatalogRecord.cost ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></div></span><strong>{editingCatalogRecord.value ? `${Math.max(0, (((editingCatalogRecord.value ?? 0) - (editingCatalogRecord.cost ?? 0)) / editingCatalogRecord.value) * 100).toFixed(1)}%` : "0%"}</strong></div></div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditingCatalogRecord(null)}>Cancelar</button><button className="primary-btn" disabled={!editingCatalogRecord.name.trim()} onClick={() => { onUpdate(name, editingCatalogRecord); setEditingCatalogRecord(null); }}><CheckCircle2 size={15}/> Salvar alterações</button></div></div></div>}
  </section>;
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
  engineer: string;
  workAddress: string;
  blockLot: string;
  endDate: string;
  progress: number;
  commission: number;
  cost: number;
  employeeRole: string;
  employeePermissions: Record<string, ("Visualizar" | "Criar" | "Editar" | "Excluir")[]>;
  employeeUsername?: string;
  employeePassword?: string;
};

type AuthenticatedUser = { username: string; displayName: string; role?: string; permissions?: string[] };

async function passwordHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

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
      const modules = JSON.parse(localStorage.getItem("proar-v3-module-records") || "{}") as Record<string, ModuleRecord[]>;
      const normalized = username.trim().toLocaleLowerCase("pt-BR");
      const employee = (modules.Funcionários ?? []).find(item => item.status !== "Inativo" && item.employeeUsername?.toLocaleLowerCase("pt-BR") === normalized);
      if (employee?.employeePasswordHash && employee.employeePasswordHash === await passwordHash(password)) {
        const permissions = Object.entries(employee.employeePermissions ?? {}).flatMap(([module, actions]) => actions.includes("Visualizar") ? [module, ...actions.map(action => `${module}:${action}`)] : []);
        onLogin({ username: employee.employeeUsername || normalized, displayName: employee.name, role: employee.employeeRole || "Utilizador", permissions });
      } else setError(loginError instanceof Error ? loginError.message : "Não foi possível entrar.");
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

function Modal({ title, customers, catalogRecords, supplierRecords, employeeRecords, close, onSave }: { title: string; customers: Customer[]; catalogRecords: ModuleRecord[]; supplierRecords: ModuleRecord[]; employeeRecords: ModuleRecord[]; close: () => void; onSave: (data: ModalSave) => void | Promise<void> }) {
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
  const [recordCost, setRecordCost] = useState("");
  const [recordCategory, setRecordCategory] = useState("");
  const [recordKind, setRecordKind] = useState<"Serviço" | "Produto">(title.includes("Produtos") ? "Produto" : "Serviço");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([]);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePickerIds, setServicePickerIds] = useState<string[]>([]);
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
  const [engineer, setEngineer] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [blockLot, setBlockLot] = useState("");
  const [endDate, setEndDate] = useState("");
  const [progress, setProgress] = useState(0);
  const [commission, setCommission] = useState(0);
  const [employeeRole, setEmployeeRole] = useState("Atendimento");
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const permissionModules = navGroups.flatMap(group => group.items.map(item => item.name));
  const permissionActions = ["Visualizar", "Criar", "Editar", "Excluir"] as const;
  const profilePermissions: Record<string, Record<string, (typeof permissionActions)[number][]>> = {
    Administrador: Object.fromEntries(permissionModules.map(module => [module, [...permissionActions]])),
    Financeiro: Object.fromEntries(permissionModules.map(module => [module, ["Financeiro", "Relatórios", "Clientes"].includes(module) ? ["Visualizar", "Criar", "Editar"] : []])),
    "Técnico de Campo": Object.fromEntries(permissionModules.map(module => [module, ["Ordens de serviço", "Agenda", "Serviços", "Clientes"].includes(module) ? ["Visualizar", "Editar"] : []])),
    Atendimento: Object.fromEntries(permissionModules.map(module => [module, ["Clientes", "Ordens de serviço", "Agenda", "Serviços"].includes(module) ? ["Visualizar", "Criar", "Editar"] : []])),
  };
  const [employeePermissions, setEmployeePermissions] = useState<Record<string, (typeof permissionActions)[number][]>>(profilePermissions.Atendimento);
  const applyEmployeeRole = (role: string) => { setEmployeeRole(role); setEmployeePermissions(profilePermissions[role]); setRecordCategory(role); };
  const togglePermission = (module: string, action: (typeof permissionActions)[number]) => setEmployeePermissions(current => ({ ...current, [module]: current[module]?.includes(action) ? current[module].filter(item => item !== action) : [...(current[module] ?? []), action] }));
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
  const serviceRecords = catalogRecords.filter(item => (item.kind || "Serviço") === "Serviço");
  const selectedServices = serviceRecords.filter(item => selectedCatalogIds.includes(item.id));
  const visibleServiceOptions = serviceRecords.filter(item => `${item.name} ${item.description || ""} ${item.category || ""}`.toLocaleLowerCase("pt-BR").includes(serviceSearch.trim().toLocaleLowerCase("pt-BR")));
  const availableUnits = selectedClient ? [
    ...(selectedClientData ? [{ icon: Building2, name: "Endereço principal", type: "Cliente principal", doc: selectedClientData.doc, responsible: selectedClientData.contact, phone: selectedClientData.phone, address: selectedClientData.address, orders: 0 }] : []),
    ...(linkedUnits[selectedClient] ?? []),
    ...(linkedSectors[selectedClient] ?? []),
  ].filter((unit, index, list) => list.findIndex(item => item.name === unit.name) === index) : [];
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}><button className="modal-backdrop" onClick={close} aria-label="Fechar janela"/><div className="modal"><div className="modal-head"><div><span>{isLinkedStructure ? "ESTRUTURA DO CLIENTE • LIMITE DE 20" : "CADASTRO PROAR"}</span><h2>{isLinkedStructure ? "Nova unidade, filial ou setor" : title}</h2>{isLinkedStructure && <p>Este registro será vinculado a <strong>{parentCustomer}</strong>.</p>}</div><button onClick={close} aria-label="Fechar"><X size={18}/></button></div><div className="form-grid">
    {isLinkedStructure ? <>
      <label>Cliente principal<input value={parentCustomer} readOnly/></label>
      <label>Tipo de vínculo<select value={recordCategory} onChange={event => setRecordCategory(event.target.value)}><option>Unidade</option><option>Filial</option><option>Setor</option><option>Secretaria</option><option>Departamento</option><option>Empresa vinculada</option></select></label>
      <label>Nome da unidade ou setor<input value={recordName} onChange={event => setRecordName(event.target.value)} placeholder="Ex.: Filial Olímpia ou Secretaria de Saúde"/></label>
      <label>Razão social<input placeholder="Razão social vinculada"/></label>
      <label>Nome fantasia<input placeholder="Nome fantasia"/></label>
      <label>CNPJ<input value={doc} onChange={event => setDoc(event.target.value)} placeholder="00.000.000/0000-00"/></label>
      <label>Responsável<input value={contact} onChange={event => setContact(event.target.value)} placeholder="Nome do responsável local"/></label>
      <label>Telefone / WhatsApp<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="(00) 00000-0000"/></label>
      <label className="wide">Endereço<input value={address} onChange={event => setAddress(event.target.value)} placeholder="CEP, rua, número, bairro, cidade e estado"/></label>
      <label className="wide">Observações<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Informações específicas desta unidade, empresa ou setor..."/></label>
    </> : <>
      {isNewOrder ? <>
        <label>Cliente cadastrado<select value={selectedClient} onChange={event => setSelectedClient(event.target.value)}><option value="">Selecione o cliente</option>{customers.map(customer => <option key={customer.doc} value={customer.name}>{customer.name} • {customer.doc}</option>)}</select></label>
        <label>Unidade, filial ou setor<select value={unit} onChange={event => setUnit(event.target.value)} disabled={!selectedClient}><option value="">{selectedClient ? "Selecione o local do atendimento" : "Selecione primeiro o cliente"}</option>{availableUnits.map(item => <option key={item.name} value={item.name}>{item.name} • {item.type}</option>)}</select></label>
        <label>Responsável do cliente<input value={selectedClientData?.contact ?? ""} readOnly placeholder="Carregado pelo cadastro"/></label>
        <label>Telefone<input value={selectedClientData?.phone ?? ""} readOnly placeholder="Carregado pelo cadastro"/></label>
        <label className="wide">Endereço do atendimento<input value={unit ? availableUnits.find(item => item.name === unit)?.address ?? selectedClientData?.address ?? "" : selectedClientData?.address ?? ""} readOnly placeholder="Carregado pelo cadastro do cliente"/></label>
        <label>Data do atendimento<input type="date" value={date} onInput={event => setDate(event.currentTarget.value)} onChange={event => setDate(event.target.value)}/></label>
        <label>Horário<input type="time" value={time} onChange={event => setTime(event.target.value)}/></label>
        <label>Técnico empenhado<select value={tech} onChange={event => setTech(event.target.value)}><option value="">Selecione o técnico</option>{employeeRecords.filter(employee => employee.status !== "Inativo" && /técnico|tecnico/i.test(`${employee.employeeRole} ${employee.category}`)).map(employee => <option key={employee.id} value={employee.name}>{employee.name}</option>)}</select></label>
        <label>Prioridade<select><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>
        <div className="wide order-catalog">
          <div className="execution-head"><div><span>SERVIÇOS DA ORDEM</span><h3>Itens selecionados</h3></div><div className="catalog-head-actions"><small>{selectedCatalogIds.length} selecionado(s)</small><button type="button" onClick={() => { setServicePickerIds(selectedCatalogIds); setServiceSearch(""); setServicePickerOpen(true); }}><Plus size={14}/> Adicionar serviços</button></div></div>
          {selectedServices.length ? <div className="selected-service-grid">{selectedServices.map(item => <article key={item.id}><span><Wrench size={16}/></span><div><b>{item.name}</b><small>{item.category || "Serviço cadastrado"}</small></div><button type="button" aria-label={`Remover ${item.name}`} onClick={() => setSelectedCatalogIds(current => current.filter(id => id !== item.id))}><X size={14}/></button></article>)}</div> : <div className="catalog-empty"><Wrench size={19}/><span>Nenhum serviço selecionado. Use “Adicionar serviços” para escolher vários itens.</span></div>}
          {!serviceRecords.length && <div className="catalog-empty"><Wrench size={19}/><span>Nenhum serviço cadastrado. Cadastre no menu Serviços para selecionar aqui.</span></div>}
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
        {requestedModule === "Obras" ? <>
          <div className="wide work-form-intro"><span><Building2 size={20}/></span><div><b>Cadastro e planejamento da obra</b><small>Centralize cliente, localização, responsável técnico, orçamento, prazo e evolução da execução.</small></div></div>
          <label>Nome da obra<input value={recordName} onChange={event => setRecordName(event.target.value)} placeholder="Ex.: Residencial Jardim Imperial"/></label>
          <label>Cliente<select value={recordClient} onChange={event => setRecordClient(event.target.value)}><option value="">Selecione o cliente</option>{customers.map(customer => <option key={customer.id} value={customer.name}>{customer.name}</option>)}</select></label>
          <label className="wide">Endereço da obra<input value={workAddress} onChange={event => setWorkAddress(event.target.value)} placeholder="Rua, número, bairro, cidade e estado"/></label>
          <label>Quadra / casa / lote<input value={blockLot} onChange={event => setBlockLot(event.target.value)} placeholder="Ex.: Quadra B • Lote 18"/></label>
          <label>Engenheiro / responsável<input value={engineer} onChange={event => setEngineer(event.target.value)} placeholder="Nome do responsável técnico"/></label>
          <label>Situação<select value={recordStatus} onChange={event => setRecordStatus(event.target.value)}>{moduleStatuses.Obras.map(status => <option key={status}>{status}</option>)}</select></label>
          <label>Orçamento previsto<input type="number" min="0" step="0.01" value={recordValue} onChange={event => setRecordValue(event.target.value)} placeholder="R$ 0,00"/></label>
          <label>Data de início<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
          <label>Previsão de conclusão<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)}/></label>
          <label>Progresso inicial (%)<input type="number" min="0" max="100" value={progress} onChange={event => setProgress(Math.min(100, Math.max(0, Number(event.target.value))))}/></label>
          <label>Comissão do responsável (%)<input type="number" min="0" max="100" step="0.1" value={commission || ""} onChange={event => setCommission(Math.min(100, Math.max(0, Number(event.target.value))))} placeholder="Opcional"/></label>
          <label>Centro de custo / tipo<input value={recordCategory} onChange={event => setRecordCategory(event.target.value)} placeholder="Ex.: Infraestrutura frigorígena"/></label>
          <label className="wide">Escopo e observações<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Descreva o escopo, etapas, materiais, equipe e observações da obra..."/></label>
        </> : <>
        <label>{requestedModule === "Compras" ? "Produto, material ou pedido" : requestedModule === "Financeiro" ? "Descrição do lançamento" : requestedModule === "Fornecedores" ? "Razão social / Nome fantasia" : requestedModule === "Funcionários" ? "Nome completo do funcionário" : "Nome / identificação"}<input value={recordName} onChange={event => setRecordName(event.target.value)} placeholder={requestedModule === "Funcionários" ? "Nome completo" : "Digite o nome do registro"}/></label>
        {requestedModule === "Orçamentos" ? <label>Cliente cadastrado<select value={recordClient} onChange={event => setRecordClient(event.target.value)}><option value="">Selecione o cliente</option>{customers.map(customer => <option key={customer.id} value={customer.name}>{customer.name} • {customer.doc || "Sem documento"}</option>)}</select></label> : requestedModule === "Funcionários" ? <label>Função / cargo<input value={recordCategory} onChange={event => setRecordCategory(event.target.value)} placeholder="Ex.: Técnico de climatização"/></label> : <label>{requestedModule === "Compras" ? "Fornecedor" : requestedModule === "Financeiro" ? "Cliente ou fornecedor" : requestedModule === "Fornecedores" ? "Responsável comercial" : "Cliente / responsável"}<input value={recordClient} onChange={event => setRecordClient(event.target.value)} placeholder="Nome relacionado ao cadastro"/></label>}
        <label>{requestedModule === "Fornecedores" ? "CNPJ / CPF" : requestedModule === "Funcionários" ? "CPF / documento" : "Código / documento"}<input placeholder="Código, CPF, CNPJ ou número interno"/></label>
        <label>Situação<select value={recordStatus} onChange={event => setRecordStatus(event.target.value)}>{(moduleStatuses[requestedModule] ?? ["Ativo", "Pendente", "Concluído", "Inativo"]).map(status => <option key={status}>{status}</option>)}</select></label>
        {requestedModule === "Funcionários" ? <><label>Perfil de acesso<select value={employeeRole} onChange={event => applyEmployeeRole(event.target.value)}><option>Administrador</option><option>Financeiro</option><option>Técnico de Campo</option><option>Atendimento</option></select></label><label>Nome de utilizador<input autoComplete="off" value={employeeUsername} onChange={event => { const value = event.target.value.toLocaleLowerCase("pt-BR").replace(/\s+/g, "."); setEmployeeUsername(value); setRecordClient(value); }} placeholder="Ex.: tiago.viana"/></label><label>Senha de acesso<input type="password" autoComplete="new-password" value={employeePassword} onChange={event => { const value = event.target.value; setEmployeePassword(value); void passwordHash(value).then(hash => setDescription(`AUTH:${hash}`)); }} placeholder="Mínimo de 4 caracteres"/></label></> : <label>{requestedModule === "Financeiro" ? "Categoria / centro de custo" : requestedModule === "Compras" ? "Categoria da compra" : "Categoria / centro de custo"}<input value={recordCategory} onChange={event => setRecordCategory(event.target.value)} placeholder="Ex.: Materiais de serviço"/></label>}
        <label>{requestedModule === "Funcionários" ? "Comissão / valor de referência" : requestedModule === "Compras" ? "Valor total calculado" : isCatalogRegistration ? "Preço de venda" : "Valor total"}<input type="number" min="0" step="0.01" readOnly={requestedModule === "Compras"} value={requestedModule === "Compras" ? purchaseTotal : recordValue} onChange={event => setRecordValue(event.target.value)} placeholder="R$ 0,00"/></label>
        {isCatalogRegistration && <label>Preço de custo<input type="number" min="0" step="0.01" value={recordCost} onChange={event => setRecordCost(event.target.value)} placeholder="R$ 0,00"/></label>}
        <label>{requestedModule === "Funcionários" ? "Telefone / WhatsApp" : "Telefone / contato"}<input placeholder="(00) 00000-0000"/></label><label>{requestedModule === "Funcionários" ? "Data de admissão" : requestedModule === "Compras" ? "Previsão de entrega" : requestedModule === "Financeiro" ? "Data de vencimento" : "Data"}<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
        {requestedModule === "Funcionários" && <div className="wide permission-matrix"><div className="permission-head"><div><span>MATRIZ DE PERMISSÕES</span><h3>Acesso por módulo</h3></div><small>O menu e as ações respeitam o perfil selecionado.</small></div><div className="permission-table"><div className="permission-row permission-labels"><b>MÓDULO</b>{permissionActions.map(action => <b key={action}>{action}</b>)}</div>{permissionModules.map(module => <div className="permission-row" key={module}><strong>{module}</strong>{permissionActions.map(action => <label key={action}><input type="checkbox" checked={employeePermissions[module]?.includes(action) ?? false} onChange={() => togglePermission(module, action)}/><span/></label>)}</div>)}</div></div>}
        <label className="wide">Descrição / observações<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder={requestedModule === "Funcionários" ? "Observações internas sobre o funcionário..." : "Inclua os detalhes deste cadastro..."}/></label>
        </>}
      </>}
    </>}
  </div><div className="modal-actions"><button className="outline-btn" onClick={close}>Cancelar</button><button className="primary-btn" disabled={isNewOrder ? !selectedClient || !tech || !date : isNewCustomer ? !recordName || !address.trim() || !addressValidated : requestedModule === "Compras" ? !recordName || !recordClient || !purchaseItems.some(item => item.description.trim() && item.quantity > 0) || purchaseTotal <= 0 || (paymentType === "A prazo" && !firstDueDate) : requestedModule === "Obras" ? !recordName || !recordClient || !workAddress : (!isLinkedStructure && !recordName)} onClick={() => onSave({ title, name: recordName, client: isNewOrder ? selectedClient : recordClient, doc, contact, phone, address: isNewOrder ? (unit ? availableUnits.find(item => item.name === unit)?.address ?? selectedClientData?.address ?? "" : selectedClientData?.address ?? "") : address, unit, tech, date, time, description, status: recordStatus, value: requestedModule === "Compras" ? purchaseTotal : Number(recordValue) || 0, category: recordCategory, kind: recordKind, catalogItems: catalogRecords.filter(item => selectedCatalogIds.includes(item.id)).map(item => ({ id: item.id, name: item.name, kind: item.kind || "Serviço" })), purchaseItems: purchaseItems.filter(item => item.description.trim() && item.quantity > 0), paymentType, paymentMethod, installments: paymentType === "A prazo" ? Math.max(1, installments) : 1, firstDueDate, paymentInstallments, xmlImported, supplierDoc, supplierId, registerSupplier: xmlImported && !supplierId, engineer, workAddress, blockLot, endDate, progress, commission, cost: Number(recordCost) || 0, employeeRole, employeePermissions })}><CheckCircle2 size={15}/> Salvar registro</button></div></div>
    {servicePickerOpen && <div className="service-picker-layer" role="dialog" aria-modal="true" aria-label="Selecionar serviços"><button type="button" className="service-picker-backdrop" aria-label="Fechar seleção de serviços" onClick={() => setServicePickerOpen(false)}/><section className="service-picker"><header><div><span>CATÁLOGO DE SERVIÇOS</span><h3>Selecionar vários serviços</h3><p>Pesquise e marque todos os itens necessários para esta ordem.</p></div><button type="button" aria-label="Fechar" onClick={() => setServicePickerOpen(false)}><X size={17}/></button></header><label className="service-picker-search"><Search size={17}/><input autoFocus value={serviceSearch} onChange={event => setServiceSearch(event.target.value)} placeholder="Pesquisar por nome ou categoria..."/><small>{visibleServiceOptions.length} resultado(s)</small></label><div className="service-picker-grid">{visibleServiceOptions.map(item => <label key={item.id} className={servicePickerIds.includes(item.id) ? "selected" : ""}><input type="checkbox" checked={servicePickerIds.includes(item.id)} onChange={() => setServicePickerIds(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id])}/><span><Wrench size={17}/></span><div><b>{item.name}</b><small>{item.category || item.description || "Serviço cadastrado"}</small></div><CheckCircle2 size={16}/></label>)}</div>{!visibleServiceOptions.length && <div className="catalog-empty"><Search size={18}/><span>Nenhum serviço encontrado para esta pesquisa.</span></div>}<footer><span><b>{servicePickerIds.length}</b> serviço(s) marcado(s)</span><div><button type="button" className="outline-btn" onClick={() => setServicePickerOpen(false)}>Cancelar</button><button type="button" className="primary-btn" onClick={() => { setSelectedCatalogIds(servicePickerIds); setServicePickerOpen(false); }}><CheckCircle2 size={15}/> Aplicar seleção</button></div></footer></section></div>}
  </div>;
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
  const [moduleRecords, setModuleRecords] = useState<Record<string, ModuleRecord[]>>({ Funcionários: [tiagoEmployee] });
  const [savedMessage, setSavedMessage] = useState("");
  const [companies, setCompanies] = useState<TenantCompany[]>([DEFAULT_COMPANY]);
  const [activeCompany, setActiveCompany] = useState<TenantCompany>(DEFAULT_COMPANY);
  useEffect(() => {
    const storedCompanies = JSON.parse(localStorage.getItem("proar-v4-companies") || "[]") as TenantCompany[];
    const available = storedCompanies.length ? storedCompanies : [DEFAULT_COMPANY];
    const storedActiveId = localStorage.getItem("proar-v4-active-company");
    const selected = available.find(company => company.id === storedActiveId && company.status === "Ativa") || available.find(company => company.status === "Ativa") || available[0];
    setCompanies(available);
    setActiveCompany(selected);
    localStorage.setItem("proar-v4-companies", JSON.stringify(available));
    localStorage.setItem("proar-v4-active-company", selected.id);
  }, []);
  const updateCompanies = (next: TenantCompany[]) => {
    setCompanies(next);
    localStorage.setItem("proar-v4-companies", JSON.stringify(next));
    next.filter(company => normalizeCnpj(company.cnpj).length === 14).forEach(company => {
      void fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(company) });
    });
  };
  const selectCompany = (company: TenantCompany) => {
    if (company.status === "Bloqueada") { setSavedMessage(`O acesso ao CNPJ ${company.cnpj} está bloqueado pelo gerenciador.`); return; }
    setActiveCompany(company);
    localStorage.setItem("proar-v4-active-company", company.id);
    setSavedMessage(`Empresa alterada para ${company.tradeName}. Base de dados isolada carregada.`);
    window.setTimeout(() => setSavedMessage(""), 3000);
  };
  useEffect(() => {
    fetch("/api/auth").then(async response => response.ok ? response.json() : null).then(result => {
      if (result?.authenticated) setAuthenticatedUser({ username: result.username, displayName: result.displayName, role: result.role, permissions: result.permissions });
    }).finally(() => setCheckingSession(false));
  }, []);
  useEffect(() => {
    if (!authenticatedUser) return;
    const loadSharedState = async () => {
      try {
        if (activeCompany.status === "Bloqueada") throw new Error("blocked");
        const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const { state } = await response.json();
        if (state) {
          setServiceOrders(state.serviceOrders ?? []);
          setCustomerRecords(state.customers ?? []);
          const loadedModules = state.moduleRecords ?? {};
          const blockedFictitious = ["João Carlos", "Caio Henrique", "Thiago Souza", "Lucas Mendes"];
          const realEmployees = (loadedModules.Funcionários ?? []).filter((employee: ModuleRecord) => !blockedFictitious.includes(employee.name));
          const employees = realEmployees.some((employee: ModuleRecord) => employee.name === "Tiago Viana") ? realEmployees : [tiagoEmployee, ...realEmployees];
          setModuleRecords({ ...loadedModules, Funcionários: employees });
          return;
        }
        const localState = {
          serviceOrders: JSON.parse(localStorage.getItem(companyStorageKey(activeCompany.id, "service-orders")) ?? "[]"),
          customers: JSON.parse(localStorage.getItem(companyStorageKey(activeCompany.id, "customers")) ?? "[]"),
          moduleRecords: JSON.parse(localStorage.getItem(companyStorageKey(activeCompany.id, "module-records")) ?? "{}"),
        };
        await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(localState) });
        setServiceOrders(localState.serviceOrders);
        setCustomerRecords(localState.customers);
        setModuleRecords(localState.moduleRecords);
      } catch {
        const localOrders = JSON.parse(localStorage.getItem(companyStorageKey(activeCompany.id, "service-orders")) ?? "[]");
        const localCustomers = JSON.parse(localStorage.getItem(companyStorageKey(activeCompany.id, "customers")) ?? "[]");
        const localModules = JSON.parse(localStorage.getItem(companyStorageKey(activeCompany.id, "module-records")) ?? "{}");
        setServiceOrders(localOrders);
        setCustomerRecords(localCustomers);
        setModuleRecords({ ...localModules, Funcionários: localModules.Funcionários?.length ? localModules.Funcionários : [tiagoEmployee] });
      }
    };
    loadSharedState();
  }, [authenticatedUser, activeCompany.id]);
  const persistSharedState = (nextCustomers: Customer[], nextOrders: ServiceOrder[], nextModules: Record<string, ModuleRecord[]>) => {
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(nextCustomers));
    localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(nextOrders));
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(nextModules));
    fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: activeCompany.id, customers: nextCustomers, serviceOrders: nextOrders, moduleRecords: nextModules }),
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
    localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(updatedOrders));
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    persistSharedState(customerRecords, updatedOrders, updatedModules);
    setSavedMessage(updatedOrder.status === "Concluída" && updatedOrder.reminderEnabled ? `Ordem ${updatedOrder.id} concluída e lembrete agendado.` : `Ordem ${updatedOrder.id} atualizada e sincronizada.`);
    window.setTimeout(() => setSavedMessage(""), 2500);
  };
  const hasAction = (moduleName: string, action: "Visualizar" | "Criar" | "Editar" | "Excluir") => Boolean(authenticatedUser?.permissions?.includes("*") || authenticatedUser?.role === "Administrador" || authenticatedUser?.permissions?.includes(`${moduleName}:${action}`));
  const updateCustomer = (updatedCustomer: Customer) => {
    const updatedCustomers = customerRecords.map(customer => customer.id === updatedCustomer.id ? updatedCustomer : customer);
    setCustomerRecords(updatedCustomers);
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
    setSavedMessage(`Cliente ${updatedCustomer.name} atualizado com sucesso.`);
    window.setTimeout(() => setSavedMessage(""), 2500);
  };
  const convertBudget = (budget: ModuleRecord, target: "Pedido" | "Ordem de serviço") => {
    if (target === "Pedido") {
      const sale: ModuleRecord = { ...budget, id:`VEN-${Date.now().toString().slice(-6)}`, name:`Pedido • ${budget.name}`, status:"Pedido confirmado", createdAt:new Date().toLocaleString("pt-BR") };
      const updated = { ...moduleRecords, Vendas:[sale,...(moduleRecords.Vendas ?? [])], Orçamentos:(moduleRecords.Orçamentos ?? []).map(item => item.id === budget.id ? {...item,status:"Convertido em pedido"} : item) };
      setModuleRecords(updated); persistSharedState(customerRecords, serviceOrders, updated); setCurrent("Vendas");
    } else {
      const customer = customerRecords.find(item => item.name === budget.client);
      const order: ServiceOrder = { id:`#OS-${String(Math.max(15499,...serviceOrders.map(item => Number(item.id.replace(/\D/g,""))||0))+1).padStart(5,"0")}`, client:budget.client, unit:"Unidade principal", service:budget.name, tech:"Não definido", date:budget.date || new Date().toISOString().slice(0,10), time:"A definir", address:customer?.address || "", status:"Aberta", tone:"blue", avatar:budget.client.split(" ").map(item => item[0]).slice(0,2).join("") };
      const updatedOrders = [order,...serviceOrders]; const updatedModules = { ...moduleRecords, Orçamentos:(moduleRecords.Orçamentos ?? []).map(item => item.id === budget.id ? {...item,status:"Convertido em OS"} : item) };
      setServiceOrders(updatedOrders); setModuleRecords(updatedModules); persistSharedState(customerRecords,updatedOrders,updatedModules); setCurrent("Ordens de serviço");
    }
    setSavedMessage(`Orçamento convertido em ${target}.`); window.setTimeout(() => setSavedMessage(""),2500);
  };
  const saveRecord = (data: ModalSave) => {
    if (data.title.startsWith("Nova unidade, filial ou setor")) {
      const parentCustomer = data.title.split("•")[1]?.trim() || data.client;
      const structure: ModuleRecord = { id:`SET-${Date.now().toString().slice(-6)}`, name:data.name, client:parentCustomer, description:data.doc || data.description, address:data.address, category:data.category || "Setor", status:"Ativo", createdAt:new Date().toLocaleString("pt-BR") };
      const updatedModules = { ...moduleRecords, "Unidades e setores":[structure,...(moduleRecords["Unidades e setores"] ?? [])] };
      const updatedCustomers = customerRecords.map(customer => customer.name === parentCustomer ? {...customer,units:customer.units+1} : customer);
      setModuleRecords(updatedModules); setCustomerRecords(updatedCustomers); persistSharedState(updatedCustomers,serviceOrders,updatedModules);
      setSavedMessage(`Unidade ou setor vinculado a ${parentCustomer}.`);
    } else if (data.title === "Novo cliente") {
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
      localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
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
        lastMaintenanceDate: data.date,
        reviewPeriodMonths: 6,
        notifyDaysBefore: 15,
      };
      const updatedOrders = [newOrder, ...serviceOrders];
      setServiceOrders(updatedOrders);
      localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(updatedOrders));
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
        description: moduleName === "Funcionários" && data.description.startsWith("AUTH:") ? "Acesso individual ao sistema configurado." : data.description,
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
        engineer: data.engineer,
        address: data.workAddress,
        blockLot: data.blockLot,
        endDate: data.endDate,
        progress: data.progress,
        commission: data.commission,
        cost: data.cost,
        transactionType: moduleName === "Financeiro" ? (/pagar|despesa|fornecedor/i.test(`${data.name} ${data.category}`) ? "Pagar" : "Receber") : undefined,
        employeeRole: moduleName === "Funcionários" ? data.employeeRole : undefined,
        employeePermissions: moduleName === "Funcionários" ? data.employeePermissions : undefined,
        employeeUsername: moduleName === "Funcionários" ? data.client : undefined,
        employeePasswordHash: moduleName === "Funcionários" && data.description.startsWith("AUTH:") ? data.description.slice(5) : undefined,
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
      localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedRecords));
      persistSharedState(customerRecords, serviceOrders, updatedRecords);
      setCurrent(moduleName);
      setSavedMessage(moduleName === "Compras" && data.paymentType === "A prazo" ? `Compra gravada e ${Math.max(1, data.paymentInstallments.length || data.installments)} parcela(s) lançada(s) em Contas a Pagar.` : "Registro gravado com sucesso.");
    }
    setModal("");
    window.setTimeout(() => setSavedMessage(""), 3500);
  };
  const titles: Record<string,string> = { "Painel inicial": "Olá", "Clientes": "Gestão de clientes", "Obras": "Gestão de obras" };
  const subtitles: Record<string,string> = { "Painel inicial": "Uma visão completa da sua empresa em tempo real.", "Clientes": "Cadastros, unidades, histórico e relacionamento.", "Obras": "Planejamento, execução, perdas, custos e progresso em um único módulo." };
  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthenticatedUser(null);
  };
  const deleteCustomer = (customer: Customer) => {
    if (!window.confirm(`Excluir o cliente “${customer.name}”? Esta ação também remove o cadastro da base compartilhada.`)) return;
    const updatedCustomers = customerRecords.filter(item => item.id !== customer.id);
    setCustomerRecords(updatedCustomers);
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
    setSavedMessage("Cliente excluído com sucesso.");
  };
  const deleteOrder = (order: ServiceOrder) => {
    if (!window.confirm(`Excluir definitivamente a ordem ${order.id}?`)) return;
    const updatedOrders = serviceOrders.filter(item => item.id !== order.id);
    setServiceOrders(updatedOrders);
    localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(updatedOrders));
    persistSharedState(customerRecords, updatedOrders, moduleRecords);
    setSelectedOrder(null);
    setSavedMessage(`Ordem ${order.id} excluída.`);
  };
  const deleteModuleRecord = (moduleName: string, record: ModuleRecord) => {
    if (!window.confirm(`Excluir o registro “${record.name}”?`)) return;
    const updatedModules = { ...moduleRecords, [moduleName]: (moduleRecords[moduleName] ?? []).filter(item => item.id !== record.id) };
    setModuleRecords(updatedModules);
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
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
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage(moduleName === "Compras" && record.status === "Recebida" ? "Compra recebida: estoque e conta a pagar atualizados." : "Registro atualizado e sincronizado.");
    window.setTimeout(() => setSavedMessage(""), 3000);
  };
  if (checkingSession) return <div className="session-loading"><div className="brand-mark brand-logo"><img src="/icon.png" alt="ProAR"/></div><p>A carregar o ProAR...</p></div>;
  if (!authenticatedUser) return <LoginScreen onLogin={setAuthenticatedUser}/>;
  return <div className="app-shell">
    <Sidebar current={current} setCurrent={setCurrent} open={menuOpen} close={() => setMenuOpen(false)} permissions={authenticatedUser.permissions}/>
    <main className="main">
      <Header title={current === "Painel inicial" ? `Olá, ${authenticatedUser.displayName.split(" ")[0]}` : titles[current] || current} subtitle={subtitles[current] || "Controle integrado da sua operação."} onMenu={() => setMenuOpen(true)} onNewOrder={() => setModal("Nova ordem de serviço")} userName={authenticatedUser.displayName} userRole={authenticatedUser.role ?? "Utilizador"} onLogout={logout}/>
      {savedMessage && <div className="save-toast" role="status"><CheckCircle2 size={16}/>{savedMessage}</div>}
      <div className="company-context"><Building2 size={13}/><span>{activeCompany.tradeName}</span><small>{activeCompany.cnpj || "CNPJ pendente"} • {activeCompany.city}/{activeCompany.state}</small></div>
      <div className="page-content">{current === "Painel inicial" ? <Dashboard onNavigate={setCurrent} serviceOrders={serviceOrders}/> : current === "Clientes" ? <Customers onOpen={setModal} onDelete={deleteCustomer} onUpdate={updateCustomer} onUpdateStructure={record => updateModuleRecord("Unidades e setores",record)} canEdit={hasAction("Clientes","Editar")} customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []}/> : current === "Agenda" ? <Agenda serviceOrders={serviceOrders} onOpen={setModal} onSelect={setSelectedOrder}/> : current === "Obras" ? <HousesWorkModule companyId={activeCompany.id}/> : current === "Vendas" ? <SalesPDV customers={customerRecords} records={[...(moduleRecords.Produtos ?? []),...(moduleRecords.Serviços ?? [])]}/> : current === "Relatórios" ? <Reports modules={moduleRecords} customers={customerRecords} serviceOrders={serviceOrders}/> : current === "Configurações" ? <SettingsModule companies={companies} activeCompany={activeCompany} onCompaniesChange={updateCompanies} onSelectCompany={selectCompany}/> : current === "Financeiro" ? <FinancialModule records={moduleRecords.Financeiro ?? []} onOpen={setModal} onUpdate={updateModuleRecord}/> : current === "Ordens de serviço" ? <ServiceOrders onOpen={setModal} onSelect={setSelectedOrder} onDelete={deleteOrder} serviceOrders={serviceOrders} customers={customerRecords}/> : <GenericModule name={current} onOpen={setModal} onDelete={deleteModuleRecord} onUpdate={updateModuleRecord} onConvert={convertBudget} companyCnpj={activeCompany.cnpj} canEdit={hasAction(current,"Editar")} records={moduleRecords[current] ?? []}/>}</div>
      <footer><span>© 2026 ProAR Gestão de Serviços</span><span><ShieldCheck size={12}/> Gestão segura e inteligente para prestadores de serviços.</span></footer>
    </main>
    {modal && <Modal title={modal} customers={customerRecords} catalogRecords={[...(moduleRecords["Serviços"] ?? []), ...(moduleRecords["Produtos"] ?? [])]} supplierRecords={moduleRecords["Fornecedores"] ?? []} employeeRecords={moduleRecords["Funcionários"] ?? [tiagoEmployee]} close={() => setModal("")} onSave={saveRecord}/>}
    {selectedOrder && <OrderDetail order={selectedOrder} customerPhone={customerRecords.find(customer => customer.name === selectedOrder.client)?.phone} company={activeCompany} close={() => setSelectedOrder(null)} onUpdate={updateServiceOrder}/>}
  </div>;
}


