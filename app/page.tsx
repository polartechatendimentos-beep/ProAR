"use client";

import "./settings.css";
import "./multiempresa.css";
import "./obra-142.css";
import "./workflow-fixes.css";
import "./access-offline.css";
import "./public-work-share.css";
import "./budget-pdv.css";
import "./licitacoes-restored.css";
import "./commercial-catalog-enhancements.css";
import "./entity-detail-tabs.css";
import "./proar-3-theme.css";
import "./lote-1-operacao.css";
import "./pdv-layout-refinement.css";
import "./header-visibility.css";
import "./service-order-tracking.css";
import "./public-contracts.css";
import "./login-minimal.css";
import "./operational-refresh.css";

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
  UsersRound, WalletCards, Warehouse, Wrench, X, Zap, House, History, ImageIcon, RefreshCw, Sparkles
} from "lucide-react";
import { PublicContractsPanel, type PublicContractRecord } from "@/components/PublicContractsPanel";
import { PublicCommitmentsPanel, type PublicCommitmentRecord } from "@/components/PublicCommitmentsPanel";
import { TechnicalCompliancePanel } from "@/components/TechnicalCompliancePanel";
import { calculateCertameItemBalance, createCertameMovement, financialOutstandingValue, financialRealizedValue } from "@/lib/public-contracts";
import { improveTechnicalText } from "@/lib/text-assist";
import { WORK_STATUSES, getWorkProgress, getWorkStatusColor, normalizeWorkStatus, type WorkStatus } from "@/lib/work-status";

type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type NavItem = { icon: IconType; name: string; badge?: string };
type GlobalSearchItem = { id: string; title: string; detail: string; module: string; kind: "Cliente" | "OS" | "Cadastro" };
type PendingItem = { id: string; title: string; detail: string; module: string; tone: "blue" | "amber" | "red" };

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
    { icon: ShieldCheck, name: "PMOC e conformidade" },
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
  nfseStatus?: "Não emitida" | "Processando" | "Emitida" | "Erro" | "Cancelada";
  nfseNumber?: string;
  nfseVerificationCode?: string;
  nfseIssuedAt?: string;
  nfseValue?: number;
  trackingToken?: string;
  whatsappPhone?: string;
  whatsappUpdatesEnabled?: boolean;
  whatsappAppointmentReminderEnabled?: boolean;
  whatsappStatusUpdatesEnabled?: boolean;
  appointmentReminderHours?: number;
  timeline?: ServiceOrderTimelineEvent[];
  assistance?: AssistanceEntry;
  pmoc?: PmocRecord;
  pmocExecutions?: PmocExecution[];
  certameId?: string;
  contractItems?: {
    certameItemId: string;
    description: string;
    quantity: number;
    unitValue: number;
    reservationMovementId?: string;
    executionMovementId?: string;
    releaseMovementId?: string;
  }[];
};

type ServiceOrderTimelineEvent = {
  id: string;
  createdAt: string;
  previousStatus?: string;
  status: string;
  technician?: string;
  internalNote?: string;
  customerNote?: string;
  photos?: string[];
  customerVisible?: boolean;
  whatsappQueued?: boolean;
};

type AssistanceEntry = {
  requestedAt?: string;
  arrivalAt?: string;
  equipment?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  pickupLocation?: string;
  pickupReason?: string;
  authorizedBy?: string;
  accessories?: string;
  reportedDefect?: string;
  receivedBy?: string;
  condition?: "Excelente" | "Bom" | "Regular" | "Com avarias" | "Danificado";
  inspection?: Record<string, boolean>;
  inspectionNotes?: string;
  missingParts?: string;
  entryPhotos?: string[];
  exitPhotos?: string[];
};

type PmocRecord = {
  applicability?: "Obrigatório" | "Não obrigatório" | "Verificar aplicabilidade";
  hasPmoc?: boolean;
  identifier?: string;
  implementationDate?: string;
  reviewDate?: string;
  technicalResponsible?: string;
  professionalCouncil?: string;
  professionalRegistration?: string;
  responsibilityDocument?: string;
  plan?: { activity: string; periodicity: string }[];
};

type PmocExecution = {
  id: string;
  createdAt: string;
  equipment: string;
  location?: string;
  capacityBtu?: number;
  beforeCondition?: string;
  services: string[];
  products?: { product: string; manufacturer?: string; purpose?: string; lot?: string; quantity?: string; sanitaryRecord?: string }[];
  pending?: { type: string; description: string; urgency: string }[];
  technicalNote?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  technician?: string;
  responsibleTechnical?: string;
  signature?: string;
  nextMaintenanceDate?: string;
};

type Customer = {
  id: string; name: string; doc: string; contact: string; phone: string;
  address: string; units: number; status: string;
  personType?: "PF" | "PJ";
  organizationType?: "Empresa" | "Pessoa Física" | "Prefeitura" | "Órgão Público" | "Autarquia" | "Fundação" | "Entidade Pública" | "Outro";
  legalName?: string;
  tradeName?: string;
  email?: string;
  zipCode?: string;
  street?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  cnaeMain?: string;
  taxStatus?: string;
  creditLimit?: number;
  balancePosted?: number;
  financialStatus?: "Liberado" | "Alerta" | "Somente à vista" | "Bloqueado";
};

type HouseWorkStatus = WorkStatus;
type LegacyHouseWorkStatus = "AG FRIGORÍGENA" | "AG VENTO KIT" | "VENTOKIT E FRIGORÍGENA OK" | "AG ACABAMENTO" | "AG EXAUSTOR" | "AG TAMPA FRIGORÍGENA" | "FIM" | "ag_exaustor" | "ag_exautor";
type HouseStagePhoto = { label: string; url: string };
type HouseWorkUpdate = { id: string; status: HouseWorkStatus | LegacyHouseWorkStatus; previousStatus?: string; note: string; responsible?: string; photo?: string; photos?: string[] | HouseStagePhoto[]; createdAt: string; completedAt?: string; origin?: string };
type HouseIncident = { id: string; type: "Perda" | "Roubo"; note: string; photo: string; responsible: string; createdAt: string };
type HouseWorkItem = { id: string; block: string; lot: number; kind?: "house" | "common"; name?: string; status: HouseWorkStatus | LegacyHouseWorkStatus; photo?: string; photos?: string[] | HouseStagePhoto[]; note?: string; updatedAt?: string; history: HouseWorkUpdate[]; incidents?: HouseIncident[] };
type WorkBlock = { block: string; houses: number };
type WorkProject = { id: string; name: string; blocks: WorkBlock[]; commonAreas: string[]; createdAt: string };

const HOUSE_BLOCKS = [
  { block: "A", houses: 5 }, { block: "B", houses: 24 }, { block: "C1", houses: 16 },
  { block: "C2", houses: 16 }, { block: "D", houses: 6 }, { block: "E", houses: 5 },
  { block: "F", houses: 27 }, { block: "G", houses: 12 }, { block: "H1", houses: 10 },
  { block: "H2", houses: 10 }, { block: "I", houses: 12 },
] as const;
const RESERVA_IMPERIAL: WorkProject = { id: "reserva-imperial", name: "Reserva Imperial", blocks: HOUSE_BLOCKS.map(item => ({...item})), commonAreas: ["Academia", "Salão de Festas", "Área Gourmet", "Administrativo"], createdAt: "2026-08-11T00:00:00.000Z" };
const HOUSE_STATUSES: { name: HouseWorkStatus; color: string }[] = WORK_STATUSES.map(name => ({ name, color: getWorkStatusColor(name) }));
const HOUSE_STAGE_PHOTOS: Record<HouseWorkStatus, string[]> = {
  "INÍCIO DE OBRA": [],
  "AG. FRIGORÍGENA": ["Sala", "Quarto Frente", "Quarto Meio", "Quarto Fundo", "Home"],
  "AG. ACABAMENTO": ["Sala", "Quarto Frente", "Quarto Meio", "Quarto Fundo", "Home", "VTK Fundo"],
  "AG. TUBULAÇÃO FORÇADA": ["Tubulação Forçada"],
  "AG. ACABAMENTO EXAUSTÃO": ["Acabamento Exaustão"],
  "AG. EXAUSTOR": ["VTK Exaustor", "Acabamento Externo"],
  "AG. TAMPA FRIGORÍGENA": ["Sala", "Quarto Frente", "Quarto Meio", "Quarto Fundo", "Home"],
  "SERVIÇO CONCLUÍDO": [],
};
// Evidências fotográficas são sempre opcionais. A ausência de foto jamais bloqueia
// uma atualização de etapa; quando presente, ela continua vinculada ao histórico.
const HOUSE_STAGE_OPTIONAL_PHOTOS: HouseWorkStatus[] = ["INÍCIO DE OBRA", "AG. FRIGORÍGENA", "AG. ACABAMENTO", "AG. TUBULAÇÃO FORÇADA", "AG. ACABAMENTO EXAUSTÃO", "AG. EXAUSTOR", "AG. TAMPA FRIGORÍGENA", "SERVIÇO CONCLUÍDO"];
const normalizeHouseStatus = (status: HouseWorkStatus | LegacyHouseWorkStatus | string) => normalizeWorkStatus(status);
const normalizeStagePhotos = (photos: HouseWorkUpdate["photos"], photo: string | undefined, status: HouseWorkStatus | LegacyHouseWorkStatus): HouseStagePhoto[] => {
  const values = photos?.length ? photos : photo ? [photo] : [];
  const normalized = normalizeHouseStatus(status);
  const labels = normalized === "STATUS NÃO IDENTIFICADO" ? [] : HOUSE_STAGE_PHOTOS[normalized];
  return values.map((item, index) => typeof item === "string" ? { label: labels[index] || `Foto ${index + 1}`, url: item } : item);
};

type TenantCompany = {
  id: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  city: string;
  state: string;
  phone: string;
  whatsapp?: string;
  email: string;
  address: string;
  zipCode?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  companyType?: string;
  taxRegime?: string;
  logo?: string;
  status: "Ativa" | "Bloqueada";
  createdAt: string;
};

const DEFAULT_COMPANY: TenantCompany = {
  id: "polartech-principal",
  legalName: "PolarTech Mirassol Ar Condicionado",
  tradeName: "PolarTech",
  cnpj: "45.823.828/0001-88",
  city: "Mirassol",
  state: "SP",
  phone: "+55 17 2122-2806",
  email: "",
  address: "",
  status: "Ativa",
  createdAt: new Date().toISOString(),
};

const companyStorageKey = (companyId: string, resource: string) => `proar-v4:${companyId}:${resource}`;
const legacyStorageKeys: Record<string, string> = {
  "service-orders": "proar-v3-service-orders",
  customers: "proar-v3-customers",
  "module-records": "proar-v3-module-records",
};

function readCompanyStorage(companyId: string, resource: string, fallback: unknown) {
  const current = localStorage.getItem(companyStorageKey(companyId, resource));
  // Dados legados globais só podem ser usados na empresa principal. Em tenants, nunca cruzar caches.
  const allowLegacy = companyId === DEFAULT_COMPANY.id || companyId === "main";
  const legacy = allowLegacy && legacyStorageKeys[resource] ? localStorage.getItem(legacyStorageKeys[resource]) : null;
  try { return JSON.parse(current ?? legacy ?? JSON.stringify(fallback)); }
  catch { return fallback; }
}
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
  unit?: string;
  phone?: string;
  contact?: string;
  doc?: string;
  engineer?: string;
  address?: string;
  blockLot?: string;
  endDate?: string;
  progress?: number;
  commission?: number;
  cost?: number;
  unitOfMeasure?: string;
  transactionType?: "Pagar" | "Receber";
  settledValue?: number;
  settlementDate?: string;
  settlementMethod?: string;
  settlementAccount?: string;
  interestValue?: number;
  discountValue?: number;
  settlementHistory?: { id: string; value: number; interest: number; discount: number; method: string; account: string; createdAt: string }[];
  empenhoId?: string;
  invoiceNumber?: string;
  invoiceIssuedAt?: string;
  employeeRole?: string;
  employeePermissions?: Record<string, ("Visualizar" | "Criar" | "Editar" | "Excluir")[]>;
  employeeUsername?: string;
  employeePasswordHash?: string;
  sku?: string;
  barcode?: string;
  brand?: string;
  model?: string;
  supplier?: string;
  stockCurrent?: number;
  stockMin?: number;
  stockMax?: number;
  stockLocation?: string;
  warrantyMonths?: number;
  estimatedMinutes?: number;
  lastPurchaseDate?: string;
  lastPurchaseValue?: number;
  lastPurchaseSupplier?: string;
  legalName?: string;
  tradeName?: string;
  email?: string;
  zipCode?: string;
  street?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  cnaeMain?: string;
  taxStatus?: string;
  equipmentType?: string;
  capacityBtus?: number;
  serialNumber?: string;
  voltage?: string;
  refrigerant?: string;
  installationLocation?: string;
  installationDate?: string;
  nextMaintenanceDate?: string;
  equipmentUnit?: string;
  frequency?: string;
  current?: string;
  power?: string;
  refrigerantCharge?: string;
  manufactureDate?: string;
  manufacturerCode?: string;
  equipmentLabelImage?: string;
  equipmentLabelImageName?: string;
  equipmentLabelHistory?: string[];
  parentUnit?: string;
  certameCustomerId?: string;
  administrativeProcess?: string;
  modality?: string;
  biddingNumber?: string;
  auctionNumber?: string;
  minutesNumber?: string;
  contractNumber?: string;
  contractObject?: string;
  certameItems?: PublicContractRecord["certameItems"];
  certameId?: string;
  empenhoNumber?: string;
  empenhoFicha?: string;
  empenhoProcess?: string;
  empenhoPurchaseOrder?: string;
  empenhoAuthorization?: string;
  empenhoAllocations?: PublicCommitmentRecord["empenhoAllocations"];
};

// Fonte única para os seletores Cliente → Unidade/Filial/Setor. Ela lê os
// registros existentes do módulo de estruturas, sem criar cópias paralelas.
const normalizeRelation = (value?: string) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
function customerStructures(customerName: string, customers: Customer[], structures: ModuleRecord[], includeInactive = false) {
  const customer = customers.find(item => item.name === customerName);
  const keys = [customerName, customer?.name, customer?.legalName, customer?.tradeName].map(normalizeRelation).filter(Boolean);
  return structures
    .filter(item => keys.includes(normalizeRelation(item.client)))
    .filter(item => includeInactive || !/^inativ/i.test(item.status ?? ""))
    .sort((a, b) => {
      const aMain = /matriz|unidade principal|sede/i.test(`${a.name} ${a.category ?? ""}`) ? 0 : 1;
      const bMain = /matriz|unidade principal|sede/i.test(`${b.name} ${b.category ?? ""}`) ? 0 : 1;
      return aMain - bMain || a.name.localeCompare(b.name, "pt-BR");
    });
}

function customerLocations(customerName: string, customers: Customer[], structures: ModuleRecord[], unitName = "") {
  const all = customerStructures(customerName, customers, structures);
  const isSector = (item: ModuleRecord) => /setor|departamento|local de atendimento/i.test(item.category ?? "");
  const units = all.filter(item => !isSector(item));
  const sectors = unitName ? all.filter(item => isSector(item) && normalizeRelation(item.parentUnit) === normalizeRelation(unitName)) : [];
  const unlinkedSectors = all.filter(item => isSector(item) && !item.parentUnit);
  return { units, sectors, unlinkedSectors };
}

function mergeImportedServices(modules: Record<string, ModuleRecord[]>) {
  // O catálogo comercial padrão não fica mais embutido no bundle público.
  // Serviços já persistidos no banco continuam intactos; os padrões são carregados após autenticação.
  return modules;
}

type PurchaseItem = {
  id: string;
  description: string;
  quantity: number;
  unitValue: number;
  productId?: string;
  registerProduct?: boolean;
  kind?: "Produto" | "Serviço" | "Custo adicional";
};

type PurchaseInstallment = { number: string; dueDate: string; value: number };

const orders: ServiceOrder[] = [];
const customers: Customer[] = [];
const tiagoEmployee: ModuleRecord = { id: "FUN-000001", name: "Tiago Viana", client: "tiago.viana", description: "Funcionário e técnico responsável", createdAt: "Cadastro principal", status: "Ativo", category: "Técnico", employeeRole: "Técnico de Campo", employeePermissions: { Clientes: ["Visualizar"], "Ordens de serviço": ["Visualizar", "Editar"], Agenda: ["Visualizar", "Editar"], Serviços: ["Visualizar"] }, employeeUsername: "tiago.viana" };
const linkedUnits: Record<string, { icon: IconType; name: string; type: string; doc: string; responsible: string; phone: string; address: string; orders: number }[]> = {};
const linkedSectors: Record<string, { icon: IconType; name: string; type: string; doc: string; responsible: string; phone: string; address: string; orders: number }[]> = {};

function Header({ title, subtitle, onMenu, onNew, searchItems, pendingItems, onSearchSelect, onPendingSelect, userName, userRole, onSwitchUser, online, syncing, onPull, onPush }: { title: string; subtitle: string; onMenu: () => void; onNew: (option: string) => void; searchItems: GlobalSearchItem[]; pendingItems: PendingItem[]; onSearchSelect: (item: GlobalSearchItem) => void; onPendingSelect: (item: PendingItem) => void; userName: string; userRole: string; onSwitchUser: () => void; online: boolean; syncing: boolean; onPull: () => void; onPush: () => void }) {
  const today = new Date();
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const results = normalizedQuery ? searchItems.filter(item => `${item.title} ${item.detail}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)).slice(0, 8) : [];
  const newOptions = ["Cliente", "Unidade", "Equipamento", "Orçamento", "Venda", "Ordem de Serviço", "Agendamento", "Compra", "Produto", "Serviço", "Conta a pagar", "Conta a receber"];
  return <header className="topbar">
    <div className="headline">
      <button className="menu-toggle" aria-label="Abrir menu" onClick={onMenu}><Menu size={20}/></button>
      <div className="header-module-mark"><img src="/icon.png" alt="ProAR"/></div>
      <div className="headline-copy"><div className="eyebrow"><span>PROAR</span><ChevronRight size={10}/><b>Central de operações</b><i>BY TAV's</i></div><h1>{title}</h1><p>{subtitle}</p></div>
    </div>
    <div className="top-actions">
      <div className="header-popover-wrap search-wrap"><label className="global-search"><Search size={16}/><input aria-label="Pesquisa global" value={query} onChange={event => setQuery(event.target.value)} onFocus={() => setShowNew(false)} placeholder="Pesquisar cliente, OS, produto..." /><kbd>⌘ K</kbd></label>{results.length > 0 && <div className="header-popover global-results" role="listbox">{results.map(item => <button key={`${item.kind}-${item.id}`} onClick={() => { onSearchSelect(item); setQuery(""); }}><span>{item.kind === "Cliente" ? <UsersRound size={15}/> : item.kind === "OS" ? <ClipboardList size={15}/> : <Search size={15}/>}</span><div><b>{item.title}</b><small>{item.detail}</small></div><em>{item.kind}</em></button>)}</div>}{normalizedQuery && !results.length && <div className="header-popover global-results empty-search"><span>Nenhum registro real encontrado.</span></div>}</div>
      <div className={`header-status ${online ? "" : "offline"}`}><span>{online ? <ShieldCheck size={14}/> : <Database size={14}/>}</span><div><b>{online ? "Sistema operacional" : "Modo offline"}</b><small>{online ? today.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }) : "Dados guardados no aparelho"}</small></div></div>
      <div className="header-popover-wrap"><button className="icon-btn notification-button" aria-label="Central de pendências" aria-expanded={showPending} onClick={() => { setShowPending(value => !value); setShowNew(false); }}><Bell size={18}/>{pendingItems.length > 0 && <i/>}</button>{showPending && <section className="header-popover pending-popover"><header><div><span>CENTRAL DE PENDÊNCIAS</span><b>O que precisa de atenção</b></div><small>{pendingItems.length}</small></header>{pendingItems.length ? <div>{pendingItems.slice(0, 6).map(item => <button key={item.id} onClick={() => { onPendingSelect(item); setShowPending(false); }}><i className={item.tone}/><span><b>{item.title}</b><small>{item.detail}</small></span><ChevronRight size={14}/></button>)}</div> : <p>Nenhuma pendência operacional encontrada.</p>}</section>}</div>
      <div className="manual-sync"><button disabled={!online || syncing} onClick={onPull} title="Atualizar dados deste aparelho"><ArrowDownRight size={14}/><span>{syncing ? "Sincronizando" : "Atualizar"}</span></button><button disabled={!online || syncing} onClick={onPush} title="Enviar alterações ao banco principal"><RefreshCw size={14}/><span>Sincronizar</span></button></div>
      <div className="header-popover-wrap"><button className="primary-btn" aria-expanded={showNew} onClick={() => { setShowNew(value => !value); setShowPending(false); }}><Plus size={17}/> Novo <ChevronDown size={13}/></button>{showNew && <section className="header-popover new-popover"><header><span>CADASTRO RÁPIDO</span><b>Criar novo registro</b></header><div>{newOptions.map(option => <button key={option} onClick={() => { onNew(option); setShowNew(false); }}><Plus size={14}/>{option}</button>)}</div></section>}</div>
      <div className="profile"><div className="profile-avatar">{userName.split(" ").map(word => word[0]).slice(0,2).join("").toUpperCase()}<span /></div><div><strong>{userName}</strong><small>{userRole}</small></div></div>
      <button className="switch-user-btn" aria-label="Trocar utilizador" title="Trocar utilizador" onClick={onSwitchUser}><UserRound size={15}/><span>Trocar</span><LogOut size={14}/></button>
    </div>
  </header>;
}

function Sidebar({ current, setCurrent, open, close, permissions }: { current: string; setCurrent: (s: string) => void; open: boolean; close: () => void; permissions?: string[] }) {
  const allowed = (name: string) => Boolean(permissions?.includes("*") || permissions?.includes(name));
  return <>
    {open && <button className="backdrop" aria-label="Fechar menu" onClick={close} />}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark brand-logo"><img src="/icon.png" alt="Ícone ProAR"/></div><div className="brand-copy"><strong>ProAR</strong><small>GESTÃO DE SERVIÇOS</small><em>BY TAV's</em></div></div>
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

function Dashboard({ onNavigate, serviceOrders, modules }: { onNavigate: (s: string) => void; serviceOrders: ServiceOrder[]; modules: Record<string, ModuleRecord[]> }) {
  const [period, setPeriod] = useState("Este mês");
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = serviceOrders.filter(order => order.date === today);
  const overdueOrders = serviceOrders.filter(order => order.date && order.date < today && !/conclu[ií]d|cancelad/i.test(order.status));
  const workItems = [
    ...overdueOrders.map(order => ({ id:`os-${order.id}`, title:`OS atrasada • ${order.id}`, detail:`${order.client} • ${order.service}`, module:"Ordens de serviço", tone:"red" })),
    ...todayOrders.filter(order=>!/conclu[ií]d|cancelad/i.test(order.status)).map(order => ({ id:`today-${order.id}`, title:`Atendimento de hoje • ${order.id}`, detail:`${order.time || "Horário a definir"} • ${order.client}`, module:"Agenda", tone:"blue" })),
    ...Object.entries(modules).flatMap(([module, records]) => records.filter(record => /aguardando|pendente|venc|atras|baixo estoque|sem estoque/i.test(`${record.status || ""} ${record.description || ""}`)).map(record => ({ id:`${module}-${record.id}`, title:record.name, detail:`${module} • ${record.status || "Próxima ação necessária"}`, module, tone:/venc|atras|sem estoque/i.test(`${record.status} ${record.description}`)?"red":"amber" })))
  ].slice(0, 8);
  const dashboardStats = [
    { icon: ClipboardList, value: String(serviceOrders.filter(order => order.status !== "Concluída").length).padStart(2, "0"), label: "OS em aberto", note: `${todayOrders.length} programada(s) para hoje`, tone: "blue", trend: "Atual" },
    { icon: Activity, value: String(serviceOrders.filter(order => order.status === "Em andamento").length).padStart(2, "0"), label: "Em andamento", note: "Atendimentos ativos", tone: "cyan", trend: "Agora" },
    { icon: CheckCircle2, value: String(serviceOrders.filter(order => order.status === "Concluída").length).padStart(2, "0"), label: "Concluídas", note: "Total registrado", tone: "green", trend: "Atual" },
    { icon: AlertTriangle, value: String(overdueOrders.length).padStart(2, "0"), label: "Atrasadas", note: overdueOrders.length ? "Exigem ação imediata" : "Nenhuma pendência", tone: "red", trend: "Atual" },
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
          <div className="panel-head"><div><span className="section-kicker"><AlertTriangle size={12}/> CENTRAL DE TRABALHO DO DIA</span><h2>Próximas ações</h2><p>Somente o que precisa de atenção agora.</p></div><span>{workItems.length}</span></div>
          {workItems.length ? <div className="workday-list">{workItems.map(item=><button key={item.id} className={item.tone} onClick={()=>onNavigate(item.module)}><i/><span><b>{item.title}</b><small>{item.detail}</small></span><ChevronRight size={15}/></button>)}</div> : <div className="linked-empty"><CheckCircle2 size={22}/><h4>Tudo certo por aqui</h4><p>Não há ações operacionais pendentes.</p></div>}
        </div>
      </aside>
    </section>
  </>;
}

function CustomerDetail({ customerName, customers, structures, serviceOrders, modules, canEdit, onBack, onOpen, onUpdateStructure }: { customerName: string; customers: Customer[]; structures: ModuleRecord[]; serviceOrders: ServiceOrder[]; modules: Record<string, ModuleRecord[]>; canEdit: boolean; onBack: () => void; onOpen: (name: string) => void; onUpdateStructure: (record: ModuleRecord) => void }) {
  const customer = customers.find(c => c.name === customerName);
  if (!customer) return null;
  const units = linkedUnits[customerName] ?? [
    { icon: Building2, name: "Matriz", type: "Unidade principal", doc: customer.doc, responsible: customer.contact, phone: customer.phone, address: customer.address, orders: 0 },
  ];
  const sectors = structures.filter(item => item.client === customerName).map(item => ({ icon: Building2, name:item.name, type:item.category || "Setor", doc:item.doc || item.description || "", responsible:item.contact || "", phone:item.phone || "", address:item.address || "", orders:0 }));
  const [editingStructure, setEditingStructure] = useState<ModuleRecord | null>(null);
  const linkedRecords = [...units, ...sectors].filter((record, index, list) => list.findIndex(item => item.name === record.name) === index);
  const structureLimit = 20;
  const canAddStructure = linkedRecords.length < structureLimit;
  const [tab, setTab] = useState("Cadastro de unidade e setor");
  const [sectorQuery, setSectorQuery] = useState("");
  const isPublicCustomer = /Prefeitura|Órgão Público|Autarquia|Fundação|Entidade Pública/.test(customer.organizationType ?? "");
  const tabs = ["Dados gerais", "Cadastro de unidade e setor", ...(isPublicCustomer ? ["Licitações / Certames"] : []), "Equipamentos", "Serviços executados", "Ordens de serviço", "Orçamentos", "Pedidos e vendas", "Financeiro", "Documentos", "Histórico"];
  const isStructureTab = tab === "Cadastro de unidade e setor";
  const filteredSectors = sectors.filter(sector => `${sector.name} ${sector.type} ${sector.responsible} ${sector.doc}`.toLowerCase().includes(sectorQuery.toLowerCase()));
  const customerOrders = serviceOrders.filter(order => order.client === customerName);
  const recordsFor = (moduleName: string) => (modules[moduleName] ?? []).filter(record => record.client === customerName);
  const equipmentRecords = recordsFor("Equipamentos");
  const budgetRecords = recordsFor("Orçamentos");
  const salesRecords = recordsFor("Vendas");
  const financeRecords = recordsFor("Financeiro");
  const documentRecords = recordsFor("Documentos");
  const certameRecords = recordsFor("Certames") as PublicContractRecord[];
  const commitmentRecords = recordsFor("Empenhos") as PublicCommitmentRecord[];
  const certameTotals = certameRecords.reduce((totals, contract) => { for (const item of contract.certameItems ?? []) { const balance=calculateCertameItemBalance(item,item.movements??[]);totals.contracted+=balance.contractedValue;totals.executed+=balance.executedValue;totals.available+=balance.availableValue; } return totals; },{contracted:0,executed:0,available:0});
  const completedOrders = customerOrders.filter(order => order.status === "Concluída");
  const creditUsed = Math.max(customer.balancePosted ?? 0, financeRecords.filter(record => record.transactionType === "Receber" && record.status !== "Recebido" && record.status !== "Pago").reduce((sum, record) => sum + Math.max(0,(record.value ?? 0)-(record.settledValue ?? 0)),0));
  const creditAvailable = Math.max(0,(customer.creditLimit ?? 0)-creditUsed);
  const renderRecordTable = (records: ModuleRecord[], empty: string) => records.length ? <div className="table-wrap customer-history-table"><table><thead><tr><th>REGISTRO</th><th>UNIDADE</th><th>DATA</th><th>SITUAÇÃO</th><th>VALOR</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td><b>{record.name}</b><small>{record.id}</small></td><td>{record.unit || "Matriz"}</td><td>{record.date || record.createdAt || "—"}</td><td><span className="status blue"><i/> {record.status || "Ativo"}</span></td><td>{typeof record.value === "number" ? `R$ ${record.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}` : "—"}</td></tr>)}</tbody></table></div> : <div className="linked-empty compact"><History size={22}/><h4>Nenhum registro</h4><p>{empty}</p></div>;
  return <section className="client-detail">
    <div className="detail-header">
      <button className="back-button" onClick={onBack}><ArrowLeft size={16}/> Voltar aos clientes</button>
      <div className="detail-identity"><span>{customer.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><div><small>CLIENTE CADASTRADO</small><h2>{customer.name}</h2><p>{customer.doc || "Documento não informado"} • {customer.address || "Endereço não informado"}</p></div></div>
      <div className="detail-header-actions"><ContextReports title={`Cliente ${customer.name}`} rows={[["Cliente",customer.name],["CPF/CNPJ",customer.doc],["Telefone",customer.phone]]} options={["Cliente 360°","Equipamentos","Ordens de Serviço","Vendas","Financeiro","Histórico","Documentos"]}/><button className="outline-btn"><Edit3 size={14}/> Editar cliente</button></div>
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
      {editingStructure && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setEditingStructure(null)} aria-label="Fechar"/><div className="modal catalog-edit-modal"><div className="modal-head"><div><span>ALTERAR SETOR / FILIAL</span><h2>{editingStructure.name}</h2><p>Vinculado a {customerName}</p></div><button onClick={() => setEditingStructure(null)}><X size={18}/></button></div><div className="catalog-edit-form"><label>Nome<input value={editingStructure.name} onChange={event => setEditingStructure({...editingStructure,name:event.target.value})}/></label><label>Tipo<select value={editingStructure.category || "Setor"} onChange={event => setEditingStructure({...editingStructure,category:event.target.value})}><option>Setor</option><option>Unidade</option><option>Filial</option><option>Empresa vinculada</option></select></label><label className="wide">Endereço<input value={editingStructure.address || ""} onChange={event => setEditingStructure({...editingStructure,address:event.target.value})}/></label><label>CNPJ<input value={editingStructure.doc || editingStructure.description || ""} onChange={event => setEditingStructure({...editingStructure,doc:event.target.value})}/></label><label>Responsável<input value={editingStructure.contact || ""} onChange={event => setEditingStructure({...editingStructure,contact:event.target.value})}/></label><label>Telefone<input value={editingStructure.phone || ""} onChange={event => setEditingStructure({...editingStructure,phone:event.target.value})}/></label><label className="wide">Observações<input value={editingStructure.description || ""} onChange={event => setEditingStructure({...editingStructure,description:event.target.value})}/></label></div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditingStructure(null)}>Cancelar</button><button className="primary-btn" onClick={() => {onUpdateStructure(editingStructure);setEditingStructure(null);}}><CheckCircle2 size={15}/> Salvar alterações</button></div></div></div>}
    </div> : tab === "Dados gerais" ? <div className="customer-tab-content"><div className="customer-data-grid"><article><small>CLIENTE / MATRIZ</small><strong>{customer.name}</strong><span>{customer.doc || "CPF/CNPJ não informado"}</span></article><article><small>RESPONSÁVEL</small><strong>{customer.contact || "Não informado"}</strong><span>{customer.phone || "Telefone não informado"}</span></article><article><small>ENDEREÇO PRINCIPAL</small><strong>{customer.address || "Não informado"}</strong><span>{customer.units} unidade(s) vinculada(s)</span></article><article><small>SITUAÇÃO FINANCEIRA</small><strong>{customer.financialStatus || "Liberado"}</strong><span>Crédito disponível: R$ {creditAvailable.toLocaleString("pt-BR",{minimumFractionDigits:2})}</span></article></div></div>
    : tab === "Licitações / Certames" ? <div className="customer-tab-content"><div className="customer-tab-head"><div><h3>Licitações e Certames</h3><p>Contratações exclusivas deste cliente público, sem compartilhar preços ou saldos com outros órgãos.</p></div><button className="primary-btn" onClick={()=>onOpen("Licitações")}><Landmark size={15}/> Abrir gestão contratual</button></div><div className="credit-summary"><article><small>CERTAMES</small><strong>{certameRecords.length}</strong></article><article><small>VALOR CONTRATADO</small><strong>R$ {certameTotals.contracted.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></article><article><small>VALOR EXECUTADO</small><strong>R$ {certameTotals.executed.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></article><article><small>SALDO CONTRATUAL</small><strong>R$ {certameTotals.available.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></article></div>{certameRecords.length?<div className="table-wrap customer-history-table"><table><thead><tr><th>CERTAME</th><th>PROCESSO</th><th>ITENS</th><th>SITUAÇÃO</th><th>VALOR</th></tr></thead><tbody>{certameRecords.map(record=><tr key={record.id}><td><b>{record.name}</b><small>{record.contractObject||record.description}</small></td><td>{record.administrativeProcess||"—"}</td><td>{record.certameItems?.length??0}</td><td><span className="status blue"><i/> {record.status||"Em vigência"}</span></td><td>R$ {(record.value??0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>)}</tbody></table></div>:<div className="linked-empty compact"><Landmark size={22}/><h4>Nenhum Certame cadastrado</h4><p>Nenhuma contratação foi criada automaticamente para este cliente.</p></div>}<div className="customer-tab-head"><div><h3>Empenhos vinculados</h3><p>{commitmentRecords.length} documento(s) administrativo(s) registrado(s).</p></div></div>{renderRecordTable(commitmentRecords,"Nenhum Empenho vinculado a este cliente.")}</div>
    : tab === "Equipamentos" ? <div className="customer-tab-content"><div className="customer-tab-head"><div><h3>Equipamentos do cliente</h3><p>Equipamentos cadastrados para a matriz, filiais e setores.</p></div><button className="primary-btn" onClick={() => onOpen("Novo • Equipamentos")}><Plus size={15}/> Novo equipamento</button></div>{renderRecordTable(equipmentRecords,"Cadastre os equipamentos instalados neste cliente.")}</div>
    : tab === "Serviços executados" ? <div className="customer-tab-content"><div className="customer-tab-head"><div><h3>Serviços executados</h3><p>Histórico técnico concluído em todas as unidades deste cliente.</p></div></div>{completedOrders.length ? <div className="table-wrap customer-history-table"><table><thead><tr><th>OS</th><th>UNIDADE</th><th>SERVIÇO</th><th>TÉCNICO</th><th>DATA</th><th>SITUAÇÃO</th></tr></thead><tbody>{completedOrders.map(order => <tr key={order.id}><td><b>{order.id}</b></td><td>{order.unit}</td><td>{order.service}</td><td>{order.tech}</td><td>{order.date}</td><td><span className="status green"><i/> Concluída</span></td></tr>)}</tbody></table></div> : <div className="linked-empty compact"><Wrench size={22}/><h4>Nenhum serviço concluído</h4><p>As ordens finalizadas aparecerão automaticamente aqui.</p></div>}</div>
    : tab === "Ordens de serviço" ? <div className="customer-tab-content"><div className="customer-tab-head"><div><h3>Ordens de serviço</h3><p>Todas as OS da matriz e unidades vinculadas.</p></div><button className="primary-btn" onClick={() => onOpen("Nova ordem de serviço")}><Plus size={15}/> Nova OS</button></div>{customerOrders.length ? <div className="table-wrap customer-history-table"><table><thead><tr><th>ORDEM</th><th>UNIDADE</th><th>SERVIÇO</th><th>TÉCNICO</th><th>DATA</th><th>SITUAÇÃO</th></tr></thead><tbody>{customerOrders.map(order => <tr key={order.id}><td><b>{order.id}</b></td><td>{order.unit}</td><td>{order.service}</td><td>{order.tech}</td><td>{order.date}</td><td><span className={`status ${order.tone}`}><i/> {order.status}</span></td></tr>)}</tbody></table></div> : <div className="linked-empty compact"><ClipboardList size={22}/><h4>Nenhuma ordem de serviço</h4><p>As OS deste cliente aparecerão aqui.</p></div>}</div>
    : tab === "Orçamentos" ? <div className="customer-tab-content"><div className="customer-tab-head"><div><h3>Orçamentos</h3><p>Propostas e orçamentos emitidos para este cliente.</p></div><button className="primary-btn" onClick={() => onOpen("Novo • Orçamentos")}><Plus size={15}/> Novo orçamento</button></div>{renderRecordTable(budgetRecords,"Nenhum orçamento emitido para este cliente.")}</div>
    : tab === "Pedidos e vendas" ? <div className="customer-tab-content"><div className="customer-tab-head"><div><h3>Pedidos e vendas</h3><p>Histórico comercial consolidado da matriz e filiais.</p></div></div>{renderRecordTable(salesRecords,"Nenhum pedido ou venda registrado para este cliente.")}</div>
    : tab === "Financeiro" ? <div className="customer-tab-content"><div className="credit-summary"><article><small>LIMITE DE CRÉDITO</small><strong>R$ {(customer.creditLimit ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></article><article><small>CRÉDITO UTILIZADO</small><strong>R$ {creditUsed.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></article><article><small>CRÉDITO DISPONÍVEL</small><strong>R$ {creditAvailable.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></article><article><small>SITUAÇÃO</small><strong>{customer.financialStatus || "Liberado"}</strong></article></div>{renderRecordTable(financeRecords,"Nenhum lançamento financeiro vinculado a este cliente.")}</div>
    : tab === "Documentos" ? <div className="customer-tab-content"><div className="customer-tab-head"><div><h3>Documentos</h3><p>Documentos, certificados, relatórios e anexos do cliente.</p></div></div>{renderRecordTable(documentRecords,"Nenhum documento cadastrado para este cliente.")}</div>
    : <div className="customer-tab-content"><div className="customer-tab-head"><div><h3>Histórico completo</h3><p>Linha do tempo consolidada do relacionamento com o cliente.</p></div></div><div className="customer-timeline">{[...customerOrders.map(order => ({id:order.id,title:`${order.id} • ${order.service}`,date:order.date,detail:`${order.unit} • ${order.status}`})),...budgetRecords.map(record => ({id:record.id,title:`Orçamento • ${record.name}`,date:record.date || record.createdAt,detail:record.status || "Registrado"})),...salesRecords.map(record => ({id:record.id,title:`Pedido/Venda • ${record.name}`,date:record.date || record.createdAt,detail:record.status || "Registrado"}))].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(item => <article key={`${item.id}-${item.title}`}><span><History size={14}/></span><div><b>{item.title}</b><small>{item.detail}</small></div><time>{item.date || "—"}</time></article>)}</div></div>}
  </section>;
}

function Customers({ onOpen, onDelete, onUpdate, onUpdateStructure, canEdit, customers, structures, serviceOrders, modules }: { onOpen: (name: string) => void; onDelete: (customer: Customer) => void; onUpdate: (customer: Customer) => void; onUpdateStructure: (record: ModuleRecord) => void; canEdit: boolean; customers: Customer[]; structures: ModuleRecord[]; serviceOrders: ServiceOrder[]; modules: Record<string, ModuleRecord[]> }) {
  const [query, setQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const filtered = useMemo(() => customers.filter(c => `${c.name} ${c.doc} ${c.contact}`.toLowerCase().includes(query.toLowerCase())), [query, customers]);
  if (selectedCustomer) return <CustomerDetail customerName={selectedCustomer} customers={customers} structures={structures} serviceOrders={serviceOrders} modules={modules} canEdit={canEdit} onUpdateStructure={onUpdateStructure} onBack={() => setSelectedCustomer("")} onOpen={name=>name==="Licitações"?window.dispatchEvent(new CustomEvent("proar:navigate",{detail:name})):onOpen(name)}/>;
  return <section className="module-page">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar cliente, CPF ou CNPJ..." /></label><button className="outline-btn"><Filter size={14}/> Filtros</button><button className="primary-btn" onClick={() => onOpen("Novo cliente")}><Plus size={16}/> Novo cliente</button></div>
    <div className="module-summary">
      <article><span><UsersRound size={19}/></span><div><small>CLIENTES ATIVOS</small><strong>{customers.filter(item => item.status === "Ativo").length}</strong><em>Cadastros reais</em></div></article>
      <article><span><Building2 size={19}/></span><div><small>UNIDADES CADASTRADAS</small><strong>{customers.reduce((total, item) => total + item.units, 0)}</strong><em>Vinculadas aos clientes</em></div></article>
      <article><span><HandCoins size={19}/></span><div><small>FATURAMENTO NO MÊS</small><strong>R$ 0,00</strong><em>Sem vendas lançadas</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><UsersRound size={12}/> CARTEIRA</span><h2>Clientes cadastrados</h2><p>{filtered.length} registro(s) encontrado(s) • {canEdit ? "Duplo clique para alterar" : "Somente consulta"}</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>CPF / CNPJ</th><th>RESPONSÁVEL</th><th>TELEFONE</th><th>ENDEREÇO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id} onDoubleClick={() => setSelectedCustomer(c.name)}><td><div className="client-cell"><span>{c.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><strong>{c.name}</strong></div></td><td>{c.doc || "—"}</td><td>{c.contact || "—"}</td><td>{c.phone || "—"}</td><td>{c.address || "—"}</td><td><span className="status green"><i/> {c.status}</span></td><td><div className="row-actions"><button className="open-client" onClick={() => setSelectedCustomer(c.name)}>Abrir <ChevronRight size={14}/></button>{canEdit && <button onClick={() => setEditingCustomer({...c})} title="Alterar"><Edit3 size={14}/></button>}<button className="delete-action" aria-label={`Excluir ${c.name}`} onClick={() => onDelete(c)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="linked-empty"><UsersRound size={22}/><h4>Nenhum cliente cadastrado</h4><p>Use “Novo cliente” para iniciar sua base real.</p></div>}</div>
    {editingCustomer && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setEditingCustomer(null)} aria-label="Fechar"/><div className="modal catalog-edit-modal"><div className="modal-head"><div><span>ALTERAR CLIENTE</span><h2>{editingCustomer.name}</h2><p>Atualize cadastro, endereço e situação.</p></div><button onClick={() => setEditingCustomer(null)}><X size={18}/></button></div><div className="catalog-edit-form"><label>Nome / razão social<input value={editingCustomer.name} onChange={event => setEditingCustomer({...editingCustomer,name:event.target.value})}/></label><label>CPF / CNPJ<input value={editingCustomer.doc} onChange={event => setEditingCustomer({...editingCustomer,doc:event.target.value})}/></label><label>Tipo de organização<select value={editingCustomer.organizationType ?? (editingCustomer.personType==="PF"?"Pessoa Física":"Empresa")} onChange={event=>setEditingCustomer({...editingCustomer,organizationType:event.target.value as Customer["organizationType"]})}><option>Empresa</option><option>Pessoa Física</option><option>Prefeitura</option><option>Órgão Público</option><option>Autarquia</option><option>Fundação</option><option>Entidade Pública</option><option>Outro</option></select></label><label>Responsável<input value={editingCustomer.contact} onChange={event => setEditingCustomer({...editingCustomer,contact:event.target.value})}/></label><label>Telefone<input value={editingCustomer.phone} onChange={event => setEditingCustomer({...editingCustomer,phone:event.target.value})}/></label><label className="wide">Endereço completo<input value={editingCustomer.address} onChange={event => setEditingCustomer({...editingCustomer,address:event.target.value})}/></label><label>Situação<select value={editingCustomer.status} onChange={event => setEditingCustomer({...editingCustomer,status:event.target.value})}><option>Ativo</option><option>Inativo</option></select></label><label>Limite de crédito<input type="number" min="0" step="0.01" value={editingCustomer.creditLimit ?? 0} onChange={event => setEditingCustomer({...editingCustomer,creditLimit:Math.max(0,Number(event.target.value)||0)})}/></label><label>Saldo lançado<input type="number" min="0" step="0.01" value={editingCustomer.balancePosted ?? 0} onChange={event => setEditingCustomer({...editingCustomer,balancePosted:Math.max(0,Number(event.target.value)||0)})}/></label><label>Situação financeira<select value={editingCustomer.financialStatus ?? "Liberado"} onChange={event => setEditingCustomer({...editingCustomer,financialStatus:event.target.value as Customer["financialStatus"]})}><option>Liberado</option><option>Alerta</option><option>Somente à vista</option><option>Bloqueado</option></select></label></div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditingCustomer(null)}>Cancelar</button><button className="primary-btn" onClick={() => {onUpdate(editingCustomer);setEditingCustomer(null);}}><CheckCircle2 size={15}/> Salvar alterações</button></div></div></div>}
  </section>;
}

function serviceOrderReviewDate(order: ServiceOrder) {
  if (!order.lastMaintenanceDate || !order.reviewPeriodMonths) return "";
  const date = new Date(`${order.lastMaintenanceDate}T12:00:00`);
  date.setMonth(date.getMonth() + order.reviewPeriodMonths);
  return date.toISOString().slice(0, 10);
}

function quickPrintServiceOrder(order: ServiceOrder, company: TenantCompany) {
  const popup = window.open("", "_blank", "width=980,height=850");
  if (!popup) return;
  const safe = (value?: string) => String(value || "—").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
  const image = (src: string | undefined, alt: string, empty: string, className = "evidence") => src ? `<img class="${className}" src="${safe(src)}" alt="${safe(alt)}"/>` : `<div class="${className} empty">${safe(empty)}</div>`;
  const items = order.catalogItems?.length ? `<div class="items">${order.catalogItems.map((item,index)=>`<div><b>${String(index+1).padStart(2,"0")}</b><span><strong>${safe(item.name)}</strong><small>${safe(item.kind)}</small></span></div>`).join("")}</div>` : `<section class="service"><small>SERVIÇO PRESTADO</small><h2>${safe(order.service)}</h2></section>`;
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safe(order.id)}</title><style>
  *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17304f;padding:24px;margin:0;background:#fff}.company{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:3px solid #1768df;padding-bottom:15px}.company img{width:145px;height:72px;object-fit:contain}.company .info{text-align:right}.company h1{margin:0 0 4px;color:#1768df;font-size:22px}.company p,.company small{display:block;margin:2px 0;color:#64758a;font-size:11px}.doc-title{display:flex;justify-content:space-between;align-items:center;margin:18px 0 8px}.doc-title h2{margin:0;color:#17304f}.doc-title strong{font-size:18px;color:#1768df}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.box{border:1px solid #dce5ef;border-radius:8px;padding:11px}.box.wide{grid-column:span 2}.box small,.service small{display:block;color:#76879b;margin-bottom:5px;font-size:9px;font-weight:700}.box b{font-size:11px}.service{padding:16px;background:#f4f8fd;border-radius:10px}.service h2{font-size:15px;margin:4px 0}.items{display:grid;gap:6px;margin:12px 0}.items>div{display:flex;gap:10px;padding:9px;border:1px solid #dce5ef;border-radius:7px}.items>div>b{color:#1768df}.items span{display:flex;flex-direction:column}.items small{color:#7b899b}.section-title{font-size:12px;color:#1768df;border-bottom:1px solid #dce5ef;padding-bottom:5px;margin:18px 0 9px}.photos,.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12px}.photos figure,.signatures figure{margin:0;border:1px solid #dce5ef;border-radius:8px;overflow:hidden;text-align:center;break-inside:avoid}.evidence{display:block;width:100%;height:230px;object-fit:cover}.signature{display:block;width:100%;height:105px;object-fit:contain}.empty{display:grid;place-items:center;color:#9aa6b5;background:#f8fafc}.photos figcaption,.signatures figcaption{font-size:9px;font-weight:700;padding:7px;border-top:1px solid #e5ebf2}.signatures figcaption span{display:block;font-weight:400;color:#738399;margin-top:2px}footer{margin-top:22px;border-top:1px solid #dce5ef;padding-top:10px;font-size:9px;color:#76879b;display:flex;justify-content:space-between;gap:20px}@media print{body{padding:9mm}.company{break-inside:avoid}.photos figure,.signatures figure{break-inside:avoid}}
  </style></head><body><header class="company">${company.logo ? `<img src="${safe(company.logo)}" alt="${safe(company.tradeName)}"/>` : `<div></div>`}<div class="info"><h1>${safe(company.tradeName || company.legalName)}</h1><p>${safe(company.legalName)}</p><small>${safe(company.cnpj ? `CNPJ/CPF: ${company.cnpj}` : "CNPJ/CPF não informado")}</small><small>${safe([company.phone,company.email].filter(Boolean).join(" • "))}</small><small>${safe([company.address, company.city && company.state ? `${company.city}/${company.state}` : company.city || company.state].filter(Boolean).join(" • "))}</small></div></header><div class="doc-title"><h2>ORDEM DE SERVIÇO</h2><strong>${safe(order.id)}</strong></div><div class="grid"><div class="box"><small>CLIENTE</small><b>${safe(order.client)}</b></div><div class="box"><small>UNIDADE / SETOR</small><b>${safe(order.unit)}</b></div><div class="box"><small>SITUAÇÃO</small><b>${safe(order.status)}</b></div><div class="box"><small>DATA / HORÁRIO</small><b>${safe(order.date)} • ${safe(order.time)}</b></div><div class="box"><small>TÉCNICO</small><b>${safe(order.tech)}</b></div><div class="box wide"><small>ENDEREÇO DO ATENDIMENTO</small><b>${safe(order.address)}</b></div></div>${items}<h3 class="section-title">Registro fotográfico</h3><div class="photos"><figure>${image(order.photoBefore,"Antes do serviço","Foto antes não adicionada")}<figcaption>ANTES DO SERVIÇO</figcaption></figure><figure>${image(order.photoAfter,"Depois do serviço","Foto depois não adicionada")}<figcaption>DEPOIS DO SERVIÇO</figcaption></figure></div><h3 class="section-title">Assinaturas</h3><div class="signatures"><figure>${image(order.clientSignature,"Assinatura do cliente","Assinatura não registrada","signature")}<figcaption>ASSINATURA DO CLIENTE<span>${safe(order.client)}</span></figcaption></figure><figure>${image(order.technicianSignature,"Assinatura do técnico","Assinatura não registrada","signature")}<figcaption>ASSINATURA DO TÉCNICO RESPONSÁVEL<span>${safe(order.tech)}</span></figcaption></figure></div><footer><span>${safe(company.tradeName)} • ${safe(company.cnpj || "Documento não informado")}</span><span>Documento gerado pelo ProAR em ${new Date().toLocaleString("pt-BR")}</span></footer><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
  popup.document.close();
}

function ServiceOrders({ onOpen, onSelect, onDelete, onUpdate, serviceOrders, customers, company }: { onOpen: (name: string) => void; onSelect: (order: ServiceOrder) => void; onDelete: (order: ServiceOrder) => void; onUpdate: (order: ServiceOrder) => void; serviceOrders: ServiceOrder[]; customers: Customer[]; company: TenantCompany }) {
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("Em aberto");
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const todayIso = new Date().toISOString().slice(0,10);
  const isClosed = (status:string) => /conclu[ií]d|cancelad/i.test(status);
  const visibleOrders = serviceOrders.filter(order => { const customer = customers.find(item => item.name === order.client); const matchesSearch=!query.trim() || normalizeSearch([order.id, order.client, order.unit, order.address, order.tech, customer?.legalName, customer?.tradeName, customer?.doc, customer?.phone].filter(Boolean).join(" ")).includes(normalizeSearch(query)); const matchesFilter=visibility === "Todas" || visibility === "Concluídas" ? /conclu[ií]d/i.test(order.status) : visibility === "Canceladas" ? /cancelad/i.test(order.status) : visibility === "Hoje" ? order.date === todayIso : !isClosed(order.status); return matchesSearch && matchesFilter; });
  serviceOrders = visibleOrders;
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
  const emitNfse = async (order: ServiceOrder) => {
    const customer = customers.find(item => item.name === order.client);
    if (!customer?.doc) return window.alert("Cadastre o CPF/CNPJ do cliente antes de emitir a NFS-e.");
    const rawValue = window.prompt("Valor da NFS-e (R$):", String(order.nfseValue || ""));
    if (rawValue === null) return;
    const value = Number(rawValue.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return window.alert("Informe um valor válido.");
    onUpdate({ ...order, nfseStatus:"Processando", nfseValue:value });
    try {
      const response = await fetch("/api/nfse/issue", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ serviceOrderId:order.id, customer:{ name:order.client, document:customer.doc, unit:order.unit, address:order.address }, service:{ description:order.service, value } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha na emissão");
      const provider = result.result || {};
      onUpdate({ ...order, nfseStatus:"Emitida", nfseValue:value, nfseNumber:String(provider.number || provider.numero || provider.nfseNumber || ""), nfseVerificationCode:String(provider.verificationCode || provider.codigoVerificacao || ""), nfseIssuedAt:new Date().toISOString() });
      window.alert(`NFS-e emitida com sucesso${provider.number || provider.numero ? `: ${provider.number || provider.numero}` : "."}`);
    } catch (error) { onUpdate({ ...order, nfseStatus:"Erro", nfseValue:value }); window.alert(error instanceof Error ? error.message : "Não foi possível emitir a NFS-e."); }
  };
  return <section className="module-page service-orders">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Pesquisar por cliente, OS, CPF/CNPJ, telefone ou unidade..."/></label><label>Exibir<select value={visibility} onChange={event=>setVisibility(event.target.value)}><option>Em aberto</option><option>Todas</option><option>Concluídas</option><option>Canceladas</option><option>Hoje</option></select></label><ContextReports title="Ordens de Serviço" rows={serviceOrders.map(order=>[order.id,order.client,order.status])} options={["Imprimir Ordem de Serviço","Relatório técnico","Certificado de higienização","Relatório fotográfico","Relatório da assistência técnica","Comprovante de entrega","Histórico completo da OS"]}/><button className="primary-btn" onClick={() => onOpen("Nova ordem de serviço")}><Plus size={16}/> Nova ordem de serviço</button></div>
    <div className="module-summary">
      <article><span><ClipboardList size={19}/></span><div><small>ORDENS ABERTAS</small><strong>{serviceOrders.filter(item => item.status !== "Concluída").length}</strong><em>{serviceOrders.filter(item => item.date === today).length} para hoje</em></div></article>
      <article><span><UserCheck size={19}/></span><div><small>TÉCNICOS EMPENHADOS</small><strong>{new Set(serviceOrders.map(item => item.tech).filter(Boolean)).size}</strong><em>Cadastros reais</em></div></article>
      <article><span><CheckCircle2 size={19}/></span><div><small>FINALIZADAS</small><strong>{serviceOrders.filter(item => item.status === "Concluída").length}</strong><em>Total registrado</em></div></article>
      <article><span><Bell size={19}/></span><div><small>REVISÕES PRÓXIMAS</small><strong>{reviewAlerts.length}</strong><em>Alertas preventivos</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><Wrench size={12}/> OPERAÇÃO TÉCNICA</span><h2>Ordens de serviço</h2><p>Duplo clique para abrir • PDF e WhatsApp disponíveis em um clique.</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>ORDEM</th><th>CLIENTE / LOCAL</th><th>DATA / HORÁRIO</th><th>REVISÃO</th><th>TÉCNICO</th><th>SITUAÇÃO</th><th>AÇÕES RÁPIDAS</th></tr></thead><tbody>{serviceOrders.map(order => { const reviewDate = serviceOrderReviewDate(order); return <tr className="clickable-row" title="Clique duas vezes para abrir a ordem" onDoubleClick={() => onSelect(order)} key={`manage-${order.id}`}><td><b className="order-id">{order.id}</b></td><td><div className="client-cell"><span>{order.avatar}</span><div><strong>{order.client}</strong><small>{order.unit}</small></div></div></td><td>{order.date ? new Date(`${order.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"} • {order.time || "Sem horário"}</td><td>{reviewDate ? <span className="review-date"><Bell size={12}/>{new Date(`${reviewDate}T12:00:00`).toLocaleDateString("pt-BR")}</span> : "—"}</td><td><div className="tech"><span>{order.tech.split(" ").map(name => name[0]).slice(0,2).join("")}</span>{order.tech}</div></td><td><span className={`status ${order.tone}`}><i/> {order.status}</span></td><td><div className="row-actions quick-order-actions"><button title="Abrir OS" onClick={() => onSelect(order)}><Eye size={14}/></button><button title="Imprimir PDF" onClick={() => quickPrintServiceOrder(order, company)}><FileText size={14}/></button><button className="whatsapp-action" title="Enviar por WhatsApp" onClick={() => sendWhatsApp(order)}><MessageCircle size={14}/></button><button title={order.nfseStatus === "Emitida" ? `NFS-e ${order.nfseNumber || "emitida"}` : "Emitir NFS-e de serviço"} onClick={() => void emitNfse(order)}><ReceiptText size={14}/></button><button className="delete-action" aria-label={`Excluir ${order.id}`} onClick={() => onDelete(order)}><Trash2 size={14}/></button></div></td></tr>; })}</tbody></table></div>{!serviceOrders.length && <div className="linked-empty"><ClipboardList size={22}/><h4>Nenhuma ordem cadastrada</h4><p>Crie uma nova ordem para iniciar a operação.</p></div>}</div>
  </section>;
}

function Agenda({ serviceOrders, onOpen, onSelect }: { serviceOrders: ServiceOrder[]; onOpen: (name: string) => void; onSelect: (order: ServiceOrder) => void }) {
  const [visibility,setVisibility]=useState("Em aberto");
  const isClosed=(value:string)=>/conclu[ií]d|cancelad/i.test(value);
  const scheduled = [...serviceOrders].filter(order => order.date && (visibility === "Todas" || visibility === "Concluídas" ? /conclu[ií]d/i.test(order.status) : visibility === "Canceladas" ? /cancelad/i.test(order.status) : visibility === "Hoje" ? order.date === new Date().toISOString().slice(0,10) : !isClosed(order.status))).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return <section className="module-page">
    <div className="module-toolbar"><div><span className="section-kicker"><CalendarDays size={12}/> AGENDA OPERACIONAL</span><h2>Serviços agendados</h2><p>Por padrão, somente ordens operacionais em aberto.</p></div><div className="toolbar-actions"><label>Exibir<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option>Em aberto</option><option>Todas</option><option>Concluídas</option><option>Canceladas</option><option>Hoje</option></select></label><button className="primary-btn" onClick={() => onOpen("Nova ordem de serviço")}><Plus size={16}/> Agendar serviço</button></div></div>
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
  const scale = Math.min(1, 960 / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.68);
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

function OrderDetail({ order, customerPhone, company, catalog, contracts, close, onUpdate, canEdit }: { order: ServiceOrder; customerPhone?: string; company: TenantCompany; catalog: ModuleRecord[]; contracts: PublicContractRecord[]; close: () => void; onUpdate: (order: ServiceOrder) => Promise<unknown>; canEdit: boolean }) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [itemsTab, setItemsTab] = useState<"Serviços" | "Produtos">("Serviços");
  const [itemSearch, setItemSearch] = useState("");
  const [contractItemId, setContractItemId] = useState("");
  const [contractQuantity, setContractQuantity] = useState("1");
  const [statusDraft, setStatusDraft] = useState(order.status);
  const [internalUpdate, setInternalUpdate] = useState("");
  const [customerUpdate, setCustomerUpdate] = useState("");
  const [statusPhotos, setStatusPhotos] = useState<string[]>([]);
  const [assistanceOpen, setAssistanceOpen] = useState(Boolean(order.assistance?.requestedAt && !order.assistance?.arrivalAt));
  const [assistance, setAssistance] = useState<AssistanceEntry>(order.assistance ?? {});
  const [assistancePhotos, setAssistancePhotos] = useState<string[]>(order.assistance?.entryPhotos ?? []);
  const [pmoc, setPmoc] = useState<PmocRecord>(order.pmoc ?? { applicability: "Verificar aplicabilidade", hasPmoc: false, plan: [] });
  const [pmocExecution, setPmocExecution] = useState<Partial<PmocExecution>>({ equipment: "", location: order.unit, services: [], products: [], pending: [] });
  const [pmocBeforePhotos, setPmocBeforePhotos] = useState<string[]>([]);
  const [pmocAfterPhotos, setPmocAfterPhotos] = useState<string[]>([]);
  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  const mapsEmbed = `https://www.google.com/maps?q=${encodeURIComponent(order.address)}&output=embed`;
  const update = (patch: Partial<ServiceOrder>) => {
    const updated = { ...currentOrder, ...patch };
    setCurrentOrder(updated);
    setDirty(true);
  };
  const requestClose = () => {
    if (dirty && !window.confirm("Existem alterações não salvas nesta Ordem de Serviço. Clique em OK para sair sem salvar ou Cancelar para continuar editando.")) return;
    close();
  };
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);
  const trackingUrl = currentOrder.trackingToken ? `${window.location.origin}/os/${currentOrder.trackingToken}` : "";
  const whatsappPhone = (currentOrder.whatsappPhone || customerPhone || "").replace(/\D/g, "");
  const toneForStatus = (status: string) => /cancel|atras/i.test(status) ? "red" : /conclu|confirm|entregue/i.test(status) ? "green" : /aguardando|reagend/i.test(status) ? "amber" : "blue";
  const trackingToken = () => currentOrder.trackingToken || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2)}`);
  const saveChanges = async () => {
    if (!dirty || saving || !canEdit || /^cancelada$/i.test(currentOrder.status)) return;
    setSaving(true); setSaveNotice("Salvando...");
    try {
      const statusChanged = statusDraft !== currentOrder.status;
      const hasUpdate = statusChanged || Boolean(internalUpdate.trim() || customerUpdate.trim() || statusPhotos.length);
      const savedOrder = hasUpdate ? { ...currentOrder, trackingToken:trackingToken(), status: statusDraft, tone: toneForStatus(statusDraft), timeline: [...(currentOrder.timeline ?? []), { id:`evt-save-${Date.now()}`, createdAt:new Date().toISOString(), previousStatus:currentOrder.status, status:statusDraft, technician:currentOrder.tech, internalNote:internalUpdate.trim() || (statusChanged ? "Status atualizado pelo salvamento principal." : undefined), customerNote:customerUpdate.trim() || undefined, photos:statusPhotos.length ? statusPhotos : undefined, customerVisible:Boolean(customerUpdate.trim() || statusPhotos.length), whatsappQueued:Boolean(whatsappPhone && currentOrder.whatsappUpdatesEnabled !== false && (customerUpdate.trim() || statusChanged)) }] } : currentOrder;
      const confirmedOrder = await onUpdate(savedOrder) as ServiceOrder;
      setCurrentOrder(confirmedOrder); setStatusDraft(confirmedOrder.status); setInternalUpdate(""); setCustomerUpdate(""); setStatusPhotos([]); setDirty(false); setSaveNotice("✓ Alterações salvas");
      window.setTimeout(() => setSaveNotice(""), 2200);
    } catch { setSaveNotice("Não foi possível salvar esta Ordem de Serviço. Verifique os dados e tente novamente."); }
    finally { setSaving(false); }
  };
  const attachStatusPhoto = async (file?: File) => { if (!file) return; const encoded = await imageFileToDataUrl(file); setStatusPhotos(current => [...current, encoded]); setDirty(true); };
  const attachAssistancePhoto = async (file?: File) => { if (!file) return; const encoded = await imageFileToDataUrl(file); setAssistancePhotos(current => [...current, encoded]); };
  const attachPmocPhoto = async (kind: "before" | "after", file?: File) => {
    if (!file) return;
    const encoded = await imageFileToDataUrl(file);
    (kind === "before" ? setPmocBeforePhotos : setPmocAfterPhotos)(current => [...current, encoded]);
  };
  const registerStatusUpdate = () => {
    const statusChanged = statusDraft !== currentOrder.status;
    if (!statusChanged && !internalUpdate.trim() && !customerUpdate.trim() && !statusPhotos.length) return;
    const token = trackingToken();
    const event: ServiceOrderTimelineEvent = { id: `evt-${Date.now()}`, createdAt: new Date().toISOString(), previousStatus: currentOrder.status, status: statusDraft, technician: currentOrder.tech, internalNote: internalUpdate.trim() || undefined, customerNote: customerUpdate.trim() || undefined, photos: statusPhotos.length ? statusPhotos : undefined, customerVisible: Boolean(customerUpdate.trim() || statusPhotos.length), whatsappQueued: Boolean(whatsappPhone && currentOrder.whatsappUpdatesEnabled !== false && (customerUpdate.trim() || statusChanged)) };
    update({ trackingToken: token, status: statusDraft, tone: toneForStatus(statusDraft), timeline: [...(currentOrder.timeline ?? []), event] });
    setInternalUpdate(""); setCustomerUpdate(""); setStatusPhotos([]);
  };
  const requestAssistance = () => {
    const token = trackingToken();
    const requestedAt = new Date().toISOString();
    const entry: AssistanceEntry = { ...assistance, requestedAt, pickupLocation: assistance.pickupLocation || currentOrder.address };
    const event: ServiceOrderTimelineEvent = { id:`evt-${Date.now()}`, createdAt:requestedAt, previousStatus:currentOrder.status, status:"Equipamento encaminhado para assistência", technician:currentOrder.tech, internalNote:entry.pickupReason || "Retirada do equipamento solicitada.", customerNote:"Seu equipamento será encaminhado para avaliação em nossa assistência técnica.", customerVisible:true, whatsappQueued:Boolean(whatsappPhone && currentOrder.whatsappUpdatesEnabled !== false) };
    update({ trackingToken:token, status:"Equipamento encaminhado para assistência", tone:"amber", assistance:entry, timeline:[...(currentOrder.timeline ?? []),event] });
    setAssistance(entry); setAssistanceOpen(true);
  };
  const confirmAssistanceEntry = () => {
    const damaged = assistance.condition === "Com avarias" || assistance.condition === "Danificado";
    if (!assistance.equipment?.trim() || !assistance.serialNumber?.trim() || !assistance.reportedDefect?.trim() || !assistance.receivedBy?.trim() || assistancePhotos.length < 1 || (damaged && !assistance.inspectionNotes?.trim())) return;
    const token = trackingToken(); const arrivalAt = new Date().toISOString();
    const entry: AssistanceEntry = { ...assistance, arrivalAt, entryPhotos: assistancePhotos };
    const event: ServiceOrderTimelineEvent = { id:`evt-${Date.now()}`, createdAt:arrivalAt, previousStatus:currentOrder.status, status:"Equipamento recebido na assistência técnica", technician:assistance.receivedBy, internalNote:entry.inspectionNotes || "Recebimento e inspeção visual registrados.", customerNote:"Seu equipamento foi recebido em nossa assistência técnica e seguirá para diagnóstico.", photos:assistancePhotos, customerVisible:true, whatsappQueued:Boolean(whatsappPhone && currentOrder.whatsappUpdatesEnabled !== false) };
    update({ trackingToken:token, status:"Equipamento recebido na assistência técnica", tone:"blue", assistance:entry, timeline:[...(currentOrder.timeline ?? []),event] });
    setAssistance(entry); setAssistanceOpen(false);
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
  const savePmoc = () => {
    update({ pmoc });
  };
  const registerPmocExecution = () => {
    if (!pmocExecution.equipment?.trim() || !(pmocExecution.services ?? []).length) return;
    const createdAt = new Date().toISOString();
    const entry: PmocExecution = {
      id: `pmoc-${Date.now()}`,
      createdAt,
      equipment: pmocExecution.equipment.trim(),
      location: pmocExecution.location?.trim() || currentOrder.unit,
      capacityBtu: Number(pmocExecution.capacityBtu) || undefined,
      beforeCondition: pmocExecution.beforeCondition?.trim(),
      services: pmocExecution.services ?? [],
      products: pmocExecution.products ?? [],
      pending: pmocExecution.pending ?? [],
      technicalNote: pmocExecution.technicalNote?.trim(),
      beforePhotos: pmocBeforePhotos,
      afterPhotos: pmocAfterPhotos,
      technician: currentOrder.tech,
      responsibleTechnical: pmoc.technicalResponsible,
      signature: pmocExecution.signature,
      nextMaintenanceDate: pmocExecution.nextMaintenanceDate,
    };
    const timelineEvent: ServiceOrderTimelineEvent = { id: `evt-pmoc-${Date.now()}`, createdAt, status: "Execução PMOC registrada", technician: currentOrder.tech, internalNote: entry.technicalNote || "Higienização/manutenção registrada no histórico PMOC.", customerNote: "A execução de higienização/manutenção foi registrada.", photos: [...pmocBeforePhotos, ...pmocAfterPhotos], customerVisible: true, whatsappQueued: Boolean(whatsappPhone && currentOrder.whatsappUpdatesEnabled !== false) };
    update({ pmoc, pmocExecutions: [...(currentOrder.pmocExecutions ?? []), entry], timeline: [...(currentOrder.timeline ?? []), timelineEvent] });
    setPmocExecution({ equipment: "", location: currentOrder.unit, services: [], products: [], pending: [] });
    setPmocBeforePhotos([]); setPmocAfterPhotos([]);
  };
  const addCatalogItem = (item: ModuleRecord) => {
    const kind = item.kind || "Serviço";
    if (currentOrder.catalogItems?.some(existing => existing.id === item.id)) return;
    update({ catalogItems: [...(currentOrder.catalogItems ?? []), { id:item.id, name:item.name, kind }] });
  };
  const removeCatalogItem = (id: string) => update({ catalogItems: (currentOrder.catalogItems ?? []).filter(item => item.id !== id) });
  const availableCatalogItems = catalog.filter(item => (item.kind || "Serviço") === itemsTab.slice(0,-1) && !currentOrder.catalogItems?.some(existing => existing.id === item.id) && `${item.name} ${item.description || ""}`.toLowerCase().includes(itemSearch.toLowerCase()));
  const availableContracts = contracts.filter(contract => contract.client === currentOrder.client && !/encerr|suspens|cancel/i.test(contract.status ?? ""));
  const selectedContract = availableContracts.find(contract => contract.id === currentOrder.certameId);
  const selectedContractItem = selectedContract?.certameItems?.find(item => item.id === contractItemId);
  const addContractItem = () => {
    if (!selectedContractItem) return;
    const quantity = Number(contractQuantity);
    const balance = calculateCertameItemBalance(selectedContractItem, selectedContractItem.movements ?? []);
    const alreadyLinked = (currentOrder.contractItems ?? []).filter(item => item.certameItemId === selectedContractItem.id).reduce((sum, item) => sum + item.quantity, 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity + alreadyLinked > balance.availableQuantity) {
      setSaveNotice(`Saldo do Certame insuficiente. Disponível para novas reservas: ${balance.availableQuantity}.`);
      return;
    }
    update({ contractItems: [...(currentOrder.contractItems ?? []), { certameItemId:selectedContractItem.id, description:selectedContractItem.description, quantity, unitValue:selectedContractItem.unitValue }] });
    setContractItemId(""); setContractQuantity("1"); setSaveNotice("");
  };
  const formatMoment = (value?: string) => value ? new Date(value).toLocaleString("pt-BR") : "";
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`Ordem ${order.id}`}>
    <button className="modal-backdrop" onClick={requestClose} aria-label="Fechar ordem"/>
    <div className="modal order-detail-modal">
      <div className="modal-head order-detail-head"><div><span>ORDEM DE SERVIÇO</span><h2>{order.id} • {order.client}</h2><p>{order.unit}</p></div><div className="order-detail-actions">{dirty && <small className="order-dirty-indicator">Alterações não salvas</small>}<ContextReports title={`OS ${currentOrder.id}`} rows={[["Cliente",currentOrder.client],["Status",currentOrder.status],["Técnico",currentOrder.tech]]} options={["Imprimir Ordem de Serviço","Relatório técnico","Certificado de higienização","Relatório fotográfico","Relatório da assistência técnica","Comprovante de entrega","Histórico completo da OS"]}/>{canEdit && <button className="primary-btn order-save-button" disabled={!dirty || saving || /^cancelada$/i.test(currentOrder.status)} onClick={()=>void saveChanges()}>{saving ? <RefreshCw size={15}/> : <CheckCircle2 size={15}/>} {saving ? "Salvando..." : "Salvar alterações"}</button>}<button onClick={requestClose} aria-label="Fechar"><X size={18}/></button></div></div>
      {saveNotice && <div className={`order-save-notice ${saveNotice.startsWith("✓") ? "saved" : saveNotice.startsWith("Não") ? "error" : "saving"}`}>{saveNotice}</div>}
      <div className="order-detail-content">
        <div className="order-overview">
          <article><CalendarDays size={17}/><div><small>AGENDAMENTO</small><strong>{order.date ? new Date(`${order.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"} • {order.time || "A definir"}</strong></div></article>
          <article><UserCheck size={17}/><div><small>TÉCNICO RESPONSÁVEL</small><strong>{currentOrder.tech || "Não definido"}</strong></div></article>
          <article><Wrench size={17}/><div><small>SERVIÇO</small><strong>{order.service}</strong></div></article>
          <article><Activity size={17}/><div><small>SITUAÇÃO</small><strong>{currentOrder.status}</strong></div></article>
        </div>
        <section className="os-tracking-panel">
          <div className="execution-head"><div><span>ACOMPANHAMENTO PELO WHATSAPP</span><h3>Atualizações seguras para o cliente</h3></div><small>{trackingUrl ? "Link ativo" : "Ative ao salvar uma atualização"}</small></div>
          <div className="os-tracking-grid">
            <label>Telefone / WhatsApp<input value={currentOrder.whatsappPhone ?? customerPhone ?? ""} onChange={event => update({ whatsappPhone:event.target.value })} placeholder="(00) 00000-0000"/></label>
            <label className="tracking-toggle"><input type="checkbox" checked={currentOrder.whatsappUpdatesEnabled !== false} onChange={event => update({ whatsappUpdatesEnabled:event.target.checked, trackingToken:trackingToken() })}/><span><b>Cliente recebe atualizações</b><small>Status e fotos liberadas</small></span></label>
            <label className="tracking-toggle"><input type="checkbox" checked={currentOrder.whatsappAppointmentReminderEnabled !== false} onChange={event => update({ whatsappAppointmentReminderEnabled:event.target.checked, trackingToken:trackingToken() })}/><span><b>Lembrete de agendamento</b><small>Antes do atendimento</small></span></label>
            <label>Antecedência do lembrete<select value={currentOrder.appointmentReminderHours ?? 24} onChange={event => update({ appointmentReminderHours:Number(event.target.value), trackingToken:trackingToken() })}><option value="2">2 horas antes</option><option value="24">24 horas antes</option><option value="48">48 horas antes</option></select></label>
          </div>
          {trackingUrl && <div className="tracking-link"><MessageCircle size={18}/><div><b>Link exclusivo do cliente</b><small>Mostra somente status, fotos e atualizações liberadas.</small></div><button type="button" onClick={() => navigator.clipboard.writeText(trackingUrl)}>Copiar link</button><button type="button" disabled={!whatsappPhone} onClick={() => window.open(`https://wa.me/${whatsappPhone.startsWith("55") ? whatsappPhone : `55${whatsappPhone}`}?text=${encodeURIComponent(`Acompanhe sua Ordem de Serviço ${currentOrder.id}: ${trackingUrl}`)}`, "_blank", "noopener,noreferrer")}>Enviar WhatsApp</button></div>}
          <p className="tracking-disclaimer">O envio automático exige uma integração WhatsApp Business configurada no ambiente seguro. Sem essa configuração, a mensagem fica pronta para envio pelo botão WhatsApp.</p>
        </section>
        <section className="os-status-panel">
          <div className="execution-head"><div><span>ATUALIZAÇÃO OPERACIONAL</span><h3>Registrar status, fotos e comunicação</h3></div><small>Observações internas nunca são enviadas ao cliente.</small></div>
          <div className="status-update-grid"><label>Novo status<select value={statusDraft} onChange={event => {setStatusDraft(event.target.value);setDirty(true);}}>{["Aberta","Agendada","Cliente confirmado","Técnico a caminho","Técnico no local","Em atendimento","Aguardando material","Aguardando aprovação","Aguardando retorno","Serviço concluído","Aguardando assinatura","Concluída","Reagendada","Cancelada"].map(status => <option key={status}>{status}</option>)}</select></label><label>Observação técnica interna<textarea value={internalUpdate} onChange={event => {setInternalUpdate(event.target.value);setDirty(true);}} placeholder="Visível somente para a equipe..."/><button type="button" className="outline-btn" onClick={()=>{const suggestion=improveTechnicalText(internalUpdate);if(suggestion){setInternalUpdate(suggestion);setDirty(true);}}}>✦ Melhorar com IA</button></label><label>Atualização para o cliente<textarea value={customerUpdate} onChange={event => {setCustomerUpdate(event.target.value);setDirty(true);}} placeholder="Texto que será exibido no acompanhamento e preparado para WhatsApp..."/><button type="button" className="outline-btn" onClick={()=>{const suggestion=improveTechnicalText(customerUpdate,"cliente");if(suggestion){setCustomerUpdate(suggestion);setDirty(true);}}}>✦ Melhorar com IA</button></label><label className="os-photo-upload"><Camera size={18}/><b>Adicionar fotos</b><small>{statusPhotos.length ? `${statusPhotos.length} foto(s) anexada(s)` : "Fotos opcionais nesta etapa"}</small><input type="file" accept="image/*" multiple onChange={event => void Promise.all(Array.from(event.target.files ?? []).map(attachStatusPhoto))}/></label></div>
          {statusPhotos.length > 0 && <div className="os-photo-strip">{statusPhotos.map((photo,index)=><figure key={`${photo.slice(-18)}-${index}`}><img src={photo} alt={`Atualização ${index+1}`}/><button type="button" onClick={()=>setStatusPhotos(current=>current.filter((_,photoIndex)=>photoIndex!==index))}><X size={12}/></button></figure>)}</div>}
          <div className="status-update-actions"><button className="outline-btn" type="button" onClick={requestAssistance}><Package size={15}/> Levar equipamento para assistência</button><button className="primary-btn" type="button" onClick={registerStatusUpdate}><CheckCircle2 size={15}/> Registrar atualização</button></div>
        </section>
        {availableContracts.length > 0 && <section className="os-contract-panel">
          <div className="execution-head"><div><span>CONTROLE CONTRATUAL INTERNO</span><h3>Itens utilizados do Certame</h3></div><small>Não substitui os serviços executados e não aparece no relatório técnico do cliente.</small></div>
          <div className="os-contract-selector">
            <label>Contratação / Certame<select value={currentOrder.certameId ?? ""} onChange={event => update({ certameId:event.target.value || undefined, contractItems:[] })}><option value="">Selecionar Certame</option>{availableContracts.map(contract => <option key={contract.id} value={contract.id}>{contract.name} • {contract.administrativeProcess || contract.id}</option>)}</select></label>
            <label>Item contratual<select value={contractItemId} disabled={!selectedContract} onChange={event => setContractItemId(event.target.value)}><option value="">Selecionar item</option>{(selectedContract?.certameItems ?? []).map(item => { const balance=calculateCertameItemBalance(item,item.movements??[]); return <option key={item.id} value={item.id}>{item.code || "Item"} • {item.description} • saldo {balance.availableQuantity}</option>; })}</select></label>
            <label>Quantidade<input type="number" min="0.001" step="0.001" value={contractQuantity} onChange={event => setContractQuantity(event.target.value)}/></label>
            <button className="outline-btn" type="button" disabled={!selectedContractItem} onClick={addContractItem}><Plus size={14}/> Reservar ao salvar</button>
          </div>
          {(currentOrder.contractItems ?? []).length > 0 && <div className="os-contract-items">{currentOrder.contractItems?.map((item,index)=><article key={`${item.certameItemId}-${index}`}><span><b>{item.description}</b><small>{item.quantity} × {item.unitValue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</small></span><strong>{(item.quantity*item.unitValue).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><button type="button" disabled={Boolean(item.executionMovementId)} onClick={()=>update({contractItems:(currentOrder.contractItems??[]).filter((_,itemIndex)=>itemIndex!==index)})}><Trash2 size={14}/></button></article>)}</div>}
        </section>}
        {assistanceOpen && <section className="assistance-panel"><div className="execution-head"><div><span>ASSISTÊNCIA TÉCNICA</span><h3>Recebimento obrigatório do equipamento</h3></div><small>Fotos e inspeção preservam o histórico da OS.</small></div>
          <div className="assistance-form"><label>Equipamento *<input value={assistance.equipment ?? ""} onChange={event=>setAssistance(value=>({...value,equipment:event.target.value}))}/></label><label>Marca<input value={assistance.brand ?? ""} onChange={event=>setAssistance(value=>({...value,brand:event.target.value}))}/></label><label>Modelo<input value={assistance.model ?? ""} onChange={event=>setAssistance(value=>({...value,model:event.target.value}))}/></label><label>Número de série *<input value={assistance.serialNumber ?? ""} onChange={event=>setAssistance(value=>({...value,serialNumber:event.target.value}))}/></label><label>Defeito informado *<textarea value={assistance.reportedDefect ?? ""} onChange={event=>setAssistance(value=>({...value,reportedDefect:event.target.value}))}/></label><label>Acessórios recebidos<input value={assistance.accessories ?? ""} onChange={event=>setAssistance(value=>({...value,accessories:event.target.value}))} placeholder="Controle, cabo, tampa..."/></label><label>Peças/acessórios ausentes<input value={assistance.missingParts ?? ""} onChange={event=>setAssistance(value=>({...value,missingParts:event.target.value}))} placeholder="Descreva ausências identificadas"/></label><label>Responsável pelo recebimento *<input value={assistance.receivedBy ?? ""} onChange={event=>setAssistance(value=>({...value,receivedBy:event.target.value}))}/></label><label>Estado geral<select value={assistance.condition ?? "Bom"} onChange={event=>setAssistance(value=>({...value,condition:event.target.value as AssistanceEntry["condition"]}))}>{["Excelente","Bom","Regular","Com avarias","Danificado"].map(item=><option key={item}>{item}</option>)}</select></label></div>
          <div className="inspection-checks">{[["riscos","Possui riscos"],["amassados","Possui amassados"],["partesQuebradas","Possui partes quebradas"],["pecasFaltando","Possui peças faltando"],["parafusosAusentes","Parafusos/tampas ausentes"],["oxidacao","Sinais de oxidação"],["manutencaoAnterior","Marcas de manutenção anterior"],["danosAparentes","Danos aparentes"] as const].map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(assistance.inspection?.[key])} onChange={event=>setAssistance(value=>({...value,inspection:{...(value.inspection ?? {}),[key]:event.target.checked}}))}/>{label}</label>)}</div>
          <label className="assistance-wide">Observações sobre riscos, avarias e condição{(assistance.condition === "Com avarias" || assistance.condition === "Danificado") ? " *" : ""}<textarea value={assistance.inspectionNotes ?? ""} onChange={event=>setAssistance(value=>({...value,inspectionNotes:event.target.value}))} placeholder="Registre detalhes visuais identificados na entrada..."/></label>
          <label className="assistance-photo-upload"><Camera size={20}/><b>Fotos obrigatórias de entrada *</b><small>{assistancePhotos.length ? `${assistancePhotos.length} foto(s) anexada(s)` : "Anexe ao menos uma foto antes de confirmar"}</small><input type="file" accept="image/*" multiple onChange={event => void Promise.all(Array.from(event.target.files ?? []).map(attachAssistancePhoto))}/></label>{assistancePhotos.length>0&&<div className="os-photo-strip">{assistancePhotos.map((photo,index)=><figure key={`${photo.slice(-18)}-${index}`}><img src={photo} alt={`Entrada ${index+1}`}/><button type="button" onClick={()=>setAssistancePhotos(current=>current.filter((_,photoIndex)=>photoIndex!==index))}><X size={12}/></button></figure>)}</div>}
          <div className="status-update-actions"><small>Para confirmar: equipamento, série, defeito, responsável e ao menos uma foto.</small><button className="primary-btn" type="button" onClick={confirmAssistanceEntry} disabled={!assistance.equipment?.trim() || !assistance.serialNumber?.trim() || !assistance.reportedDefect?.trim() || !assistance.receivedBy?.trim() || !assistancePhotos.length || ((assistance.condition === "Com avarias" || assistance.condition === "Danificado") && !assistance.inspectionNotes?.trim())}><CheckCircle2 size={15}/> Confirmar entrada do equipamento</button></div>
        </section>}
        {(currentOrder.timeline?.length ?? 0) > 0 && <section className="os-timeline"><div className="execution-head"><div><span>LINHA DO TEMPO</span><h3>Histórico do atendimento</h3></div><small>Eventos não são sobrescritos.</small></div>{[...(currentOrder.timeline ?? [])].reverse().map(event=><article key={event.id}><i/><div><header><b>{event.status}</b><time>{formatMoment(event.createdAt)}</time></header><small>{event.technician || "Equipe ProAR"}</small>{event.internalNote&&<p><strong>Interno:</strong> {event.internalNote}</p>}{event.customerNote&&<p><strong>Cliente:</strong> {event.customerNote}</p>}{event.photos?.length?<div className="os-event-photos">{event.photos.map((photo,index)=><img key={`${photo.slice(-16)}-${index}`} src={photo} alt={`Foto do evento ${index+1}`}/>)}</div>:null}</div></article>)}</section>}
        <section className="pmoc-panel">
          <div className="execution-head"><div><span>PMOC E HIGIENIZAÇÃO POR AMBIENTE</span><h3>Plano, evidências e execução técnica</h3></div><small>O certificado registra a execução e não substitui o PMOC.</small></div>
          <div className="pmoc-status-note"><ShieldCheck size={17}/><span><b>Execução do serviço:</b> {currentOrder.pmocExecutions?.length ? "com registros" : "sem registro"} <i/> <b>PMOC:</b> {!pmoc.hasPmoc ? "não cadastrado" : pmoc.reviewDate && pmoc.reviewDate < new Date().toISOString().slice(0,10) ? "vencido" : "vigente / em revisão"} <i/> <b>Documentação:</b> {pmoc.technicalResponsible && pmoc.responsibilityDocument ? "com dados cadastrados" : "com pendências"}</span></div>
          <div className="pmoc-grid">
            <label>Aplicabilidade do PMOC<select value={pmoc.applicability ?? "Verificar aplicabilidade"} onChange={event=>setPmoc(value=>({...value,applicability:event.target.value as PmocRecord["applicability"]}))}><option>Obrigatório</option><option>Não obrigatório</option><option>Verificar aplicabilidade</option></select></label>
            <label className="tracking-toggle"><input type="checkbox" checked={Boolean(pmoc.hasPmoc)} onChange={event=>setPmoc(value=>({...value,hasPmoc:event.target.checked}))}/><span><b>Possui PMOC</b><small>Vincula as execuções desta OS ao plano</small></span></label>
            <label>Número / identificação<input value={pmoc.identifier ?? ""} onChange={event=>setPmoc(value=>({...value,identifier:event.target.value}))} placeholder="PMOC-0000"/></label>
            <label>Data de implantação<input type="date" value={pmoc.implementationDate ?? ""} onChange={event=>setPmoc(value=>({...value,implementationDate:event.target.value}))}/></label>
            <label>Validade / revisão<input type="date" value={pmoc.reviewDate ?? ""} onChange={event=>setPmoc(value=>({...value,reviewDate:event.target.value}))}/></label>
            <label>Responsável técnico<input value={pmoc.technicalResponsible ?? ""} onChange={event=>setPmoc(value=>({...value,technicalResponsible:event.target.value}))} placeholder="Selecionar profissional habilitado"/></label>
            <label>Conselho profissional<input value={pmoc.professionalCouncil ?? ""} onChange={event=>setPmoc(value=>({...value,professionalCouncil:event.target.value}))} placeholder="Conselho / UF"/></label>
            <label>Registro profissional<input value={pmoc.professionalRegistration ?? ""} onChange={event=>setPmoc(value=>({...value,professionalRegistration:event.target.value}))}/></label>
            <label>ART / TRT / documento aplicável<input value={pmoc.responsibilityDocument ?? ""} onChange={event=>setPmoc(value=>({...value,responsibilityDocument:event.target.value}))}/></label>
          </div>
          <div className="pmoc-plan"><div><b>Plano de manutenção configurável</b><small>Defina a periodicidade conforme o PMOC vigente; o sistema não fixa frequências legais.</small></div>{(pmoc.plan ?? []).map((item,index)=><div className="pmoc-plan-row" key={`${item.activity}-${index}`}><input value={item.activity} onChange={event=>setPmoc(value=>({...value,plan:(value.plan??[]).map((record,itemIndex)=>itemIndex===index?{...record,activity:event.target.value}:record)}))} placeholder="Atividade (ex.: Filtros)"/><input value={item.periodicity} onChange={event=>setPmoc(value=>({...value,plan:(value.plan??[]).map((record,itemIndex)=>itemIndex===index?{...record,periodicity:event.target.value}:record)}))} placeholder="Periodicidade"/><button type="button" className="delete-action" title="Remover atividade" onClick={()=>setPmoc(value=>({...value,plan:(value.plan??[]).filter((_,itemIndex)=>itemIndex!==index)}))}><Trash2 size={14}/></button></div>)}<div className="pmoc-actions"><button type="button" className="outline-btn" onClick={()=>setPmoc(value=>({...value,plan:[...(value.plan??[]),{activity:"",periodicity:""}]}))}><Plus size={14}/> Adicionar atividade</button><button type="button" className="outline-btn" onClick={savePmoc}><CheckCircle2 size={14}/> Salvar dados do PMOC</button></div></div>
          <div className="pmoc-execution"><div><span>EXECUÇÃO DE HIGIENIZAÇÃO</span><h4>Registro por setor, sala e equipamento</h4><p>O histórico é acumulativo: uma nova execução não substitui a anterior.</p></div><div className="pmoc-grid"><label>Equipamento *<input value={pmocExecution.equipment ?? ""} onChange={event=>setPmocExecution(value=>({...value,equipment:event.target.value}))} placeholder="Código ou identificação"/></label><label>Setor / sala / ambiente<input value={pmocExecution.location ?? ""} onChange={event=>setPmocExecution(value=>({...value,location:event.target.value}))} placeholder="Unidade • setor • sala"/></label><label>Capacidade instalada (BTU/h)<input type="number" min="0" value={pmocExecution.capacityBtu ?? ""} onChange={event=>setPmocExecution(value=>({...value,capacityBtu:Number(event.target.value)||undefined}))}/></label><label>Estado antes da execução<textarea value={pmocExecution.beforeCondition ?? ""} onChange={event=>setPmocExecution(value=>({...value,beforeCondition:event.target.value}))} placeholder="Filtro, serpentina, turbina, bandeja, dreno e funcionamento..."/></label></div>
            <div className="pmoc-checklist"><b>Serviços executados *</b>{["Desmontagem","Limpeza dos filtros","Higienização da serpentina","Higienização da turbina/ventilador","Limpeza da bandeja","Limpeza/desobstrução do dreno","Limpeza da carenagem","Aplicação de sanitizante","Lubrificação","Montagem","Teste de funcionamento","Não aplicável"].map(service=><label key={service}><input type="checkbox" checked={Boolean(pmocExecution.services?.includes(service))} onChange={event=>setPmocExecution(value=>({...value,services:event.target.checked?[...(value.services??[]),service]:(value.services??[]).filter(item=>item!==service)}))}/>{service}</label>)}</div>
            <div className="pmoc-photo-pair"><label className="assistance-photo-upload"><Camera size={18}/><b>Fotos antes</b><small>{pmocBeforePhotos.length ? `${pmocBeforePhotos.length} anexo(s)` : "Conforme configuração do plano"}</small><input type="file" accept="image/*" multiple onChange={event=>void Promise.all(Array.from(event.target.files??[]).map(file=>attachPmocPhoto("before",file)))}/></label><label className="assistance-photo-upload"><Camera size={18}/><b>Fotos depois</b><small>{pmocAfterPhotos.length ? `${pmocAfterPhotos.length} anexo(s)` : "Foto geral, filtro, serpentina ou resultado"}</small><input type="file" accept="image/*" multiple onChange={event=>void Promise.all(Array.from(event.target.files??[]).map(file=>attachPmocPhoto("after",file)))}/></label></div>
            <div className="pmoc-grid"><label>Produto utilizado<input value={pmocExecution.products?.[0]?.product ?? ""} onChange={event=>setPmocExecution(value=>({...value,products:[{...(value.products?.[0]??{}),product:event.target.value}]}))} placeholder="Produto químico / material"/></label><label>Fabricante / finalidade<input value={`${pmocExecution.products?.[0]?.manufacturer ?? ""}${pmocExecution.products?.[0]?.purpose ? ` • ${pmocExecution.products?.[0]?.purpose}` : ""}`} onChange={event=>setPmocExecution(value=>({...value,products:[{...(value.products?.[0]??{}),product:value.products?.[0]?.product ?? "",manufacturer:event.target.value}]}))} placeholder="Informação documentada"/></label><label>Pendência técnica<select value={pmocExecution.pending?.[0]?.type ?? ""} onChange={event=>setPmocExecution(value=>({...value,pending:event.target.value?[{...(value.pending?.[0]??{}),type:event.target.value,description:value.pending?.[0]?.description ?? "",urgency:value.pending?.[0]?.urgency??"Normal"}]:[]}))}><option value="">Nenhuma</option>{["Filtro danificado","Vazamento","Dreno","Ruído","Oxidação","Serpentina","Motor","Turbina","Sistema elétrico","Controle","Placa","Baixo rendimento","Outro"].map(item=><option key={item}>{item}</option>)}</select></label><label>Observação / recomendação<textarea value={pmocExecution.technicalNote ?? ""} onChange={event=>setPmocExecution(value=>({...value,technicalNote:event.target.value}))} placeholder="Pendências, recomendação e detalhes técnicos..."/></label><label>Próxima manutenção<input type="date" value={pmocExecution.nextMaintenanceDate ?? ""} onChange={event=>setPmocExecution(value=>({...value,nextMaintenanceDate:event.target.value}))}/></label></div>
            <div className="pmoc-actions"><button className="primary-btn" type="button" disabled={!pmocExecution.equipment?.trim() || !(pmocExecution.services??[]).length} onClick={registerPmocExecution}><CheckCircle2 size={15}/> Registrar execução no PMOC</button><button className="outline-btn" type="button" onClick={()=>window.print()}><FileText size={15}/> Gerar certificado / relatório</button></div>
          </div>
          {(currentOrder.pmocExecutions?.length ?? 0) > 0 && <div className="pmoc-history"><b>Execuções anteriores preservadas</b>{[...(currentOrder.pmocExecutions??[])].reverse().map(item=><article key={item.id}><span><strong>{item.equipment}</strong><small>{item.location || currentOrder.unit} • {formatMoment(item.createdAt)}</small></span><em>{item.services.length} serviço(s)</em><span>{item.nextMaintenanceDate ? `Próxima: ${new Date(`${item.nextMaintenanceDate}T12:00:00`).toLocaleDateString("pt-BR")}` : "Próxima manutenção não definida"}</span></article>)}</div>}
        </section>
        <section className="preventive-engine">
          <div className="execution-head"><div><span>MANUTENÇÃO PREVENTIVA</span><h3>Garantia, revisão e alerta automático</h3></div><small>{serviceOrderReviewDate(currentOrder) ? `Próxima revisão: ${new Date(`${serviceOrderReviewDate(currentOrder)}T12:00:00`).toLocaleDateString("pt-BR")}` : "Configure a recorrência"}</small></div>
          <div className="preventive-fields"><label>Última manutenção<input type="date" value={currentOrder.lastMaintenanceDate ?? currentOrder.date ?? ""} onChange={event => update({ lastMaintenanceDate: event.target.value })}/></label><label>Garantia / revisão<select value={currentOrder.reviewPeriodMonths ?? 6} onChange={event => update({ reviewPeriodMonths: Number(event.target.value) as 3 | 6 | 12 })}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label><label>Notificar antes<input type="number" min="1" max="90" value={currentOrder.notifyDaysBefore ?? 15} onChange={event => update({ notifyDaysBefore: Math.max(1, Number(event.target.value) || 15) })}/><small>dias antes</small></label></div>
        </section>
        <section className="order-items-panel">
          <div className="order-item-tabs"><button className={itemsTab === "Serviços" ? "active" : ""} onClick={() => setItemsTab("Serviços")}><Wrench size={15}/> Serviços</button><button className={itemsTab === "Produtos" ? "active" : ""} onClick={() => setItemsTab("Produtos")}><Package size={15}/> Produtos e lembrete</button></div>
          <div className="execution-head"><div><span>{itemsTab === "Serviços" ? "SERVIÇOS DA ORDEM" : "PRODUTOS UTILIZADOS"}</span><h3>{itemsTab === "Serviços" ? "Serviços executados" : "Produtos, materiais e pós-serviço"}</h3></div><small>{currentOrder.catalogItems?.filter(item => item.kind === itemsTab.slice(0, -1)).length ?? 0} item(ns)</small></div>
          {currentOrder.catalogItems?.some(item => item.kind === itemsTab.slice(0, -1)) ? <div className="order-item-list">{currentOrder.catalogItems.filter(item => item.kind === itemsTab.slice(0, -1)).map(item => <article key={item.id}><span>{item.kind === "Produto" ? <Package size={16}/> : <Wrench size={16}/>}</span><div><b>{item.name}</b><small>{item.kind} • incluído na OS</small></div><button type="button" className="delete-action" title="Remover item" onClick={() => removeCatalogItem(item.id)}><Trash2 size={14}/></button></article>)}</div> : <div className="catalog-empty">{itemsTab === "Produtos" ? <Package size={19}/> : <Wrench size={19}/>}<span>Nenhum {itemsTab.toLowerCase()} foi vinculado a esta ordem.</span></div>}
          <div className="order-add-items"><label><Search size={14}/><input value={itemSearch} onChange={event => setItemSearch(event.target.value)} placeholder={`Buscar ${itemsTab.toLowerCase()} para adicionar após o lançamento...`}/></label>{itemSearch && <div className="order-add-results">{availableCatalogItems.slice(0,8).map(item => <button type="button" key={item.id} onClick={() => {addCatalogItem(item);setItemSearch("");}}><Plus size={13}/><span><b>{item.name}</b><small>{item.category || item.kind || "Cadastro"}</small></span></button>)}{!availableCatalogItems.length && <small>Nenhum item disponível.</small>}</div>}</div>
          {itemsTab === "Produtos" && <div className={`service-reminder ${currentOrder.reminderEnabled ? "enabled" : ""}`}>
            <div className="reminder-heading"><span><Bell size={18}/></span><div><small>RELACIONAMENTO PÓS-SERVIÇO</small><h4>Lembrete automático para o cliente</h4><p>Após o check-out, o ProAR agenda uma mensagem de manutenção ou higienização.</p></div><label className="reminder-switch"><input type="checkbox" checked={Boolean(currentOrder.reminderEnabled)} onChange={event => configureReminder({ reminderEnabled: event.target.checked })}/><i/></label></div>
            {currentOrder.reminderEnabled && <div className="reminder-fields"><label>Enviar após<input type="number" min="1" max="60" value={currentOrder.reminderAmount ?? 6} onChange={event => configureReminder({ reminderAmount: Math.max(1, Number(event.target.value) || 1) })}/></label><label>Período<select value={currentOrder.reminderUnit ?? "Meses"} onChange={event => configureReminder({ reminderUnit: event.target.value as "Dias" | "Meses" })}><option>Dias</option><option>Meses</option></select></label><label>Data prevista<input type="date" value={currentOrder.reminderDate ?? reminderDate(6, "Meses", currentOrder.checkOutAt)} onChange={event => update({ reminderDate: event.target.value })}/></label><label className="wide">Mensagem<textarea value={currentOrder.reminderMessage ?? "Olá! Está na hora de realizar a higienização preventiva do seu ar-condicionado. Vamos agendar?"} onChange={event => configureReminder({ reminderMessage: event.target.value })}/></label><div className="reminder-summary"><MessageCircle size={15}/><span><b>{customerPhone || "Cliente sem WhatsApp cadastrado"}</b><small>{currentOrder.checkOutAt ? `Agendado para ${new Date(`${currentOrder.reminderDate}T12:00:00`).toLocaleDateString("pt-BR")}` : "Será agendado automaticamente quando o técnico fizer o check-out."}</small></span></div></div>}
          </div>}
        </section>
        <section className="order-map compact-address">
          <div className="order-map-head"><div><span><MapPin size={16}/></span><div><small>ENDEREÇO DO ATENDIMENTO</small><strong>{order.address || "Endereço incompleto"}</strong><em>{order.address ? "Endereço da unidade/cliente" : "⚠ Endereço incompleto"}</em></div></div><div className="address-actions">{order.address && <a href={mapsSearch} target="_blank" rel="noreferrer"><MapPin size={13}/> Abrir no Google Maps</a>}<button type="button" disabled={!order.address} onClick={() => order.address && void navigator.clipboard?.writeText(order.address)}>Copiar endereço</button></div></div>
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
      <div className="modal-actions order-save-footer"><button className="outline-btn" onClick={requestClose}>Cancelar alterações</button>{canEdit && <button className="primary-btn" disabled={!dirty || saving || /^cancelada$/i.test(currentOrder.status)} onClick={() => void saveChanges()}>{saving ? "Salvando..." : "Salvar alterações"}</button>}<button className="outline-btn" onClick={() => window.print()}><FileText size={15}/> Imprimir ordem</button></div>
      <article className="print-service-order">
        <header className="print-order-header"><img src={company.logo || "/proar-logo.png"} alt={company.tradeName}/><div><span>ORDEM DE SERVIÇO</span><h1>{currentOrder.id}</h1><p><b>{company.tradeName}</b> • {company.legalName}</p><p>{company.cnpj ? `CNPJ/CPF: ${company.cnpj}` : "CNPJ/CPF não informado"} • {company.phone || "Telefone não informado"}</p><p>{[company.email, company.address, company.city && company.state ? `${company.city}/${company.state}` : company.city || company.state].filter(Boolean).join(" • ")}</p></div></header>
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

function CommercialRecordsManager({ title, records, onConvert, onDelete, onEdit }: { title: "Orçamentos" | "Vendas"; records: ModuleRecord[]; onConvert?: (record: ModuleRecord, target: "Pedido" | "Ordem de serviço") => void; onDelete?: (record: ModuleRecord) => void; onEdit?: (record: ModuleRecord) => void }) {
  const [query,setQuery]=useState(""); const [status,setStatus]=useState("Todos");
  const statuses=["Todos",...Array.from(new Set(records.map(item=>item.status||"Sem situação")))];
  const visible=records.filter(item=>(status==="Todos"||(item.status||"Sem situação")===status)&&`${item.id} ${item.client} ${item.name} ${item.unit||""}`.toLowerCase().includes(query.toLowerCase()));
  const total=visible.reduce((sum,item)=>sum+(item.value||0),0); const approved=records.filter(item=>/aprov|confirm|convert|fatur|conclu/i.test(item.status||"")).length;
  return <section className="commercial-manager panel"><header><div><span className="section-kicker"><FileChartColumn size={12}/> GERENCIADOR DE {title.toUpperCase()}</span><h3>Controle comercial</h3><p>{onEdit ? "Dê dois cliques no pedido para editar os dados e itens." : "Consulte, filtre e acompanhe todos os registros sem precisar abrir um por um."}</p></div><div className="commercial-kpis"><span><small>REGISTROS</small><b>{records.length}</b></span><span><small>VALOR FILTRADO</small><b>R$ {total.toLocaleString("pt-BR",{minimumFractionDigits:2})}</b></span><span><small>APROVADOS / CONCLUÍDOS</small><b>{approved}</b></span></div></header><div className="commercial-manager-toolbar"><label><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Pesquisar ${title.toLowerCase()} por cliente, número ou unidade...`}/></label><select value={status} onChange={event=>setStatus(event.target.value)}>{statuses.map(item=><option key={item}>{item}</option>)}</select></div>{visible.length?<div className="table-wrap"><table><thead><tr><th>NÚMERO</th><th>CLIENTE / UNIDADE</th><th>SITUAÇÃO</th><th>ITENS</th><th>VALOR</th><th>DATA</th><th>AÇÕES</th></tr></thead><tbody>{visible.map(record=><tr key={record.id} className={onEdit ? "editable-row" : ""} onDoubleClick={()=>onEdit?.(record)} title={onEdit ? "Dê dois cliques para alterar este pedido" : undefined}><td><b className="order-id">{record.id}</b></td><td><strong>{record.client||"—"}</strong><small className="table-description">{record.unit||"Matriz"}</small></td><td><span className={`workflow-status ${/aprov|confirm|convert|fatur|conclu/i.test(record.status||"")?"done":/cancel|reprov|vencid/i.test(record.status||"")?"blocked":""}`}>{record.status||"Registrado"}</span></td><td>{record.purchaseItems?.length??0}</td><td><b>R$ {(record.value??0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</b></td><td>{record.date?new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR"):record.createdAt}</td><td><div className="record-actions">{onEdit&&<button title="Alterar pedido" onClick={event=>{event.stopPropagation();onEdit(record)}}><Edit3 size={14}/></button>}{title==="Orçamentos"&&onConvert&&<><button title="Converter em venda" onClick={()=>onConvert(record,"Pedido")}><ShoppingBag size={14}/></button><button title="Converter em OS" onClick={()=>onConvert(record,"Ordem de serviço")}><ClipboardList size={14}/></button></>}<button title="Imprimir" onClick={()=>window.print()}><ReceiptText size={14}/></button>{onDelete&&<button className="danger" title="Excluir" onClick={()=>onDelete(record)}><Trash2 size={14}/></button>}</div></td></tr>)}</tbody></table></div>:<div className="linked-empty compact"><Search size={20}/><h4>Nenhum registro encontrado</h4><p>Altere os filtros para consultar outros registros.</p></div>}</section>;
}

function BudgetPDV({ customers, structures, catalog, budgets, onSave, onConvert, onDelete }: { customers: Customer[]; structures: ModuleRecord[]; catalog: ModuleRecord[]; budgets: ModuleRecord[]; onSave: (record: ModuleRecord) => void; onConvert: (record: ModuleRecord, target: "Pedido" | "Ordem de serviço") => void; onDelete: (record: ModuleRecord) => void }) {
  const [cart, setCart] = useState<PurchaseItem[]>([]);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"Todos" | "Produto" | "Serviço">("Todos");
  const [customer, setCustomer] = useState("");
  const [unit, setUnit] = useState("");
  const [validity, setValidity] = useState(7);
  const [priceTable, setPriceTable] = useState("Padrão");
  const [discount, setDiscount] = useState(0);
  const [surcharge, setSurcharge] = useState(0);
  const [payment, setPayment] = useState("PIX");
  const [observations, setObservations] = useState("");
  const [notice, setNotice] = useState("");
  const items = catalog.filter(item => (item.kind === "Produto" || item.kind === "Serviço") && item.status !== "Inativo" && (kindFilter === "Todos" || item.kind === kindFilter) && `${item.name} ${item.id} ${item.category}`.toLowerCase().includes(search.toLowerCase()));
  const productsTotal = cart.filter(item => item.kind === "Produto").reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
  const servicesTotal = cart.filter(item => item.kind === "Serviço").reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
  const additionalCosts = cart.filter(item => item.kind === "Custo adicional").reduce((sum, item) => sum + item.quantity * item.unitValue, 0);
  const subtotal = productsTotal + servicesTotal + additionalCosts;
  const total = Math.max(0, subtotal - discount + surcharge);
  const add = (record: ModuleRecord) => setCart(current => { const existing = current.find(item => item.productId === record.id); return existing ? current.map(item => item.productId === record.id ? { ...item, quantity: item.quantity + 1 } : item) : [...current, { id:`ORC-ITEM-${Date.now()}-${current.length}`, productId:record.id, description:record.name, quantity:1, unitValue:record.value ?? 0, kind:record.kind }]; });
  const update = (id: string, changes: Partial<PurchaseItem>) => setCart(current => current.map(item => item.id === id ? { ...item, ...changes } : item).filter(item => item.quantity > 0));
  const save = () => {
    if (!customer || !cart.length) { setNotice("Selecione o cliente e adicione pelo menos um produto ou serviço."); return; }
    const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + validity);
    const record: ModuleRecord = { id:`ORC-${Date.now().toString().slice(-6)}`, name:`Orçamento • ${customer}`, client:customer, unit, description:`Tabela: ${priceTable} • Condição: ${payment}${observations ? ` • ${observations}` : ""}`, createdAt:new Date().toLocaleString("pt-BR"), date:new Date().toISOString().slice(0,10), endDate:validUntil.toISOString().slice(0,10), status:"Em elaboração", value:total, category:"Produtos e serviços", purchaseItems:cart, paymentMethod:payment };
    onSave(record); setCart([]); setDiscount(0); setSurcharge(0); setObservations(""); setUnit(""); setNotice(`${record.id} salvo com sucesso.`);
  };
  const customerUnits = customer ? customerStructures(customer, customers, structures) : [];
  useEffect(() => {
    if (customer && !customerUnits.some(item => item.name === unit)) setUnit(customerUnits[0]?.name ?? "");
  }, [customer, customerUnits, unit]);
  return <section className="budget-pdv"><CommercialRecordsManager title="Orçamentos" records={budgets} onConvert={onConvert} onDelete={onDelete}/><div className="budget-pdv-hero"><div><span className="section-kicker"><FileText size={12}/> ORÇAMENTO RÁPIDO</span><h2>Orçamento no formato PDV</h2><p>Adicione produtos e serviços, calcule os valores e converta sem redigitação.</p></div><div><label>Cliente<select value={customer} onChange={event => {setCustomer(event.target.value);setUnit("Matriz");}}><option value="">Selecionar cliente</option>{customers.map(item => <option key={item.id}>{item.name}</option>)}</select></label>{customer && <label>Unidade / filial / setor<select value={unit} onChange={event => setUnit(event.target.value)}>{customerUnits.map(item => <option key={item.name} value={item.name}>{item.name} • {item.category || "Unidade"}</option>)}</select></label>}<label>Validade<select value={validity} onChange={event => setValidity(Number(event.target.value))}><option value={7}>7 dias</option><option value={15}>15 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option></select></label></div></div>{notice && <div className="pdv-notice"><CheckCircle2 size={15}/>{notice}<button onClick={() => setNotice("")}><X size={13}/></button></div>}<div className="budget-pdv-layout"><div className="budget-catalog panel"><div className="budget-search"><label><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar produto ou serviço..."/></label><div>{(["Todos","Produto","Serviço"] as const).map(kind => <button className={kindFilter === kind ? "active" : ""} key={kind} onClick={() => setKindFilter(kind)}>{kind}</button>)}</div></div><div className="budget-catalog-grid">{items.map(item => <button key={item.id} onClick={() => add(item)}><span className={item.kind === "Produto" ? "product" : "service"}>{item.kind === "Produto" ? <Package size={17}/> : <Wrench size={17}/>}</span><div><small>{item.id} • {item.kind}</small><b>{item.name}</b><em>{item.category || "Sem categoria"}</em></div><strong>R$ {(item.value ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong><Plus size={15}/></button>)}</div>{!items.length && <div className="linked-empty"><Search size={20}/><h4>Nenhum item encontrado</h4></div>}</div><aside className="budget-cart panel"><header><div><ShoppingCart size={17}/><span><b>Itens do orçamento</b><small>{cart.length} cadastro(s)</small></span></div>{cart.length > 0 && <button onClick={() => setCart([])}><Trash2 size={13}/> Limpar</button>}</header><div className="budget-cart-list">{cart.map(item => <article key={item.id}><div><small>{item.kind}</small><b>{item.description}</b><input type="number" min="0" step="0.01" value={item.unitValue} onChange={event => update(item.id,{unitValue:Number(event.target.value)})}/></div><label>Qtd.<input type="number" min="0.001" step="0.001" value={item.quantity} onChange={event => update(item.id,{quantity:Number(event.target.value)})}/></label><strong>R$ {(item.quantity*item.unitValue).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong><button onClick={() => setCart(current => current.filter(record => record.id !== item.id))}><Trash2 size={13}/></button></article>)}{!cart.length && <div className="pdv-empty"><ShoppingCart size={26}/><strong>Orçamento vazio</strong><p>Selecione produtos ou serviços no catálogo.</p></div>}</div><div className="budget-totals"><label>Forma de pagamento<select value={payment} onChange={event => setPayment(event.target.value)}>{["PIX","Dinheiro","Cartão de crédito","Cartão de débito","Boleto","Transferência","A combinar"].map(item => <option key={item}>{item}</option>)}</select></label><label>Desconto<input type="number" min="0" max={subtotal} value={discount || ""} onChange={event => setDiscount(Number(event.target.value))} placeholder="R$ 0,00"/></label><label className="wide">Observações<textarea value={observations} onChange={event => setObservations(event.target.value)} placeholder="Prazo, garantia e condições..."/></label><p><span>Subtotal</span><b>R$ {subtotal.toLocaleString("pt-BR",{minimumFractionDigits:2})}</b></p><div><span>TOTAL</span><strong>R$ {total.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div><button className="primary-btn" disabled={!customer || !cart.length} onClick={save}><CheckCircle2 size={16}/> Salvar orçamento</button></div></aside></div><div className="budget-saved panel"><header><div><span className="section-kicker"><History size={12}/> ORÇAMENTOS SALVOS</span><h3>Conversão rápida</h3></div><small>{budgets.length} orçamento(s)</small></header>{budgets.length ? <div>{budgets.map(record => <article key={record.id}><span><b>{record.id}</b><strong>{record.client}</strong><small>{record.purchaseItems?.length ?? 0} item(ns) • {record.endDate ? `Válido até ${new Date(`${record.endDate}T12:00:00`).toLocaleDateString("pt-BR")}` : record.createdAt}</small></span><em>{record.status}</em><b>R$ {(record.value ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</b><button onClick={() => onConvert(record,"Pedido")}><ShoppingBag size={14}/> Converter em venda</button><button onClick={() => onConvert(record,"Ordem de serviço")}><ClipboardList size={14}/> Converter em OS</button><button className="danger" onClick={() => onDelete(record)}><Trash2 size={14}/></button></article>)}</div> : <div className="linked-empty"><FileText size={22}/><h4>Nenhum orçamento salvo</h4></div>}</div></section>;
}

type TenderDocument = { sequencialDocumento?: number; tipoDocumentoNome?: string; titulo?: string; dataPublicacaoPncp?: string; url?: string; uri?: string };
type Tender = { numeroControlePNCP?: string; objetoCompra?: string; modalidadeNome?: string; dataEncerramentoProposta?: string; dataPublicacaoPncp?: string; valorTotalEstimado?: number; linkSistemaOrigem?: string; sourcePortal?: string; distanciaMirassol?: number; anoCompra?: number; sequencialCompra?: number; orgaoEntidade?: { razaoSocial?: string; cnpj?: string }; unidadeOrgao?: { municipioNome?: string; ufSigla?: string; nomeUnidade?: string } };
function BiddingModule() {
  const [tenders,setTenders]=useState<Tender[]>([]); const [query,setQuery]=useState(""); const [source,setSource]=useState("Todos"); const [radius,setRadius]=useState(300); const [loading,setLoading]=useState(true); const [warning,setWarning]=useState(""); const [lastScan,setLastScan]=useState("");
  const [selected,setSelected]=useState<Tender|null>(null); const [documents,setDocuments]=useState<TenderDocument[]>([]); const [documentLoading,setDocumentLoading]=useState(false); const [detailWarning,setDetailWarning]=useState("");
  const load=async(monitor=true)=>{setLoading(true);setWarning("");try{const url=monitor?"/api/licitacoes?monitor=1":`/api/licitacoes?raio=${radius}${query.trim()?`&q=${encodeURIComponent(query.trim())}`:""}`;const response=await fetch(url,{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error);let data=result.data??[];if(monitor&&!data.length){const direct=await fetch(`/api/licitacoes?raio=${radius}`,{cache:"no-store"});const directResult=await direct.json();if(direct.ok)data=directResult.data??[];}setTenders(data);setWarning(result.warning||"");setLastScan(result.lastScan||new Date().toISOString());}catch(error){setWarning(error instanceof Error?error.message:"Não foi possível consultar as licitações.");}finally{setLoading(false);}};
  useEffect(()=>{void load(false);},[]);
  const openDetail=async(item:Tender)=>{setSelected(item);setDocuments([]);setDetailWarning(""); if(!item.orgaoEntidade?.cnpj||!item.anoCompra||!item.sequencialCompra){setDetailWarning("Esta fonte não informou todos os identificadores necessários para consultar os anexos automaticamente. Use o portal de origem.");return;}setDocumentLoading(true);try{const params=new URLSearchParams({documents:"1",cnpj:item.orgaoEntidade.cnpj,ano:String(item.anoCompra),sequencial:String(item.sequencialCompra)});const response=await fetch(`/api/licitacoes?${params}`,{cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Falha ao consultar documentos");setDocuments(Array.isArray(result.data)?result.data:[]);if(result.warning)setDetailWarning(result.warning);}catch(error){setDetailWarning(error instanceof Error?error.message:"Não foi possível consultar edital e anexos.");}finally{setDocumentLoading(false);}};
  const visible=tenders.filter(item=>(source==="Todos"||item.sourcePortal===source)&&(`${item.objetoCompra} ${item.orgaoEntidade?.razaoSocial} ${item.unidadeOrgao?.municipioNome}`.toLowerCase().includes(query.toLowerCase()))&&(item.distanciaMirassol===undefined||item.distanciaMirassol<=radius));
  const sources=["Todos","PNCP","Compras.gov.br","BLL Compras","Licitações-e"];
  return <section className="bidding-restored"><div className="bidding-hero"><div><span className="section-kicker"><Landmark size={12}/> MONITOR DE OPORTUNIDADES</span><h2>Licitações públicas</h2><p>Busca automática diária no PNCP, Compras.gov.br, BLL Compras e Licitações-e. Dê dois cliques em uma licitação para abrir a ficha completa.</p></div><div><span><Zap size={16}/><b>Monitor automático ativo</b><small>Período de 60 dias • raio máximo de 300 km</small></span><button onClick={()=>void load(false)} disabled={loading}><RefreshCw size={15}/>{loading?"Buscando...":"Buscar agora"}</button></div></div><div className="bidding-filters panel"><label><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar objeto, órgão ou cidade..."/></label><select value={source} onChange={event=>setSource(event.target.value)}>{sources.map(item=><option key={item}>{item}</option>)}</select><label className="radius-control"><span>Raio: <b>{radius} km</b></span><input type="range" min="25" max="300" step="25" value={radius} onChange={event=>setRadius(Number(event.target.value))}/></label><button onClick={()=>void load(false)} disabled={loading}><Filter size={14}/> Aplicar busca</button></div>{warning&&<div className="bidding-warning"><AlertTriangle size={15}/>{warning}</div>}<div className="bidding-summary"><article><small>OPORTUNIDADES LOCALIZADAS</small><strong>{visible.length}</strong></article><article><small>ATÉ 300 KM DE MIRASSOL</small><strong>{visible.filter(item=>(item.distanciaMirassol??999)<=300).length}</strong></article><article><small>ÚLTIMA BUSCA AUTOMÁTICA</small><strong>{lastScan?new Date(lastScan).toLocaleString("pt-BR"):"Aguardando"}</strong></article></div>{loading?<div className="bidding-loading"><RefreshCw size={24}/>Consultando os portais públicos...</div>:visible.length?<div className="tender-grid">{visible.map((item,index)=><article key={item.numeroControlePNCP||index} className="tender-card-detail" onDoubleClick={()=>void openDetail(item)} title="Dê dois cliques para abrir todas as informações"><header><span>{item.modalidadeNome||"Licitação pública"}</span><em>{item.sourcePortal||"PNCP"}</em></header><h3>{item.objetoCompra||"Objeto não informado"}</h3><div className="tender-meta"><span><Landmark size={12}/>{item.orgaoEntidade?.razaoSocial||"Órgão não informado"}</span><span><MapPin size={12}/>{item.unidadeOrgao?.municipioNome||"Cidade não informada"}/{item.unidadeOrgao?.ufSigla||""}</span><span><Clock3 size={12}/>{item.dataEncerramentoProposta?`Encerra em ${new Date(item.dataEncerramentoProposta).toLocaleString("pt-BR")}`:"Prazo não informado"}</span></div><footer><strong>R$ {(item.valorTotalEstimado??0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong><span>{item.distanciaMirassol!==undefined?`${item.distanciaMirassol} km de Mirassol`:"Distância a confirmar"}</span><button onClick={()=>void openDetail(item)}><Eye size={13}/> Ver detalhes</button></footer></article>)}</div>:<div className="linked-empty bidding-empty"><Search size={25}/><h4>Nenhuma licitação localizada</h4><p>Use “Buscar agora” para consultar o período dos próximos 60 dias ou altere os filtros.</p></div>}{selected&&<div className="modal-layer tender-detail-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" aria-label="Fechar" onClick={()=>setSelected(null)}/><div className="modal tender-detail-modal"><div className="modal-head"><div><span>FICHA DA LICITAÇÃO</span><h2>{selected.modalidadeNome||"Licitação pública"}</h2><p>{selected.numeroControlePNCP||"Número PNCP não informado"}</p></div><button onClick={()=>setSelected(null)}><X size={18}/></button></div><div className="tender-detail-grid"><label className="wide"><small>OBJETO</small><strong>{selected.objetoCompra||"Não informado"}</strong></label><label><small>ÓRGÃO</small><strong>{selected.orgaoEntidade?.razaoSocial||"Não informado"}</strong></label><label><small>CNPJ DO ÓRGÃO</small><strong>{selected.orgaoEntidade?.cnpj||"Não informado"}</strong></label><label><small>UNIDADE</small><strong>{selected.unidadeOrgao?.nomeUnidade||"Não informada"}</strong></label><label><small>MUNICÍPIO</small><strong>{selected.unidadeOrgao?.municipioNome||"Não informado"}/{selected.unidadeOrgao?.ufSigla||""}</strong></label><label><small>PUBLICAÇÃO</small><strong>{selected.dataPublicacaoPncp?new Date(selected.dataPublicacaoPncp).toLocaleString("pt-BR"):"Não informada"}</strong></label><label><small>ENCERRAMENTO</small><strong>{selected.dataEncerramentoProposta?new Date(selected.dataEncerramentoProposta).toLocaleString("pt-BR"):"Não informado"}</strong></label><label><small>VALOR ESTIMADO</small><strong>R$ {(selected.valorTotalEstimado??0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></label><label><small>DISTÂNCIA</small><strong>{selected.distanciaMirassol!==undefined?`${selected.distanciaMirassol} km de Mirassol`:"A confirmar"}</strong></label></div><section className="tender-documents"><header><div><FileText size={17}/><span><b>Edital e documentos</b><small>Documentos oficiais vinculados à contratação.</small></span></div>{documentLoading&&<RefreshCw size={16}/>}</header>{detailWarning&&<div className="bidding-warning"><AlertTriangle size={14}/>{detailWarning}</div>}{documents.length?<div>{documents.map((doc,index)=>{const url=doc.url||doc.uri;return <article key={`${doc.sequencialDocumento||index}-${doc.titulo||"documento"}`}><span><b>{doc.titulo||doc.tipoDocumentoNome||`Documento ${index+1}`}</b><small>{doc.tipoDocumentoNome||"Documento PNCP"}{doc.dataPublicacaoPncp?` • ${new Date(doc.dataPublicacaoPncp).toLocaleDateString("pt-BR")}`:""}</small></span>{url&&<a href={url} target="_blank" rel="noreferrer"><FileText size={14}/> Baixar / abrir</a>}</article>})}</div>:!documentLoading&&<p className="tender-no-docs">Nenhum documento retornado automaticamente. O portal de origem continua disponível abaixo.</p>}</section><div className="modal-actions"><button className="outline-btn" onClick={()=>setSelected(null)}>Fechar</button>{selected.linkSistemaOrigem&&<a className="primary-btn tender-origin-link" href={selected.linkSistemaOrigem} target="_blank" rel="noreferrer">Abrir portal de origem <ArrowRight size={14}/></a>}</div></div></div>}</section>;
}

type SaleItem = { id: string; name: string; code: string; price: number; kind: "Produto" | "Serviço"; unit: string };
type CartItem = SaleItem & { quantity: number };

function SalesPDV({ customers, structures, records, sales, onSave }: { customers: Customer[]; structures: ModuleRecord[]; records: ModuleRecord[]; sales: ModuleRecord[]; onSave: (record: ModuleRecord) => void }) {
  const [salesView, setSalesView] = useState<"nova" | "historico" | "caixa">("nova");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"itens" | "cliente" | "pagamento" | "opcoes">("itens");
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState("");
  const [unit, setUnit] = useState("");
  const [payment, setPayment] = useState("PIX");
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([]);
  const [priceTable, setPriceTable] = useState("Padrão");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [recentItemId, setRecentItemId] = useState("");
  const [notice, setNotice] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [editingSale, setEditingSale] = useState<ModuleRecord | null>(null);
  const pdvRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const quickSaleCatalog: SaleItem[] = records.filter(item => (item.kind === "Produto" || item.kind === "Serviço") && item.status !== "Inativo").map(item => ({ id:item.id, name:item.name, code:item.id, price:item.value ?? 0, kind:item.kind!, unit:item.unitOfMeasure || (item.kind === "Serviço" ? "serviço" : "un") }));
  const filteredCatalog = quickSaleCatalog.filter(item => `${item.name} ${item.code} ${item.kind}`.toLowerCase().includes(search.toLowerCase()));
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discount);
  const paidTotal = payments.reduce((sum, entry) => sum + Math.max(0, entry.amount || 0), 0);
  const hasCashPayment = payments.some(entry => entry.method === "Dinheiro" && entry.amount > 0);
  const nonCashOverpayment = paidTotal > total && !hasCashPayment;
  const remaining = Math.max(0, total - paidTotal);
  const change = hasCashPayment ? Math.max(0, paidTotal - total) : 0;
  const selectedCustomer = customers.find(item => item.name === customer);
  const customerUnits = customer ? customerStructures(customer, customers, structures) : [];
  useEffect(() => {
    if (customer && !customerUnits.some(item => item.name === unit)) setUnit(customerUnits[0]?.name ?? "");
  }, [customer, customerUnits, unit]);

  const markRecentItem = (id: string) => {
    setRecentItemId(id);
    window.setTimeout(() => setRecentItemId(current => current === id ? "" : current), 1500);
  };
  const addItem = (item: SaleItem, quantity = 1) => {
    setCart(current => {
    const existing = current.find(record => record.id === item.id);
    if (existing) return [{ ...existing, quantity: existing.quantity + quantity }, ...current.filter(record => record.id !== item.id)];
    return [{ ...item, quantity } , ...current];
    });
    setSelectedItemId(item.id); markRecentItem(item.id);
    requestAnimationFrame(() => searchRef.current?.focus());
  };
  const launchCommand = () => {
    const command = search.trim();
    if (!command) return;
    const match = command.match(/^(\d+(?:[.,]\d+)?)\s*(?:x|\*)\s*(.+)$/i);
    const quantity = match ? Number(match[1].replace(",", ".")) : 1;
    const term = (match?.[2] ?? command).trim().toLocaleLowerCase("pt-BR");
    const item = quickSaleCatalog.find(record => `${record.code} ${record.name}`.toLocaleLowerCase("pt-BR") === term)
      ?? quickSaleCatalog.find(record => `${record.code} ${record.name}`.toLocaleLowerCase("pt-BR").includes(term));
    if (!item) { setNotice("Produto ou serviço não encontrado."); return; }
    addItem(item, quantity);
    setSearch("");
  };
  const formatQuantity = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const changeQuantity = (id: string, amount: number) => setCart(current => current
    .map(item => item.id === id ? { ...item, quantity: Math.round((item.quantity + amount) * 1000) / 1000 } : item)
    .filter(item => item.quantity > 0));
  const typeQuantity = (id: string, raw: string) => {
    setQuantityDrafts(current => ({ ...current, [id]: raw }));
    const quantity = Number(raw.trim().replace(",", "."));
    if (Number.isFinite(quantity) && quantity > 0) setCart(current => current.map(item => item.id === id ? { ...item, quantity: Math.round(quantity * 1000) / 1000 } : item));
  };
  const confirmQuantity = (item: CartItem) => {
    const raw = quantityDrafts[item.id];
    const quantity = raw === undefined ? item.quantity : Number(raw.trim().replace(",", "."));
    setQuantityDrafts(current => ({ ...current, [item.id]: Number.isFinite(quantity) && quantity > 0 ? formatQuantity(Math.round(quantity * 1000) / 1000) : formatQuantity(item.quantity) }));
  };
  const finishSale = () => {
    if (!cart.length) {
      setNotice("Adicione pelo menos um item à venda.");
      return;
    }
    if (remaining > 0) { setNotice(`Falta pagar R$ ${remaining.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`); setActiveTab("pagamento"); return; }
    if (nonCashOverpayment) { setNotice("Valor informado superior ao total da venda. Ajuste o pagamento."); setActiveTab("pagamento"); return; }
    if (selectedCustomer?.financialStatus === "Bloqueado") { setNotice("Cliente bloqueado pelo financeiro. A venda não pode ser concluída."); return; }
    if (selectedCustomer?.creditLimit && (selectedCustomer.balancePosted ?? 0) + total > selectedCustomer.creditLimit && payment === "Boleto") { setNotice("Limite de crédito excedido para venda a prazo. Solicite liberação do financeiro."); return; }
    const sale: ModuleRecord = {
      ...(editingSale ?? {}), id: editingSale?.id ?? `VEN-${Date.now().toString().slice(-6)}`, name:`Venda • ${customer || "Consumidor final"}`, client:customer || "Consumidor final", unit, paymentMethod:payment, value:total, status:editingSale?.status || "Pedido confirmado", category:"Venda PDV", description:`Subtotal R$ ${subtotal.toLocaleString("pt-BR",{minimumFractionDigits:2})} • desconto R$ ${discount.toLocaleString("pt-BR",{minimumFractionDigits:2})}`, purchaseItems:cart.map(item=>({id:item.id,productId:item.id,description:item.name,quantity:item.quantity,unitValue:item.price,kind:item.kind})), createdAt:editingSale?.createdAt ?? new Date().toLocaleString("pt-BR"), date:editingSale?.date ?? new Date().toISOString().slice(0,10)
    };
    onSave(sale);
    setCart([]); setDiscount(0); setPayments([]); setCustomer(""); setUnit("Matriz"); setActiveTab("itens"); setEditingSale(null);
    setNotice(editingSale ? `Pedido ${sale.id} atualizado e sincronizado.` : `Venda ${sale.id} finalizada e sincronizada — R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`);
  };
  const editSavedSale = (sale: ModuleRecord) => {
    setEditingSale(sale); setCustomer(sale.client === "Consumidor final" ? "" : sale.client); setUnit(sale.unit || ""); setPayment(sale.paymentMethod || "PIX");
    const match = sale.description?.match(/desconto R\$ ([\d.,]+)/i); setDiscount(match ? Number(match[1].replace(".","").replace(",",".")) || 0 : 0);
    setCart((sale.purchaseItems ?? []).map(item => ({ id:item.productId || item.id, name:item.description, code:item.productId || item.id, price:item.unitValue, quantity:item.quantity, kind:item.kind === "Serviço" ? "Serviço" : "Produto", unit:records.find(record => record.id === (item.productId || item.id))?.unitOfMeasure || "un" })));
    setActiveTab("itens"); setNotice(`Editando ${sale.id}. Ajuste os itens e clique em “Atualizar pedido”.`);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F1") { event.preventDefault(); setActiveTab("cliente"); }
      if (event.key === "F2") { event.preventDefault(); setShortcutsOpen(value => !value); }
      if (event.key === "F3") { event.preventDefault(); setActiveTab("opcoes"); }
      if (event.key === "F4") { event.preventDefault(); setActiveTab("pagamento"); }
      if (event.key === "F5") { event.preventDefault(); setSalesView("historico"); }
      if (event.key === "F6") { event.preventDefault(); setActiveTab("itens"); searchRef.current?.focus(); }
      if (event.key === "F7") { event.preventDefault(); setActiveTab("pagamento"); }
      if (event.key === "F8") { event.preventDefault(); if (selectedItemId) setCart(current => current.filter(item => item.id !== selectedItemId)); }
      if (event.key === "F9") { event.preventDefault(); if (cart.length && window.confirm("Cancelar a venda atual?")) { setCart([]); setSelectedItemId(""); setNotice("Venda atual cancelada. Nenhum histórico foi alterado."); } }
      if (event.key === "F10") { event.preventDefault(); setActiveTab("opcoes"); }
      if (event.key === "F11") { event.preventDefault(); setNotice("Vendedor: utilizador atual."); }
      if (event.key === "F12") { event.preventDefault(); setSalesView("nova"); setShortcutsOpen(false); }
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
    <div className="sales-top"><h2>Vendas</h2><button className="primary-btn" onClick={()=>{setSalesView("nova");searchRef.current?.focus();}}><Plus size={15}/> Nova venda</button></div>
    <nav className="sales-mode-tabs"><button className={salesView === "nova" ? "active" : ""} onClick={()=>setSalesView("nova")}>Nova venda</button><button className={salesView === "historico" ? "active" : ""} onClick={()=>setSalesView("historico")}>Histórico</button><button className={salesView === "caixa" ? "active" : ""} onClick={()=>setSalesView("caixa")}>Caixa</button></nav>
    {salesView === "historico" ? <CommercialRecordsManager title="Vendas" records={sales} onEdit={editSavedSale}/> : salesView === "caixa" ? <div className="panel pdv-cash-panel"><h3>Caixa</h3><p>Acompanhe as vendas confirmadas e os recebimentos do turno.</p><strong>R$ {sales.filter(item=>item.status !== "Cancelada").reduce((sum,item)=>sum+(item.value??0),0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div> : <>
    <div className="pdv-command">
      <div><span className="section-kicker"><ShoppingBag size={12}/> VENDA RÁPIDA</span><h2>PDV ProAR</h2><p>Produtos e serviços em um fluxo direto, sem campos desnecessários.</p></div>
      <div className="pdv-shortcuts"><button onClick={toggleFullScreen}><Grid2X2 size={14}/>{fullScreen ? "Sair da tela cheia" : "Maximizar PDV"}</button><button onClick={() => setShortcutsOpen(true)}><Keyboard size={14}/><kbd>F1</kbd> Atalhos</button><span>Caixa aberto</span></div>
    </div>
    <div className="pdv-context"><label>Cliente<select value={customer} onChange={event=>{setCustomer(event.target.value);setUnit("");}}><option value="">Consumidor final</option>{customers.map(item=><option key={item.doc} value={item.name}>{item.name}</option>)}</select></label><label>Tabela de preço<select value={priceTable} onChange={event=>setPriceTable(event.target.value)}><option>Padrão</option><option>Varejo</option><option>Atacado</option><option>Construtora</option><option>Cliente especial</option></select></label><div className="pdv-top-total"><small>TOTAL DA VENDA</small><strong>R$ {total.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong></div><button className="outline-btn" onClick={()=>setShortcutsOpen(true)}><Keyboard size={14}/> Atalhos</button><button className="outline-btn" onClick={()=>setActiveTab("opcoes")}><MoreHorizontal size={14}/> Mais opções</button></div>
    {notice && <div className="pdv-notice"><CheckCircle2 size={15}/>{notice}<button onClick={() => setNotice("")}><X size={13}/></button></div>}
    <nav className="pdv-tabs" aria-label="Etapas da venda">
      <button className={activeTab === "itens" ? "active" : ""} onClick={() => setActiveTab("itens")}><ScanBarcode size={15}/><span>Itens</span><kbd>F2</kbd></button>
      <button className={activeTab === "cliente" ? "active" : ""} onClick={() => setActiveTab("cliente")}><UserRound size={15}/><span>Cliente</span><kbd>F3</kbd></button>
      <button className={activeTab === "pagamento" ? "active" : ""} onClick={() => setActiveTab("pagamento")}><CreditCard size={15}/><span>Pagamento</span><kbd>F4</kbd></button>
      <button className={activeTab === "opcoes" ? "active" : ""} onClick={() => setActiveTab("opcoes")}><MoreHorizontal size={15}/><span>Mais opções</span><kbd>F8</kbd></button>
    </nav>
    <div className="pdv-operational-grid"><aside className="pdv-function-keys" aria-label="Atalhos do PDV">{[["F1","Cliente"],["F2","Menu"],["F3","Operações"],["F4","Pagamento"],["F5","Recuperar venda"],["F6","Pesquisar"],["F7","Finalizar"],["F8","Cancelar item"],["F9","Cancelar venda"],["F10","Desconto"],["F11","Vendedor"],["F12","Sair"]].map(([key,label])=><button key={key} onClick={()=>key==="F4"||key==="F7"?setActiveTab("pagamento"):key==="F1"?setActiveTab("cliente"):key==="F5"?setSalesView("historico"):key==="F6"?searchRef.current?.focus():key==="F10"?setActiveTab("opcoes"):key==="F8"&&selectedItemId?setCart(current=>current.filter(item=>item.id!==selectedItemId)):undefined}><kbd>{key}</kbd><span>{label}</span></button>)}</aside><div className="pdv-layout">
      <div className="pdv-workspace panel">
        {activeTab === "itens" && <>
          <label className="pdv-search"><Search size={19}/><input ref={searchRef} autoFocus value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();launchCommand();}}} placeholder="Código, produto ou 10xCÓDIGO"/><kbd>F6</kbd></label>
          <div className="pdv-catalog">{filteredCatalog.map(item => <button key={item.id} onClick={() => addItem(item)}>
            <span className={item.kind === "Serviço" ? "service" : "product"}>{item.kind === "Serviço" ? <Wrench size={17}/> : <Package size={17}/>}</span>
            <div><small>{item.code} • {item.kind}</small><strong>{item.name}</strong></div>
            <b>R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / {item.unit}</b><Plus size={16}/>
          </button>)}</div>
          {!filteredCatalog.length && <div className="linked-empty"><Package size={23}/><h4>Nenhum produto ou serviço cadastrado</h4><p>Cadastre os itens reais nos módulos Produtos e Serviços.</p></div>}
        </>}
        {activeTab === "cliente" && <div className="pdv-hidden-panel"><div className="pdv-panel-title"><UserRound size={20}/><div><h3>Cliente da venda</h3><p>Opcional para vendas rápidas.</p></div></div><label>Selecionar cliente<select value={customer} onChange={event => {setCustomer(event.target.value);setUnit("");}}><option value="">Consumidor final</option>{customers.map(item => <option key={item.doc} value={item.name}>{item.name} • {item.doc}</option>)}</select></label>{customer && <>{customerUnits.length ? <label>Unidade / filial / setor<select value={unit} onChange={event=>setUnit(event.target.value)}>{customerUnits.map(item=><option key={item.name} value={item.name}>{item.name} • {item.category || "Unidade"}</option>)}</select></label> : <p className="field-hint">Nenhuma unidade/filial/setor cadastrado para este cliente.</p>}<div className={`credit-check ${selectedCustomer?.financialStatus === "Bloqueado" ? "blocked" : ""}`}><CircleDollarSign size={17}/><div><b>Crédito</b><small>Disponível R$ {Math.max(0,(selectedCustomer?.creditLimit ?? 0)-(selectedCustomer?.balancePosted ?? 0)).toLocaleString("pt-BR",{minimumFractionDigits:2})}</small></div><strong>{selectedCustomer?.financialStatus ?? "Liberado"}</strong></div></>}<button className="outline-btn"><Plus size={14}/> Cadastro rápido</button></div>}
        {activeTab === "pagamento" && <div className="pdv-hidden-panel"><div className="pdv-panel-title"><CreditCard size={20}/><div><h3>Pagamentos</h3><p>Informe uma ou mais formas de pagamento.</p></div></div><div className="payment-grid">{["PIX", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Boleto", "Outros"].map(option => <button className={payment === option ? "active" : ""} key={option} onClick={() => { setPayment(option); setPayments(current => current.some(item => item.method === option) ? current : [...current, {method:option, amount:0}]); }}>{option}</button>)}</div><div className="pdv-payment-lines">{payments.map((entry,index)=><label key={`${entry.method}-${index}`}>{entry.method}<input type="number" min="0" step="0.01" value={entry.amount || ""} onChange={event=>setPayments(current=>current.map((item,i)=>i===index?{...item,amount:Number(event.target.value)||0}:item))}/><button type="button" onClick={()=>setPayments(current=>current.filter((_,i)=>i!==index))}><X size={13}/></button></label>)}</div><div className="pdv-payment-check"><span>Total da venda <b>R$ {total.toLocaleString("pt-BR",{minimumFractionDigits:2})}</b></span><span>Total informado <b>R$ {paidTotal.toLocaleString("pt-BR",{minimumFractionDigits:2})}</b></span><span>Falta pagar <b>R$ {remaining.toLocaleString("pt-BR",{minimumFractionDigits:2})}</b></span><span>Troco <b>R$ {change.toLocaleString("pt-BR",{minimumFractionDigits:2})}</b></span>{nonCashOverpayment && <em>Valor informado superior ao total da venda. Ajuste o pagamento.</em>}</div></div>}
        {activeTab === "opcoes" && <div className="pdv-hidden-panel"><div className="pdv-panel-title"><Tag size={20}/><div><h3>Opções da venda</h3><p>Recursos menos utilizados ficam ocultos aqui.</p></div></div><label>Desconto em reais<input type="number" min="0" max={subtotal} value={discount || ""} onChange={event => setDiscount(Number(event.target.value))} placeholder="R$ 0,00"/></label><label>Observações<textarea placeholder="Informações adicionais para o comprovante..."/></label></div>}
      </div>
      <aside className="pdv-cart panel">
        <div className="pdv-cart-head"><div><ReceiptText size={17}/><span><strong>Venda atual</strong><small>{formatQuantity(cart.reduce((sum, item) => sum + item.quantity, 0))} item(ns)</small></span></div>{cart.length > 0 && <button onClick={() => setCart([])}><Trash2 size={13}/> Limpar</button>}</div>
        <div className="pdv-cart-items">{cart.length ? cart.map(item => <article className={`${selectedItemId===item.id?"selected":""} ${recentItemId===item.id?"recent":""}`} key={item.id} onClick={()=>setSelectedItemId(item.id)}><div><small>{item.code}</small><strong>{item.name}</strong><span>R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / {item.unit}</span></div><div className="quantity"><button onClick={event => { event.stopPropagation(); changeQuantity(item.id, -1); }} aria-label="Diminuir quantidade"><Minus size={12}/></button><label><input className="quantity-input" inputMode="decimal" value={quantityDrafts[item.id] ?? formatQuantity(item.quantity)} onClick={event=>event.stopPropagation()} onChange={event => typeQuantity(item.id, event.target.value)} onBlur={() => confirmQuantity(item)} aria-label={`Quantidade de ${item.name}`}/><small>{item.unit}</small></label><button onClick={event => { event.stopPropagation(); changeQuantity(item.id, 1); }} aria-label="Aumentar quantidade"><Plus size={12}/></button></div><b>R$ {(item.price * item.quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></article>) : <div className="pdv-empty"><ShoppingCart size={29}/><strong>Carrinho vazio</strong><p>Leia um código ou pesquise um produto para iniciar.</p></div>}</div>
        <div className="pdv-summary"><p><span>Subtotal</span><b>R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></p>{discount > 0 && <p className="discount"><span>Desconto</span><b>− R$ {discount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></p>}<div><span>TOTAL</span><strong>R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div><small>{customer || "Consumidor final"} • {payment}</small><button className="finish-sale" disabled={!cart.length} onClick={finishSale}><CheckCircle2 size={17}/>{editingSale ? "Atualizar pedido" : "Finalizar venda"}<kbd>F10</kbd></button></div>
      </aside>
    </div></div>
    {shortcutsOpen && <div className="shortcut-layer" role="dialog" aria-modal="true" aria-label="Atalhos do PDV"><button className="modal-backdrop" onClick={() => setShortcutsOpen(false)} aria-label="Fechar atalhos"/><div className="shortcut-card"><div><span><Keyboard size={19}/></span><div><small>PDV PROAR</small><h3>Atalhos de teclado</h3></div><button onClick={() => setShortcutsOpen(false)} aria-label="Fechar"><X size={16}/></button></div>{[["F1","Abrir esta ajuda"],["F2","Pesquisar produto ou serviço"],["F3","Selecionar cliente"],["F4","Forma de pagamento"],["F8","Desconto e outras opções"],["F10","Finalizar a venda"],["ESC","Fechar janela"]].map(([key,label]) => <p key={key}><kbd>{key}</kbd><span>{label}</span></p>)}</div></div>}
    </>}
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

function ContextReports({ title, options, rows = [] }: { title: string; options: string[]; rows?: string[][] }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const generate = (option: string, excel = false) => {
    if (!rows.length) {
      setNotice("Não há dados para gerar este relatório com os filtros atuais.");
      return;
    }
    const filename = `${title}-${option}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").toLowerCase();
    if (excel) downloadCsv(`${filename}.xls`, [["Relatório", option], ["Contexto", title], ["Gerado em", new Date().toLocaleString("pt-BR")], [], ...rows]); else window.print();
    setOpen(false);
  };
  return <div className="context-reports"><button className="outline-btn" onClick={()=>setOpen(value=>!value)}><FileChartColumn size={14}/> Relatórios <ChevronDown size={13}/></button>{notice && <small className="context-report-notice">{notice}</small>}{open && <div className="context-report-menu"><b>RELATÓRIOS DESTE REGISTRO</b>{options.map(option=><button key={option} onClick={()=>generate(option)}>{option}<FileText size={13}/></button>)}<footer><button onClick={()=>generate(options[0] || "Relatório",true)}><ArrowDownRight size={13}/> Exportar Excel</button><button onClick={()=>generate(options[0] || "Relatório")}><FileText size={13}/> Gerar PDF</button></footer></div>}</div>;
}

function Reports({ modules, customers, serviceOrders, company }: { modules: Record<string, ModuleRecord[]>; customers: Customer[]; serviceOrders: ServiceOrder[]; company: TenantCompany }) {
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
    <div className="report-print-company-header"><div>{company.logo ? <img src={company.logo} alt={company.tradeName}/> : null}</div><div><h1>{company.tradeName || company.legalName}</h1><p>{company.legalName}</p><small>{company.cnpj ? `CNPJ/CPF: ${company.cnpj}` : "CNPJ/CPF não informado"}</small><small>{[company.phone, company.email].filter(Boolean).join(" • ")}</small><small>{[company.address, company.city && company.state ? `${company.city}/${company.state}` : company.city || company.state].filter(Boolean).join(" • ")}</small></div></div>
    <div className="management-hero"><div><span className="section-kicker"><FileChartColumn size={12}/> INTELIGÊNCIA GERENCIAL</span><h2>Central de relatórios</h2><p>Indicadores comerciais, operacionais, financeiros e administrativos com dados reais do ProAR.</p></div><div className="management-actions"><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Imprimir</button><button className="primary-btn" onClick={exportSummary}><ArrowDownRight size={14}/> Exportar resumo</button></div></div>
    <div className="report-kpis"><article><small>TOTAL FATURADO</small><strong>R$ {billed.toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></article><article><small>TOTAL PENDENTE</small><strong>R$ {pending.toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></article><article><small>OS CONCLUÍDAS</small><strong>{filteredOrders.filter(order => order.status === "Concluída").length}</strong></article><article><small>REGISTROS FILTRADOS</small><strong>{Object.values(filteredModules).reduce((sum, records) => sum + records.length, 0)}</strong></article></div>
    <div className="report-filter-bar"><label>Data inicial<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)}/></label><label>Data final<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)}/></label><label>Situação<select value={status} onChange={event => setStatus(event.target.value)}><option>Todas</option><option>Ativo</option><option>Pendente</option><option>Concluído</option><option>Vencida</option><option>Paga</option></select></label><label>Cliente<select value={client} onChange={event => setClient(event.target.value)}><option>Todos</option>{customers.map(customer => <option key={customer.id}>{customer.name}</option>)}</select></label><label>Técnico<select value={technician} onChange={event => setTechnician(event.target.value)}><option>Todos</option>{[...new Set(serviceOrders.map(order => order.tech).filter(Boolean))].map(name => <option key={name}>{name}</option>)}</select></label><label>Pagamento<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option>Todas</option><option>Pix</option><option>Boleto</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option></select></label><div className="report-active-filter"><Filter size={14}/><span>{selectedReport}</span><button onClick={() => { setStartDate(""); setEndDate(""); setStatus("Todas"); setClient("Todos"); setTechnician("Todos"); setPaymentMethod("Todas"); }}>Limpar</button></div></div>
    <div className="report-grid">{reportGroups.map(({ title, icon: Icon, count, items }) => <article className="report-card" key={title}><div className="report-card-head"><span><Icon size={20}/></span><div><small>MÓDULO</small><h3>{title}</h3></div><b>{count}</b></div><div className="report-links">{items.map(item => <button className={selectedReport === item ? "active" : ""} onClick={() => setSelectedReport(item)} key={item}>{item}<ChevronRight size={13}/></button>)}</div><footer><button onClick={() => window.print()}><FileText size={13}/> PDF</button><button onClick={() => downloadCsv(`relatorio-${title.toLowerCase()}.xls`, [["Relatório", selectedReport], ["Período", startDate || "Início", endDate || "Hoje"], ["Situação", status], ["Cliente", client], ["Técnico", technician], ["Pagamento", paymentMethod], ["Total", String(count)]])}><ArrowDownRight size={13}/> Excel</button><button onClick={() => downloadCsv(`relatorio-${title.toLowerCase()}.csv`, [["Relatório", selectedReport], ["Total", String(count)]])}><ArrowDownRight size={13}/> CSV</button></footer></article>)}</div>
  </section>;
}

function FinancialModule({ records, onOpen, onUpdate, onIssueInvoice }: { records: ModuleRecord[]; onOpen: (name: string) => void; onUpdate: (record: ModuleRecord) => Promise<boolean>; onIssueInvoice: (record: ModuleRecord, invoiceNumber: string) => Promise<boolean> }) {
  const [view, setView] = useState<"Títulos" | "Fluxo de caixa">("Títulos");
  const [titleFilter, setTitleFilter] = useState<"Todos" | "Recebimentos" | "Pagamentos">("Todos");
  const [settling, setSettling] = useState<ModuleRecord | null>(null);
  const [amount, setAmount] = useState(0);
  const [interest, setInterest] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState("Pix");
  const [account, setAccount] = useState("Conta bancária");
  const [invoicing, setInvoicing] = useState<ModuleRecord | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const outstanding = (record: ModuleRecord) => Math.max(0, (record.value ?? 0) - (record.settledValue ?? 0));
  const isFullySettled = (record: ModuleRecord) => /Cancelada/i.test(record.status || "") || outstanding(record) <= 0.009;
  const open = records.filter(record => !isFullySettled(record));
  const realized = records.filter(record => (record.settledValue ?? 0) > 0 || /^(Paga|Recebida)$/i.test(record.status || ""));
  const payable = (record: ModuleRecord) => record.transactionType === "Pagar" || /pagar|compra|fornecedor/i.test(`${record.name} ${record.category}`);
  const visibleRecords = records.filter(record => titleFilter === "Todos" || (titleFilter === "Pagamentos" ? payable(record) : !payable(record)));
  const totalOpen = (items: ModuleRecord[]) => items.reduce((sum, record) => sum + financialOutstandingValue(record), 0);
  const totalRealized = (items: ModuleRecord[]) => items.reduce((sum, record) => sum + financialRealizedValue(record), 0);
  const incoming = realized.filter(record => !payable(record));
  const outgoing = realized.filter(payable);
  const maxChart = Math.max(1, totalRealized(incoming), totalRealized(outgoing), totalOpen(open.filter(record => !payable(record))), totalOpen(open.filter(payable)));
  const startSettlement = (record: ModuleRecord) => { setSettling(record); setAmount(Math.max(0, (record.value ?? 0) - (record.settledValue ?? 0))); setInterest(0); setDiscount(0); };
  const settle = async () => {
    if (!settling) return;
    const finalValue = Math.max(0, amount + interest - discount);
    if (finalValue <= 0) { setMessage("Informe um valor de baixa maior que zero."); return; }
    const accumulated = (settling.settledValue ?? 0) + finalValue;
    const nominalValue = Math.max(0, settling.value ?? 0);
    const isPaid = accumulated >= nominalValue;
    setSaving(true); setMessage("Salvando...");
    const createdAt = new Date().toISOString();
    const saved = await onUpdate({ ...settling, transactionType: payable(settling) ? "Pagar" : "Receber", settledValue: Math.min(nominalValue, accumulated), settlementDate: createdAt.slice(0, 10), settlementMethod: method, settlementAccount: account, interestValue: (settling.interestValue ?? 0) + interest, discountValue: (settling.discountValue ?? 0) + discount, settlementHistory: [...(settling.settlementHistory ?? []), { id:`BAIXA-${Date.now()}`, value:finalValue, interest, discount, method, account, createdAt }], status: isPaid ? (payable(settling) ? "Paga" : "Recebida") : (payable(settling) ? "Paga parcialmente" : "Recebida parcialmente") });
    setSaving(false);
    if (!saved) { setMessage("Não foi possível salvar a alteração."); return; }
    setSettling(null); setMessage("✓ Alteração efetuada");
  };
  const issueInvoice = async () => {
    if (!invoicing || !invoiceNumber.trim() || saving) { setMessage("Informe o número da Nota Fiscal."); return; }
    setSaving(true); setMessage("Salvando...");
    const saved = await onIssueInvoice(invoicing, invoiceNumber.trim());
    setSaving(false);
    if (!saved) { setMessage("Não foi possível salvar a alteração."); return; }
    setInvoicing(null); setInvoiceNumber(""); setMessage("✓ Alteração efetuada");
  };
  return <section className="module-page financial-module">
    <div className="management-hero"><div><span className="section-kicker"><WalletCards size={12}/> CONTROLE FINANCEIRO</span><h2>Financeiro e fluxo de caixa</h2><p>Separe compromissos previstos da movimentação efetivamente liquidada.</p></div><div className="management-actions"><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Relatório</button><button className="primary-btn" onClick={() => onOpen("Novo registro • Financeiro")}><Plus size={15}/> Novo lançamento</button></div></div>
    {message && <div className="public-contract-message"><CheckCircle2 size={15}/>{message}</div>}
    <div className="finance-kpis"><article><small>A RECEBER</small><strong>R$ {totalOpen(open.filter(record => !payable(record))).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong><span>Saldo pendente</span></article><article><small>A PAGAR</small><strong>R$ {totalOpen(open.filter(payable)).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong><span>Saldo pendente</span></article><article><small>ENTRADAS REALIZADAS</small><strong>R$ {totalRealized(incoming).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong><span>Liquidado</span></article><article><small>SALDO REALIZADO</small><strong>R$ {(totalRealized(incoming)-totalRealized(outgoing)).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong><span>Caixa e bancos</span></article></div>
    <nav className="management-tabs"><button className={view === "Títulos" ? "active" : ""} onClick={() => setView("Títulos")}>Contas a pagar e receber</button><button className={view === "Fluxo de caixa" ? "active" : ""} onClick={() => setView("Fluxo de caixa")}>Fluxo de caixa</button></nav>
    {view === "Títulos" && <nav className="management-tabs finance-title-filters" aria-label="Filtrar títulos"><button className={titleFilter === "Todos" ? "active" : ""} onClick={() => setTitleFilter("Todos")}>Todos</button><button className={titleFilter === "Recebimentos" ? "active" : ""} onClick={() => setTitleFilter("Recebimentos")}>Recebimentos</button><button className={titleFilter === "Pagamentos" ? "active" : ""} onClick={() => setTitleFilter("Pagamentos")}>Pagamentos</button></nav>}
    {view === "Fluxo de caixa" ? <div className="cashflow-panel panel"><div className="panel-head"><div><span className="section-kicker"><ChartNoAxesCombined size={12}/> PREVISTO × REALIZADO</span><h2>Movimentação consolidada</h2><p>Comparativo dos títulos cadastrados e efetivamente baixados.</p></div></div><div className="cashflow-chart">{[{label:"Receitas previstas",value:totalOpen(open.filter(record => !payable(record))),tone:"blue"},{label:"Receitas realizadas",value:totalRealized(incoming),tone:"green"},{label:"Despesas previstas",value:totalOpen(open.filter(payable)),tone:"orange"},{label:"Despesas realizadas",value:totalRealized(outgoing),tone:"red"}].map(item => <div key={item.label}><span><b>{item.label}</b><strong>R$ {item.value.toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></span><i><b className={item.tone} style={{width:`${Math.max(2,item.value/maxChart*100)}%`}}/></i></div>)}</div><div className="cashflow-balance"><span>Saldo acumulado realizado</span><strong>R$ {(totalRealized(incoming)-totalRealized(outgoing)).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></div></div> : <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><ReceiptText size={12}/> TÍTULOS</span><h2>Liquidação de contas</h2><p>{visibleRecords.filter(record => !isFullySettled(record)).length} título(s) aguardando baixa</p></div></div><div className="table-wrap"><table><thead><tr><th>DESCRIÇÃO</th><th>TIPO</th><th>VENCIMENTO</th><th>VALOR</th><th>LIQUIDADO / RESTANTE</th><th>SITUAÇÃO</th><th>AÇÃO</th></tr></thead><tbody>{visibleRecords.map(record => <tr key={record.id}><td><strong>{record.name}</strong><small className="table-description">{record.invoiceNumber ? `NF ${record.invoiceNumber} • ` : ""}{record.client || record.category}</small></td><td>{payable(record) ? "A pagar" : "A receber"}</td><td>{record.date ? new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td><td><b>R$ {(record.value ?? 0).toLocaleString("pt-BR", {minimumFractionDigits:2})}</b></td><td><b>R$ {(record.settledValue ?? 0).toLocaleString("pt-BR", {minimumFractionDigits:2})}</b><small className="table-description">Restante: R$ {outstanding(record).toLocaleString("pt-BR", {minimumFractionDigits:2})}</small></td><td><span className={`workflow-status ${isFullySettled(record) ? "done" : ""}`}>{record.status || "Em aberto"}</span></td><td>{record.status === "Pronto para faturar" ? <button className="settle-button" onClick={()=>{setInvoicing(record);setInvoiceNumber("")}}><ReceiptText size={14}/> Emitir NF</button> : outstanding(record) > 0.009 && !/Cancelada/i.test(record.status || "") ? <button className="settle-button" onClick={() => startSettlement(record)}><HandCoins size={14}/> Dar baixa</button> : <span className="settled-label"><CheckCircle2 size={13}/> Liquidado</span>}</td></tr>)}</tbody></table></div>{!visibleRecords.length && <div className="linked-empty"><WalletCards size={22}/><h4>Nenhum lançamento financeiro</h4><p>Não há títulos para este filtro.</p></div>}</div>}
    {settling && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Baixar título"><button className="modal-backdrop" onClick={() => !saving && setSettling(null)} aria-label="Fechar"/><div className="modal settlement-modal"><div className="modal-head"><div><span>BAIXA FINANCEIRA</span><h2>{settling.name}</h2><p>Liquidação parcial ou total com rastreabilidade.</p></div><button disabled={saving} onClick={() => setSettling(null)}><X size={18}/></button></div><div className="settlement-form"><label>Valor da baixa<input type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(Number(event.target.value)||0)}/></label><label>Juros / multa<input type="number" min="0" step="0.01" value={interest} onChange={event => setInterest(Number(event.target.value)||0)}/></label><label>Desconto<input type="number" min="0" step="0.01" value={discount} onChange={event => setDiscount(Number(event.target.value)||0)}/></label><label>Forma de pagamento<select value={method} onChange={event => setMethod(event.target.value)}><option>Pix</option><option>Boleto</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option><option>Transferência</option></select></label><label>Conta / caixa de destino<select value={account} onChange={event => setAccount(event.target.value)}><option>Conta bancária</option><option>Caixa</option><option>Conta digital</option><option>Cartão</option></select></label><div className="settlement-total"><span>VALOR EFETIVO</span><strong>R$ {Math.max(0,amount+interest-discount).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></div></div><div className="modal-actions"><button className="outline-btn" disabled={saving} onClick={() => setSettling(null)}>Cancelar</button><button className="primary-btn" disabled={saving} onClick={settle}><CheckCircle2 size={15}/> {saving ? "Salvando..." : "Confirmar baixa"}</button></div></div></div>}
    {invoicing && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Emitir Nota Fiscal"><button className="modal-backdrop" onClick={() => !saving && setInvoicing(null)} aria-label="Fechar"/><div className="modal settlement-modal"><div className="modal-head"><div><span>FATURAMENTO PÚBLICO</span><h2>{invoicing.name}</h2><p>Informe a Nota Fiscal para criar a conta a receber.</p></div><button disabled={saving} onClick={() => setInvoicing(null)}><X size={18}/></button></div><div className="settlement-form"><label>Número da Nota Fiscal<input autoFocus value={invoiceNumber} onChange={event=>setInvoiceNumber(event.target.value)} placeholder="Ex.: 12345"/></label><div className="settlement-total"><span>VALOR A RECEBER</span><strong>R$ {(invoicing.value ?? 0).toLocaleString("pt-BR", {minimumFractionDigits:2})}</strong></div></div><div className="modal-actions"><button className="outline-btn" disabled={saving} onClick={()=>setInvoicing(null)}>Cancelar</button><button className="primary-btn" disabled={saving || !invoiceNumber.trim()} onClick={issueInvoice}><CheckCircle2 size={15}/> {saving ? "Salvando..." : "Emitir NF e criar conta"}</button></div></div></div>}
  </section>;
}

function SettingsModule({ companies, activeCompany, onCompaniesChange, onSelectCompany, isAdministrator }: { companies: TenantCompany[]; activeCompany: TenantCompany; onCompaniesChange: (companies: TenantCompany[]) => void; onSelectCompany: (company: TenantCompany) => void; isAdministrator: boolean }) {
  const [tab, setTab] = useState<"Empresa" | "WhatsApp" | "Fiscal" | "Inteligência Artificial" | "Segurança">("Empresa");
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
  const [aiKey, setAiKey] = useState("");
  const [aiStatus, setAiStatus] = useState<{configured:boolean;last4:string|null;source:string}>({configured:false,last4:null,source:"none"});
  const [aiBusy, setAiBusy] = useState(false);
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
  useEffect(() => {
    if (!isAdministrator || tab !== "Inteligência Artificial") return;
    setAiBusy(true);
    fetch(`/api/ai-credential?company=${encodeURIComponent(activeCompany.id)}`, {cache:"no-store"}).then(async response => {
      const data=await response.json(); if(!response.ok) throw new Error(data.error); setAiStatus(data);
    }).catch(error=>setSaved(error instanceof Error?error.message:"Não foi possível consultar a integração.")).finally(()=>setAiBusy(false));
  }, [activeCompany.id, isAdministrator, tab]);
  const saveAiCredential = async () => {
    if (!aiKey.trim()) { setSaved("Informe a nova chave da OpenAI."); return; }
    setAiBusy(true); setSaved("Salvando credencial protegida...");
    try { const response=await fetch(`/api/ai-credential?company=${encodeURIComponent(activeCompany.id)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({apiKey:aiKey})}); const data=await response.json(); if(!response.ok)throw new Error(data.error); setAiStatus({configured:true,last4:data.last4,source:"company"}); setAiKey(""); setSaved("✓ Credencial salva de forma criptografada."); } catch(error){setSaved(error instanceof Error?error.message:"Não foi possível salvar a credencial.");} finally{setAiBusy(false);}
  };
  const testAiCredential = async () => { setAiBusy(true); setSaved("Testando conexão..."); try { const response=await fetch(`/api/ai-credential?company=${encodeURIComponent(activeCompany.id)}`,{method:"POST"}); const data=await response.json(); if(!response.ok)throw new Error(data.error); setSaved(data.message); } catch(error){setSaved(error instanceof Error?error.message:"Falha no teste da conexão.");} finally{setAiBusy(false);} };
  const removeAiCredential = async () => { if(!window.confirm("Remover a credencial de IA desta empresa?"))return; setAiBusy(true); try { const response=await fetch(`/api/ai-credential?company=${encodeURIComponent(activeCompany.id)}`,{method:"DELETE"}); const data=await response.json(); if(!response.ok)throw new Error(data.error); setAiStatus({configured:false,last4:null,source:"none"}); setSaved("Credencial da empresa removida."); } catch(error){setSaved(error instanceof Error?error.message:"Não foi possível remover a credencial.");} finally{setAiBusy(false);} };
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
    <div className="settings-layout"><nav className="settings-nav">{[{name:"Empresa",icon:Building2,text:"Dados e logomarca"},{name:"WhatsApp",icon:MessageCircle,text:"API oficial da Meta"},{name:"Fiscal",icon:FileText,text:"NF-e, NFC-e e NFS-e"},...(isAdministrator?[{name:"Inteligência Artificial",icon:Sparkles,text:"Credencial OpenAI protegida"}]:[]),{name:"Segurança",icon:ShieldCheck,text:"Acessos e proteção"}].map(item => <button key={item.name} className={tab === item.name ? "active" : ""} onClick={() => setTab(item.name as typeof tab)}><item.icon size={17}/><span><b>{item.name}</b><small>{item.text}</small></span></button>)}</nav>
      <div className="settings-card"><header><div><small>CONFIGURAÇÃO • {tab.toUpperCase()}</small><h3>{tab === "WhatsApp" ? "WhatsApp Business Platform" : tab === "Empresa" ? "Cadastro da empresa" : tab === "Fiscal" ? "Configuração fiscal" : tab === "Inteligência Artificial" ? "Credencial segura da OpenAI" : "Segurança do sistema"}</h3></div><span className="settings-status"><i/> {tab === "Inteligência Artificial" ? aiStatus.configured ? `Configurada • final ${aiStatus.last4}` : aiStatus.source === "environment" ? "Fallback do servidor" : "Não configurada" : "Configuração disponível"}</span></header>
        {tab === "Empresa" && <div className="settings-form company-settings-form"><label>Razão social / Nome empresarial<input value={companyName} onChange={event => setCompanyName(event.target.value)}/></label><label>Nome fantasia<input value={tradeName} onChange={event => setTradeName(event.target.value)}/></label><label>CNPJ<input value={companyDoc} onChange={event => setCompanyDoc(formatCnpj(event.target.value))} placeholder="00.000.000/0000-00"/></label><label>Telefone<input value={businessPhone} onChange={event => setBusinessPhone(event.target.value)}/></label><label>E-mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="contato@empresa.com.br"/></label><label>Cidade<input list="proar-cities" value={city} onChange={event => setCity(event.target.value)} placeholder="Selecione ou digite a cidade"/><datalist id="proar-cities">{cities.map(item => <option key={item}>{item}</option>)}</datalist></label><label>Estado<select value={state} onChange={event => setState(event.target.value)}>{["SP","MG","PR","RJ","MS","GO","SC","RS"].map(item => <option key={item}>{item}</option>)}</select></label><label className="wide">Endereço completo<input value={address} onChange={event => setAddress(event.target.value)} placeholder="Rua, número e bairro"/></label><div className="wide company-logo-field"><div className="company-logo-preview">{logo ? <img src={logo} alt="Logomarca da empresa"/> : <Building2 size={30}/>}</div><div><b>Logomarca dos relatórios</b><p>Será utilizada nos cabeçalhos de PDF, impressão, orçamentos e ordens de serviço.</p><label className="logo-upload"><ImagePlus size={15}/> Selecionar logomarca<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={event => readLogo(event.target.files?.[0])}/></label>{logo && <button className="logo-remove" type="button" onClick={() => setLogo("")}><Trash2 size={13}/> Remover</button>}</div></div></div>}
        {tab === "WhatsApp" && <div className="settings-form whatsapp-settings-form"><div className="wide whatsapp-account-status"><MessageCircle size={20}/><div><small>CONTA LOCALIZADA NA META</small><b>POLARTECH AR CONDICIONADO</b><span>{businessPhone} • Conectado • Qualidade alta</span></div><CheckCircle2 size={19}/></div><label>Phone Number ID<input value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} inputMode="numeric"/><small>ID do número, diferente do telefone.</small></label><label>WABA ID<input value={wabaId} onChange={event => setWabaId(event.target.value)} inputMode="numeric"/><small>ID da conta WhatsApp Business.</small></label><label className="wide">Token permanente<input type="password" value={token} onChange={event => setToken(event.target.value)} autoComplete="new-password" placeholder="Cole o token gerado pelo Utilizador do Sistema"/><small>Por segurança, o token nunca será mostrado depois de salvo.</small></label><div className="wide settings-security-note"><ShieldCheck size={17}/><span><b>Permissões necessárias</b><small>whatsapp_business_management e whatsapp_business_messaging</small></span></div></div>}
        {tab === "Fiscal" && <div className="settings-form"><label>Ambiente<select><option>Homologação</option><option>Produção</option></select></label><label>Regime tributário<select><option>Simples Nacional</option><option>Lucro Presumido</option><option>Lucro Real</option></select></label><label className="wide">Certificado digital A1<input type="file" accept=".pfx,.p12"/></label></div>}
        {tab === "Inteligência Artificial" && isAdministrator && <div className="settings-form"><div className="wide settings-security-note"><ShieldCheck size={17}/><span><b>A chave nunca volta ao navegador</b><small>O servidor armazena a credencial criptografada e informa apenas os quatro últimos caracteres.</small></span></div><label className="wide">{aiStatus.configured ? "Trocar chave da OpenAI" : "Chave da OpenAI"}<input type="password" autoComplete="new-password" value={aiKey} onChange={event=>setAiKey(event.target.value)} placeholder={aiStatus.configured?`Configurada • final ${aiStatus.last4}`:"sk-proj-..."}/></label><div className="wide settings-footer-actions"><button className="primary-btn" disabled={aiBusy||!aiKey.trim()} onClick={()=>void saveAiCredential()}><LockKeyhole size={14}/>{aiStatus.configured?"Trocar chave":"Salvar chave"}</button><button className="outline-btn" disabled={aiBusy||(!aiStatus.configured&&aiStatus.source==="none")} onClick={()=>void testAiCredential()}><Zap size={14}/> Testar conexão</button>{aiStatus.configured&&<button className="outline-btn" disabled={aiBusy} onClick={()=>void removeAiCredential()}><Trash2 size={14}/> Remover chave</button>}</div></div>}
        {tab === "Segurança" && <div className="settings-form"><label className="wide settings-switch"><span><b>Exigir autenticação individual</b><small>Somente funcionários ativos podem entrar.</small></span><input type="checkbox" defaultChecked/></label><label className="wide settings-switch"><span><b>Encerrar sessão por inatividade</b><small>Protege o sistema em computadores compartilhados.</small></span><input type="checkbox" defaultChecked/></label></div>}
        {saved && <p className="settings-message">{saved}</p>}<footer><small>Empresa ativa: {activeCompany.tradeName} • base {activeCompany.id}</small>{tab !== "Inteligência Artificial" && <div className="settings-footer-actions">{tab === "Empresa" && normalizeCnpj(companyDoc) !== normalizeCnpj(activeCompany.cnpj) && <button className="outline-btn" onClick={createCompany}><Plus size={15}/> Criar como nova empresa</button>}<button className="primary-btn" onClick={save}><CheckCircle2 size={15}/> Salvar configurações</button></div>}</footer>
      </div></div>
  </section>;
}

function HousesWorkModule({ companyId, company, responsibleUser = "Utilizador do ProAR" }: { companyId: string; company: TenantCompany; responsibleUser?: string }) {
  const projectsKey = companyStorageKey(companyId, "obras-cadastradas");
  const selectedProjectKey = companyStorageKey(companyId, "obra-selecionada");
  const [projects, setProjects] = useState<WorkProject[]>([RESERVA_IMPERIAL]);
  const [activeProjectId, setActiveProjectId] = useState(RESERVA_IMPERIAL.id);
  const [projectsReady, setProjectsReady] = useState(false);
  const activeProject = projects.find(project => project.id === activeProjectId) ?? projects[0] ?? RESERVA_IMPERIAL;
  const storageKey = activeProject.id === RESERVA_IMPERIAL.id ? companyStorageKey(companyId, "obra-142-casas") : companyStorageKey(companyId, `obra-${activeProject.id}-itens`);
  const shareKey = activeProject.id === RESERVA_IMPERIAL.id ? companyStorageKey(companyId, "obra-142-public-token") : companyStorageKey(companyId, `obra-${activeProject.id}-public-token`);
  const createHouses = (project = activeProject) => [...project.blocks.flatMap(({ block, houses }) => Array.from({ length: houses }, (_, index): HouseWorkItem => ({ id: `${block}-${String(index + 1).padStart(2, "0")}`, block, lot: index + 1, kind: "house", status: "INÍCIO DE OBRA", history: [] }))), ...project.commonAreas.map((name,index): HouseWorkItem => ({ id:`common-${String(index + 1).padStart(2,"0")}`, block:"Áreas Comuns", lot:index + 1, kind:"common", name, status:"INÍCIO DE OBRA", history:[] }))];
  const [houses, setHouses] = useState<HouseWorkItem[]>([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [blockFilter, setBlockFilter] = useState("Todas");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<HouseWorkItem | null>(null);
  const [nextStatus, setNextStatus] = useState<HouseWorkStatus>("INÍCIO DE OBRA");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [houseModalTab, setHouseModalTab] = useState<"Etapa" | "Perdas e Roubos">("Etapa");
  const [incidentType, setIncidentType] = useState<"Perda" | "Roubo">("Perda");
  const [incidentNote, setIncidentNote] = useState("");
  const [incidentPhoto, setIncidentPhoto] = useState("");
  const [historyHouse, setHistoryHouse] = useState<HouseWorkItem | null>(null);
  const [historyUpdate, setHistoryUpdate] = useState<HouseWorkUpdate | null>(null);
  const [reportNotice, setReportNotice] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [serverRevision, setServerRevision] = useState(0);
  const [mapOnline, setMapOnline] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [workManagerOpen, setWorkManagerOpen] = useState(false);
  const [newWorkName, setNewWorkName] = useState("");
  const [newBlocks, setNewBlocks] = useState<WorkBlock[]>([{block:"A",houses:1}]);
  const [newCommonAreas, setNewCommonAreas] = useState<string[]>([]);
  const [projectsRevision, setProjectsRevision] = useState(0);
  useEffect(() => {
    const normalizeProjects = (items: WorkProject[]) => {
      const normalized = items.length ? items.map(project => project.id === RESERVA_IMPERIAL.id ? {...project,name:"Reserva Imperial",commonAreas:Array.from(new Set([...(project.commonAreas ?? []),...RESERVA_IMPERIAL.commonAreas]))} : project) : [RESERVA_IMPERIAL];
      if (!normalized.some(project => project.id === RESERVA_IMPERIAL.id)) normalized.unshift(RESERVA_IMPERIAL);
      return normalized;
    };
    const loadProjects = async () => {
      let local: WorkProject[] = [RESERVA_IMPERIAL];
      try { local = normalizeProjects(JSON.parse(localStorage.getItem(projectsKey) || "[]") as WorkProject[]); } catch {}
      if (!navigator.onLine) { setProjects(local); setProjectsReady(true); return; }
      try {
        const response = await fetch(`/api/work-projects?company=${encodeURIComponent(companyId)}&refresh=${Date.now()}`, {cache:"no-store"});
        const result = await response.json();
        if (!response.ok) throw new Error();
        if (result.state?.projects?.length) {
          const authoritative = normalizeProjects(result.state.projects as WorkProject[]);
          setProjects(authoritative); setProjectsRevision(Number(result.state.revision||0)); localStorage.setItem(projectsKey,JSON.stringify(authoritative));
          const selected=localStorage.getItem(selectedProjectKey); if(selected&&authoritative.some(project=>project.id===selected))setActiveProjectId(selected);
        } else {
          const seed = normalizeProjects(local);
          const save = await fetch('/api/work-projects',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,projects:seed,baseRevision:0})});
          const saved = await save.json(); if(save.ok)setProjectsRevision(Number(saved.state?.revision||1)); setProjects(seed); localStorage.setItem(projectsKey,JSON.stringify(seed));
        }
      } catch { setProjects(local); setReportNotice("Lista de obras online indisponível. Exibindo cache deste aparelho somente para consulta."); }
      finally { setProjectsReady(true); }
    };
    void loadProjects();
  },[projectsKey,selectedProjectKey,companyId]);
  const mergeWorkRows = (rows: HouseWorkItem[]) => { const byId=new Map(rows.map(item=>[item.id,item])); return createHouses().map(item=>byId.get(item.id)??item); };
  const applyServerMap = (map: { houses?: HouseWorkItem[]; token?: string; revision?: number }) => { const authoritative=mergeWorkRows(map.houses??[]); setHouses(authoritative); localStorage.setItem(storageKey,JSON.stringify(authoritative)); setServerRevision(Number(map.revision||0)); setMapOnline(true); setMapLoading(false); if(map.token){setShareToken(map.token);localStorage.setItem(shareKey,map.token);} return authoritative; };
  const fetchServerMap = async () => { if(!navigator.onLine) throw new Error("offline"); const response=await fetch(`/api/public-work-map?company=${encodeURIComponent(companyId)}&work=${encodeURIComponent(activeProject.id)}&refresh=${Date.now()}`,{cache:"no-store"}); const result=await response.json(); if(!response.ok) throw new Error(result.error||"Falha no banco online"); if(result.map?.houses?.length) applyServerMap(result.map); return result.map as {houses?:HouseWorkItem[];token?:string;revision?:number}|null; };
  const publishPublicMap = async (next: HouseWorkItem[], revision = serverRevision) => {
    if(!navigator.onLine){localStorage.setItem(`${shareKey}:pending`,"1");setMapOnline(false);throw new Error("Dispositivo sem internet.");}
    const response=await fetch("/api/public-work-map",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId,workId:activeProject.id,workName:activeProject.name,title:`Acompanhamento da obra — ${activeProject.name}`,houses:next,baseRevision:revision})});
    const result=await response.json();
    if(response.status===409&&result.map){applyServerMap(result.map);localStorage.removeItem(`${shareKey}:pending`);throw new Error("O banco online tinha uma versão mais recente e foi mantido como principal.");}
    if(!response.ok){localStorage.setItem(`${shareKey}:pending`,"1");throw new Error(result.error||"Não foi possível atualizar o banco online.");}
    const confirmed=result.map as {houses?:HouseWorkItem[];revision?:number;token?:string};
    if(!confirmed?.houses?.length) throw new Error("O banco não confirmou a atualização da etapa.");
    setServerRevision(Number(confirmed.revision||serverRevision+1));setMapOnline(true);setMapLoading(false);setShareToken(result.token);localStorage.setItem(shareKey,result.token);localStorage.removeItem(`${shareKey}:pending`);return confirmed;
  };
  useEffect(() => {
    if(!projectsReady)return;
    setShareToken(localStorage.getItem(shareKey)||"");setServerRevision(0);
    const stored=localStorage.getItem(storageKey);const localHouses=(()=>{if(!stored)return createHouses();try{return mergeWorkRows(JSON.parse(stored) as HouseWorkItem[]);}catch{return createHouses();}})();
    if(!navigator.onLine){setHouses(localHouses);setMapOnline(false);setMapLoading(false);setReportNotice("Modo offline: mostrando a cópia deste aparelho.");return;}
    setHouses([]);setMapOnline(true);setMapLoading(true);
    void fetchServerMap().then(map=>{if(!map) return publishPublicMap(localHouses);}).catch(()=>{setMapOnline(false);setMapLoading(false);setReportNotice("Banco online indisponível. A cópia local não foi enviada nem definida como principal.");});
  },[storageKey,companyId,projectsReady,activeProject.id]);
  const persist = async (next: HouseWorkItem[]) => {
    if (!navigator.onLine) { const message="Não foi possível salvar a alteração. Tente novamente."; setSaveState("error"); setSaveError(message); setMapOnline(false); setReportNotice(message); return false; }
    setSaveError(""); setSaveState("saving");
    try {
      const confirmed=await publishPublicMap(next);
      const authoritative=mergeWorkRows(confirmed.houses??[]);
      const requested=next.find(item=>item.id===editing?.id); const returned=authoritative.find(item=>item.id===editing?.id);
      if(requested && normalizeHouseStatus(requested.status)==="AG. EXAUSTOR" && normalizeHouseStatus(returned?.status||"")!=="AG. EXAUSTOR") throw new Error("O banco não confirmou AG. EXAUSTOR.");
      setHouses(authoritative); localStorage.setItem(storageKey,JSON.stringify(authoritative));
      setSaveState("saved"); setReportNotice("✓ ALTERAÇÃO EFETUADA");
      window.setTimeout(()=>setSaveState("idle"),1800); return true;
    } catch (error) {
      const message = error instanceof Error && /versão mais recente|conflito/i.test(error.message)
        ? "Este registro foi alterado por outro usuário. Atualize os dados antes de continuar."
        : "Não foi possível salvar a alteração. Verifique os dados e tente novamente.";
      setSaveState("error"); setSaveError(message); setReportNotice(message);
      window.setTimeout(()=>setSaveState("idle"),3000);
      return false;
    }
  };
  useEffect(() => {
    const synchronize=()=>{if(!navigator.onLine){setMapOnline(false);return;}if(localStorage.getItem(`${shareKey}:pending`))void publishPublicMap(houses).catch(error=>setReportNotice(error.message));else void fetchServerMap().catch(()=>setMapOnline(false));};
    const timer=window.setInterval(()=>{if(navigator.onLine&&!localStorage.getItem(`${shareKey}:pending`))void fetchServerMap().catch(()=>setMapOnline(false));},20000);
    window.addEventListener("online",synchronize);window.addEventListener("offline",synchronize);return()=>{window.clearInterval(timer);window.removeEventListener("online",synchronize);window.removeEventListener("offline",synchronize);};
  },[shareKey,houses,serverRevision,activeProject.id]);
  const sharePublicMap = async () => {
    setReportNotice("A publicar o mapa da obra...");
    try {
      const savedMap = shareToken ? null : await publishPublicMap(houses); const token = shareToken || savedMap?.token || ""; if (!token) throw new Error("O banco não confirmou o link da obra."); const url = `${window.location.origin}/obra/${token}`;
      if (navigator.share) await navigator.share({ title: "Acompanhamento da obra — PolarTech", text: "Acompanhe em tempo real o andamento de cada casa da obra.", url });
      else { await navigator.clipboard.writeText(url); setReportNotice("Link copiado. Pode enviá-lo ao cliente pelo WhatsApp."); window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Acompanhe em tempo real o andamento da obra: ${url}`)}`, "_blank", "noopener,noreferrer"); }
    } catch (error) { if ((error as Error)?.name !== "AbortError") setReportNotice((error as Error)?.message || "Não foi possível compartilhar o mapa."); }
    window.setTimeout(() => setReportNotice(""), 5000);
  };
  const refreshWorkMap = async () => {
    setReportNotice("A atualizar o mapa pelo banco principal...");
    try { await fetchServerMap();localStorage.removeItem(`${shareKey}:pending`);setReportNotice("Banco online carregado. Esta é a versão principal."); }
    catch { setReportNotice(navigator.onLine?"Banco online indisponível; nenhum dado local foi enviado.":"Dispositivo sem internet. A cópia offline foi mantida."); }
    window.setTimeout(()=>setReportNotice(""),4500);
  };
  const sendWorkMap = async () => { setReportNotice("A sincronizar com o banco principal..."); try { await fetchServerMap();setReportNotice("Sincronização concluída. O banco online permaneceu como fonte principal."); } catch(error){setReportNotice((error as Error).message);} window.setTimeout(()=>setReportNotice(""),4500); };
  const createWorkProject = () => {
    const name = newWorkName.trim(); const blocks = newBlocks.filter(item => item.block.trim() && item.houses > 0).map(item => ({block:item.block.trim().toUpperCase(),houses:Math.max(1,Math.floor(item.houses))}));
    if (!name || !blocks.length) { setReportNotice("Informe o nome da obra e pelo menos uma quadra."); return; }
    const id = `${name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}-${Date.now().toString(36)}`;
    const project: WorkProject = {id,name,blocks,commonAreas:newCommonAreas.map(item=>item.trim()).filter(Boolean),createdAt:new Date().toISOString()};
    const next = [...projects,project];
    if (!navigator.onLine) { setReportNotice("Cadastros de novas obras exigem internet para evitar divergência entre aparelhos."); return; }
    void fetch('/api/work-projects',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({companyId,projects:next,baseRevision:projectsRevision})}).then(async response=>{const result=await response.json();if(response.status===409&&result.state){const authoritative=result.state.projects as WorkProject[];setProjects(authoritative);setProjectsRevision(Number(result.state.revision||0));localStorage.setItem(projectsKey,JSON.stringify(authoritative));throw new Error("Outro aparelho atualizou a lista de obras. A versão online foi mantida; tente cadastrar novamente.");}if(!response.ok)throw new Error(result.error||"Falha ao salvar obra");setProjects(next);setProjectsRevision(Number(result.state?.revision||projectsRevision+1));localStorage.setItem(projectsKey,JSON.stringify(next));localStorage.setItem(selectedProjectKey,id);setActiveProjectId(id);setBlockFilter("Todas");setWorkManagerOpen(false);setNewWorkName("");setNewBlocks([{block:"A",houses:1}]);setNewCommonAreas([]);setReportNotice(`Obra ${name} cadastrada com sucesso e disponível em todos os aparelhos.`);}).catch(error=>setReportNotice(error.message));
  };
  const selectWorkProject = (id:string) => { setActiveProjectId(id); localStorage.setItem(selectedProjectKey,id); setBlockFilter("Todas"); setStatusFilter("Todos"); setQuery(""); };
  const openUpdate = (house: HouseWorkItem) => { const normalized=normalizeHouseStatus(house.status); setEditing(house); setNextStatus(normalized === "STATUS NÃO IDENTIFICADO" ? "INÍCIO DE OBRA" : normalized); setNote(house.note ?? ""); setPhotos({}); setSaveError(""); setHouseModalTab("Etapa"); setIncidentType("Perda"); setIncidentNote(""); setIncidentPhoto(""); };
  const readStagePhoto = async (label: string, file?: File) => {
    if (!file) return;
    const encoded = await imageFileToDataUrl(file);
    setPhotos(current => ({ ...current, [label]: encoded }));
  };
  const readIncidentPhoto = async (file?: File) => { if (file) setIncidentPhoto(await imageFileToDataUrl(file)); };
  const replaceHistoryPhoto = async (label: string, file?: File) => {
    if (!file || !historyHouse || !historyUpdate) return;
    const url = await imageFileToDataUrl(file);
    const nextUpdate: HouseWorkUpdate = {...historyUpdate,photos:normalizeStagePhotos(historyUpdate.photos,historyUpdate.photo,historyUpdate.status).map(photo=>photo.label===label?{...photo,url}:photo)};
    const nextHouse: HouseWorkItem = {...historyHouse,updatedAt:new Date().toISOString(),history:(historyHouse.history??[]).map(update=>update.id===historyUpdate.id?nextUpdate:update)};
    const next=houses.map(item=>item.id===nextHouse.id?nextHouse:item);
    if (await persist(next)) { setHistoryHouse(nextHouse); setHistoryUpdate(nextUpdate); }
  };
  const replaceIncidentPhoto = async (incidentId: string, file?: File) => {
    if (!file || !editing) return;
    const photo=await imageFileToDataUrl(file);const updatedAt=new Date().toISOString();
    const nextHouse: HouseWorkItem={...editing,updatedAt,incidents:(editing.incidents??[]).map(incident=>incident.id===incidentId?{...incident,photo}:incident)};
    const next=houses.map(item=>item.id===editing.id?nextHouse:item);
    if (await persist(next)) setEditing(nextHouse);
  };
  const saveIncident = async () => {
    if (saveState === "saving") return;
    if (!editing) return;
    if (!incidentPhoto) { setReportNotice("Anexe uma foto da perda ou do roubo."); return; }
    const createdAt = new Date().toISOString();
    const incident: HouseIncident = {id:`incident-${editing.id}-${Date.now()}`,type:incidentType,note:incidentNote.trim(),photo:incidentPhoto,responsible:responsibleUser,createdAt};
    const next=houses.map(item=>item.id===editing.id?{...item,updatedAt:createdAt,incidents:[incident,...(item.incidents??[])]}:item);
    if (await persist(next)) { setEditing(next.find(item=>item.id===editing.id)??null); setIncidentNote(""); setIncidentPhoto(""); }
  };
  const saveUpdate = async () => {
    if (saveState === "saving") return;
    if (!editing) return;
    const photoLabels = HOUSE_STAGE_PHOTOS[nextStatus];
    if (nextStatus === "SERVIÇO CONCLUÍDO" && !window.confirm("Confirma a conclusão desta casa? A data, o horário e o responsável serão registrados.")) return;
    const createdAt = new Date().toISOString();
    const observationChanged = note.trim() !== (editing.note ?? "").trim();
    const statusChanged = nextStatus !== normalizeHouseStatus(editing.status);
    const stagePhotos = photoLabels.filter(label => photos[label]).map(label => ({ label, url: photos[label] }));
    const previousStatus = normalizeHouseStatus(editing.status);
    const storedStatus: HouseWorkItem["status"] = nextStatus === "AG. EXAUSTOR" ? "ag_exaustor" : nextStatus;
    const update: HouseWorkUpdate = { id: `${editing.id}-${Date.now()}`, status: storedStatus, previousStatus, note: note.trim(), responsible: responsibleUser, photos: stagePhotos.length ? stagePhotos : undefined, createdAt, completedAt: nextStatus === "SERVIÇO CONCLUÍDO" ? createdAt : undefined, origin: typeof navigator === "undefined" ? "web" : navigator.userAgent };
    const next = houses.map(item => item.id === editing.id ? { ...item, status: storedStatus, note: note.trim() || item.note, photo: stagePhotos[0]?.url || item.photo, photos: stagePhotos.length ? stagePhotos : item.photos, updatedAt: createdAt, history: [update, ...(item.history ?? [])] } : item);
    if (!observationChanged && !statusChanged && !stagePhotos.length) { setSaveError("Nenhuma alteração realizada."); return; }
    if (await persist(next)) setEditing(null);
  };
  const stageDirty = !!editing && (
    nextStatus !== normalizeHouseStatus(editing.status)
    || note.trim() !== (editing.note ?? "").trim()
    || Object.keys(photos).length > 0
  );
  if (mapLoading) return <section className="houses-app"><div className="work-online-loading"><RefreshCw size={24}/><div><b>A carregar {activeProject.name}</b><span>A consultar a base principal online. Nenhum valor local provisório será exibido.</span></div></div></section>;
  const visible = houses.filter(house => (blockFilter === "Todas" || house.block === blockFilter) && (statusFilter === "Todos" || normalizeHouseStatus(house.status) === statusFilter) && `${house.block} ${house.lot} ${house.id} ${house.name ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const completed = houses.filter(house => normalizeHouseStatus(house.status) === "SERVIÇO CONCLUÍDO").length;
  const completion = houses.length ? Math.round(houses.reduce((sum, house) => sum + getWorkProgress(house.status), 0) / houses.length) : 0;
  const blockProgress = (block: string) => {
    const entries = houses.filter(house => house.block === block);
    const progress = entries.length ? Math.round(entries.reduce((sum, house) => sum + getWorkProgress(house.status), 0) / entries.length) : 0;
    return { entries, progress, done: entries.filter(house => normalizeHouseStatus(house.status) === "SERVIÇO CONCLUÍDO").length, working: entries.filter(house => !["INÍCIO DE OBRA", "SERVIÇO CONCLUÍDO"].includes(normalizeHouseStatus(house.status))).length };
  };
  const grouped = [...activeProject.blocks.map(({ block }) => ({ block, houses: visible.filter(house => house.block === block) })),{block:"Áreas Comuns",houses:visible.filter(house=>house.kind === "common")}].filter(group => group.houses.length);
  const statusColor = (status: HouseWorkStatus | LegacyHouseWorkStatus) => getWorkStatusColor(status);
  const houseProgress = (status: HouseWorkStatus | LegacyHouseWorkStatus) => getWorkProgress(status);
  const createWorkReport = async (selectedHouses: HouseWorkItem[], reportTitle: string) => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let y = 0;
    const header = () => {
      pdf.setFillColor(14, 62, 128); pdf.rect(0, 0, pageWidth, 27, "F");
      pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text(`${company.tradeName || company.legalName} — RELATÓRIO DE OBRA`, 14, 9);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.text(company.cnpj ? `CNPJ/CPF: ${company.cnpj}` : company.legalName, 14, 14);
      pdf.text([company.phone, company.email].filter(Boolean).join(" • ") || `${company.city}/${company.state}`, 14, 19);
      pdf.text(reportTitle, pageWidth - 14, 11, { align: "right" });
      pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageWidth - 14, 19, { align: "right" });
      pdf.setTextColor(35, 55, 78); y = 35;
    };
    const ensureSpace = (height: number) => { if (y + height > pageHeight - 18) { pdf.addPage(); header(); } };
    header();
    for (const house of selectedHouses) {
      ensureSpace(24);
      pdf.setFillColor(238, 246, 255); pdf.roundedRect(12, y, pageWidth - 24, 16, 2, 2, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(16, 91, 178); pdf.text(`QUADRA ${house.block} • CASA / LOTE ${String(house.lot).padStart(2, "0")}`, 16, y + 7);
      pdf.setFontSize(8); pdf.setTextColor(50, 70, 92); pdf.text(`Situação atual: ${normalizeHouseStatus(house.status)}`, 16, y + 12); y += 21;
      const history = [...(house.history ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (!history.length) { pdf.setFont("helvetica", "italic"); pdf.setFontSize(8); pdf.setTextColor(115, 130, 145); pdf.text("Nenhuma alteração registrada para esta casa.", 16, y); y += 9; }
      for (const [index, update] of history.entries()) {
        const photos = normalizeStagePhotos(update.photos, update.photo, update.status);
        ensureSpace(photos.length ? 67 : 27);
        pdf.setDrawColor(216, 228, 239); pdf.line(16, y, pageWidth - 16, y); y += 6;
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(37, 61, 86); pdf.text(`${String(index + 1).padStart(2, "0")} • ${normalizeHouseStatus(update.status)}`, 16, y);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(105, 122, 140); pdf.text(new Date(update.createdAt).toLocaleString("pt-BR"), pageWidth - 16, y, { align: "right" }); y += 6;
        if (update.responsible) { pdf.setTextColor(55, 73, 93); pdf.text(`Responsável: ${update.responsible}`, 16, y); y += 5; }
        if (update.note) { pdf.setTextColor(55, 73, 93); const lines = pdf.splitTextToSize(`Observações: ${update.note}`, pageWidth - 32) as string[]; pdf.text(lines, 16, y); y += lines.length * 4 + 3; }
        else { pdf.setTextColor(125, 139, 153); pdf.text("Sem observações.", 16, y); y += 6; }
        for (let photoIndex = 0; photoIndex < photos.length; photoIndex += 2) {
          ensureSpace(45);
          photos.slice(photoIndex, photoIndex + 2).forEach((photo, column) => { try { pdf.setFontSize(7); pdf.setTextColor(65, 83, 103); pdf.text(photo.label, 16 + column * 89, y); pdf.addImage(photo.url, photo.url.startsWith("data:image/png") ? "PNG" : "JPEG", 16 + column * 89, y + 3, 84, 40, undefined, "FAST"); } catch {} });
          y += 44;
        }
        y += 3;
      }
      if (house.incidents?.length) {
        ensureSpace(18); pdf.setFillColor(255,244,244); pdf.roundedRect(14,y,pageWidth-28,10,2,2,"F"); pdf.setFont("helvetica","bold"); pdf.setFontSize(9); pdf.setTextColor(180,55,55); pdf.text("PERDAS E ROUBOS",18,y+6.5); y+=15;
        for (const incident of [...house.incidents].reverse()) { ensureSpace(55); pdf.setFont("helvetica","bold"); pdf.setFontSize(8.5); pdf.setTextColor(130,45,45); pdf.text(`${incident.type} • ${new Date(incident.createdAt).toLocaleString("pt-BR")}`,16,y); y+=5; pdf.setFont("helvetica","normal"); pdf.setFontSize(7.5); pdf.setTextColor(65,78,92); pdf.text(`Responsável: ${incident.responsible}`,16,y); y+=5; if(incident.note){const lines=pdf.splitTextToSize(incident.note,pageWidth-32) as string[];pdf.text(lines,16,y);y+=lines.length*4+2;} try{pdf.addImage(incident.photo,incident.photo.startsWith("data:image/png")?"PNG":"JPEG",16,y,84,40,undefined,"FAST");y+=44;}catch{} }
      }
      y += 3;
    }
    const pages = pdf.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) { pdf.setPage(page); pdf.setDrawColor(220, 229, 238); pdf.line(12, pageHeight - 12, pageWidth - 12, pageHeight - 12); pdf.setFontSize(7); pdf.setTextColor(110, 126, 143); pdf.text(`ProAR Gestão de Serviços — BY TAV's • ${company.tradeName || company.legalName}`, 14, pageHeight - 7); pdf.text(`Página ${page} de ${pages}`, pageWidth - 14, pageHeight - 7, { align: "right" }); }
    const safeTitle = reportTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    return { pdf, filename: `relatorio-${safeTitle}.pdf` };
  };
  const issueWorkReport = async (selectedHouses: HouseWorkItem[], reportTitle: string, share = false) => {
    setReportNotice("A gerar relatório com fotos e histórico...");
    try {
      const { pdf, filename } = await createWorkReport(selectedHouses, reportTitle);
      if (share) {
        const file = new File([pdf.output("blob")], filename, { type: "application/pdf" });
        if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) { await navigator.share({ title: reportTitle, text: `Segue o ${reportTitle} da ${company.tradeName}.`, files: [file] }); setReportNotice("Relatório compartilhado com sucesso."); }
        else { pdf.save(filename); window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Segue o ${reportTitle} da ${company.tradeName}. O PDF foi baixado e deve ser anexado a esta conversa.`)}`, "_blank", "noopener,noreferrer"); setReportNotice("PDF baixado. Anexe o arquivo na conversa aberta do WhatsApp."); }
      } else { pdf.save(filename); setReportNotice("Relatório PDF gerado com sucesso."); }
    } catch (error) { if ((error as Error)?.name !== "AbortError") setReportNotice("Não foi possível gerar o relatório. Tente novamente."); }
    window.setTimeout(() => setReportNotice(""), 5000);
  };
  return <section className="houses-app">
    {saveState !== "idle" && <div className={`work-save-bar ${saveState}`} role="status"><i/><span>{saveState === "saving" ? "Salvando..." : saveState === "saved" ? "✓ ALTERAÇÃO EFETUADA" : "Não foi possível salvar a alteração"}</span></div>}
    <div className="work-manager-bar"><div><span><Building2 size={17}/></span><label>Obra ativa<select value={activeProject.id} onChange={event=>selectWorkProject(event.target.value)}>{projects.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label><small>{activeProject.blocks.length} quadra(s) • {activeProject.blocks.reduce((total,item)=>total+item.houses,0)} casas • {activeProject.commonAreas.length} áreas comuns</small></div><button className="primary-btn" onClick={()=>setWorkManagerOpen(true)}><Plus size={15}/> Cadastrar obra</button></div>
    <div className="houses-hero"><div><span className="section-kicker"><House size={12}/> CONTROLE DE EXECUÇÃO</span><h2>{activeProject.name}</h2><p>Acompanhamento individual das casas e áreas comuns, com evidências e histórico de execução.</p></div><div className="houses-public-share"><span><MapPin size={18}/></span><div><small>ACESSO DO CLIENTE</small><b>{shareToken ? "Mapa público ativo" : "Criar link de acompanhamento"}</b><em>{shareToken ? "Atualização automática em tempo real" : "O cliente verá somente o andamento da obra"}</em></div><button onClick={refreshWorkMap}><ArrowDownRight size={14}/> Atualizar</button><button onClick={sendWorkMap}><ArrowUpRight size={14}/> Enviar</button><button onClick={sharePublicMap}><MessageCircle size={14}/>{shareToken ? "Link" : "Criar link"}</button>{shareToken && <a href={`/obra/${shareToken}`} target="_blank" rel="noreferrer"><Eye size={14}/> Visualizar</a>}</div><div className="houses-progress"><div><small>PROGRESSO GERAL</small><strong>{completion}%</strong></div><i><b style={{ width: `${completion}%` }}/></i><span>{completed} finalizadas de {houses.length} unidades cadastradas</span></div></div>
    <div className="work-block-summary">{activeProject.blocks.map(({block})=>{const stat=blockProgress(block);return <button key={block} style={{"--block-progress":`${stat.progress}%`} as React.CSSProperties} className={blockFilter===block?"active":""} onClick={()=>setBlockFilter(block)}><b>Quadra {block}</b><span>{stat.progress}%</span><small>{stat.entries.length} casas • {stat.done} concluídas • {stat.working} em andamento</small></button>})}</div>
    <div className="houses-kpis"><article><span><House size={18}/></span><div><small>TOTAL CADASTRADO</small><strong>{houses.length}</strong><em>{activeProject.blocks.length} quadras • {activeProject.commonAreas.length} áreas comuns</em></div></article>{HOUSE_STATUSES.map(status => { const total = houses.filter(house => normalizeHouseStatus(house.status) === status.name).length; return <article key={status.name}><i style={{background:status.color}}/><div><small>{status.name}</small><strong>{total}</strong><em>{Math.round(total / houses.length * 100)}% da obra</em></div></article>; })}</div>
    <div className="houses-toolbar"><label><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar quadra, casa ou área comum..."/></label><select value={blockFilter} onChange={event => setBlockFilter(event.target.value)}><option>Todas</option>{activeProject.blocks.map(item => <option key={item.block}>{item.block}</option>)}{activeProject.commonAreas.length > 0 && <option>Áreas Comuns</option>}</select><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>Todos</option>{HOUSE_STATUSES.map(item => <option key={item.name}>{item.name}</option>)}</select><span>{visible.length} unidade(s) exibida(s)</span></div>
    <div className="houses-legend">{HOUSE_STATUSES.map(status => <span key={status.name}><i style={{background:status.color}}/>{status.name}</span>)}</div>
    {reportNotice && <div className="work-report-notice"><FileText size={15}/>{reportNotice}</div>}
    <div className="block-list">{grouped.map(group => { const completeBlock = houses.filter(house => house.block === group.block); return <section className="block-section" key={group.block}><header><div><span>{group.block === "Áreas Comuns" ? "ÁREA" : "QUADRA"}</span><strong>{group.block}</strong></div><p>{group.houses.length} unidade(s) exibida(s)</p><b>{completeBlock.filter(house => normalizeHouseStatus(house.status) === "SERVIÇO CONCLUÍDO").length}/{completeBlock.length} concluídas</b><div className="block-report-actions"><button onClick={() => issueWorkReport(completeBlock, `Relatório completo da Quadra ${group.block}`)}><FileText size={13}/> PDF da quadra</button><button onClick={() => issueWorkReport(completeBlock, `Relatório completo da Quadra ${group.block}`, true)}><MessageCircle size={13}/> WhatsApp</button></div></header><div className="house-grid">{group.houses.map(house => <article key={house.id} style={{"--house-color":statusColor(house.status)} as React.CSSProperties} onDoubleClick={() => openUpdate(house)}><div className="house-card-top"><span><House size={15}/></span><div><small>{house.kind === "common" ? "ÁREA COMUM" : `QUADRA ${house.block}`}</small><h3>{house.kind === "common" ? house.name : `Lote ${String(house.lot).padStart(2,"0")}`}</h3></div>{house.photo && <img src={house.photo} alt={`Casa ${house.id}`}/>}</div>
<div className="house-status"><i/><span>{normalizeHouseStatus(house.status)}</span></div><div className="house-mini-progress"><i><b style={{width:`${houseProgress(house.status)}%`}}/></i><small>{houseProgress(house.status)}%</small></div>
{house.note && <p>{house.note}</p>}<small className="house-date">{house.updatedAt ? `Atualizado em ${new Date(house.updatedAt).toLocaleString("pt-BR")}` : "Sem alterações registradas"}</small><footer><button onClick={() => openUpdate(house)} title="Alterar status"><Edit3 size={13}/></button><button disabled={!house.history?.length} onClick={() => setHistoryHouse(house)} title="Histórico"><History size={13}/></button><button onClick={() => issueWorkReport([house], `Relatório da Quadra ${house.block} — Casa ${String(house.lot).padStart(2, "0")}`)} title="Gerar PDF"><FileText size={13}/></button><button onClick={() => issueWorkReport([house], `Relatório da Quadra ${house.block} — Casa ${String(house.lot).padStart(2, "0")}`, true)} title="Enviar pelo WhatsApp"><MessageCircle size={13}/></button></footer></article>)}</div></section>; })}</div>
    {!visible.length && <div className="linked-empty"><Search size={22}/><h4>Nenhuma casa encontrada</h4><p>Altere os filtros para visualizar outros lotes.</p></div>}
    {workManagerOpen && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={()=>setWorkManagerOpen(false)} aria-label="Fechar"/><div className="modal work-register-modal"><div className="modal-head"><div><span>GERENCIADOR DE OBRAS</span><h2>Cadastrar nova obra</h2><p>Defina as quadras, a quantidade de casas e as áreas comuns.</p></div><button onClick={()=>setWorkManagerOpen(false)}><X size={18}/></button></div><div className="work-register-body"><label className="wide">Nome da obra<input value={newWorkName} onChange={event=>setNewWorkName(event.target.value)} placeholder="Ex.: Residencial Primavera"/></label><section className="work-config-section"><header><div><b>Quadras e casas</b><small>Informe a identificação e a quantidade de casas de cada quadra.</small></div><button type="button" onClick={()=>setNewBlocks(current=>[...current,{block:String.fromCharCode(65+current.length),houses:1}])}><Plus size={13}/> Quadra</button></header>{newBlocks.map((item,index)=><div className="work-config-row" key={index}><label>Quadra<input value={item.block} onChange={event=>setNewBlocks(current=>current.map((block,i)=>i===index?{...block,block:event.target.value}:block))}/></label><label>Quantidade de casas<input type="number" min="1" value={item.houses} onChange={event=>setNewBlocks(current=>current.map((block,i)=>i===index?{...block,houses:Math.max(1,Number(event.target.value)||1)}:block))}/></label><button type="button" disabled={newBlocks.length===1} onClick={()=>setNewBlocks(current=>current.filter((_,i)=>i!==index))}><Trash2 size={14}/></button></div>)}</section><section className="work-config-section"><header><div><b>Áreas comuns</b><small>Adicione a quantidade necessária e dê um nome para cada área.</small></div><button type="button" onClick={()=>setNewCommonAreas(current=>[...current,""])}><Plus size={13}/> Área comum</button></header>{newCommonAreas.length===0?<p className="work-config-empty">Nenhuma área comum adicionada.</p>:newCommonAreas.map((name,index)=><div className="work-config-row common" key={index}><label>Nome da área comum<input value={name} onChange={event=>setNewCommonAreas(current=>current.map((area,i)=>i===index?event.target.value:area))} placeholder="Ex.: Academia, salão de festas..."/></label><button type="button" onClick={()=>setNewCommonAreas(current=>current.filter((_,i)=>i!==index))}><Trash2 size={14}/></button></div>)}</section></div><div className="modal-actions"><button className="outline-btn" onClick={()=>setWorkManagerOpen(false)}>Cancelar</button><button className="primary-btn" onClick={createWorkProject}><CheckCircle2 size={15}/> Cadastrar obra</button></div></div></div>}
    {editing && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setEditing(null)} aria-label="Fechar"/><div className="modal house-update-modal"><div className="modal-head"><div><span>ATUALIZAÇÃO DA OBRA</span><h2>Quadra {editing.block} • Casa {String(editing.lot).padStart(2,"0")}</h2><p>Status atual: {normalizeHouseStatus(editing.status)} • Responsável: {responsibleUser}</p></div><button onClick={() => setEditing(null)}><X size={18}/></button></div><div className="house-modal-tabs"><button className={houseModalTab === "Etapa" ? "active" : ""} onClick={()=>setHouseModalTab("Etapa")}><CheckCircle2 size={14}/> Etapa da obra</button><button className={houseModalTab === "Perdas e Roubos" ? "active warning" : ""} onClick={()=>setHouseModalTab("Perdas e Roubos")}><AlertTriangle size={14}/> Perdas e Roubos {editing.incidents?.length ? <span>{editing.incidents.length}</span> : null}</button></div>{houseModalTab === "Etapa" ? <><div className="house-stage-progress">{HOUSE_STATUSES.map((stage,index) => { const activeIndex = HOUSE_STATUSES.findIndex(item => item.name === nextStatus); return <div key={stage.name} className={index <= activeIndex ? "active" : ""}><i>{index < activeIndex ? <CheckCircle2 size={12}/> : index + 1}</i><span>{stage.name}</span></div>; })}</div><div className="house-update-body"><label>Novo status<select value={nextStatus} onChange={event => { setNextStatus(event.target.value as HouseWorkStatus); setPhotos({}); setSaveError(""); }}>{HOUSE_STATUSES.map(status => <option key={status.name}>{status.name}</option>)}</select></label><div className="status-preview" style={{"--preview-color":statusColor(nextStatus)} as React.CSSProperties}><i/><span>{nextStatus}</span></div>{HOUSE_STAGE_PHOTOS[nextStatus].length > 0 && <div className="stage-photo-slots wide">{HOUSE_STAGE_PHOTOS[nextStatus].map(label => <label className={photos[label] ? "filled" : ""} key={label}>{photos[label] ? <img src={photos[label]} alt={label}/> : <ImageIcon size={22}/>}<b>{label}</b><small>{photos[label] ? "Foto pronta • toque para substituir" : HOUSE_STAGE_OPTIONAL_PHOTOS.includes(nextStatus) ? "Foto opcional" : "Foto obrigatória"}</small><input type="file" accept="image/*" capture="environment" onChange={event => void readStagePhoto(label,event.target.files?.[0])}/>{photos[label] && <button type="button" onClick={event => { event.preventDefault(); setPhotos(current => { const next = {...current}; delete next[label]; return next; }); }}><X size={12}/> Remover</button>}</label>)}</div>}<label className="wide">Observação da etapa<textarea value={note} onChange={event => { setNote(event.target.value); setSaveError(""); }} placeholder={nextStatus === "AG. TUBULAÇÃO FORÇADA" ? "Informe os detalhes da tubulação forçada..." : "Descreva o serviço executado, pendências ou materiais utilizados..."}/><small>A observação poderá ser consultada no histórico permanente da casa.</small></label>{nextStatus === "SERVIÇO CONCLUÍDO" && <div className="completion-warning wide"><CheckCircle2 size={19}/><span><b>Finalização da casa</b><small>Ao confirmar, o sistema registrará automaticamente data, horário e {responsibleUser} como responsável.</small></span></div>}</div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditing(null)}>Cancelar</button><button className="primary-btn" disabled={!stageDirty || saveState === "saving"} onClick={() => void saveUpdate()}>{saveState === "saving" ? <RefreshCw size={15}/> : <CheckCircle2 size={15}/>} {saveState === "saving" ? "Salvando..." : "Salvar alterações"}</button></div></> : <><div className="incident-register-body"><div className="incident-form"><label>Tipo da ocorrência<select value={incidentType} onChange={event=>setIncidentType(event.target.value as "Perda" | "Roubo")}><option>Perda</option><option>Roubo</option></select></label><label className="incident-photo-upload">{incidentPhoto ? <img src={incidentPhoto} alt="Foto da ocorrência"/> : <><Camera size={25}/><b>Anexar foto da ocorrência</b><small>Câmera ou galeria • foto obrigatória</small></>}<input type="file" accept="image/*" capture="environment" onChange={event=>void readIncidentPhoto(event.target.files?.[0])}/></label><label className="wide">Observação<textarea value={incidentNote} onChange={event=>setIncidentNote(event.target.value)} placeholder="Descreva o item perdido ou roubado e os detalhes da ocorrência..."/></label></div><section className="incident-history"><header><b>Registros desta unidade</b><small>{editing.incidents?.length ?? 0} ocorrência(s)</small></header>{editing.incidents?.length ? editing.incidents.map(incident=>
<article key={incident.id}><label className="replaceable-photo"><img src={incident.photo} alt={incident.type}/><span>Alterar foto</span><input type="file" accept="image/*" capture="environment" onChange={event=>void replaceIncidentPhoto(incident.id,event.target.files?.[0])}/></label>
<div><strong>{incident.type}</strong><time>{new Date(incident.createdAt).toLocaleString("pt-BR")}</time><p>{incident.note || "Sem observação."}</p><small>Responsável: {incident.responsible}</small></div></article>) : <div className="incident-empty"><AlertTriangle size={20}/><span>Nenhuma perda ou roubo registrado nesta unidade.</span></div>}</section></div><div className="modal-actions"><button className="outline-btn" onClick={() => setEditing(null)}>Fechar</button><button className="danger-primary-btn" onClick={saveIncident}><Camera size={15}/> Registrar {incidentType.toLowerCase()}</button></div></>}</div></div>}
    {editing && saveError && <div role="alert" style={{position:"fixed",right:20,bottom:20,zIndex:1000,maxWidth:360,padding:"12px 15px",borderRadius:10,background:"#fff1f2",border:"1px solid #fda4af",color:"#9f1239",boxShadow:"0 12px 30px rgba(15,23,42,.22)",fontWeight:700}}>{saveError}</div>}
    {editing && !saveError && houseModalTab === "Etapa" && <div style={{position:"fixed",right:20,bottom:20,zIndex:999,maxWidth:360,padding:"10px 14px",borderRadius:10,background:"#0f172a",color:"#e2e8f0",boxShadow:"0 12px 30px rgba(15,23,42,.28)",fontSize:13}}>{saveState === "saving" ? "Salvando..." : stageDirty ? "Alterações não salvas" : "Nenhuma alteração realizada."}</div>}
    {historyHouse && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setHistoryHouse(null)} aria-label="Fechar"/><div className="modal house-history-modal"><div className="modal-head"><div><span>HISTÓRICO DA CASA</span><h2>Quadra {historyHouse.block} • Casa {String(historyHouse.lot).padStart(2,"0")}</h2><p>{historyHouse.history.length} alteração(ões) permanente(s) • clique numa etapa para ver os detalhes</p></div><button onClick={() => setHistoryHouse(null)}><X size={18}/></button></div><div className="house-timeline">{historyHouse.history.map(item => { const itemPhotos = normalizeStagePhotos(item.photos,item.photo,item.status); return <article key={item.id} onClick={() => setHistoryUpdate(item)} tabIndex={0}><i style={{background:statusColor(item.status)}}/><div><header><strong>{normalizeHouseStatus(item.status)} — Concluído</strong><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></header><p>Responsável: {item.responsible || "Não informado no registro antigo"}</p><small>{itemPhotos.length} foto(s) anexada(s){item.note ? " • com observação" : ""}</small></div></article>; })}</div><div className="modal-actions"><button className="outline-btn" onClick={() => issueWorkReport([historyHouse], `Relatório da Quadra ${historyHouse.block} — Casa ${String(historyHouse.lot).padStart(2,"0")}`)}><FileText size={14}/> Relatório completo</button><button className="primary-btn" onClick={() => setHistoryHouse(null)}>Fechar histórico</button></div></div></div>}
    {historyUpdate && <div className="modal-layer house-history-detail-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={() => setHistoryUpdate(null)} aria-label="Fechar"/><div className="modal house-history-detail"><div className="modal-head"><div><span>DETALHES DA ETAPA</span><h2>{normalizeHouseStatus(historyUpdate.status)}</h2><p>{new Date(historyUpdate.createdAt).toLocaleString("pt-BR")} • {historyUpdate.responsible || "Responsável não informado"}</p></div><button onClick={() => setHistoryUpdate(null)}><X size={18}/></button></div><div className="history-detail-body">{normalizeStagePhotos(historyUpdate.photos,historyUpdate.photo,historyUpdate.status).map(photo => 
<figure key={photo.label}><img src={photo.url} alt={photo.label}/><figcaption>{photo.label}</figcaption><label className="replace-history-photo"><Edit3 size={12}/> Alterar foto<input type="file" accept="image/*" capture="environment" onChange={event=>void replaceHistoryPhoto(photo.label,event.target.files?.[0])}/></label></figure>
)}{!normalizeStagePhotos(historyUpdate.photos,historyUpdate.photo,historyUpdate.status).length && <div className="no-stage-photos"><ImageIcon size={22}/><span>Nenhuma foto exigida ou anexada nesta etapa.</span></div>}<div className="history-detail-note"><b>Observações da etapa</b><p>{historyUpdate.note || "Nenhuma observação registrada."}</p></div></div><div className="modal-actions"><button className="primary-btn" onClick={() => setHistoryUpdate(null)}>Fechar detalhes</button></div></div></div>}
  </section>;
}

function GenericModule({ name, onOpen, onDelete, onUpdate, onConvert, companyCnpj, canEdit, records, allModules, serviceOrders }: { name: string; onOpen: (name: string) => void; onDelete: (moduleName: string, record: ModuleRecord) => void; onUpdate: (moduleName: string, record: ModuleRecord) => void; onConvert?: (record: ModuleRecord, target: "Pedido" | "Ordem de serviço") => void; companyCnpj?: string; canEdit: boolean; records: ModuleRecord[]; allModules?: Record<string, ModuleRecord[]>; serviceOrders?: ServiceOrder[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [activeView, setActiveView] = useState("Visão geral");
  const [editingCatalogRecord, setEditingCatalogRecord] = useState<ModuleRecord | null>(null);
  const [historyCatalogRecord, setHistoryCatalogRecord] = useState<ModuleRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<ModuleRecord | null>(null);
  const [detailTab, setDetailTab] = useState("Dados gerais");
  const [employeePasswordReset, setEmployeePasswordReset] = useState("");
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
  const openDetail = (record: ModuleRecord) => { setDetailRecord(record); setDetailTab("Dados gerais"); };
  const detailTabsFor = (moduleName: string) => moduleName === "Fornecedores"
    ? ["Dados gerais", "Compras", "Produtos fornecidos", "Financeiro", "Documentos", "Histórico"]
    : moduleName === "Equipamentos"
      ? ["Dados gerais", "Dados técnicos", "Ordens de serviço", "Manutenções", "Garantias", "Histórico"]
      : moduleName === "Compras"
        ? ["Dados gerais", "Itens", "Pagamento", "Financeiro", "Documentos", "Histórico"]
        : moduleName === "Produtos"
          ? ["Dados gerais", "Estoque", "Compras", "Clientes", "Histórico"]
          : moduleName === "Serviços"
            ? ["Dados gerais", "Clientes", "Ordens de serviço", "Orçamentos", "Histórico"]
            : ["Dados gerais", "Histórico"];
  const supplierMatches = (candidate: ModuleRecord, supplier: ModuleRecord) => {
    const values = [supplier.name, supplier.tradeName, supplier.legalName].filter(Boolean).map(value => String(value).trim().toLowerCase());
    return values.some(value => String(candidate.client || candidate.supplier || "").trim().toLowerCase() === value);
  };
  return <section className="module-page management-module">
    <div className="management-hero"><div><span className="section-kicker"><Grid2X2 size={12}/> MÓDULO PROAR</span><h2>{name}</h2><p>{descriptions[name] || `Consulte, cadastre e acompanhe todas as informações de ${name.toLowerCase()} em um só lugar.`}</p>{name === "Compras" && nfeStatus && <small className="nfe-search-status">{nfeStatus}</small>}</div><div className="management-actions">{name === "Compras" && <button className="outline-btn" onClick={searchDestinedNfe}><Search size={14}/> Buscar NF-e destinadas</button>}<ContextReports title={name} rows={filtered.map(record=>[record.id,record.name,record.status || "",String(record.value ?? "")])} options={name === "Equipamentos" ? ["Ficha técnica","Histórico de manutenção","Histórico de OS","Higienizações","Pendências","QR Code"] : name === "Estoque" ? ["Posição atual","Movimentações","Perdas","Reservas","Inventário"] : name === "Compras" ? ["Solicitação","Aprovação","Pedido","Recebimento","Divergências"] : name === "Financeiro" ? ["Conta específica","Contas a pagar","Contas a receber","Fluxo de caixa","Extrato","Resultado"] : name === "Orçamentos" ? ["Proposta comercial","Versão atual","Versões anteriores","Relatório sem valores internos"] : name === "Vendas" ? ["Comprovante da venda","Pedido","Relação de itens","Relatório financeiro da venda","Impressão sem valores"] : ["Relatório do módulo","Histórico","Documentos"]}/><button className="outline-btn" onClick={() => window.print()}><FileText size={14}/> Imprimir</button><button className="outline-btn" onClick={exportRecords}><ArrowDownRight size={14}/> Exportar</button><button className="primary-btn" onClick={() => onOpen(`Novo registro • ${name}`)}><Plus size={16}/> {name === "Compras" ? "Nova compra" : name === "Fornecedores" ? "Novo fornecedor" : name === "Financeiro" ? "Novo lançamento" : name === "Obras" ? "Nova obra" : "Novo registro"}</button></div></div>
    <div className="management-stats"><article><span><ClipboardList size={18}/></span><div><small>TOTAL DE REGISTROS</small><strong>{records.length}</strong></div></article><article><span><Clock3 size={18}/></span><div><small>PENDENTES / EM ABERTO</small><strong>{records.filter(record => /Rascunho|Aguardando|aberto|Vencida|Pendente/i.test(record.status || "")).length}</strong></div></article><article><span><CircleDollarSign size={18}/></span><div><small>VALOR REGISTRADO</small><strong>R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article></div>
    {managementFlows[name] && <div className="management-flow">{managementFlows[name].map((step, index) => <article key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{step.title}</b><small>{step.text}</small></div>{index < managementFlows[name].length - 1 && <ChevronRight size={14}/>}</article>)}</div>}
    <nav className="management-tabs" aria-label={`Áreas de ${name}`}>{tabs.map(tab => <button key={tab} className={activeView === tab ? "active" : ""} onClick={() => setActiveView(tab)}>{tab}</button>)}</nav>
    {name === "Financeiro" && <div className="finance-control-strip"><article><span className="money-icon red"><ArrowDownRight size={17}/></span><div><small>COMPROMISSOS EM ABERTO</small><strong>R$ {openValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article><article><span className="money-icon green"><ArrowUpRight size={17}/></span><div><small>MOVIMENTAÇÃO REALIZADA</small><strong>R$ {records.filter(record => /Paga|Recebida/i.test(record.status || "")).reduce((sum, record) => sum + (record.value ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></article><article><span><Landmark size={17}/></span><div><small>CONCILIAÇÃO</small><strong>{records.filter(record => /Paga|Recebida/i.test(record.status || "")).length} movimento(s)</strong></div></article></div>}
    <div className="management-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Pesquisar em ${name.toLowerCase()}...`}/></label><label className="status-filter"><Filter size={14}/><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>Todas</option>{statuses.map(status => <option key={status}>{status}</option>)}</select></label></div>
    {name === "Orçamentos" && filtered.length > 0 && <div className="budget-conversion-strip"><div><FileText size={17}/><span><b>Conversão rápida de orçamento</b><small>Transforme um orçamento sem digitar novamente os dados.</small></span></div>{filtered.map(record => <article key={`convert-${record.id}`}><span><b>{record.name}</b><small>{record.client} • R$ {(record.value ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})}</small></span><button disabled={!canEdit} onClick={() => onConvert?.(record,"Pedido")}><ShoppingBag size={13}/> Transformar em pedido</button><button disabled={!canEdit} onClick={() => onConvert?.(record,"Ordem de serviço")}><ClipboardList size={13}/> Transformar em OS</button></article>)}</div>}
    {records.length ? <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><ClipboardList size={12}/> {activeView.toUpperCase()}</span><h2>{activeView} de {name.toLowerCase()}</h2><p>{filtered.length} de {records.length} registro(s){catalogEditable ? " • Clique duas vezes para editar" : ""}</p></div></div>{name === "Obras" && <div className="works-grid">{filtered.map(record => <article key={record.id}><header><span><Building2 size={18}/></span><div><small>{record.id}</small><h3>{record.name}</h3></div><em className={`workflow-status ${record.status === "Concluída" ? "done" : record.status === "Cancelada" ? "blocked" : ""}`}>{record.status}</em></header><p><MapPin size={13}/>{record.address || "Endereço não informado"}</p><div className="work-meta"><span><small>CLIENTE</small><b>{record.client || "—"}</b></span><span><small>RESPONSÁVEL</small><b>{record.engineer || "—"}</b></span><span><small>QUADRA / LOTE</small><b>{record.blockLot || "—"}</b></span><span><small>ORÇAMENTO</small><b>R$ {(record.value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></span></div><div className="work-progress"><span><b>Progresso da obra</b><strong>{record.progress ?? 0}%</strong></span><i><b style={{width:`${Math.min(100, Math.max(0, record.progress ?? 0))}%`}}/></i></div><footer><button onClick={() => advance(record)}><CheckCircle2 size={14}/> Avançar etapa</button><button onClick={() => window.print()}><FileText size={14}/> Relatório</button><button className="danger" onClick={() => onDelete(name, record)}><Trash2 size={14}/></button></footer></article>)}</div>} {name !== "Obras" && <div className="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>NOME / IDENTIFICAÇÃO</th><th>FORNECEDOR / RESPONSÁVEL</th><th>SITUAÇÃO</th><th>VALOR</th><th>DATA</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(record => <tr key={record.id} className={catalogEditable ? "editable-row" : ""} title={catalogEditable ? "Clique duas vezes para editar" : undefined} onDoubleClick={() => (["Fornecedores","Equipamentos","Compras","Produtos","Serviços"].includes(name) ? openDetail(record) : catalogEditable && setEditingCatalogRecord({ ...record }))}><td><b className="order-id">{record.id}</b></td><td><strong>{record.name}</strong><small className="table-description">{name === "Compras" ? `${record.purchaseItems?.length ?? 0} item(ns) • ${record.paymentType ?? "Pagamento não informado"}${record.installments && record.installments > 1 ? ` • ${record.installments}x` : ""}` : catalogEditable ? `${record.category || record.kind || "Cadastro"} • Custo R$ ${(record.cost ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : record.description || "Sem observações"}</small></td><td>{record.client || "—"}</td><td><span className={`workflow-status ${/Recebida|Paga|Ativo|Concluído/i.test(record.status || "") ? "done" : /Cancelada|Inativo|Bloqueado|Devolvida/i.test(record.status || "") ? "blocked" : ""}`}>{record.status || statuses[0]}</span></td><td><b>R$ {(record.value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></td><td>{record.date ? new Date(`${record.date}T12:00:00`).toLocaleDateString("pt-BR") : record.createdAt}</td><td><div className="record-actions">{["Fornecedores","Equipamentos","Compras","Produtos","Serviços"].includes(name) && <button title="Abrir ficha completa" onClick={() => openDetail(record)}><Eye size={14}/></button>}{catalogEditable && <button title="Editar cadastro" onClick={() => setEditingCatalogRecord({ ...record })}><Edit3 size={14}/></button>}{(name === "Produtos" || name === "Serviços") && <button title="Histórico do cadastro" onClick={() => setHistoryCatalogRecord(record)}><History size={14}/></button>}<button title="Avançar situação" onClick={() => advance(record)}><CheckCircle2 size={14}/></button>{name === "Compras" && <button title="Duplicar compra" onClick={() => duplicate(record)}><FileText size={14}/></button>}<button title="Imprimir" onClick={() => window.print()}><ReceiptText size={14}/></button><button className="danger" title="Excluir" onClick={() => onDelete(name, record)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>}{!filtered.length && <div className="linked-empty"><Search size={22}/><h4>Nenhum registro encontrado</h4><p>Ajuste a pesquisa ou o filtro de situação.</p></div>}</div> :
    <div className="empty-grid">{[{t:"Visão geral",i:LayoutDashboard},{t:"Registros recentes",i:Clock3},{t:"Indicadores",i:TrendingUp}].map(({t,i:Icon})=><article className="panel" key={t}><span><Icon size={19}/></span><h3>{t}</h3><p>Use “Novo registro” para adicionar o primeiro cadastro deste módulo.</p><button onClick={() => onOpen(`Novo registro • ${name}`)}>Cadastrar agora <ArrowRight size={12}/></button></article>)}</div>}
    {detailRecord && (() => {
      const tabs = detailTabsFor(name);
      const relatedPurchases = name === "Fornecedores" ? (allModules?.Compras ?? []).filter(item => supplierMatches(item, detailRecord)) : name === "Produtos" ? (allModules?.Compras ?? []).filter(item => item.purchaseItems?.some(p => p.productId === detailRecord.id || p.description.trim().toLowerCase() === detailRecord.name.trim().toLowerCase())) : [];
      const relatedSales = (allModules?.Vendas ?? []).filter(item => item.purchaseItems?.some(p => p.productId === detailRecord.id || p.description.trim().toLowerCase() === detailRecord.name.trim().toLowerCase()));
      const relatedBudgets = (allModules?.Orçamentos ?? []).filter(item => item.purchaseItems?.some(p => p.productId === detailRecord.id || p.description.trim().toLowerCase() === detailRecord.name.trim().toLowerCase()));
      const relatedOrders = (serviceOrders ?? []).filter(order => name === "Equipamentos" ? order.client === detailRecord.client && (!detailRecord.equipmentUnit || order.unit === detailRecord.equipmentUnit) : order.catalogItems?.some(item => item.id === detailRecord.id || item.name.trim().toLowerCase() === detailRecord.name.trim().toLowerCase()));
      const supplierProducts = name === "Fornecedores" ? (allModules?.Produtos ?? []).filter(item => String(item.supplier || "").trim().toLowerCase() === detailRecord.name.trim().toLowerCase()) : [];
      const supplierFinance = name === "Fornecedores" ? (allModules?.Financeiro ?? []).filter(item => supplierMatches(item, detailRecord)) : name === "Compras" ? (allModules?.Financeiro ?? []).filter(item => item.purchaseId === detailRecord.id) : [];
      const clients = Array.from(new Set([...relatedSales.map(item=>item.client), ...relatedBudgets.map(item=>item.client), ...relatedOrders.map(item=>item.client)].filter(Boolean)));
      const field = (label: string, value: unknown) => <div className="entity-field"><small>{label}</small><strong>{value === undefined || value === null || value === "" ? "—" : String(value)}</strong></div>;
      const money = (value?: number) => `R$ ${(value ?? 0).toLocaleString("pt-BR", {minimumFractionDigits:2})}`;
      const list = (items: {id:string; name?:string; client?:string; date?:string; createdAt?:string; status?:string; value?:number}[], empty: string) => items.length ? <div className="entity-history-list">{items.map(item => <article key={item.id}><span><b>{item.id} • {item.name || item.client || "Registro"}</b><small>{item.client || item.status || "—"}</small></span><time>{item.date || item.createdAt || "—"}</time>{item.value !== undefined && <strong>{money(item.value)}</strong>}</article>)}</div> : <div className="entity-empty"><History size={20}/><span>{empty}</span></div>;
      let content: any = null;
      if (detailTab === "Dados gerais") content = <div className="entity-fields-grid">{field("Código", detailRecord.id)}{field("Nome / fantasia", detailRecord.name)}{field("Razão social", detailRecord.legalName)}{field("CPF / CNPJ", detailRecord.doc)}{field("Responsável", detailRecord.contact || detailRecord.client)}{field("Telefone", detailRecord.phone)}{field("E-mail", detailRecord.email)}{field("Categoria", detailRecord.category)}{field("Situação", detailRecord.status || "Ativo")}{field("Endereço", detailRecord.address || [detailRecord.street,detailRecord.addressNumber,detailRecord.neighborhood,detailRecord.city,detailRecord.state].filter(Boolean).join(", "))}<div className="entity-field wide"><small>Observações</small><strong>{detailRecord.description || "Sem observações cadastradas."}</strong></div></div>;
      else if (detailTab === "Compras") content = list(relatedPurchases, "Nenhuma compra vinculada a este cadastro.");
      else if (detailTab === "Produtos fornecidos") content = list(supplierProducts, "Nenhum produto vinculado a este fornecedor.");
      else if (detailTab === "Financeiro") content = list(supplierFinance, "Nenhum lançamento financeiro vinculado.");
      else if (detailTab === "Itens") content = detailRecord.purchaseItems?.length ? <div className="entity-items-table"><table><thead><tr><th>ITEM</th><th>QTD.</th><th>UNITÁRIO</th><th>TOTAL</th></tr></thead><tbody>{detailRecord.purchaseItems.map((item,index)=><tr key={`${item.description}-${index}`}><td><b>{item.description}</b></td><td>{item.quantity}</td><td>{money(item.unitValue)}</td><td>{money(item.quantity*item.unitValue)}</td></tr>)}</tbody></table></div> : <div className="entity-empty">Nenhum item informado.</div>;
      else if (detailTab === "Pagamento") content = <div className="entity-fields-grid">{field("Tipo", detailRecord.paymentType)}{field("Forma", detailRecord.paymentMethod)}{field("Parcelas", detailRecord.installments)}{field("Primeiro vencimento", detailRecord.firstDueDate)}{field("Valor total", money(detailRecord.value))}</div>;
      else if (detailTab === "Dados técnicos") content = <><div className="entity-fields-grid">{field("Tipo de equipamento", detailRecord.equipmentType)}{field("Marca", detailRecord.brand)}{field("Modelo", detailRecord.model)}{field("Capacidade", detailRecord.capacityBtus ? `${detailRecord.capacityBtus.toLocaleString("pt-BR")} BTUs` : "—")}{field("Número de série", detailRecord.serialNumber)}{field("Tensão", detailRecord.voltage)}{field("Frequência", detailRecord.frequency)}{field("Corrente", detailRecord.current)}{field("Potência", detailRecord.power)}{field("Fluido refrigerante", detailRecord.refrigerant)}{field("Carga de refrigerante", detailRecord.refrigerantCharge)}{field("Fabricação", detailRecord.manufactureDate)}{field("Referência fabricante", detailRecord.manufacturerCode)}{field("Local de instalação", detailRecord.installationLocation)}{field("Unidade / setor", detailRecord.equipmentUnit)}</div>{detailRecord.equipmentLabelImage && <section className="equipment-label-history"><header><div><span>ETIQUETA VINCULADA</span><h3>Foto técnica original</h3></div><button className="outline-btn" onClick={() => onOpen("Novo • Equipamentos")}><Sparkles size={14}/> Ler nova etiqueta com IA</button></header><img src={detailRecord.equipmentLabelImage} alt={detailRecord.equipmentLabelImageName || "Etiqueta técnica"}/><small>{detailRecord.equipmentLabelHistory?.[0] || "Etiqueta cadastrada"}</small></section>}</>;
      else if (detailTab === "Ordens de serviço" || detailTab === "Manutenções") content = relatedOrders.length ? <div className="entity-history-list">{relatedOrders.map(order=><article key={order.id}><span><b>{order.id} • {order.service}</b><small>{order.client} • {order.unit}</small></span><time>{order.date}</time><strong>{order.status}</strong></article>)}</div> : <div className="entity-empty">Nenhuma ordem de serviço vinculada.</div>;
      else if (detailTab === "Garantias") content = <div className="entity-fields-grid">{field("Garantia", detailRecord.warrantyMonths ? `${detailRecord.warrantyMonths} meses` : "—")}{field("Data de instalação", detailRecord.installationDate)}{field("Próxima preventiva", detailRecord.nextMaintenanceDate)}</div>;
      else if (detailTab === "Estoque") content = <div className="entity-fields-grid">{field("Estoque atual", detailRecord.stockCurrent)}{field("Estoque mínimo", detailRecord.stockMin)}{field("Estoque máximo", detailRecord.stockMax)}{field("Localização", detailRecord.stockLocation)}{field("Custo", money(detailRecord.cost))}{field("Preço de venda", money(detailRecord.value))}</div>;
      else if (detailTab === "Clientes") content = clients.length ? <div className="history-chip-list">{clients.map(client=><span key={client}><UserRound size={13}/>{client}</span>)}</div> : <div className="entity-empty">Nenhum cliente vinculado.</div>;
      else if (detailTab === "Orçamentos") content = list(relatedBudgets, "Nenhum orçamento vinculado.");
      else if (detailTab === "Documentos") content = <div className="entity-document-grid"><article><FileText size={20}/><b>Documentos do cadastro</b><small>Área preparada para contratos, notas, certificados e anexos.</small><button onClick={()=>window.print()}>Imprimir ficha</button></article></div>;
      else content = list([...(relatedPurchases as ModuleRecord[]), ...(relatedSales as ModuleRecord[]), ...(relatedBudgets as ModuleRecord[])].sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt))), "Nenhum histórico registrado ainda.");
      return <div className="modal-layer entity-detail-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" aria-label="Fechar ficha" onClick={()=>setDetailRecord(null)}/><div className="modal entity-detail-modal"><div className="entity-detail-head"><div className="entity-avatar">{detailRecord.name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div><div><span>FICHA COMPLETA • {name.toUpperCase()}</span><h2>{detailRecord.name}</h2><p>{detailRecord.id} • {detailRecord.status || "Ativo"}</p></div><div className="entity-detail-actions"><button className="outline-btn" onClick={()=>setEditingCatalogRecord({...detailRecord})}><Edit3 size={14}/> Editar</button><button onClick={()=>setDetailRecord(null)}><X size={18}/></button></div></div><nav className="entity-detail-tabs">{tabs.map(tab=><button key={tab} className={detailTab===tab?"active":""} onClick={()=>setDetailTab(tab)}>{tab}</button>)}</nav><div className="entity-detail-body">{content}</div><div className="modal-actions"><button className="outline-btn" onClick={()=>window.print()}><FileText size={14}/> Imprimir ficha</button><button className="primary-btn" onClick={()=>setDetailRecord(null)}>Fechar</button></div></div></div>;
    })()}
    {editingCatalogRecord && <div className="modal-layer catalog-edit-layer" role="dialog" aria-modal="true" aria-label={`Editar ${editingCatalogRecord.name}`}><button className="modal-backdrop" aria-label="Fechar edição" onClick={() => setEditingCatalogRecord(null)}/><div className="modal catalog-edit-modal"><div className="modal-head"><div><span>EDIÇÃO RÁPIDA • {name.toUpperCase()}</span><h2>{editingCatalogRecord.name}</h2><p>{name === "Funcionários" ? "Altere o acesso, perfil e dados do funcionário." : "Altere nome, preço e custo do cadastro."}</p></div><button onClick={() => setEditingCatalogRecord(null)} aria-label="Fechar"><X size={18}/></button></div><div className="catalog-edit-form"><label className="wide">Nome / identificação<input autoFocus value={editingCatalogRecord.name} onChange={event => setEditingCatalogRecord(record => record ? { ...record, name: event.target.value } : record)}/></label>{name === "Funcionários" ? <><label>Nome de utilizador<input value={editingCatalogRecord.employeeUsername ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, employeeUsername: event.target.value.toLocaleLowerCase("pt-BR").replace(/\s+/g, "."), client: event.target.value.toLocaleLowerCase("pt-BR").replace(/\s+/g, ".") } : record)} placeholder="nome.sobrenome"/></label><label>Nova senha<input type="password" autoComplete="new-password" value={employeePasswordReset} onChange={event => setEmployeePasswordReset(event.target.value)} placeholder="Deixe vazio para manter a atual"/><small>Mínimo de 4 caracteres para redefinir.</small></label><label>Perfil<select value={editingCatalogRecord.employeeRole ?? "Atendimento"} onChange={event => setEditingCatalogRecord(record => record ? { ...record, employeeRole: event.target.value } : record)}><option>Administrador</option><option>Financeiro</option><option>Técnico de Campo</option><option>Atendimento</option></select></label></> : <><label>Preço de venda<input type="number" min="0" step="0.01" value={editingCatalogRecord.value ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, value: Number(event.target.value) || 0 } : record)}/></label><label>Preço de custo<input type="number" min="0" step="0.01" value={editingCatalogRecord.cost ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, cost: Number(event.target.value) || 0 } : record)}/></label>{(name === "Produtos" || name === "Serviços") && <><label>Código interno / SKU<input value={editingCatalogRecord.sku ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,sku:event.target.value}:record)}/></label><label>Código de barras<input value={editingCatalogRecord.barcode ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,barcode:event.target.value}:record)}/></label><label>Marca<input value={editingCatalogRecord.brand ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,brand:event.target.value}:record)}/></label><label>Modelo<input value={editingCatalogRecord.model ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,model:event.target.value}:record)}/></label><label>Fornecedor principal<input value={editingCatalogRecord.supplier ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,supplier:event.target.value}:record)}/></label>{name === "Produtos" ? <><label>Estoque atual<input type="number" min="0" step="0.001" value={editingCatalogRecord.stockCurrent ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,stockCurrent:Number(event.target.value)||0}:record)}/></label><label>Estoque mínimo<input type="number" min="0" step="0.001" value={editingCatalogRecord.stockMin ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,stockMin:Number(event.target.value)||0}:record)}/></label><label>Estoque máximo<input type="number" min="0" step="0.001" value={editingCatalogRecord.stockMax ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,stockMax:Number(event.target.value)||0}:record)}/></label><label>Localização<input value={editingCatalogRecord.stockLocation ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,stockLocation:event.target.value}:record)}/></label></> : <label>Tempo estimado (min)<input type="number" min="0" value={editingCatalogRecord.estimatedMinutes ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,estimatedMinutes:Number(event.target.value)||0}:record)}/></label>}<label>Garantia (meses)<input type="number" min="0" value={editingCatalogRecord.warrantyMonths ?? ""} onChange={event=>setEditingCatalogRecord(record=>record?{...record,warrantyMonths:Number(event.target.value)||0}:record)}/></label><label>Unidade de medida<select value={editingCatalogRecord.unitOfMeasure ?? (name === "Serviços" ? "serviço" : "un")} onChange={event=>setEditingCatalogRecord(record=>record?{...record,unitOfMeasure:event.target.value}:record)}><option>un</option><option>serviço</option><option>m</option><option>m²</option><option>kg</option><option>l</option><option>h</option><option>kit</option></select></label></>}</>}<label>Categoria<input value={editingCatalogRecord.category ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, category: event.target.value } : record)}/></label><label>Situação<select value={editingCatalogRecord.status ?? "Ativo"} onChange={event => setEditingCatalogRecord(record => record ? { ...record, status: event.target.value } : record)}><option>Ativo</option><option>Inativo</option><option>Pendente</option></select></label><label className="wide">Descrição / observações<textarea value={editingCatalogRecord.description ?? ""} onChange={event => setEditingCatalogRecord(record => record ? { ...record, description: event.target.value } : record)}/></label>{name !== "Funcionários" && <div className="wide catalog-margin-preview"><span><CircleDollarSign size={18}/><div><small>MARGEM BRUTA ESTIMADA</small><b>R$ {Math.max(0, (editingCatalogRecord.value ?? 0) - (editingCatalogRecord.cost ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></div></span><strong>{editingCatalogRecord.value ? `${Math.max(0, (((editingCatalogRecord.value ?? 0) - (editingCatalogRecord.cost ?? 0)) / editingCatalogRecord.value) * 100).toFixed(1)}%` : "0%"}</strong></div>}</div><div className="modal-actions"><button className="outline-btn" onClick={() => { setEditingCatalogRecord(null); setEmployeePasswordReset(""); }}>Cancelar</button><button className="primary-btn" disabled={!editingCatalogRecord.name.trim() || (name === "Funcionários" && (!editingCatalogRecord.employeeUsername?.trim() || (employeePasswordReset.length > 0 && employeePasswordReset.length < 4)))} onClick={async () => { const updated = name === "Funcionários" && employeePasswordReset ? { ...editingCatalogRecord, employeePasswordHash: await passwordHash(employeePasswordReset) } : editingCatalogRecord; onUpdate(name, updated); setEditingCatalogRecord(null); setEmployeePasswordReset(""); }}><CheckCircle2 size={15}/> Salvar alterações</button></div></div></div>}
    {historyCatalogRecord && (()=>{const key=historyCatalogRecord.id;const norm=historyCatalogRecord.name.trim().toLowerCase();const matches=(item:PurchaseItem)=>item.productId===key||item.description.trim().toLowerCase()===norm;const sales=(allModules?.Vendas??[]).filter(record=>record.purchaseItems?.some(matches));const budgets=(allModules?.Orçamentos??[]).filter(record=>record.purchaseItems?.some(matches));const purchases=(allModules?.Compras??[]).filter(record=>record.purchaseItems?.some(matches)).sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt)));const orders=(serviceOrders??[]).filter(order=>order.catalogItems?.some(item=>item.id===key||item.name.trim().toLowerCase()===norm));const clients=Array.from(new Set([...sales.map(item=>item.client),...budgets.map(item=>item.client),...orders.map(item=>item.client)].filter(Boolean)));const lastPurchase=purchases[0];const lastItem=lastPurchase?.purchaseItems?.find(matches);return <div className="modal-layer catalog-history-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" aria-label="Fechar histórico" onClick={()=>setHistoryCatalogRecord(null)}/><div className="modal catalog-history-modal"><div className="modal-head"><div><span>HISTÓRICO • {name.toUpperCase()}</span><h2>{historyCatalogRecord.name}</h2><p>Consumo por cliente, compras e utilização operacional deste cadastro.</p></div><button onClick={()=>setHistoryCatalogRecord(null)}><X size={18}/></button></div><div className="catalog-history-summary"><article><small>CLIENTES QUE CONSUMIRAM</small><b>{clients.length}</b></article><article><small>VENDAS</small><b>{sales.length}</b></article><article><small>ORÇAMENTOS</small><b>{budgets.length}</b></article><article><small>OS / UTILIZAÇÕES</small><b>{orders.length}</b></article>{name==="Produtos"&&<article><small>ÚLTIMA COMPRA</small><b>{lastPurchase?.date?new Date(`${lastPurchase.date}T12:00:00`).toLocaleDateString("pt-BR"):lastPurchase?.createdAt||"—"}</b><em>{lastItem?`R$ ${lastItem.unitValue.toLocaleString("pt-BR",{minimumFractionDigits:2})} • ${lastPurchase?.client||"Fornecedor"}`:"Sem compra registrada"}</em></article>}</div><div className="catalog-history-tabs"><section><h3>Clientes que consumiram</h3>{clients.length?<div className="history-chip-list">{clients.map(client=><span key={client}><UserRound size={13}/>{client}</span>)}</div>:<p>Nenhum consumo vinculado a cliente até o momento.</p>}</section><section><h3>Movimentações</h3><div className="catalog-movement-list">{[...sales.map(item=>({type:"Venda",id:item.id,client:item.client,date:item.date||item.createdAt,value:item.value})),...purchases.map(item=>({type:"Compra",id:item.id,client:item.client,date:item.date||item.createdAt,value:item.value})),...orders.map(item=>({type:"OS",id:item.id,client:item.client,date:item.date,value:0}))].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map((item,index)=><article key={`${item.type}-${item.id}-${index}`}><span><b>{item.type} • {item.id}</b><small>{item.client||"—"}</small></span><time>{item.date||"—"}</time>{item.value? <strong>R$ {item.value.toLocaleString("pt-BR",{minimumFractionDigits:2})}</strong>:null}</article>)}</div></section></div><div className="modal-actions"><button className="primary-btn" onClick={()=>setHistoryCatalogRecord(null)}>Fechar histórico</button></div></div></div>})()}
  </section>;
}

type ModalSave = {
  title: string;
  name: string;
  client: string;
  doc: string;
  contact: string;
  phone: string;
  personType?: "PF" | "PJ";
  organizationType?: Customer["organizationType"];
  legalName?: string;
  tradeName?: string;
  email?: string;
  zipCode?: string;
  street?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  cnaeMain?: string;
  taxStatus?: string;
  creditLimit?: number;
  balancePosted?: number;
  financialStatus?: Customer["financialStatus"];
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
  sku: string;
  barcode: string;
  brand: string;
  model: string;
  supplier: string;
  stockCurrent: number;
  stockMin: number;
  stockMax: number;
  stockLocation: string;
  warrantyMonths: number;
  estimatedMinutes: number;
  unitOfMeasure: string;
  employeeRole: string;
  employeePermissions: Record<string, ("Visualizar" | "Criar" | "Editar" | "Excluir")[]>;
  employeeUsername?: string;
  employeePassword?: string;
  equipmentType?: string;
  capacityBtus?: number;
  serialNumber?: string;
  voltage?: string;
  refrigerant?: string;
  installationLocation?: string;
  installationDate?: string;
  nextMaintenanceDate?: string;
  equipmentUnit?: string;
  frequency?: string;
  current?: string;
  power?: string;
  refrigerantCharge?: string;
  manufactureDate?: string;
  manufacturerCode?: string;
  equipmentLabelImage?: string;
  equipmentLabelImageName?: string;
  equipmentLabelHistory?: string[];
};

type AuthenticatedUser = { username: string; displayName: string; role?: string; permissions?: string[]; companyId?: string; companySlug?: string; trialExpiresAt?: string };

async function passwordHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function LoginScreen({ onLogin }: { onLogin: (user: AuthenticatedUser) => void }) {
  const tenant = typeof window !== "undefined" ? (() => { const host=window.location.hostname.toLowerCase(); const root=(process.env.NEXT_PUBLIC_PROAR_ROOT_DOMAIN || "proar.online").toLowerCase(); if(host.endsWith(`.${root}`)){ const sub=host.slice(0,-(`.${root}`.length)); if(sub && !["www","manager","teste","api","admin","docs","status"].includes(sub)) return sub; } return new URLSearchParams(window.location.search).get("tenant") || ""; })() : "";
  const [tenantCompany, setTenantCompany] = useState<{trade_name?: string; legal_name?: string; logo_path?: string; brand_config?: {logo?: string; systemName?: string; tagline?: string; primaryColor?: string}; daysRemaining?: number; expired?: boolean} | null>(null);
  useEffect(() => { if (!tenant) return; fetch(`/api/trial/company?slug=${encodeURIComponent(tenant)}`, {cache:"no-store"}).then(async r => r.ok ? (await r.json()).company : null).then(company => { setTenantCompany(company); if (company?.trade_name) document.title = `${company.trade_name} | ProAR Gestão de Serviços`; }).catch(()=>{}); }, [tenant]);
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
        body: JSON.stringify({ username, password, tenant }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível entrar.");
      if (result.mustChangePassword && tenant) { window.location.href = `/trocar-senha`; return; }
      onLogin({ username: result.username, displayName: result.displayName, role: result.role, permissions: result.permissions, companyId: result.companyId, companySlug: result.companySlug, trialExpiresAt: result.trialExpiresAt });
    } catch (loginError) {
      const moduleKeys = Object.keys(localStorage).filter(key => key === "proar-v3-module-records" || key.endsWith(":module-records"));
      const modules = moduleKeys.reduce<Record<string, ModuleRecord[]>>((merged, key) => {
        try {
          const stored = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, ModuleRecord[]>;
          return { ...merged, Funcionários: [...(merged.Funcionários ?? []), ...(stored.Funcionários ?? [])] };
        } catch { return merged; }
      }, {});
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
    <section className="login-panel">
      <form onSubmit={submit}>
        <header className="login-form-heading"><h2>Acessar o ProAR</h2><p>Entre com suas credenciais</p></header>
        <i className="login-heading-line"/>
        <label>E-mail ou Usuário<div className="login-input"><UserRound size={19}/><input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Digite seu e-mail ou usuário"/></div></label>
        <label>Senha<div className="password-field login-input"><LockKeyhole size={19}/><input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Digite sua senha"/><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div></label>
        <div className="login-options"><label><input type="checkbox" defaultChecked/> <span>Lembrar de mim</span></label><a href="/trocar-senha">Esqueci minha senha</a></div>
        {error && <div className="login-error" role="alert"><AlertTriangle size={15}/>{error}</div>}
        <button className="login-submit" disabled={loading || !username || !password}>{loading ? "Verificando..." : <><LogIn size={20}/> Entrar no sistema</>}</button>
        {tenantCompany?.daysRemaining !== undefined && <div className="login-trial"><Clock3 size={16}/>{tenantCompany.expired ? "Período de teste encerrado" : `${tenantCompany.daysRemaining} dia(s) restantes no período de teste`}</div>}
        <footer className="login-form-security"><ShieldCheck size={18}/> Seus dados estão protegidos com segurança</footer>
      </form>
    </section>
  </main>;
}

function Modal({ title, customers, structures, catalogRecords, supplierRecords, employeeRecords, close, onSave }: { title: string; customers: Customer[]; structures: ModuleRecord[]; catalogRecords: ModuleRecord[]; supplierRecords: ModuleRecord[]; employeeRecords: ModuleRecord[]; close: () => void; onSave: (data: ModalSave) => void | Promise<void> }) {
  const isLinkedStructure = title.startsWith("Nova unidade, filial ou setor");
  const isNewOrder = title === "Nova ordem de serviço";
  const isNewCustomer = title === "Novo cliente";
  const isCatalogRegistration = title.includes("Serviços") || title.includes("Produtos");
  const isEquipmentRegistration = title.includes("Equipamentos");
  const [selectedClient, setSelectedClient] = useState("");
  const [unit, setUnit] = useState("");
  const [sector, setSector] = useState("");
  const [tech, setTech] = useState("");
  const [time, setTime] = useState("");
  const [recordName, setRecordName] = useState("");
  const [recordClient, setRecordClient] = useState("");
  const [doc, setDoc] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [personType, setPersonType] = useState<"PF" | "PJ">("PF");
  const [organizationType, setOrganizationType] = useState<Customer["organizationType"]>("Pessoa Física");
  useEffect(() => setOrganizationType(current => personType === "PJ" && current === "Pessoa Física" ? "Empresa" : personType === "PF" && current === "Empresa" ? "Pessoa Física" : current), [personType]);
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [customerCity, setCustomerCity] = useState("");
  const [customerState, setCustomerState] = useState("");
  const [stateRegistration, setStateRegistration] = useState("");
  const [municipalRegistration, setMunicipalRegistration] = useState("");
  const [cnaeMain, setCnaeMain] = useState("");
  const [taxStatus, setTaxStatus] = useState("");
  const [documentLookup, setDocumentLookup] = useState<{loading:boolean;message:string;kind:""|"ok"|"error"}>({loading:false,message:"",kind:""});
  const [creditLimit, setCreditLimit] = useState(0);
  const [balancePosted, setBalancePosted] = useState(0);
  const [financialStatus, setFinancialStatus] = useState<Customer["financialStatus"]>("Liberado");
  const [address, setAddress] = useState("");
  const [addressValidated, setAddressValidated] = useState(false);
  const [showAddressMap, setShowAddressMap] = useState(false);
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const requestedModule = title.includes("•") ? title.split("•").pop()!.trim() : title.replace(/^Novo(a)?\s+/i, "");
  const [recordStatus, setRecordStatus] = useState(moduleStatuses[requestedModule]?.[0] ?? "Ativo");
  const [recordValue, setRecordValue] = useState("");
  const [recordCost, setRecordCost] = useState("");
  const [catalogSku, setCatalogSku] = useState("");
  const [catalogBarcode, setCatalogBarcode] = useState("");
  const [catalogBrand, setCatalogBrand] = useState("");
  const [catalogModel, setCatalogModel] = useState("");
  const [catalogSupplier, setCatalogSupplier] = useState("");
  const [catalogStockCurrent, setCatalogStockCurrent] = useState("");
  const [catalogStockMin, setCatalogStockMin] = useState("");
  const [catalogStockMax, setCatalogStockMax] = useState("");
  const [catalogStockLocation, setCatalogStockLocation] = useState("");
  const [catalogWarranty, setCatalogWarranty] = useState("");
  const [catalogEstimatedMinutes, setCatalogEstimatedMinutes] = useState("");
  const [catalogUnit, setCatalogUnit] = useState(title.includes("Serviços") ? "serviço" : "un");
  const [equipmentType, setEquipmentType] = useState("Split Hi Wall");
  const [capacityBtus, setCapacityBtus] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [voltage, setVoltage] = useState("220V");
  const [refrigerant, setRefrigerant] = useState("R32");
  const [installationLocation, setInstallationLocation] = useState("");
  const [installationDate, setInstallationDate] = useState("");
  const [nextMaintenanceDate, setNextMaintenanceDate] = useState("");
  const [equipmentUnit, setEquipmentUnit] = useState("");
  const [frequency, setFrequency] = useState("");
  const [currentDraw, setCurrentDraw] = useState("");
  const [power, setPower] = useState("");
  const [refrigerantCharge, setRefrigerantCharge] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");
  const [manufacturerCode, setManufacturerCode] = useState("");
  const [equipmentLabel, setEquipmentLabel] = useState<{ name: string; dataUrl: string } | null>(null);
  const [labelReading, setLabelReading] = useState(false);
  const [labelError, setLabelError] = useState("");
  const [labelReview, setLabelReview] = useState<Record<string, string> | null>(null);
  const labelFileRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);
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
  const readEquipmentLabel = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLabelError("Selecione uma imagem da etiqueta do equipamento."); return; }
    if (file.size > 8 * 1024 * 1024) { setLabelError("A imagem deve ter no máximo 8 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setEquipmentLabel({ name: file.name, dataUrl: String(reader.result) }); setLabelError(""); setLabelReview(null); };
    reader.readAsDataURL(file);
  };
  const analyseEquipmentLabel = async () => {
    if (!equipmentLabel) { setLabelError("Tire uma foto ou anexe a etiqueta antes de usar a IA."); return; }
    setLabelReading(true); setLabelError("");
    try {
      const response = await fetch("/api/equipment-label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: equipmentLabel.dataUrl }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível analisar a etiqueta.");
      setLabelReview(result.fields || {});
    } catch (error) { setLabelError(error instanceof Error ? error.message : "Não foi possível analisar a etiqueta."); }
    finally { setLabelReading(false); }
  };
  const applyLabelReading = () => {
    if (!labelReview) return;
    const value = (key: string) => labelReview[key] || "";
    if (value("brand")) setCatalogBrand(value("brand")); if (value("model")) setCatalogModel(value("model"));
    if (value("equipmentType")) setEquipmentType(value("equipmentType")); if (value("capacityBtus")) setCapacityBtus(value("capacityBtus").replace(/\D/g, ""));
    if (value("serialNumber")) setSerialNumber(value("serialNumber")); if (value("voltage")) setVoltage(value("voltage"));
    if (value("refrigerant")) setRefrigerant(value("refrigerant")); if (value("frequency")) setFrequency(value("frequency"));
    if (value("current")) setCurrentDraw(value("current")); if (value("power")) setPower(value("power"));
    if (value("refrigerantCharge")) setRefrigerantCharge(value("refrigerantCharge")); if (value("manufactureDate")) setManufactureDate(value("manufactureDate"));
    if (value("manufacturerCode")) setManufacturerCode(value("manufacturerCode"));
    if (!recordName && (value("model") || value("brand"))) setRecordName([value("brand"), value("model")].filter(Boolean).join(" "));
    setLabelReview(null);
  };
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
  const formatCpfCnpj = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, "$1.$2.$3/$4-$5");
  };
  const composeCustomerAddress = (parts?: Partial<{street:string;addressNumber:string;complement:string;neighborhood:string;city:string;state:string;zipCode:string}>) => {
    const p = {street,addressNumber,complement,neighborhood,city:customerCity,state:customerState,zipCode,...parts};
    return [p.street, p.addressNumber, p.complement, p.neighborhood, p.city && p.state ? `${p.city}/${p.state}` : p.city || p.state, p.zipCode ? `CEP ${p.zipCode}` : ""].filter(Boolean).join(", ");
  };
  const lookupCustomerDocument = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setPersonType(digits.length > 11 ? "PJ" : "PF");
    setDoc(formatCpfCnpj(raw));
    if (digits.length !== 14) { setDocumentLookup({loading:false,message:digits.length===11?"CPF reconhecido. Preencha os dados do cliente.":"",kind:""}); return; }
    setDocumentLookup({loading:true,message:"Consultando CNPJ...",kind:""});
    try {
      const response = await fetch(`/api/cnpj/${digits}`, {cache:"no-store"});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "CNPJ não encontrado");
      setPersonType("PJ");
      setLegalName(result.legalName || "");
      setTradeName(result.tradeName || result.legalName || "");
      setRecordName(result.tradeName || result.legalName || recordName);
      setCustomerEmail(result.email || "");
      setPhone(result.phone || phone);
      setZipCode(result.zipCode || ""); setStreet(result.street || ""); setComplement(result.complement || "");
      setNeighborhood(result.neighborhood || ""); setCustomerCity(result.city || ""); setCustomerState(result.state || "");
      setStateRegistration(result.stateRegistration || ""); setCnaeMain(result.cnaeMain || ""); setTaxStatus(result.taxStatus || "");
      const fullAddress=composeCustomerAddress({street:result.street||"",addressNumber:"",complement:result.complement||"",neighborhood:result.neighborhood||"",city:result.city||"",state:result.state||"",zipCode:result.zipCode||""});
      setAddress(fullAddress); setAddressValidated(false); setShowAddressMap(false);
      setDocumentLookup({loading:false,message:"CNPJ localizado. Confira e altere qualquer dado antes de salvar.",kind:"ok"});
    } catch (error) { setDocumentLookup({loading:false,message:error instanceof Error ? error.message : "Não foi possível consultar o CNPJ.",kind:"error"}); }
  };
  const parentCustomer = isLinkedStructure ? title.split("•")[1]?.trim() : "";
  const selectedClientData = customers.find(customer => customer.name === selectedClient);
  const serviceRecords = catalogRecords.filter(item => (item.kind || "Serviço") === "Serviço");
  const selectedServices = serviceRecords.filter(item => selectedCatalogIds.includes(item.id));
  const visibleServiceOptions = serviceRecords.filter(item => `${item.name} ${item.description || ""} ${item.category || ""}`.toLocaleLowerCase("pt-BR").includes(serviceSearch.trim().toLocaleLowerCase("pt-BR")));
  const locations = selectedClient ? customerLocations(selectedClient, customers, structures, unit) : { units: [], sectors: [], unlinkedSectors: [] };
  const availableUnits = locations.units.map(item => ({ icon: Building2, name:item.name, type:item.category || "Unidade", doc:item.doc || "", responsible:item.contact || "", phone:item.phone || "", address:item.address || "", orders:0 }));
  useEffect(() => {
    if (selectedClient && !availableUnits.some(item => item.name === unit)) setUnit(availableUnits[0]?.name ?? "");
  }, [selectedClient, availableUnits, unit]);
  useEffect(() => { if (!locations.sectors.some(item => item.name === sector)) setSector(""); }, [unit, selectedClient]);
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}><button className="modal-backdrop" onClick={close} aria-label="Fechar janela"/><div className="modal"><div className="modal-head"><div><span>{isLinkedStructure ? "ESTRUTURA DO CLIENTE • LIMITE DE 20" : "CADASTRO PROAR"}</span><h2>{isLinkedStructure ? "Nova unidade, filial ou setor" : title}</h2>{isLinkedStructure && <p>Este registro será vinculado a <strong>{parentCustomer}</strong>.</p>}</div><button onClick={close} aria-label="Fechar"><X size={18}/></button></div><div className="form-grid">
    {isLinkedStructure ? <>
      <label>Cliente principal<input value={parentCustomer} readOnly/></label>
      <label>Tipo de vínculo<select value={recordCategory} onChange={event => setRecordCategory(event.target.value)}><option>Unidade</option><option>Filial</option><option>Setor</option><option>Secretaria</option><option>Departamento</option><option>Empresa vinculada</option></select></label>
      <div className="wide customer-auto-document"><div><span>IDENTIFICAÇÃO AUTOMÁTICA DA FILIAL</span><h3>Consultar CNPJ</h3><p>Digite o CNPJ da filial/unidade. O ProAR busca os dados cadastrais e mantém todos os campos liberados para alteração antes de salvar.</p></div></div>
      <label>CNPJ<input value={doc} onChange={event => void lookupCustomerDocument(event.target.value)} placeholder="00.000.000/0000-00" inputMode="numeric"/></label>
      {documentLookup.message && <div className={`wide document-lookup-status ${documentLookup.kind}`}>{documentLookup.loading ? "Consultando CNPJ..." : documentLookup.message}</div>}
      <label>Nome da unidade ou setor<input value={recordName} onChange={event => setRecordName(event.target.value)} placeholder="Ex.: Filial Olímpia ou Secretaria de Saúde"/></label>
      <label>Razão social<input value={legalName} onChange={event => setLegalName(event.target.value)} placeholder="Razão social vinculada"/></label>
      <label>Nome fantasia<input value={tradeName} onChange={event => {setTradeName(event.target.value); if(event.target.value.trim()) setRecordName(event.target.value);}} placeholder="Nome fantasia"/></label>
      <label>Responsável<input value={contact} onChange={event => setContact(event.target.value)} placeholder="Nome do responsável local"/></label>
      <label>Telefone / WhatsApp<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="(00) 00000-0000"/></label>
      <label>E-mail<input type="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} placeholder="filial@empresa.com.br"/></label>
      <label>CEP<input value={zipCode} onChange={event => {setZipCode(event.target.value); setAddress(composeCustomerAddress({zipCode:event.target.value}));}} placeholder="00000-000"/></label>
      <label>Logradouro<input value={street} onChange={event => {setStreet(event.target.value); setAddress(composeCustomerAddress({street:event.target.value}));}} placeholder="Rua / Avenida"/></label>
      <label>Número<input value={addressNumber} onChange={event => {setAddressNumber(event.target.value); setAddress(composeCustomerAddress({addressNumber:event.target.value}));}}/></label>
      <label>Complemento<input value={complement} onChange={event => {setComplement(event.target.value); setAddress(composeCustomerAddress({complement:event.target.value}));}}/></label>
      <label>Bairro<input value={neighborhood} onChange={event => {setNeighborhood(event.target.value); setAddress(composeCustomerAddress({neighborhood:event.target.value}));}}/></label>
      <label>Cidade<input value={customerCity} onChange={event => {setCustomerCity(event.target.value); setAddress(composeCustomerAddress({city:event.target.value}));}}/></label>
      <label>UF<input maxLength={2} value={customerState} onChange={event => {const value=event.target.value.toUpperCase(); setCustomerState(value); setAddress(composeCustomerAddress({state:value}));}}/></label>
      <label>Inscrição Estadual<input value={stateRegistration} onChange={event => setStateRegistration(event.target.value)}/></label>
      <label>Inscrição Municipal<input value={municipalRegistration} onChange={event => setMunicipalRegistration(event.target.value)}/></label>
      <label>CNAE principal<input value={cnaeMain} onChange={event => setCnaeMain(event.target.value)}/></label>
      <label>Situação cadastral<input value={taxStatus} onChange={event => setTaxStatus(event.target.value)}/></label>
      <label className="wide">Endereço completo<input value={address} onChange={event => setAddress(event.target.value)} placeholder="CEP, rua, número, bairro, cidade e estado"/></label>
      <label className="wide">Observações<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Informações específicas desta unidade, empresa ou setor..."/></label>
    </> : <>
      {isNewOrder ? <>
        <label>Pesquisar cliente<input list="proar-order-customers" value={selectedClient} onChange={event => { setSelectedClient(event.target.value); setUnit(""); setSector(""); }} placeholder="Pesquisar cliente por nome, CPF/CNPJ ou telefone..."/><datalist id="proar-order-customers">{customers.map(customer => <option key={customer.id} value={customer.name}>{[customer.legalName,customer.tradeName,customer.doc,customer.phone].filter(Boolean).join(" • ")}</option>)}</datalist></label>
        <label>Unidade / Filial<select value={unit} onChange={event => { setUnit(event.target.value); setSector(""); }} disabled={!selectedClient || !availableUnits.length}><option value="">{selectedClient ? availableUnits.length ? "Selecione a unidade" : "Cliente principal / Endereço principal" : "Selecione primeiro o cliente"}</option>{availableUnits.map(item => <option key={item.name} value={item.name}>{item.name} • {item.type}</option>)}</select>{selectedClient && !availableUnits.length && <small>Nenhuma unidade cadastrada: será usado o endereço principal.</small>}</label>
        <label>Setor / Local de atendimento<select value={sector} onChange={event => setSector(event.target.value)} disabled={!unit || !locations.sectors.length}><option value="">{unit ? locations.sectors.length ? "Selecione o setor" : "Nenhum setor cadastrado nesta unidade" : "Selecione uma unidade"}</option>{locations.sectors.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select>{unit && !locations.sectors.length && <small>Nenhum setor cadastrado nesta unidade.</small>}</label>
        <label>Responsável do cliente<input value={selectedClientData?.contact ?? ""} readOnly placeholder="Carregado pelo cadastro"/></label>
        <label>Telefone<input value={selectedClientData?.phone ?? ""} readOnly placeholder="Carregado pelo cadastro"/></label>{selectedClientData && <div className={`wide credit-check ${selectedClientData.financialStatus === "Bloqueado" ? "blocked" : ""}`}><CircleDollarSign size={17}/><div><b>Crédito do cliente</b><small>Limite R$ {(selectedClientData.creditLimit ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})} • Saldo lançado R$ {(selectedClientData.balancePosted ?? 0).toLocaleString("pt-BR",{minimumFractionDigits:2})} • Disponível R$ {Math.max(0,(selectedClientData.creditLimit ?? 0)-(selectedClientData.balancePosted ?? 0)).toLocaleString("pt-BR",{minimumFractionDigits:2})}</small></div><strong>{selectedClientData.financialStatus ?? "Liberado"}</strong></div>}
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
        <div className="wide customer-auto-document"><div><span>1ª ABA • IDENTIFICAÇÃO AUTOMÁTICA</span><h3>CPF ou CNPJ</h3><p>Digite o documento. CNPJ com 14 dígitos será consultado automaticamente e todos os campos encontrados continuarão editáveis.</p></div></div>
        <label>CPF ou CNPJ<input value={doc} onChange={event => void lookupCustomerDocument(event.target.value)} placeholder="CPF ou CNPJ" inputMode="numeric"/></label>
        <label>Tipo de pessoa<input value={personType === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"} readOnly/></label>
        <label>Tipo de organização<select value={organizationType} onChange={event=>setOrganizationType(event.target.value as Customer["organizationType"])}><option>Empresa</option><option>Pessoa Física</option><option>Prefeitura</option><option>Órgão Público</option><option>Autarquia</option><option>Fundação</option><option>Entidade Pública</option><option>Outro</option></select></label>
        {documentLookup.message && <div className={`wide document-lookup-status ${documentLookup.kind}`}>{documentLookup.loading ? "Consultando..." : documentLookup.message}</div>}
        <label>Razão social / Nome completo<input value={legalName || recordName} onChange={event => {setLegalName(event.target.value); if(personType==="PF") setRecordName(event.target.value);}} placeholder="Razão social ou nome completo"/></label>
        <label>Nome fantasia<input value={tradeName} onChange={event => {setTradeName(event.target.value); if(personType==="PJ") setRecordName(event.target.value);}} placeholder="Nome fantasia (quando houver)"/></label>
        <label>Responsável<input value={contact} onChange={event => setContact(event.target.value)} placeholder="Nome do responsável"/></label>
        <label>Telefone / WhatsApp<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="(00) 00000-0000"/></label>
        <label>E-mail<input type="email" value={customerEmail} onChange={event => setCustomerEmail(event.target.value)} placeholder="cliente@empresa.com.br"/></label>
        <label>CEP<input value={zipCode} onChange={event => {setZipCode(event.target.value); setAddress(composeCustomerAddress({zipCode:event.target.value}));}} placeholder="00000-000"/></label>
        <label>Logradouro<input value={street} onChange={event => {setStreet(event.target.value); setAddress(composeCustomerAddress({street:event.target.value}));}}/></label>
        <label>Número<input value={addressNumber} onChange={event => {setAddressNumber(event.target.value); setAddress(composeCustomerAddress({addressNumber:event.target.value}));}}/></label>
        <label>Complemento<input value={complement} onChange={event => {setComplement(event.target.value); setAddress(composeCustomerAddress({complement:event.target.value}));}}/></label>
        <label>Bairro<input value={neighborhood} onChange={event => {setNeighborhood(event.target.value); setAddress(composeCustomerAddress({neighborhood:event.target.value}));}}/></label>
        <label>Cidade<input value={customerCity} onChange={event => {setCustomerCity(event.target.value); setAddress(composeCustomerAddress({city:event.target.value}));}}/></label>
        <label>UF<input maxLength={2} value={customerState} onChange={event => {const value=event.target.value.toUpperCase(); setCustomerState(value); setAddress(composeCustomerAddress({state:value}));}}/></label>
        {personType === "PJ" && <><label>Inscrição Estadual<input value={stateRegistration} onChange={event => setStateRegistration(event.target.value)}/></label><label>Inscrição Municipal<input value={municipalRegistration} onChange={event => setMunicipalRegistration(event.target.value)}/></label><label>CNAE principal<input value={cnaeMain} onChange={event => setCnaeMain(event.target.value)}/></label><label>Situação cadastral<input value={taxStatus} onChange={event => setTaxStatus(event.target.value)}/></label></>}
        <label>Limite de crédito<input type="number" min="0" step="0.01" value={creditLimit || ""} onChange={event => setCreditLimit(Math.max(0,Number(event.target.value)||0))} placeholder="R$ 0,00"/></label>
        <label>Saldo lançado<input type="number" min="0" step="0.01" value={balancePosted || ""} onChange={event => setBalancePosted(Math.max(0,Number(event.target.value)||0))} placeholder="R$ 0,00"/></label>
        <label>Situação financeira<select value={financialStatus} onChange={event => setFinancialStatus(event.target.value as Customer["financialStatus"])}><option>Liberado</option><option>Alerta</option><option>Somente à vista</option><option>Bloqueado</option></select></label>
        <label className="wide">Endereço completo<input value={address} onChange={event => { setAddress(event.target.value); setAddressValidated(false); setShowAddressMap(false); }} placeholder="CEP, rua, número, complemento, bairro, cidade e estado"/></label>
        <div className="wide address-validation">
          <div><span className="map-validation-icon"><MapPin size={18}/></span><div><b>Validar endereço no Google Maps</b><small>Confira rua, número, bairro e cidade antes de salvar o cliente.</small></div></div>
          <button type="button" disabled={!address.trim()} onClick={() => { setShowAddressMap(true); setAddressValidated(true); }}>{addressValidated ? <CheckCircle2 size={15}/> : <Search size={15}/>} {addressValidated ? "Endereço validado" : "Buscar e validar"}</button>
          {showAddressMap && address.trim() && <div className="address-map-preview"><iframe title={`Validação de ${address}`} src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">Ver resultado completo no Google Maps <ArrowRight size={12}/></a></div>}
        </div>
        <label className="wide">Observações<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Informações adicionais do cliente..."/><button type="button" className="outline-btn" onClick={()=>setDescription(improveTechnicalText(description))}>✦ Melhorar com IA</button></label>
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
        {isEquipmentRegistration && <div className="wide module-form-guidance"><span><Boxes size={18}/></span><div><b>Cadastro técnico do equipamento</b><small>Vincule o equipamento ao cliente e registre os dados usados nas ordens de serviço e no histórico de manutenção.</small></div></div>}
        {isEquipmentRegistration && <>
          <section className="wide equipment-label-reader">
            <div className="equipment-label-reader-head"><div><span>FOTO / ETIQUETA DO EQUIPAMENTO</span><h3>Leitura técnica assistida por IA</h3><p>A foto original fica vinculada ao cadastro. Revise os dados antes de aplicar.</p></div><Sparkles size={20}/></div>
            <div className="equipment-label-reader-content">
              <div className={`equipment-label-preview ${equipmentLabel ? "has-image" : ""}`}>{equipmentLabel ? <img src={equipmentLabel.dataUrl} alt="Etiqueta técnica anexada"/> : <><ImageIcon size={28}/><span>Pré-visualização da etiqueta</span></>} </div>
              <div className="equipment-label-actions"><input ref={cameraFileRef} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={event => { readEquipmentLabel(event.target.files?.[0]); event.currentTarget.value = ""; }}/><input ref={labelFileRef} className="visually-hidden" type="file" accept="image/*" onChange={event => { readEquipmentLabel(event.target.files?.[0]); event.currentTarget.value = ""; }}/><button type="button" className="outline-btn" onClick={() => cameraFileRef.current?.click()}><Camera size={15}/> Tirar foto</button><button type="button" className="outline-btn" onClick={() => labelFileRef.current?.click()}><ImagePlus size={15}/> Anexar imagem</button><button type="button" className="primary-btn" disabled={!equipmentLabel || labelReading} onClick={() => void analyseEquipmentLabel()}><Sparkles size={15}/> {labelReading ? "Analisando etiqueta..." : "Preencher com IA"}</button>{equipmentLabel && <small>{equipmentLabel.name} • imagem será salva no cadastro</small>}{labelError && <em>{labelError}</em>}</div>
            </div>
          </section>
          <label>Cliente<select value={recordClient} onChange={event => setRecordClient(event.target.value)}><option value="">Selecione o cliente</option>{customers.map(customer => <option key={customer.id} value={customer.name}>{customer.name}</option>)}</select></label>
          <label>Unidade / filial / setor<input value={equipmentUnit} onChange={event => setEquipmentUnit(event.target.value)} placeholder="Ex.: Matriz, Filial Olímpia, Sala administrativa"/></label>
          <label>Nome / identificação<input value={recordName} onChange={event => setRecordName(event.target.value)} placeholder="Ex.: Ar-condicionado Recepção"/></label>
          <label>Tipo de equipamento<select value={equipmentType} onChange={event => setEquipmentType(event.target.value)}><option>Split Hi Wall</option><option>Split Inverter</option><option>Cassete</option><option>Piso Teto</option><option>Multi Split</option><option>VRF</option><option>Janela</option><option>Self Contained</option><option>Chiller</option><option>Fan Coil</option><option>Exaustor</option><option>Outro</option></select></label>
          <label>Marca<input value={catalogBrand} onChange={event=>setCatalogBrand(event.target.value)} placeholder="Ex.: Carrier, Midea, TCL"/></label>
          <label>Modelo<input value={catalogModel} onChange={event=>setCatalogModel(event.target.value)} placeholder="Modelo / referência"/></label>
          <label>Capacidade (BTUs)<input type="number" min="0" step="1000" value={capacityBtus} onChange={event=>setCapacityBtus(event.target.value)} placeholder="Ex.: 12000"/></label>
          <label>Número de série<input value={serialNumber} onChange={event=>setSerialNumber(event.target.value)} placeholder="Número de série do equipamento"/></label>
          <label>Tensão<select value={voltage} onChange={event=>setVoltage(event.target.value)}><option>127V</option><option>220V</option><option>220V Trifásico</option><option>380V Trifásico</option></select></label>
          <label>Fluido refrigerante<select value={refrigerant} onChange={event=>setRefrigerant(event.target.value)}><option>R22</option><option>R410A</option><option>R32</option><option>R454B</option><option>Outro</option></select></label>
          <label>Frequência<input value={frequency} onChange={event=>setFrequency(event.target.value)} placeholder="Ex.: 60 Hz"/></label>
          <label>Corrente<input value={currentDraw} onChange={event=>setCurrentDraw(event.target.value)} placeholder="Ex.: 5,2 A"/></label>
          <label>Potência<input value={power} onChange={event=>setPower(event.target.value)} placeholder="Ex.: 1.150 W"/></label>
          <label>Carga de refrigerante<input value={refrigerantCharge} onChange={event=>setRefrigerantCharge(event.target.value)} placeholder="Ex.: 0,62 kg"/></label>
          <label>Data de fabricação<input value={manufactureDate} onChange={event=>setManufactureDate(event.target.value)} placeholder="Conforme etiqueta"/></label>
          <label>Código / referência fabricante<input value={manufacturerCode} onChange={event=>setManufacturerCode(event.target.value)} placeholder="Código da etiqueta"/></label>
          <label>Local de instalação<input value={installationLocation} onChange={event=>setInstallationLocation(event.target.value)} placeholder="Ex.: Recepção / Sala Financeiro"/></label>
          <label>Data de instalação<input type="date" value={installationDate} onChange={event=>setInstallationDate(event.target.value)}/></label>
          <label>Próxima preventiva<input type="date" value={nextMaintenanceDate} onChange={event=>setNextMaintenanceDate(event.target.value)}/></label>
          <label>Garantia (meses)<input type="number" min="0" value={catalogWarranty} onChange={event=>setCatalogWarranty(event.target.value)} placeholder="Ex.: 12"/></label>
        </>}
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
        {requestedModule === "Funcionários" ? <><label>Perfil de acesso<select value={employeeRole} onChange={event => applyEmployeeRole(event.target.value)}><option>Administrador</option><option>Financeiro</option><option>Técnico de Campo</option><option>Atendimento</option></select></label><label>Nome de utilizador<input autoComplete="off" value={employeeUsername} onChange={event => { const value = event.target.value.toLocaleLowerCase("pt-BR").replace(/\s+/g, "."); setEmployeeUsername(value); setRecordClient(value); }} placeholder="Ex.: tiago.viana"/></label><label>Senha de acesso<input type="password" autoComplete="new-password" value={employeePassword} onChange={event => setEmployeePassword(event.target.value)} placeholder="Mínimo de 4 caracteres"/><small>A senha será guardada de forma criptografada.</small></label></> : <label>{requestedModule === "Financeiro" ? "Categoria / centro de custo" : requestedModule === "Compras" ? "Categoria da compra" : "Categoria / centro de custo"}<input value={recordCategory} onChange={event => setRecordCategory(event.target.value)} placeholder="Ex.: Materiais de serviço"/></label>}
        <label>{requestedModule === "Funcionários" ? "Comissão / valor de referência" : requestedModule === "Compras" ? "Valor total calculado" : isCatalogRegistration ? "Preço de venda" : "Valor total"}<input type="number" min="0" step="0.01" readOnly={requestedModule === "Compras"} value={requestedModule === "Compras" ? purchaseTotal : recordValue} onChange={event => setRecordValue(event.target.value)} placeholder="R$ 0,00"/></label>
        {isCatalogRegistration && <><label>Preço de custo<input type="number" min="0" step="0.01" value={recordCost} onChange={event => setRecordCost(event.target.value)} placeholder="R$ 0,00"/></label><label>Código interno / SKU<input value={catalogSku} onChange={event=>setCatalogSku(event.target.value)} placeholder="Ex.: PRO-12000-TCL"/></label><label>Código de barras<input value={catalogBarcode} onChange={event=>setCatalogBarcode(event.target.value)} placeholder="EAN / GTIN"/></label><label>Marca<input value={catalogBrand} onChange={event=>setCatalogBrand(event.target.value)} placeholder="Ex.: Carrier, Midea, TCL"/></label><label>Modelo<input value={catalogModel} onChange={event=>setCatalogModel(event.target.value)} placeholder="Modelo / referência"/></label><label>Fornecedor principal<input value={catalogSupplier} onChange={event=>setCatalogSupplier(event.target.value)} placeholder="Fornecedor preferencial"/></label>{recordKind === "Produto" ? <><label>Estoque atual<input type="number" min="0" step="0.001" value={catalogStockCurrent} onChange={event=>setCatalogStockCurrent(event.target.value)} placeholder="0"/></label><label>Estoque mínimo<input type="number" min="0" step="0.001" value={catalogStockMin} onChange={event=>setCatalogStockMin(event.target.value)} placeholder="0"/></label><label>Estoque máximo<input type="number" min="0" step="0.001" value={catalogStockMax} onChange={event=>setCatalogStockMax(event.target.value)} placeholder="0"/></label><label>Localização no estoque<input value={catalogStockLocation} onChange={event=>setCatalogStockLocation(event.target.value)} placeholder="Ex.: Prateleira A-03"/></label></> : <label>Tempo estimado (minutos)<input type="number" min="0" value={catalogEstimatedMinutes} onChange={event=>setCatalogEstimatedMinutes(event.target.value)} placeholder="Ex.: 120"/></label>}<label>Garantia (meses)<input type="number" min="0" value={catalogWarranty} onChange={event=>setCatalogWarranty(event.target.value)} placeholder="Ex.: 3"/></label><label>Unidade de medida<select value={catalogUnit} onChange={event=>setCatalogUnit(event.target.value)}><option>un</option><option>serviço</option><option>m</option><option>m²</option><option>kg</option><option>l</option><option>h</option><option>kit</option></select></label></>}

        <label>{requestedModule === "Funcionários" ? "Telefone / WhatsApp" : "Telefone / contato"}<input placeholder="(00) 00000-0000"/></label><label>{requestedModule === "Funcionários" ? "Data de admissão" : requestedModule === "Compras" ? "Previsão de entrega" : requestedModule === "Financeiro" ? "Data de vencimento" : "Data"}<input type="date" value={date} onChange={event => setDate(event.target.value)}/></label>
        {requestedModule === "Funcionários" && <div className="wide permission-matrix"><div className="permission-head"><div><span>MATRIZ DE PERMISSÕES</span><h3>Acesso por módulo</h3></div><small>O menu e as ações respeitam o perfil selecionado.</small></div><div className="permission-table"><div className="permission-row permission-labels"><b>MÓDULO</b>{permissionActions.map(action => <b key={action}>{action}</b>)}</div>{permissionModules.map(module => <div className="permission-row" key={module}><strong>{module}</strong>{permissionActions.map(action => <label key={action}><input type="checkbox" checked={employeePermissions[module]?.includes(action) ?? false} onChange={() => togglePermission(module, action)}/><span/></label>)}</div>)}</div></div>}
        <label className="wide">Descrição / observações<textarea value={description} onChange={event => setDescription(event.target.value)} placeholder={requestedModule === "Funcionários" ? "Observações internas sobre o funcionário..." : "Inclua os detalhes deste cadastro..."}/>{isCatalogRegistration && <button type="button" className="outline-btn" onClick={()=>setDescription(improveTechnicalText(description))}>✦ Melhorar com IA</button>}</label>
        </>}
      </>}
    </>}
  </div><div className="modal-actions"><button className="outline-btn" onClick={close}>Cancelar</button><button className="primary-btn" disabled={isNewOrder ? !selectedClient || !tech || !date || selectedClientData?.financialStatus === "Bloqueado" : isNewCustomer ? !recordName || !address.trim() || !addressValidated : requestedModule === "Compras" ? !recordName || !recordClient || !purchaseItems.some(item => item.description.trim() && item.quantity > 0) || purchaseTotal <= 0 || (paymentType === "A prazo" && !firstDueDate) : requestedModule === "Obras" ? !recordName || !recordClient || !workAddress : requestedModule === "Equipamentos" ? !recordName || !recordClient || !equipmentType : requestedModule === "Funcionários" ? !recordName || !employeeUsername.trim() || employeePassword.length < 4 : (!isLinkedStructure && !recordName)} onClick={() => onSave({ title, name: recordName, client: isNewOrder ? selectedClient : recordClient, doc, contact, phone, personType, organizationType, legalName: legalName || (personType === "PF" ? recordName : ""), tradeName: tradeName || (personType === "PJ" ? recordName : ""), email: customerEmail, zipCode, street, addressNumber, complement, neighborhood, city: customerCity, state: customerState, stateRegistration, municipalRegistration, cnaeMain, taxStatus, creditLimit, balancePosted, financialStatus, address: isNewOrder ? (unit ? availableUnits.find(item => item.name === unit)?.address ?? selectedClientData?.address ?? "" : selectedClientData?.address ?? "") : address, unit, tech, date, time, description, status: recordStatus, value: requestedModule === "Compras" ? purchaseTotal : Number(recordValue) || 0, category: recordCategory, kind: recordKind, catalogItems: catalogRecords.filter(item => selectedCatalogIds.includes(item.id)).map(item => ({ id: item.id, name: item.name, kind: item.kind || "Serviço" })), purchaseItems: purchaseItems.filter(item => item.description.trim() && item.quantity > 0), paymentType, paymentMethod, installments: paymentType === "A prazo" ? Math.max(1, installments) : 1, firstDueDate, paymentInstallments, xmlImported, supplierDoc, supplierId, registerSupplier: xmlImported && !supplierId, engineer, workAddress, blockLot, endDate, progress, commission, cost: Number(recordCost) || 0, sku: catalogSku, barcode: catalogBarcode, brand: catalogBrand, model: catalogModel, supplier: catalogSupplier, stockCurrent: Number(catalogStockCurrent)||0, stockMin: Number(catalogStockMin)||0, stockMax: Number(catalogStockMax)||0, stockLocation: catalogStockLocation, warrantyMonths: Number(catalogWarranty)||0, estimatedMinutes: Number(catalogEstimatedMinutes)||0, unitOfMeasure: catalogUnit, employeeRole, employeePermissions, employeeUsername, employeePassword, equipmentType, capacityBtus: Number(capacityBtus)||0, serialNumber, voltage, refrigerant, frequency, current: currentDraw, power, refrigerantCharge, manufactureDate, manufacturerCode, equipmentLabelImage: equipmentLabel?.dataUrl, equipmentLabelImageName: equipmentLabel?.name, equipmentLabelHistory: equipmentLabel ? [`Etiqueta cadastrada em ${new Date().toLocaleDateString("pt-BR")} por Usuário atual`] : [], installationLocation, installationDate, nextMaintenanceDate, equipmentUnit })}><CheckCircle2 size={15}/> Salvar registro</button></div></div>
    {labelReview && <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Dados identificados pela IA"><button className="modal-backdrop" aria-label="Cancelar leitura" onClick={() => setLabelReview(null)}/><section className="modal label-review-modal"><div className="modal-head"><div><span><Sparkles size={14}/> DADOS IDENTIFICADOS PELA IA</span><h2>Confira antes de aplicar</h2><p>Somente informações legíveis são sugeridas. Campos não identificados permanecem em branco.</p></div><button onClick={() => setLabelReview(null)} aria-label="Fechar"><X size={18}/></button></div><div className="label-review-grid">{[["brand","Marca"],["model","Modelo"],["equipmentType","Tipo"],["capacityBtus","Capacidade"],["serialNumber","Número de série"],["voltage","Tensão"],["frequency","Frequência"],["current","Corrente"],["power","Potência"],["refrigerant","Fluido"],["refrigerantCharge","Carga de refrigerante"],["manufactureDate","Fabricação"],["manufacturerCode","Referência fabricante"]].map(([key,label]) => <label key={key}>{label}<input value={labelReview[key] || ""} placeholder="Não identificado" onChange={event => setLabelReview(current => current ? { ...current, [key]: event.target.value } : current)}/></label>)}</div><div className="modal-actions"><button className="outline-btn" onClick={() => setLabelReview(null)}>Cancelar</button><button className="outline-btn" onClick={() => {}}>Revisar</button><button className="primary-btn" onClick={applyLabelReading}><CheckCircle2 size={15}/> Aplicar dados</button></div></section></div>}
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
  const [online, setOnline] = useState(true);
  const [stateRevision, setStateRevision] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncPhase, setSyncPhase] = useState<"idle" | "syncing" | "complete">("idle");
  useEffect(() => {
    const navigate = (event: Event) => setCurrent((event as CustomEvent<string>).detail);
    window.addEventListener("proar:navigate", navigate);
    return () => window.removeEventListener("proar:navigate", navigate);
  }, []);
  const handleLogin = (user: AuthenticatedUser) => {
    setAuthenticatedUser(user);
    localStorage.setItem("proar-offline-session", JSON.stringify({ user, expiresAt: Date.now() + 12 * 60 * 60 * 1000 }));
  };
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
  useEffect(() => {
    if (!authenticatedUser?.companySlug || !authenticatedUser.companyId) return;
    fetch(`/api/trial/company?slug=${encodeURIComponent(authenticatedUser.companySlug)}`, {cache:"no-store"}).then(async response => {
      if (!response.ok) return null; const result = await response.json(); return result.company;
    }).then(company => {
      if (!company) return;
      const tenantCompany: TenantCompany = { id: company.id, legalName: company.legal_name, tradeName: company.trade_name, cnpj: company.cnpj || company.cpf || "", city: company.city || "", state: company.state || "SP", phone: company.phone || "", whatsapp: company.whatsapp || "", email: company.email || "", address: company.address || "", zipCode: company.zip_code || "", stateRegistration: company.state_registration || "", municipalRegistration: company.municipal_registration || "", companyType: company.company_type || "", taxRegime: company.tax_regime || "", logo: company.logo_path || company.brand_config?.logo || "", status: company.status === "active" ? "Ativa" : "Bloqueada", createdAt: company.trial_started_at || new Date().toISOString() };
      setCompanies([tenantCompany]); setActiveCompany(tenantCompany); localStorage.setItem("proar-v4-companies", JSON.stringify([tenantCompany])); localStorage.setItem("proar-v4-active-company", tenantCompany.id);
    }).catch(()=>{});
  }, [authenticatedUser?.companyId, authenticatedUser?.companySlug]);
  useEffect(() => {
    if (!authenticatedUser || !navigator.onLine || normalizeCnpj(activeCompany.cnpj).length !== 14) return;
    const registerInManager = () => {
      void fetch("/api/companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(activeCompany) }).catch(()=>{});
    };
    registerInManager();
    const interval = window.setInterval(registerInManager, 6 * 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [authenticatedUser?.username, activeCompany.id, activeCompany.cnpj, activeCompany.tradeName]);
  const selectCompany = (company: TenantCompany) => {
    if (company.status === "Bloqueada") { setSavedMessage(`O acesso ao CNPJ ${company.cnpj} está bloqueado pelo gerenciador.`); return; }
    setActiveCompany(company);
    localStorage.setItem("proar-v4-active-company", company.id);
    setSavedMessage(`Empresa alterada para ${company.tradeName}. Base de dados isolada carregada.`);
    window.setTimeout(() => setSavedMessage(""), 3000);
  };
  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    fetch("/api/auth").then(async response => response.ok ? response.json() : null).then(result => {
      if (result?.authenticated) handleLogin({ username: result.username, displayName: result.displayName, role: result.role, permissions: result.permissions, companyId: result.companyId, companySlug: result.companySlug, trialExpiresAt: result.trialExpiresAt });
    }).catch(() => {
      if (!navigator.onLine) {
        try { const cached = JSON.parse(localStorage.getItem("proar-offline-session") || "null"); if (cached?.user && cached.expiresAt > Date.now()) setAuthenticatedUser(cached.user); } catch {}
      }
    }).finally(() => setCheckingSession(false));
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);
  useEffect(() => {
    if (!authenticatedUser) return;
    const verifyManagerAccess = async () => {
      if (!navigator.onLine) return;
      try {
        const response = await fetch("/api/auth", { cache: "no-store" });
        if (response.status === 403 || response.status === 401) {
          localStorage.removeItem("proar-offline-session");
          setAuthenticatedUser(null);
          setSavedMessage("A empresa foi bloqueada, suspensa ou teve a licença encerrada no ProAR Manager.");
        }
      } catch {}
    };
    const interval = window.setInterval(verifyManagerAccess, 60 * 60 * 1000);
    const onFocus = () => void verifyManagerAccess();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [authenticatedUser?.username]);
  useEffect(() => {
    if (!authenticatedUser || !navigator.onLine) return;
    fetch("/api/catalog/default-services", { cache: "no-store" }).then(async response => response.ok ? (await response.json()).services : []).then((services: ModuleRecord[]) => {
      if (!services?.length) return;
      setModuleRecords(currentModules => {
        const existing = currentModules.Serviços ?? [];
        const existingNames = new Set(existing.map(item => item.name.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, " ")));
        const additions = services.filter(item => !existingNames.has(item.name.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, " ")));
        return additions.length ? { ...currentModules, Serviços: [...existing, ...additions] } : currentModules;
      });
    }).catch(()=>{});
  }, [authenticatedUser?.username, activeCompany.id]);
  useEffect(() => {
    if (!authenticatedUser) return;
    const visibleModules = navGroups.flatMap(group => group.items.map(item => item.name)).filter(name => authenticatedUser.permissions?.includes("*") || authenticatedUser.permissions?.includes(name));
    if (visibleModules.length && !visibleModules.includes(current)) setCurrent(visibleModules[0]);
  }, [authenticatedUser, current]);
  useEffect(() => {
    if (!authenticatedUser) return;
    const loadSharedState = async () => {
      try {
        if (activeCompany.status === "Bloqueada") throw new Error("blocked");
        if (!navigator.onLine) throw new Error("offline");
        const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const { state } = await response.json();
        if (state) {
          setStateRevision(Number(state._revision || 0));
          setServiceOrders(state.serviceOrders ?? []);
          setCustomerRecords(state.customers ?? []);
          const loadedModules = mergeImportedServices(state.moduleRecords ?? {});
          const blockedFictitious = ["João Carlos", "Caio Henrique", "Thiago Souza", "Lucas Mendes"];
          const realEmployees = (loadedModules.Funcionários ?? []).filter((employee: ModuleRecord) => !blockedFictitious.includes(employee.name));
          const employees = realEmployees.some((employee: ModuleRecord) => employee.name === "Tiago Viana") ? realEmployees : [tiagoEmployee, ...realEmployees];
          const migratedModules = { ...loadedModules, Funcionários: employees };
          setModuleRecords(migratedModules);
          localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(state.serviceOrders ?? []));
          localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(state.customers ?? []));
          localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(migratedModules));
          return;
        }
        const localState = {
          serviceOrders: readCompanyStorage(activeCompany.id, "service-orders", []),
          customers: readCompanyStorage(activeCompany.id, "customers", []),
          moduleRecords: mergeImportedServices(readCompanyStorage(activeCompany.id, "module-records", {}) as Record<string, ModuleRecord[]>),
        };
        const initialResponse=await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...localState,_baseRevision:0}) });
        const initialResult=await initialResponse.json();if(initialResponse.ok)setStateRevision(Number(initialResult.state?._revision||1));
        setServiceOrders(localState.serviceOrders);
        setCustomerRecords(localState.customers);
        setModuleRecords(localState.moduleRecords);
      } catch {
        if (navigator.onLine) { setSavedMessage("Banco online indisponível. Nenhuma cópia local foi enviada ou definida como principal."); return; }
        const localOrders = readCompanyStorage(activeCompany.id, "service-orders", []) as ServiceOrder[];
        const localCustomers = readCompanyStorage(activeCompany.id, "customers", []) as Customer[];
        const localModules = mergeImportedServices(readCompanyStorage(activeCompany.id, "module-records", {}) as Record<string, ModuleRecord[]>);
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
    const payload = { companyId: activeCompany.id, customers: nextCustomers, serviceOrders: nextOrders, moduleRecords: nextModules, _baseRevision: stateRevision };
    if (!navigator.onLine) {
      const queue = JSON.parse(localStorage.getItem("proar-offline-queue") || "[]");
      localStorage.setItem("proar-offline-queue", JSON.stringify([...queue.filter((item: { companyId: string }) => item.companyId !== activeCompany.id), { companyId: activeCompany.id, payload, createdAt: new Date().toISOString() }]));
      setSavedMessage("Sem internet: alteração guardada somente neste aparelho."); return;
    }
    fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async response => {
      const result=await response.json();
      if (response.status===409 && result.state) { const serverCustomers=result.state.customers??[]; const serverOrders=result.state.serviceOrders??[]; const serverModules=mergeImportedServices(result.state.moduleRecords??{}); setCustomerRecords(serverCustomers);setServiceOrders(serverOrders);setModuleRecords(serverModules);setStateRevision(Number(result.state._revision||0));localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(serverCustomers));localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(serverOrders));localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(serverModules));setSavedMessage("Conflito detectado: a versão mais recente do banco online foi preservada. Refaça apenas a alteração pendente.");return; }
      if (!response.ok) throw new Error();setStateRevision(Number(result.state?._revision||stateRevision+1));
    }).catch(() => {
      setSavedMessage("Falha no banco online. A cópia local não substituirá a versão principal.");
    });
  };
  const pullFromDatabase = async () => {
    if (!online) { setSavedMessage("Sem internet. Não foi possível atualizar do banco."); return; }
    setSyncing(true); setSyncPhase("syncing");
    try {
      const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}&refresh=${Date.now()}`, { cache: "no-store" });
      const result = await response.json(); if (!response.ok || !result.state) throw new Error();
      const nextCustomers = result.state.customers ?? []; const nextOrders = result.state.serviceOrders ?? []; const nextModules = mergeImportedServices(result.state.moduleRecords ?? {});
      setStateRevision(Number(result.state._revision||0));
      setCustomerRecords(nextCustomers); setServiceOrders(nextOrders); setModuleRecords(nextModules);
      localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(nextCustomers)); localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(nextOrders)); localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(nextModules));
      setSyncPhase("complete");
      window.setTimeout(() => setSyncPhase("idle"), 1000);
    } catch { setSyncPhase("idle"); setSavedMessage("Não foi possível atualizar os dados. Os dados deste aparelho foram mantidos."); }
    finally { setSyncing(false); }
  };
  const pushToDatabase = async () => {
    if (!online) { setSavedMessage("Sem internet. Alterações pendentes serão sincronizadas ao reconectar."); return; }
    // Segurança multiaparelho: nunca força a cópia local como principal.
    await pullFromDatabase();
  };
  useEffect(() => {
    if (!online || !authenticatedUser) return;
    const synchronize = async () => {
      const queue = JSON.parse(localStorage.getItem("proar-offline-queue") || "[]") as { companyId: string; payload: unknown }[];
      if (!queue.length) return;
      const pending: typeof queue = [];
      for (const item of queue) { try { const response = await fetch(`/api/state?company=${encodeURIComponent(item.companyId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.payload) }); if (response.status === 409) { setSavedMessage("Havia alterações mais novas no servidor. A base online foi preservada; revise a alteração feita offline."); continue; } if (!response.ok) pending.push(item); } catch { pending.push(item); } }
      localStorage.setItem("proar-offline-queue", JSON.stringify(pending));
      if (!pending.length) { setSavedMessage("Dados offline sincronizados com sucesso."); window.setTimeout(() => setSavedMessage(""), 3500); }
    };
    void synchronize();
  }, [online, authenticatedUser]);
  useEffect(() => {
    if (!online || !authenticatedUser) return;
    const refresh = () => { if (document.visibilityState === "visible" && !syncing) void pullFromDatabase(); };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [online, authenticatedUser, activeCompany.id, syncing]);
  const updateServiceOrder = async (updatedOrder: ServiceOrder) => {
    const previousOrder = serviceOrders.find(order => order.id === updatedOrder.id);
    let orderForPersistence: ServiceOrder = { ...updatedOrder, contractItems: (updatedOrder.contractItems ?? []).map(item => ({ ...item })) };
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
    const previousContractItems = previousOrder?.contractItems ?? [];
    const nextContractItems = orderForPersistence.contractItems ?? [];
    const shouldExecute = /conclu[ií]da/i.test(orderForPersistence.status);
    const shouldRelease = /cancelada/i.test(orderForPersistence.status);
    const movementMoment = Date.now();
    const contractRecords = (updatedModules.Certames ?? []) as PublicContractRecord[];
    if (contractRecords.length && (previousContractItems.length || nextContractItems.length)) {
      updatedModules = { ...updatedModules, Certames: contractRecords.map(contract => {
        const belongsToCurrent = contract.id === orderForPersistence.certameId;
        const belongsToPrevious = contract.id === previousOrder?.certameId;
        if (!belongsToCurrent && !belongsToPrevious) return contract;
        return { ...contract, certameItems:(contract.certameItems ?? []).map(contractItem => {
          let movements = [...(contractItem.movements ?? [])];
          const previousLinks = previousContractItems.filter(link => link.certameItemId === contractItem.id);
          const currentIndexes = nextContractItems.map((link,index) => ({link,index})).filter(entry => entry.link.certameItemId === contractItem.id);

          for (const previousLink of previousLinks) {
            const stillPresent = currentIndexes.some(entry => entry.link.reservationMovementId === previousLink.reservationMovementId);
            if (!stillPresent && previousLink.reservationMovementId && !previousLink.executionMovementId && !previousLink.releaseMovementId) {
              const correlationId = `${orderForPersistence.id}:release:${previousLink.reservationMovementId}`;
              if (!movements.some(movement=>movement.correlationId===correlationId)) {
                const releaseId = `CM-${movementMoment}-release-${contractItem.id}-${movements.length}`;
                movements.push(createCertameMovement({ id:releaseId, item:contractItem, type:"Liberação", quantity:previousLink.quantity, userId:authenticatedUser?.displayName || "Sistema", origin:"Ordem de Serviço", serviceOrderId:orderForPersistence.id, correlationId, existingMovements:movements }));
              }
            }
          }

          for (const { link, index } of currentIndexes) {
            if (!link.reservationMovementId) {
              const correlationId = `${orderForPersistence.id}:reserve:${contractItem.id}:${index}`;
              const existingReservation = movements.find(movement=>movement.correlationId===correlationId);
              const reservationId = existingReservation?.id ?? `CM-${movementMoment}-reserve-${contractItem.id}-${index}`;
              if (!existingReservation) movements.push(createCertameMovement({ id:reservationId, item:contractItem, type:"Reserva", quantity:link.quantity, userId:authenticatedUser?.displayName || "Sistema", origin:"Ordem de Serviço", serviceOrderId:orderForPersistence.id, correlationId, existingMovements:movements }));
              nextContractItems[index] = { ...link, reservationMovementId:reservationId };
            }
            const persistedLink = nextContractItems[index];
            if (shouldExecute && !persistedLink.executionMovementId && !persistedLink.releaseMovementId) {
              const correlationId = `${orderForPersistence.id}:execute:${persistedLink.reservationMovementId}`;
              const existingExecution = movements.find(movement=>movement.correlationId===correlationId);
              const executionId = existingExecution?.id ?? `CM-${movementMoment}-execute-${contractItem.id}-${index}`;
              if (!existingExecution) movements.push(createCertameMovement({ id:executionId, item:contractItem, type:"Execução", quantity:persistedLink.quantity, userId:authenticatedUser?.displayName || "Sistema", origin:"Conclusão da Ordem de Serviço", serviceOrderId:orderForPersistence.id, correlationId, existingMovements:movements }));
              nextContractItems[index] = { ...persistedLink, executionMovementId:executionId };
            } else if (shouldRelease && !persistedLink.executionMovementId && !persistedLink.releaseMovementId) {
              const correlationId = `${orderForPersistence.id}:cancel:${persistedLink.reservationMovementId}`;
              const existingRelease = movements.find(movement=>movement.correlationId===correlationId);
              const releaseId = existingRelease?.id ?? `CM-${movementMoment}-cancel-${contractItem.id}-${index}`;
              if (!existingRelease) movements.push(createCertameMovement({ id:releaseId, item:contractItem, type:"Liberação", quantity:persistedLink.quantity, userId:authenticatedUser?.displayName || "Sistema", origin:"Cancelamento da Ordem de Serviço", serviceOrderId:orderForPersistence.id, correlationId, existingMovements:movements }));
              nextContractItems[index] = { ...persistedLink, releaseMovementId:releaseId };
            }
          }
          return { ...contractItem, movements };
        }) };
      }) as ModuleRecord[] };
      orderForPersistence = { ...orderForPersistence, contractItems: nextContractItems };
    }
    const updatedOrders = serviceOrders.map(order => order.id === orderForPersistence.id ? orderForPersistence : order);
    // Conclusão nunca apaga lançamentos anteriores: cria somente integrações ainda inexistentes.
    if (/conclu[ií]da/i.test(updatedOrder.status)) {
      const receivableId = `REC-${updatedOrder.id.replace(/\D/g, "")}`;
      const stockPrefix = `OS-${updatedOrder.id.replace(/\D/g, "")}-`;
      const hasReceivable = (updatedModules.Financeiro ?? []).some(item => item.id === receivableId || item.serviceOrderId === updatedOrder.id);
      const productsUsed = (updatedOrder.catalogItems ?? []).filter(item => item.kind === "Produto");
      // OS vinculada a Certame segue o fluxo público: execução → fechamento → Empenho → faturamento.
      // A conclusão técnica não cria Conta a Receber antecipada e não altera lançamentos históricos.
      if (!updatedOrder.certameId && !hasReceivable) updatedModules = { ...updatedModules, Financeiro: [{ id: receivableId, name: `Conta a receber • ${updatedOrder.id}`, client: updatedOrder.client, description: `Gerada pela conclusão da OS ${updatedOrder.id}`, createdAt: new Date().toLocaleString("pt-BR"), status: "Em aberto", date: new Date().toISOString().slice(0,10), value: 0, transactionType: "Receber", serviceOrderId: updatedOrder.id }, ...(updatedModules.Financeiro ?? [])] };
      const stockEntries = productsUsed.filter(item => !(updatedModules.Estoque ?? []).some(stock => stock.id === `${stockPrefix}${item.id}`)).map(item => ({ id: `${stockPrefix}${item.id}`, name: `Saída por OS • ${item.name}`, client: updatedOrder.client, description: `Movimentação vinculada à ${updatedOrder.id}`, createdAt: new Date().toLocaleString("pt-BR"), status: "Concluído", category: "Saída por OS", serviceOrderId: updatedOrder.id, kind: "Produto" as const }));
      if (stockEntries.length) updatedModules = { ...updatedModules, Estoque: [...stockEntries, ...(updatedModules.Estoque ?? [])] };
    }
    if (!navigator.onLine) throw new Error("Sem conexão com a internet.");
    const payload = { companyId: activeCompany.id, customers: customerRecords, serviceOrders: updatedOrders, moduleRecords: updatedModules, _baseRevision: stateRevision };
    const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409 && result.state) {
        const serverCustomers=result.state.customers??[]; const serverOrders=result.state.serviceOrders??[]; const serverModules=mergeImportedServices(result.state.moduleRecords??{});
        setCustomerRecords(serverCustomers); setServiceOrders(serverOrders); setModuleRecords(serverModules); setStateRevision(Number(result.state._revision||0));
        localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(serverCustomers)); localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(serverOrders)); localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(serverModules));
      }
      throw new Error(result.error || "Não foi possível confirmar a gravação no banco.");
    }
    const confirmedCustomers=result.state?.customers??customerRecords; const confirmedOrders=result.state?.serviceOrders??updatedOrders; const confirmedModules=mergeImportedServices(result.state?.moduleRecords??updatedModules);
    setCustomerRecords(confirmedCustomers); setServiceOrders(confirmedOrders); setModuleRecords(confirmedModules); setSelectedOrder(orderForPersistence); setStateRevision(Number(result.state?._revision||stateRevision+1));
    localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(confirmedCustomers)); localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(confirmedOrders)); localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(confirmedModules));
    // O acompanhamento externo recebe somente o recorte liberado ao cliente;
    // observações internas, financeiro e demais dados operacionais ficam na base autenticada.
    if (orderForPersistence.trackingToken) {
      const timeline = (orderForPersistence.timeline ?? []).filter(event => event.customerVisible).map(event => ({ id:event.id, createdAt:event.createdAt, status:event.status, customerNote:event.customerNote, photos:event.photos, customerVisible:true }));
      void fetch("/api/public-service-order", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ companyId:activeCompany.id, orderId:orderForPersistence.id, token:orderForPersistence.trackingToken, client:orderForPersistence.client, service:orderForPersistence.service, date:orderForPersistence.date, time:orderForPersistence.time, status:orderForPersistence.status, timeline }) });
    }
    setSavedMessage(orderForPersistence.status === "Concluída" && orderForPersistence.reminderEnabled ? `Ordem ${orderForPersistence.id} concluída e lembrete agendado.` : `Ordem ${orderForPersistence.id} atualizada e sincronizada.`);
    window.setTimeout(() => setSavedMessage(""), 2500);
    return orderForPersistence;
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
  const appendAudit = (modules: Record<string, ModuleRecord[]>, action: string, reference: string, detail: string) => ({ ...modules, Auditoria: [{ id: `AUD-${Date.now()}`, name: action, client: authenticatedUser?.displayName || "Sistema", description: `${reference} • ${detail}`, createdAt: new Date().toLocaleString("pt-BR"), status: "Registrado", category: "Rastreabilidade" }, ...(modules.Auditoria ?? [])].slice(0, 1000) });
  const convertBudget = (budget: ModuleRecord, target: "Pedido" | "Ordem de serviço") => {
    if (target === "Pedido") {
      const sale: ModuleRecord = { ...budget, id:`VEN-${Date.now().toString().slice(-6)}`, name:`Pedido • ${budget.name}`, status:"Pedido confirmado", createdAt:new Date().toLocaleString("pt-BR") };
      const updated = { ...moduleRecords, Vendas:[sale,...(moduleRecords.Vendas ?? [])], Orçamentos:(moduleRecords.Orçamentos ?? []).map(item => item.id === budget.id ? {...item,status:"Convertido em pedido"} : item) };
      setModuleRecords(updated); persistSharedState(customerRecords, serviceOrders, updated); setCurrent("Vendas");
    } else {
      const customer = customerRecords.find(item => item.name === budget.client);
      const order: ServiceOrder = { id:`#OS-${String(Math.max(15499,...serviceOrders.map(item => Number(item.id.replace(/\D/g,""))||0))+1).padStart(5,"0")}`, client:budget.client, unit:budget.unit || "Matriz", service:budget.purchaseItems?.map(item => item.description).join(", ") || budget.name, tech:"Não definido", date:new Date().toISOString().slice(0,10), time:"A definir", address:(budget.unit && budget.unit !== "Matriz" ? (moduleRecords["Unidades e setores"] ?? []).find(item=>item.client===budget.client&&item.name===budget.unit)?.address : customer?.address) || customer?.address || "", status:"Aberta", tone:"blue", avatar:budget.client.split(" ").map(item => item[0]).slice(0,2).join(""), catalogItems:budget.purchaseItems?.filter(item => item.kind !== "Custo adicional").map(item => ({ id:item.productId || item.id, name:item.description, kind:item.kind === "Produto" ? "Produto" : "Serviço" })) };
      const updatedOrders = [order,...serviceOrders]; const updatedModules = { ...moduleRecords, Orçamentos:(moduleRecords.Orçamentos ?? []).map(item => item.id === budget.id ? {...item,status:"Convertido em OS"} : item) };
      setServiceOrders(updatedOrders); setModuleRecords(updatedModules); persistSharedState(customerRecords,updatedOrders,updatedModules); setCurrent("Ordens de serviço");
    }
    setSavedMessage(`Orçamento convertido em ${target}.`); window.setTimeout(() => setSavedMessage(""),2500);
  };
  const saveRecord = async (data: ModalSave) => {
    if (data.title.startsWith("Nova unidade, filial ou setor")) {
      const parentCustomer = data.title.split("•")[1]?.trim() || data.client;
      const structure: ModuleRecord = { id:`SET-${Date.now().toString().slice(-6)}`, name:data.name, client:parentCustomer, description:data.description || data.doc, doc:data.doc, contact:data.contact, phone:data.phone, address:data.address, category:data.category || "Setor", status:"Ativo", createdAt:new Date().toLocaleString("pt-BR"), legalName:data.legalName, tradeName:data.tradeName, email:data.email, zipCode:data.zipCode, street:data.street, addressNumber:data.addressNumber, complement:data.complement, neighborhood:data.neighborhood, city:data.city, state:data.state, stateRegistration:data.stateRegistration, municipalRegistration:data.municipalRegistration, cnaeMain:data.cnaeMain, taxStatus:data.taxStatus };
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
        personType: data.personType,
        organizationType: data.organizationType,
        legalName: data.legalName,
        tradeName: data.tradeName,
        email: data.email,
        zipCode: data.zipCode,
        street: data.street,
        addressNumber: data.addressNumber,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        stateRegistration: data.stateRegistration,
        municipalRegistration: data.municipalRegistration,
        cnaeMain: data.cnaeMain,
        taxStatus: data.taxStatus,
        address: data.address,
        units: 0,
        status: "Ativo",
        creditLimit: data.creditLimit ?? 0,
        balancePosted: data.balancePosted ?? 0,
        financialStatus: data.financialStatus ?? "Liberado",
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
        engineer: data.engineer,
        address: data.workAddress,
        blockLot: data.blockLot,
        endDate: data.endDate,
        progress: data.progress,
        commission: data.commission,
        cost: data.cost,
        doc: data.doc || undefined,
        contact: data.contact || undefined,
        phone: data.phone || undefined,
        legalName: data.legalName || undefined,
        tradeName: data.tradeName || undefined,
        email: data.email || undefined,
        zipCode: data.zipCode || undefined,
        street: data.street || undefined,
        addressNumber: data.addressNumber || undefined,
        complement: data.complement || undefined,
        neighborhood: data.neighborhood || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        stateRegistration: data.stateRegistration || undefined,
        municipalRegistration: data.municipalRegistration || undefined,
        cnaeMain: data.cnaeMain || undefined,
        taxStatus: data.taxStatus || undefined,
        sku: data.sku || undefined, barcode: data.barcode || undefined, brand: data.brand || undefined, model: data.model || undefined, supplier: data.supplier || undefined,
        stockCurrent: data.kind === "Produto" ? data.stockCurrent : undefined, stockMin: data.kind === "Produto" ? data.stockMin : undefined, stockMax: data.kind === "Produto" ? data.stockMax : undefined, stockLocation: data.kind === "Produto" ? data.stockLocation || undefined : undefined,
        warrantyMonths: data.warrantyMonths || undefined, estimatedMinutes: data.kind === "Serviço" ? data.estimatedMinutes : undefined, unitOfMeasure: data.unitOfMeasure || undefined,
        transactionType: moduleName === "Financeiro" ? (/pagar|despesa|fornecedor/i.test(`${data.name} ${data.category}`) ? "Pagar" : "Receber") : undefined,
        employeeRole: moduleName === "Funcionários" ? data.employeeRole : undefined,
        employeePermissions: moduleName === "Funcionários" ? data.employeePermissions : undefined,
        employeeUsername: moduleName === "Funcionários" ? data.employeeUsername?.trim().toLocaleLowerCase("pt-BR") : undefined,
        employeePasswordHash: moduleName === "Funcionários" && data.employeePassword ? await passwordHash(data.employeePassword) : undefined,
        equipmentType: moduleName === "Equipamentos" ? data.equipmentType : undefined,
        capacityBtus: moduleName === "Equipamentos" ? data.capacityBtus : undefined,
        serialNumber: moduleName === "Equipamentos" ? data.serialNumber : undefined,
        voltage: moduleName === "Equipamentos" ? data.voltage : undefined,
        refrigerant: moduleName === "Equipamentos" ? data.refrigerant : undefined,
        frequency: moduleName === "Equipamentos" ? data.frequency : undefined,
        current: moduleName === "Equipamentos" ? data.current : undefined,
        power: moduleName === "Equipamentos" ? data.power : undefined,
        refrigerantCharge: moduleName === "Equipamentos" ? data.refrigerantCharge : undefined,
        manufactureDate: moduleName === "Equipamentos" ? data.manufactureDate : undefined,
        manufacturerCode: moduleName === "Equipamentos" ? data.manufacturerCode : undefined,
        equipmentLabelImage: moduleName === "Equipamentos" ? data.equipmentLabelImage : undefined,
        equipmentLabelImageName: moduleName === "Equipamentos" ? data.equipmentLabelImageName : undefined,
        equipmentLabelHistory: moduleName === "Equipamentos" ? data.equipmentLabelHistory : undefined,
        installationLocation: moduleName === "Equipamentos" ? data.installationLocation : undefined,
        installationDate: moduleName === "Equipamentos" ? data.installationDate : undefined,
        nextMaintenanceDate: moduleName === "Equipamentos" ? data.nextMaintenanceDate : undefined,
        equipmentUnit: moduleName === "Equipamentos" ? data.equipmentUnit : undefined,
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
    try { await fetch("/api/auth", { method: "DELETE" }); } catch {}
    localStorage.removeItem("proar-offline-session");
    setAuthenticatedUser(null);
  };
  const deleteCustomer = (customer: Customer) => {
    if (!window.confirm(`Inativar o cliente “${customer.name}”? O cadastro, seus vínculos e histórico serão preservados.`)) return;
    const updatedCustomers = customerRecords.map(item => item.id === customer.id ? { ...item, status: "Inativo" } : item);
    setCustomerRecords(updatedCustomers);
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
    setSavedMessage("Cliente inativado com sucesso. O histórico foi preservado.");
  };
  const deleteOrder = (order: ServiceOrder) => {
    if (!window.confirm(`Cancelar a ordem ${order.id}? A ordem continuará disponível no histórico.`)) return;
    const updatedOrders = serviceOrders.map(item => item.id === order.id ? { ...item, status: "Cancelada", tone: "red" } : item);
    setServiceOrders(updatedOrders);
    localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(updatedOrders));
    persistSharedState(customerRecords, updatedOrders, moduleRecords);
    setSelectedOrder(null);
    setSavedMessage(`Ordem ${order.id} cancelada. O histórico foi preservado.`);
  };
  const deleteModuleRecord = (moduleName: string, record: ModuleRecord) => {
    const cancellation = /Vendas|Orçamentos|Compras|Financeiro/.test(moduleName);
    if (!window.confirm(`${cancellation ? "Cancelar" : "Inativar"} o registro “${record.name}”? O histórico será mantido.`)) return;
    const updatedModules = { ...moduleRecords, [moduleName]: (moduleRecords[moduleName] ?? []).map(item => item.id === record.id ? { ...item, status: cancellation ? "Cancelado" : "Inativo" } : item) };
    setModuleRecords(updatedModules);
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage(`${cancellation ? "Registro cancelado" : "Registro inativado"} com histórico preservado.`);
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
    updatedModules = appendAudit(updatedModules, exists ? "Registro atualizado" : "Registro criado", `${moduleName} • ${record.name}`, exists ? "Alteração registrada pelo utilizador" : "Novo cadastro registrado pelo utilizador");
    setModuleRecords(updatedModules);
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage(moduleName === "Compras" && record.status === "Recebida" ? "Compra recebida: estoque e conta a pagar atualizados." : "Registro atualizado e sincronizado.");
    window.setTimeout(() => setSavedMessage(""), 3000);
  };
  const saveConfirmedModuleRecord = async (moduleName: string, record: ModuleRecord, relatedRecords: { moduleName: string; record: ModuleRecord }[] = []) => {
    if (!navigator.onLine) {
      setSavedMessage("Sem conexão: este cadastro não foi enviado ao banco.");
      return false;
    }
    const currentRecords = moduleRecords[moduleName] ?? [];
    const exists = currentRecords.some(item => item.id === record.id);
    const nextModuleRecords = exists
      ? currentRecords.map(item => item.id === record.id ? record : item)
      : [record, ...currentRecords];
    let moduleChanges = { ...moduleRecords, [moduleName]: nextModuleRecords };
    for (const related of relatedRecords) {
      const currentRelated = moduleChanges[related.moduleName] ?? [];
      const relatedExists = currentRelated.some(item => item.id === related.record.id);
      moduleChanges = { ...moduleChanges, [related.moduleName]:relatedExists ? currentRelated.map(item => item.id === related.record.id ? related.record : item) : [related.record, ...currentRelated] };
    }
    const updatedModules = appendAudit(
      moduleChanges,
      exists ? "Registro atualizado" : "Registro criado",
      `${moduleName} • ${record.name}`,
      "Alteração aguardou a confirmação do banco principal",
    );
    setSyncPhase("syncing");
    try {
      const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: activeCompany.id,
          customers: customerRecords,
          serviceOrders,
          moduleRecords: updatedModules,
          _baseRevision: stateRevision,
        }),
      });
      const result = await response.json();
      if (response.status === 409 && result.state) {
        const serverCustomers = result.state.customers ?? [];
        const serverOrders = result.state.serviceOrders ?? [];
        const serverModules = mergeImportedServices(result.state.moduleRecords ?? {});
        setCustomerRecords(serverCustomers);
        setServiceOrders(serverOrders);
        setModuleRecords(serverModules);
        setStateRevision(Number(result.state._revision || 0));
        localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(serverCustomers));
        localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(serverOrders));
        localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(serverModules));
        setSavedMessage("Este registro foi alterado por outro usuário. Atualize os dados antes de continuar.");
        setSyncPhase("idle");
        return false;
      }
      if (!response.ok || !result.state) throw new Error(result.error || "Falha ao confirmar a gravação");
      const confirmedCustomers = result.state.customers ?? customerRecords;
      const confirmedOrders = result.state.serviceOrders ?? serviceOrders;
      const confirmedModules = mergeImportedServices(result.state.moduleRecords ?? updatedModules);
      setCustomerRecords(confirmedCustomers);
      setServiceOrders(confirmedOrders);
      setModuleRecords(confirmedModules);
      setStateRevision(Number(result.state._revision || stateRevision + 1));
      localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(confirmedCustomers));
      localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(confirmedOrders));
      localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(confirmedModules));
      setSyncPhase("complete");
      window.setTimeout(() => setSyncPhase("idle"), 1000);
      return true;
    } catch (error) {
      console.error("Falha ao salvar registro confirmado", { moduleName, recordId: record.id, relatedModules:relatedRecords.map(item=>item.moduleName), error });
      setSavedMessage("Não foi possível salvar a alteração. Verifique sua conexão e tente novamente.");
      setSyncPhase("idle");
      return false;
    }
  };
  const globalSearchItems = useMemo<GlobalSearchItem[]>(() => {
    const customerItems = customerRecords.map(customer => ({ id: customer.id, title: customer.name, detail: [customer.doc, customer.phone, customer.city || customer.address].filter(Boolean).join(" • "), module: "Clientes", kind: "Cliente" as const }));
    const orderItems = serviceOrders.map(order => ({ id: order.id, title: order.id, detail: [order.client, order.service, order.tech].filter(Boolean).join(" • "), module: "Ordens de serviço", kind: "OS" as const }));
    const moduleItems = Object.entries(moduleRecords).flatMap(([module, records]) => records.map(record => ({ id: record.id, title: record.name, detail: [record.id, record.client, record.sku, record.barcode, record.serialNumber, record.doc].filter(Boolean).join(" • "), module, kind: "Cadastro" as const })));
    return [...customerItems, ...orderItems, ...moduleItems];
  }, [customerRecords, serviceOrders, moduleRecords]);
  const pendingItems = useMemo<PendingItem[]>(() => {
    const now = new Date();
    const ordersPending = serviceOrders.filter(order => /atras|aguardando|aberta|agendada/i.test(order.status)).map(order => ({ id: `os-${order.id}`, title: `${order.id} • ${order.status}`, detail: `${order.client} • ${order.date || "sem data"}`, module: "Ordens de serviço", tone: /atras/i.test(order.status) ? "red" as const : /aguardando/i.test(order.status) ? "amber" as const : "blue" as const }));
    const recordsPending = Object.entries(moduleRecords).flatMap(([module, records]) => records.filter(record => /atras|venc|aguardando|pendente|baixo estoque|sem estoque/i.test(record.status || "") || (module === "Estoque" && (record.stockCurrent ?? 0) <= (record.stockMin ?? -1))).map(record => ({ id: `${module}-${record.id}`, title: record.name, detail: `${module} • ${record.status || "Atenção necessária"}`, module, tone: /atras|venc|sem estoque/i.test(record.status || "") ? "red" as const : "amber" as const })));
    return [...ordersPending, ...recordsPending].slice(0, 20);
  }, [serviceOrders, moduleRecords]);
  const openNew = (option: string) => {
    const routes: Record<string, { module?: string; modal?: string }> = {
      "Cliente": { modal: "Novo cliente" }, "Unidade": { module: "Clientes" }, "Equipamento": { modal: "Novo • Equipamentos" }, "Orçamento": { module: "Orçamentos" }, "Venda": { module: "Vendas" }, "Ordem de Serviço": { modal: "Nova ordem de serviço" }, "Agendamento": { modal: "Nova ordem de serviço" }, "Compra": { modal: "Novo registro • Compras" }, "Produto": { modal: "Novo registro • Produtos" }, "Serviço": { modal: "Novo registro • Serviços" }, "Conta a pagar": { modal: "Novo registro • Financeiro" }, "Conta a receber": { modal: "Novo registro • Financeiro" },
    };
    const route = routes[option];
    if (route.module) setCurrent(route.module);
    if (route.modal) setModal(route.modal);
    if (option === "Unidade") setSavedMessage("Abra um cliente para cadastrar uma unidade, filial ou setor vinculado.");
  };
  const openGlobalSearch = (item: GlobalSearchItem) => {
    setCurrent(item.module);
    setSavedMessage(`${item.kind} localizado: ${item.title}.`);
  };
  const openPending = (item: PendingItem) => {
    setCurrent(item.module);
    setSavedMessage(`Pendência selecionada: ${item.title}.`);
  };
  if (checkingSession) return <div className="session-loading"><div className="brand-mark brand-logo"><img src="/icon.png" alt="ProAR"/></div><p>A carregar o ProAR...</p></div>;
  if (!authenticatedUser) return <LoginScreen onLogin={handleLogin}/>;
  return <div className="app-shell">
    <Sidebar current={current} setCurrent={setCurrent} open={menuOpen} close={() => setMenuOpen(false)} permissions={authenticatedUser.permissions}/>
    <main className="main">
      <Header title={current === "Painel inicial" ? `Olá, ${authenticatedUser.displayName.split(" ")[0]}` : titles[current] || current} subtitle={subtitles[current] || "Controle integrado da sua operação."} onMenu={() => setMenuOpen(true)} onNew={openNew} searchItems={globalSearchItems} pendingItems={pendingItems} onSearchSelect={openGlobalSearch} onPendingSelect={openPending} userName={authenticatedUser.displayName} userRole={authenticatedUser.role ?? "Utilizador"} onSwitchUser={logout} online={online} syncing={syncing} onPull={() => void pullFromDatabase()} onPush={() => void pushToDatabase()}/>
      {syncPhase !== "idle" && <div className={`sync-progress ${syncPhase}`} role="status" aria-label={syncPhase === "complete" ? "Dados atualizados" : "Sincronizando dados"}><i/></div>}
      {savedMessage && <div className="save-toast" role="status"><CheckCircle2 size={16}/>{savedMessage}</div>}
      <div className="company-context"><Building2 size={13}/><span>{activeCompany.tradeName}</span><small>{activeCompany.cnpj || "CNPJ pendente"} • {activeCompany.city}/{activeCompany.state}</small></div>
      {current === "PMOC e conformidade" && <TechnicalCompliancePanel plans={(moduleRecords.PMOC ?? []) as any} fluids={(moduleRecords.Refrigerantes ?? []) as any} documents={(moduleRecords["Documentação / Habilitação"] ?? []) as any} onSave={(module,record)=>saveConfirmedModuleRecord(module,record)}/>}
      <div className="page-content">{current === "Painel inicial" ? <Dashboard onNavigate={setCurrent} serviceOrders={serviceOrders} modules={moduleRecords}/> : current === "Clientes" ? <Customers onOpen={setModal} onDelete={deleteCustomer} onUpdate={updateCustomer} onUpdateStructure={record => updateModuleRecord("Unidades e setores",record)} canEdit={hasAction("Clientes","Editar")} customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} serviceOrders={serviceOrders} modules={moduleRecords}/> : current === "Agenda" ? <Agenda serviceOrders={serviceOrders} onOpen={setModal} onSelect={setSelectedOrder}/> : current === "Obras" ? <HousesWorkModule companyId={activeCompany.id} company={activeCompany} responsibleUser={authenticatedUser.displayName}/> : current === "Licitações" ? <><PublicContractsPanel records={(moduleRecords.Certames ?? []) as PublicContractRecord[]} customers={customerRecords} onSave={record => saveConfirmedModuleRecord("Certames", record)}/><PublicCommitmentsPanel orders={serviceOrders} contracts={(moduleRecords.Certames ?? []) as PublicContractRecord[]} commitments={(moduleRecords.Empenhos ?? []) as PublicCommitmentRecord[]} onSave={record=>saveConfirmedModuleRecord("Empenhos",record)} onReadyToInvoice={record=>saveConfirmedModuleRecord("Empenhos",{...record,status:"Pronto para faturar"},[{moduleName:"Financeiro",record:{id:`FAT-${record.id}`,name:`Faturamento • ${record.name}`,client:record.client,description:`Aguardando emissão de Nota Fiscal • ${record.empenhoProcess || "processo não informado"}`,createdAt:new Date().toLocaleString("pt-BR"),status:"Pronto para faturar",date:new Date().toISOString().slice(0,10),value:record.value??0,category:"Faturamento público",transactionType:"Receber",empenhoId:record.id}}])}/><BiddingModule/></> : current === "Orçamentos" ? <BudgetPDV customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} catalog={[...(moduleRecords.Produtos ?? []),...(moduleRecords.Serviços ?? [])]} budgets={moduleRecords.Orçamentos ?? []} onSave={record => updateModuleRecord("Orçamentos",record)} onConvert={convertBudget} onDelete={record => deleteModuleRecord("Orçamentos",record)}/> : current === "Vendas" ? <SalesPDV customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} records={[...(moduleRecords.Produtos ?? []),...(moduleRecords.Serviços ?? [])]} sales={moduleRecords.Vendas ?? []} onSave={record => updateModuleRecord("Vendas",record)}/> : current === "Relatórios" ? <Reports modules={moduleRecords} customers={customerRecords} serviceOrders={serviceOrders} company={activeCompany}/> : current === "Configurações" ? <SettingsModule companies={companies} activeCompany={activeCompany} onCompaniesChange={updateCompanies} onSelectCompany={selectCompany} isAdministrator={authenticatedUser.role === "Administrador" || authenticatedUser.permissions?.includes("*")}/> : current === "Financeiro" ? <FinancialModule records={moduleRecords.Financeiro ?? []} onOpen={setModal} onUpdate={record=>{const commitment=record.status==="Recebida"?(moduleRecords.Empenhos??[]).find(item=>item.id===record.empenhoId):undefined;const related=commitment?[{moduleName:"Empenhos",record:{...commitment,status:"Recebido"}}]:[];return saveConfirmedModuleRecord("Financeiro",record,related)}} onIssueInvoice={(record,invoiceNumber)=>{const commitment=(moduleRecords.Empenhos??[]).find(item=>item.id===record.empenhoId);const related=commitment?[{moduleName:"Empenhos",record:{...commitment,status:"Faturado"}}]:[];return saveConfirmedModuleRecord("Financeiro",{...record,status:"Em aberto",transactionType:"Receber",invoiceNumber,invoiceIssuedAt:new Date().toISOString()},related)}}/> : current === "Ordens de serviço" ? <ServiceOrders onOpen={setModal} onSelect={setSelectedOrder} onDelete={deleteOrder} onUpdate={updateServiceOrder} serviceOrders={serviceOrders} customers={customerRecords} company={activeCompany}/> : <GenericModule name={current} onOpen={setModal} onDelete={deleteModuleRecord} onUpdate={updateModuleRecord} onConvert={convertBudget} companyCnpj={activeCompany.cnpj} canEdit={hasAction(current,"Editar")} records={moduleRecords[current] ?? []} allModules={moduleRecords} serviceOrders={serviceOrders}/>}</div>
      <footer><span>© 2026 ProAR Gestão de Serviços</span><span><ShieldCheck size={12}/> Gestão segura e inteligente para prestadores de serviços.</span></footer>
    </main>
    {modal && <Modal title={modal} customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} catalogRecords={[...(moduleRecords["Serviços"] ?? []), ...(moduleRecords["Produtos"] ?? [])]} supplierRecords={moduleRecords["Fornecedores"] ?? []} employeeRecords={moduleRecords["Funcionários"] ?? [tiagoEmployee]} close={() => setModal("")} onSave={saveRecord}/>}
    {selectedOrder && <OrderDetail order={selectedOrder} customerPhone={customerRecords.find(customer => customer.name === selectedOrder.client)?.phone} company={activeCompany} catalog={[...(moduleRecords["Serviços"] ?? []), ...(moduleRecords["Produtos"] ?? [])]} contracts={(moduleRecords.Certames ?? []) as PublicContractRecord[]} close={() => setSelectedOrder(null)} onUpdate={updateServiceOrder} canEdit={hasAction("Ordens de serviço","Editar")}/>}{/* detalhe da OS */}
  </div>;
}
