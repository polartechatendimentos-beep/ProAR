"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Bell, Boxes, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined,
  CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList,
  Clock3, FileChartColumn, FileText, Filter, Grid2X2, HandCoins, Headphones,
  ArrowLeft, Camera, Contact, Edit3, Hospital, Landmark, LayoutDashboard, LogIn, LogOut, MapPin,
  Menu, MoreHorizontal, Package, Phone, Plus, School, Search, Settings,
  ShieldCheck, ShoppingBag, ShoppingCart, Store, TrendingUp, UserCheck, UserRound,
  PenTool,
  UsersRound, WalletCards, Warehouse, Wrench, X, Zap
} from "lucide-react";

type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type NavItem = { icon: IconType; name: string; badge?: string };

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "VISÃO GERAL", items: [
    { icon: LayoutDashboard, name: "Painel inicial" },
    { icon: CalendarDays, name: "Agenda" },
    { icon: Bell, name: "Notificações", badge: "3" },
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

const stats: { icon: IconType; value: string; label: string; note: string; tone: string; trend?: string }[] = [
  { icon: ClipboardList, value: "24", label: "OS em aberto", note: "6 programadas para hoje", tone: "blue", trend: "+8,4%" },
  { icon: Activity, value: "08", label: "Em andamento", note: "3 técnicos em campo", tone: "cyan", trend: "Agora" },
  { icon: CheckCircle2, value: "127", label: "Concluídas", note: "Neste mês", tone: "green", trend: "+12,0%" },
  { icon: AlertTriangle, value: "05", label: "Atrasadas", note: "Requerem atenção", tone: "red", trend: "−2" },
];

const orders = [
  { id: "#OS-0248", client: "Prefeitura de Mirassol", unit: "Secretaria de Educação", service: "Manutenção preventiva", tech: "Tiago Viana", time: "08:30", status: "Em andamento", tone: "blue", avatar: "PM" },
  { id: "#OS-0247", client: "Drogaria Santa Rita", unit: "Unidade Olímpia", service: "Higienização completa", tech: "João Carlos", time: "09:00", status: "Agendada", tone: "violet", avatar: "DS" },
  { id: "#OS-0246", client: "Construtora Impper", unit: "Obra Legacy • Casa 24", service: "Infraestrutura frigorígena", tech: "Caio Henrique", time: "10:30", status: "Aguardando material", tone: "orange", avatar: "CI" },
  { id: "#OS-0245", client: "Allma Jeep & RAM", unit: "Showroom principal", service: "Manutenção corretiva", tech: "Thiago Souza", time: "13:30", status: "Agendada", tone: "violet", avatar: "AJ" },
  { id: "#OS-0244", client: "Clínica Saúde Mais", unit: "Sala de exames", service: "Diagnóstico técnico", tech: "Lucas Mendes", time: "15:00", status: "Aberta", tone: "gray", avatar: "CS" },
];

const customers = [
  { name: "Prefeitura de Mirassol", doc: "46.612.032/0001-49", contact: "Marcos Oliveira", phone: "(17) 3243-0000", units: 8, status: "Ativo" },
  { name: "Drogaria Santa Rita", doc: "55.862.551/0010-47", contact: "Ana Paula", phone: "(17) 3322-1840", units: 4, status: "Ativo" },
  { name: "Construtora Impper", doc: "18.427.930/0001-20", contact: "Rafael Martins", phone: "(17) 99712-4300", units: 2, status: "Ativo" },
  { name: "Allma Jeep & RAM", doc: "32.117.448/0001-08", contact: "Ricardo Lima", phone: "(17) 3201-7700", units: 3, status: "Ativo" },
];

const linkedUnits: Record<string, { icon: IconType; name: string; type: string; doc: string; responsible: string; phone: string; address: string; orders: number }[]> = {
  "Prefeitura de Mirassol": [
    { icon: Landmark, name: "Paço Municipal", type: "Unidade administrativa", doc: "46.612.032/0001-49", responsible: "Marcos Oliveira", phone: "(17) 3243-8120", address: "Praça Dr. Anísio José Moreira, 22", orders: 12 },
    { icon: School, name: "Secretaria de Educação", type: "Secretaria municipal", doc: "46.612.032/0003-00", responsible: "Carla Mendes", phone: "(17) 3243-8144", address: "Rua São Pedro, 2150", orders: 8 },
    { icon: Hospital, name: "Secretaria de Saúde", type: "Secretaria municipal", doc: "46.612.032/0004-82", responsible: "Renata Alves", phone: "(17) 3243-8162", address: "Rua Capitão Neves, 1950", orders: 5 },
  ],
  "Drogaria Santa Rita": [
    { icon: Store, name: "Unidade Olímpia", type: "Filial", doc: "55.862.551/0010-47", responsible: "Ana Paula", phone: "(17) 3322-1840", address: "Av. 17, 727 • Centro", orders: 9 },
    { icon: Store, name: "Unidade São José do Rio Preto", type: "Filial", doc: "55.862.551/0006-60", responsible: "Paulo Henrique", phone: "(17) 3212-4410", address: "Av. Bady Bassitt, 3150", orders: 6 },
  ],
};

const linkedSectors: Record<string, { icon: IconType; name: string; type: string; doc: string; responsible: string; phone: string; address: string; orders: number }[]> = {
  "Prefeitura de Mirassol": [
    { icon: School, name: "Secretaria de Educação", type: "Setor vinculado", doc: "46.612.032/0003-00", responsible: "Carla Mendes", phone: "(17) 3243-8144", address: "Rua São Pedro, 2150", orders: 8 },
    { icon: Hospital, name: "Secretaria de Saúde", type: "Setor vinculado", doc: "46.612.032/0004-82", responsible: "Renata Alves", phone: "(17) 3243-8162", address: "Rua Capitão Neves, 1950", orders: 5 },
  ],
  "Drogaria Santa Rita": [
    { icon: Store, name: "Filial Olímpia", type: "Filial vinculada", doc: "55.862.551/0010-47", responsible: "Ana Paula", phone: "(17) 3322-1840", address: "Av. 17, 727 • Centro", orders: 9 },
    { icon: Store, name: "Filial São José do Rio Preto", type: "Filial vinculada", doc: "55.862.551/0006-60", responsible: "Paulo Henrique", phone: "(17) 3212-4410", address: "Av. Bady Bassitt, 3150", orders: 6 },
  ],
};

function Header({ title, subtitle, onMenu, onNewOrder }: { title: string; subtitle: string; onMenu: () => void; onNewOrder: () => void }) {
  return <header className="topbar">
    <div className="headline">
      <button className="menu-toggle" aria-label="Abrir menu" onClick={onMenu}><Menu size={20}/></button>
      <div><div className="eyebrow"><span /> Central de operações</div><h1>{title}</h1><p>{subtitle}</p></div>
    </div>
    <div className="top-actions">
      <label className="global-search"><Search size={16}/><input aria-label="Pesquisa global" placeholder="Pesquisar no ProAR..." /><kbd>⌘ K</kbd></label>
      <button className="icon-btn" aria-label="Notificações"><Bell size={18}/><span className="dot">3</span></button>
      <button className="primary-btn" onClick={onNewOrder}><Plus size={17}/> Nova ordem</button>
      <div className="profile"><div className="profile-avatar">TV<span /></div><div><strong>Tiago Viana</strong><small>Administrador</small></div><ChevronDown size={14}/></div>
    </div>
  </header>;
}

function Sidebar({ current, setCurrent, open, close }: { current: string; setCurrent: (s: string) => void; open: boolean; close: () => void }) {
  return <>
    {open && <button className="backdrop" aria-label="Fechar menu" onClick={close} />}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark">P<span>✦</span></div><div><strong>Pro<span>AR</span></strong><small>GESTÃO DE SERVIÇOS</small></div></div>
      <nav>{navGroups.map(group => <div className="nav-group" key={group.label}>
        <p>{group.label}</p>
        {group.items.map(({icon: Icon, name, badge}) => <button key={name} className={current === name ? "active" : ""} onClick={() => { setCurrent(name); close(); }}>
          <span className="nav-icon"><Icon size={17} strokeWidth={1.9}/></span><span>{name}</span>{badge && <em>{badge}</em>}
        </button>)}
      </div>)}</nav>
      <div className="help-card"><div><Headphones size={17}/></div><strong>Suporte ProAR</strong><p>Conte com a nossa equipe sempre que precisar.</p><button>Falar com especialista <ArrowRight size={12}/></button></div>
      <div className="secure"><ShieldCheck size={13}/><span>Ambiente seguro</span><b>v2.0</b></div>
    </aside>
  </>;
}

function Dashboard({ onNavigate }: { onNavigate: (s: string) => void }) {
  const [period, setPeriod] = useState("Este mês");
  return <>
    <section className="command-row">
      <div className="periods">{["Hoje", "Semana", "Este mês", "Ano"].map(p => <button className={period === p ? "active" : ""} onClick={() => setPeriod(p)} key={p}>{p}</button>)}</div>
      <div className="live-status"><i/><span>Dados atualizados agora</span></div>
      <button className="filter-btn"><Filter size={14}/> Mais filtros <ChevronDown size={13}/></button>
    </section>
    <section className="stat-grid">{stats.map(({icon: Icon, ...s}) => <article className={`stat-card ${s.tone}`} key={s.label}>
      <div className="stat-top"><div className={`stat-icon ${s.tone}`}><Icon size={21} strokeWidth={1.8}/></div><span className={`trend ${s.tone}`}>{s.trend}</span></div>
      <div className="stat-value"><strong>{s.value}</strong><span>{s.label}</span></div><small>{s.note}</small>
      <button aria-label={`Detalhes de ${s.label}`}><ChevronRight size={15}/></button>
    </article>)}</section>
    <section className="content-grid">
      <div className="panel orders-panel">
        <div className="panel-head"><div><span className="section-kicker"><Zap size={12}/> OPERAÇÃO DE HOJE</span><h2>Ordens de serviço</h2><p>Quarta-feira, 29 de julho</p></div><button onClick={() => onNavigate("Ordens de serviço")}>Ver agenda completa <ArrowRight size={13}/></button></div>
        <div className="table-wrap"><table><thead><tr><th>ORDEM</th><th>CLIENTE / UNIDADE</th><th>SERVIÇO</th><th>TÉCNICO</th><th>HORÁRIO</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>
          {orders.map(o => <tr key={o.id}><td><b className="order-id">{o.id}</b></td><td><div className="client-cell"><span>{o.avatar}</span><div><strong>{o.client}</strong><small>{o.unit}</small></div></div></td><td>{o.service}</td><td><div className="tech"><span>{o.tech.split(" ").map(x => x[0]).slice(0,2).join("")}</span>{o.tech}</div></td><td><div className="time"><Clock3 size={12}/><b>{o.time}</b></div></td><td><span className={`status ${o.tone}`}><i/> {o.status}</span></td><td><button className="more" aria-label={`Opções da ${o.id}`}><MoreHorizontal size={16}/></button></td></tr>)}
        </tbody></table></div>
      </div>
      <aside className="side-stack">
        <div className="panel financial">
          <div className="panel-head"><div><span className="section-kicker"><ChartNoAxesCombined size={12}/> PERFORMANCE</span><h2>Resumo financeiro</h2><p>Julho de 2026</p></div><button aria-label="Mais opções"><MoreHorizontal size={17}/></button></div>
          <div className="finance-total"><small>RESULTADO PREVISTO</small><strong>R$ 27.430,00</strong><span><TrendingUp size={12}/> 18,4%</span></div>
          <div className="finance-split"><div><span className="money-icon green"><ArrowUpRight size={17}/></span><small>A receber</small><strong>R$ 48.750</strong></div><div><span className="money-icon red"><ArrowDownRight size={17}/></span><small>A pagar</small><strong>R$ 21.320</strong></div></div>
          <div className="mini-chart"><i style={{height:"35%"}}/><i style={{height:"46%"}}/><i style={{height:"38%"}}/><i style={{height:"63%"}}/><i style={{height:"51%"}}/><i style={{height:"78%"}}/><i className="current" style={{height:"88%"}}/></div><div className="chart-labels"><span>Jan</span><span>Fev</span><span>Mar</span><span>Abr</span><span>Mai</span><span>Jun</span><span>Jul</span></div>
        </div>
        <div className="panel alerts">
          <div className="panel-head"><div><span className="section-kicker"><AlertTriangle size={12}/> ATENÇÃO</span><h2>Alertas importantes</h2><p>Itens que precisam de ação</p></div><span>4</span></div>
          <button><i className="alert-icon orange"><Package size={15}/></i><div><strong>5 produtos com estoque baixo</strong><small>Verificar e repor o estoque</small></div><ChevronRight size={15}/></button>
          <button><i className="alert-icon red"><CircleDollarSign size={15}/></i><div><strong>3 contas vencidas</strong><small>Total de R$ 4.280,00</small></div><ChevronRight size={15}/></button>
          <button><i className="alert-icon violet"><FileText size={15}/></i><div><strong>2 orçamentos vencendo</strong><small>Vencem nos próximos 3 dias</small></div><ChevronRight size={15}/></button>
        </div>
      </aside>
    </section>
  </>;
}

function CustomerDetail({ customerName, onBack, onOpen }: { customerName: string; onBack: () => void; onOpen: (name: string) => void }) {
  const customer = customers.find(c => c.name === customerName) ?? customers[0];
  const units = linkedUnits[customerName] ?? [
    { icon: Building2, name: "Matriz", type: "Unidade principal", doc: customer.doc, responsible: customer.contact, phone: customer.phone, address: "Endereço principal do cliente", orders: customer.units },
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
      <div className="detail-identity"><span>{customer.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><div><small>CLIENTE • PESSOA JURÍDICA</small><h2>{customer.name}</h2><p>{customer.doc} • Responsável: {customer.contact}</p></div></div>
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

function Customers({ onOpen }: { onOpen: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const filtered = useMemo(() => customers.filter(c => `${c.name} ${c.doc} ${c.contact}`.toLowerCase().includes(query.toLowerCase())), [query]);
  if (selectedCustomer) return <CustomerDetail customerName={selectedCustomer} onBack={() => setSelectedCustomer("")} onOpen={onOpen}/>;
  return <section className="module-page">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar cliente, CPF ou CNPJ..." /></label><button className="outline-btn"><Filter size={14}/> Filtros</button><button className="primary-btn" onClick={() => onOpen("Novo cliente")}><Plus size={16}/> Novo cliente</button></div>
    <div className="module-summary">
      <article><span><UsersRound size={19}/></span><div><small>CLIENTES ATIVOS</small><strong>248</strong><em>+12 este mês</em></div></article>
      <article><span><Building2 size={19}/></span><div><small>UNIDADES CADASTRADAS</small><strong>92</strong><em>Em 38 clientes</em></div></article>
      <article><span><HandCoins size={19}/></span><div><small>FATURAMENTO NO MÊS</small><strong>R$ 86,4 mil</strong><em>+9,2% no período</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><UsersRound size={12}/> CARTEIRA</span><h2>Clientes cadastrados</h2><p>{filtered.length} registros encontrados • Abra um cliente para acessar seus setores</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>CPF / CNPJ</th><th>RESPONSÁVEL</th><th>TELEFONE</th><th>UNIDADES / SETORES</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>{filtered.map(c => <tr key={c.doc} onDoubleClick={() => setSelectedCustomer(c.name)}><td><div className="client-cell"><span>{c.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><strong>{c.name}</strong></div></td><td>{c.doc}</td><td>{c.contact}</td><td>{c.phone}</td><td><button className="unit-count" onClick={() => setSelectedCustomer(c.name)}><Building2 size={13}/>{c.units} vinculados</button></td><td><span className="status green"><i/> {c.status}</span></td><td><button className="open-client" onClick={() => setSelectedCustomer(c.name)}>Abrir cliente <ChevronRight size={14}/></button></td></tr>)}</tbody></table></div></div>
  </section>;
}

function ServiceOrders({ onOpen }: { onOpen: (name: string) => void }) {
  return <section className="module-page service-orders">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input placeholder="Pesquisar ordem, cliente ou técnico..."/></label><button className="outline-btn"><Filter size={14}/> Filtros</button><button className="primary-btn" onClick={() => onOpen("Nova ordem de serviço")}><Plus size={16}/> Nova ordem de serviço</button></div>
    <div className="module-summary">
      <article><span><ClipboardList size={19}/></span><div><small>ORDENS ABERTAS</small><strong>24</strong><em>6 para hoje</em></div></article>
      <article><span><UserCheck size={19}/></span><div><small>TÉCNICOS EMPENHADOS</small><strong>8</strong><em>3 em atendimento</em></div></article>
      <article><span><CheckCircle2 size={19}/></span><div><small>FINALIZADAS NO MÊS</small><strong>127</strong><em>Com relatório e assinatura</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><Wrench size={12}/> OPERAÇÃO TÉCNICA</span><h2>Ordens de serviço</h2><p>Acompanhe técnico, check-in, check-out, fotos e assinatura.</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>ORDEM</th><th>CLIENTE / LOCAL</th><th>TÉCNICO EMPENHADO</th><th>CHECK-IN</th><th>CHECK-OUT</th><th>EVIDÊNCIAS</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>{orders.map(order => <tr key={`manage-${order.id}`}><td><b className="order-id">{order.id}</b></td><td><div className="client-cell"><span>{order.avatar}</span><div><strong>{order.client}</strong><small>{order.unit}</small></div></div></td><td><div className="tech"><span>{order.tech.split(" ").map(name => name[0]).slice(0,2).join("")}</span>{order.tech}</div></td><td><span className={`check-state ${order.status === "Em andamento" ? "done" : ""}`}><LogIn size={12}/>{order.status === "Em andamento" ? "08:27" : "Pendente"}</span></td><td><span className="check-state"><LogOut size={12}/>Pendente</span></td><td><span className="evidence-count"><Camera size={12}/> 0/2 fotos</span></td><td><span className={`status ${order.tone}`}><i/> {order.status}</span></td><td><button className="open-client">Abrir ordem <ChevronRight size={13}/></button></td></tr>)}</tbody></table></div></div>
  </section>;
}

function GenericModule({ name }: { name: string }) {
  const descriptions: Record<string,string> = {
    "Equipamentos": "Acompanhe o parque de equipamentos, histórico técnico, garantias e próximas manutenções.",
    "Ordens de serviço": "Planeje atendimentos, distribua equipes e acompanhe cada serviço até a assinatura.",
    "Estoque": "Controle entradas, saídas, reservas, inventários, perdas e alertas de reposição.",
    "Financeiro": "Acompanhe contas a pagar e receber, fluxo de caixa, conciliação e centros de custo.",
  };
  return <section className="module-page"><div className="welcome-panel"><div className="welcome-icon"><Grid2X2 size={32}/></div><div><span>MÓDULO PROAR</span><h2>{name}</h2><p>{descriptions[name] || `Consulte, cadastre e acompanhe todas as informações de ${name.toLowerCase()} em um só lugar.`}</p><button className="primary-btn"><Plus size={16}/> Novo registro</button></div></div>
    <div className="empty-grid">{[{t:"Visão geral",i:LayoutDashboard},{t:"Registros recentes",i:Clock3},{t:"Indicadores",i:TrendingUp}].map(({t,i:Icon})=><article className="panel" key={t}><span><Icon size={19}/></span><h3>{t}</h3><p>Este módulo está pronto para receber os dados reais da sua operação.</p><button>Explorar <ArrowRight size={12}/></button></article>)}</div></section>;
}

function Modal({ title, close }: { title: string; close: () => void }) {
  const isLinkedStructure = title.startsWith("Nova unidade, filial ou setor");
  const isNewOrder = title === "Nova ordem de serviço";
  const [selectedClient, setSelectedClient] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [signed, setSigned] = useState(false);
  const parentCustomer = isLinkedStructure ? title.split("•")[1]?.trim() : "";
  const selectedClientData = customers.find(customer => customer.name === selectedClient);
  const availableUnits = selectedClient ? [
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
        <label>Unidade, filial ou setor<select disabled={!selectedClient}><option value="">{selectedClient ? "Selecione o local do atendimento" : "Selecione primeiro o cliente"}</option>{availableUnits.map(unit => <option key={unit.name} value={unit.name}>{unit.name} • {unit.type}</option>)}</select></label>
        <label>Responsável do cliente<input value={selectedClientData?.contact ?? ""} readOnly placeholder="Carregado pelo cadastro"/></label>
        <label>Telefone<input value={selectedClientData?.phone ?? ""} readOnly placeholder="Carregado pelo cadastro"/></label>
        <label>Data do atendimento<input type="date"/></label>
        <label>Horário<input type="time"/></label>
        <label>Técnico empenhado<select><option value="">Selecione o técnico</option><option>Tiago Viana</option><option>João Carlos</option><option>Caio Henrique</option><option>Thiago Souza</option><option>Lucas Mendes</option></select></label>
        <label>Prioridade<select><option>Normal</option><option>Alta</option><option>Urgente</option></select></label>
        <label className="wide">Descrição / solicitação<textarea placeholder="Descreva o atendimento, problema informado ou observações..."/></label>
        <div className="wide order-execution">
          <div className="execution-head"><div><span>EXECUÇÃO DO ATENDIMENTO</span><h3>Controle do técnico em campo</h3></div><small>Horário registrado automaticamente</small></div>
          <div className="check-actions"><button type="button" className={checkedIn ? "done" : ""} onClick={() => setCheckedIn(true)}><LogIn size={17}/><span><b>{checkedIn ? "Check-in realizado" : "Dar check-in"}</b><small>{checkedIn ? "Técnico no local • 08:27" : "Registrar chegada ao cliente"}</small></span></button><button type="button" disabled={!checkedIn} className={checkedOut ? "done" : ""} onClick={() => setCheckedOut(true)}><LogOut size={17}/><span><b>{checkedOut ? "Check-out realizado" : "Dar check-out"}</b><small>{checkedOut ? "Atendimento finalizado • 10:42" : "Registrar saída do cliente"}</small></span></button></div>
          <div className="evidence-grid"><label className="upload-box"><Camera size={22}/><b>Foto antes do serviço</b><small>JPG, PNG ou foto da câmera</small><input type="file" accept="image/*" capture="environment"/></label><label className="upload-box"><Camera size={22}/><b>Foto depois do serviço</b><small>JPG, PNG ou foto da câmera</small><input type="file" accept="image/*" capture="environment"/></label></div>
          <div className={`signature-box ${signed ? "signed" : ""}`}><div><PenTool size={22}/><span><b>{signed ? "Assinatura registrada" : "Assinatura digital do cliente"}</b><small>{signed ? "Responsável confirmou o atendimento" : "O cliente assina diretamente na tela"}</small></span></div><button type="button" onClick={() => setSigned(!signed)}>{signed ? "Limpar assinatura" : "Coletar assinatura"}</button></div>
        </div>
      </> : <>
        <label>Cliente / Razão social<input placeholder="Digite o nome do cliente"/></label><label>CPF ou CNPJ<input placeholder="00.000.000/0000-00"/></label><label>Unidade ou setor<select><option>Selecione uma unidade</option><option>Matriz</option><option>Secretaria de Educação</option></select></label><label>Responsável<input placeholder="Nome do responsável"/></label><label>Telefone / WhatsApp<input placeholder="(00) 00000-0000"/></label><label>Data do atendimento<input type="date"/></label><label className="wide">Descrição / solicitação<textarea placeholder="Descreva o atendimento, problema informado ou observações..."/></label>
      </>}
    </>}
  </div><div className="modal-actions"><button className="outline-btn" onClick={close}>Cancelar</button><button className="primary-btn" onClick={close}><CheckCircle2 size={15}/> Salvar registro</button></div></div></div>;
}

export default function Home() {
  const [current, setCurrent] = useState("Painel inicial");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState("");
  const titles: Record<string,string> = { "Painel inicial": "Bom dia, Tiago", "Clientes": "Gestão de clientes" };
  const subtitles: Record<string,string> = { "Painel inicial": "Uma visão completa da sua empresa em tempo real.", "Clientes": "Cadastros, unidades, histórico e relacionamento." };
  return <div className="app-shell">
    <Sidebar current={current} setCurrent={setCurrent} open={menuOpen} close={() => setMenuOpen(false)}/>
    <main className="main">
      <Header title={titles[current] || current} subtitle={subtitles[current] || "Controle integrado da sua operação."} onMenu={() => setMenuOpen(true)} onNewOrder={() => setModal("Nova ordem de serviço")}/>
      <div className="page-content">{current === "Painel inicial" ? <Dashboard onNavigate={setCurrent}/> : current === "Clientes" ? <Customers onOpen={setModal}/> : current === "Ordens de serviço" ? <ServiceOrders onOpen={setModal}/> : <GenericModule name={current}/>}</div>
      <footer><span>© 2026 ProAR Gestão de Serviços</span><span><ShieldCheck size={12}/> Gestão segura e inteligente para prestadores de serviços.</span></footer>
    </main>
    {modal && <Modal title={modal} close={() => setModal("")}/>}
  </div>;
}
