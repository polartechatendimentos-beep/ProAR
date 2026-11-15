Warning: truncated output (original token count: 158415)
Total output lines: 5264

"use client";
import {ServiceOrderReportPreview} from "../components/ServiceOrderReportPreview";
import {prepareOrderWorkspaceSave,orderStatusTone,workspaceDraftKey,newOrderSchedulingIssue,type OrderScheduleSeed} from "../lib/order-workspace-state";
import {OperationalAgenda} from "../components/OperationalAgenda";
import {BiddingDocumentsWorkspace} from "@/components/BiddingDocumentsWorkspace";

import { createPortal } from "react-dom";

import { EMPLOYEE_ACCESS_MODULES, EMPLOYEE_ACCESS_PROFILES, employeeAccessPreset, employeeAccessRole } from "@/lib/employee-access-presets";
import { employeePasswordIssue } from "@/lib/employee-password-validation";
import { orderCreationIssue } from "@/lib/order-create-validation";
import { orderSectorLocationOptions, orderSectorUnitSelection } from "@/lib/order-location-options";
import { stateSaveOutcome } from "@/lib/state-save-confirmation";
import type { CostLine } from "@/lib/catalog-cost-engine";
import { CatalogBidSimulator } from "@/components/CatalogBidSimulator";
import { CatalogAdvancedSimulators } from "@/components/CatalogAdvancedSimulators";
import { CatalogCostComposer } from "@/components/CatalogCostComposer";
import { EmployeeSignatureEditor } from "@/components/EmployeeSignatureEditor";
import { readOrderSignatures } from "@/lib/service-order-signatures";
import { serviceOrderDocumentData } from "@/lib/mobile-order-records";
import { EmployeeRoutesTab } from "@/components/EmployeeRoutesTab";
import { WorkMaterialPlanningPanel, RESERVA_MATERIAL_PLANNING, type WorkMaterialPlanning } from "@/components/WorkMaterialPlanningPanel";
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
import "./google-calendar.css";
import "./usability-hardening.css";
import "./fiscal-workspace.css";
import "./responsive-hardening.css";
import "./resilience-status.css";
import { ConnectivityBanner } from "@/components/ResponsivePrimitives";
import { MobileToday } from "@/components/MobileToday";

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight,
  Bell, Boxes, BriefcaseBusiness, Building2, CalendarDays, ChartNoAxesCombined,
  CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, ClipboardList,
  Clock3, FileChartColumn, FileText, Filter, Grid2X2, HandCoins, Headphones,
  ArrowLeft, Camera, Contact, Edit3, Eye, EyeOff, Hospital, Landmark, LayoutDashboard, LogIn, LogOut, MapPin,
  CreditCard, Keyboard, Menu, Minus, MoreHorizontal, Package, Phone, Plus, ReceiptText, ScanBarcode, School, Search, Settings,
  ShieldCheck, ShoppingBag, ShoppingCart, Store, TrendingUp, UserCheck, UserRound, Save,
  MessageCircle, PenTool, Tag, Trash2, Database, LockKeyhole, UnlockKeyhole, ImagePlus,
  UsersRound, WalletCards, Warehouse, Wrench, X, Zap, House, History, ImageIcon, RefreshCw, Sparkles, Stethoscope, Smartphone
} from "lucide-react";
import { PublicContractsPanel, type PublicContractRecord } from "@/components/PublicContractsPanel";
import { PublicCommitmentsPanel, type PublicCommitmentRecord } from "@/components/PublicCommitmentsPanel";
import { BudgetQuickCreateDrawer, type CustomerDraft, type StructureDraft } from "@/components/BudgetQuickCreateDrawer";
import { CustomerSearchSelect } from "@/components/CustomerSearchSelect";
import { CurrencyInput } from "@/components/CurrencyInput";
import { centsToMoney, moneyToCents } from "@/lib/money-input";
import { validateCpf, validateCnpj } from "@/lib/customer-validation";
import { CustomerHierarchyProvider } from "@/components/CustomerHierarchyContext";
import { customerHierarchy, hierarchySelection, isMunicipalCustomer, matchesHierarchyLocation, type HierarchySelection } from "@/lib/customer-hierarchy";
import { TechnicalBasePanel } from "@/components/TechnicalBasePanel";
import { moduleFromSearch, moduleNavigationUrl, canNavigateModule } from "@/lib/module-navigation";
import { isMobileInterfacePath } from "@/lib/interface-experience";
import { TenderPipelinePanel } from "@/components/TenderPipelinePanel";
import type { TenderTracking } from "@/lib/tender-pipeline";
import { ProcurementReadinessPanel } from "@/components/ProcurementReadinessPanel";
import type { ProcurementData, PricingInput } from "@/lib/procurement-readiness";
import { BiddingOperationsWorkspace } from "@/components/BiddingOperationsWorkspace";
import { WhatsAppWebConnection } from "@/components/WhatsAppWebConnection";
import { OperationalFinance } from "@/components/OperationalFinance";
import { InventoryOperations } from "@/components/InventoryOperations";
import type { OperationalCommand } from "@/lib/operational-ledger";
import { ServiceOrderWorkspace, type WorkspaceOrder } from "@/components/ServiceOrderWorkspace";
import { canLinkHistoricalServiceOrder, isEquipmentLabelCode, normalizeEquipmentLabelCode } from "@/lib/equipment-label-associations";
import { CustomerProfileWorkspace } from "@/components/CustomerProfileWorkspace";
import { TechnicalCompliancePanel } from "@/components/TechnicalCompliancePanel";
import { IntegrityAudit } from "@/components/IntegrityAudit";
import { calculateCertameItemBalance, createCertameMovement, financialOutstandingValue, financialRealizedValue } from "@/lib/public-contracts";
import { improveTechnicalText } from "@/lib/text-assist";
import { WORK_STATUSES, getWorkProgress, getWorkStatusColor, normalizeWorkStatus, type WorkStatus } from "@/lib/work-status";
import { TenderPortalLinks } from "@/components/TenderPortalLinks";
import { TenderRadarTools, type RadarDiagnostic } from "@/components/TenderRadarTools";
import { prepareCustomerStructureSave, prepareCustomerStructureInactivation } from "@/lib/customer-structure";
import { deriveOperationalActions } from "@/lib/action-center";
import { OperationsActionCenter } from "@/components/OperationsActionCenter";
import { DashboardWorkspace } from "@/components/DashboardWorkspace";
import { ApprovalCenter } from "@/components/ApprovalCenter";
import { FiscalWorkspace } from "@/components/FiscalWorkspace";
import { inferFeedbackTone, notifyFeedback, type FeedbackAction, type FeedbackTone } from "@/lib/ui-feedback";
import { friendlyErrorMessage } from "@/lib/error-messages";
import { CURRENT_PROAR_RELEASE, PROAR_RELEASES, type ReleaseNoteType } from "@/lib/release-notes";
import { ActivityCenter } from "@/components/ActivityCenter";
import { DiagnosticManagementDashboard } from "@/components/DiagnosticManagementDashboard";
import { auditMatches, diffAuditRecord } from "@/lib/audit-utils";
import { buildWorkTodaySummary, workDailyLog } from "@/lib/work-operations";
import type {EmployeeComplianceDoc,EmployeeAsset} from "@/lib/employee-management";
import { allowedMobileDiscount, receiptText, whatsappReceiptUrl } from "@/lib/mobile-sales";
import { barcodeScannerSupported, openRearCamera, scanBarcodeFromVideo } from "@/lib/mobile-barcode";
import { createMobilePaymentIntent, paymentStatusLabel } from "@/lib/mobile-payments";

type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
type NavItem = { icon: IconType; name: string; badge?: string };
type GlobalSearchItem = { id: string; title: string; detail: string; module: string; kind: "Cliente" | "OS" | "Cadastro" };
type PendingItem = { id: string; title: string; detail: string; module: string; tone: "blue" | "amber" | "red" };

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: "OPERAÇÃO DO DIA A DIA", items: [
    { icon: LayoutDashboard, name: "Painel inicial" },
    { icon: Activity, name: "Atividades" },
    { icon: Bell, name: "Central de pendências" },
    { icon: CalendarDays, name: "Agenda" },
    { icon: ClipboardList, name: "Ordens de serviço" },
    { icon: UsersRound, name: "Clientes" },
    { icon: Boxes, name: "Equipamentos" },
    { icon: ShieldCheck, name: "PMOC e conformidade" },
    { icon: Building2, name: "Obras" },
    { icon: Warehouse, name: "Estoque" },
    { icon: FileText, name: "Base Técnica" },
  ]},
  { label: "COMERCIAL & CONTRATOS", items: [
    { icon: FileText, name: "Orçamentos" },
    { icon: ShoppingBag, name: "Vendas" },
    { icon: Landmark, name: "Licitações" },
    { icon: Wrench, name: "Serviços" },
    { icon: Package, name: "Produtos" },
    { icon: ShoppingCart, name: "Compras" },
    { icon: Store, name: "Fornecedores" },
  ]},
  { label: "FINANCEIRO & RESULTADOS", items: [
    { icon: WalletCards, name: "Financeiro" },
    { icon: ReceiptText, name: "Fiscal" },
    { icon: ShieldCheck, name: "Aprovações" },
    { icon: BriefcaseBusiness, name: "Funcionários" },
    { icon: FileChartColumn, name: "Relatórios" },
    { icon: Stethoscope, name: "Diagnósticos" },
    { icon: Database, name: "Integridade do Sistema" },
    { icon: Settings, name: "Configurações" },
  ]},
];

type ServiceOrder = {
  communicationDraft?: {internalNote?:string;customerNote?:string;photos?:string[]};
  pmocExecutionDraft?:Partial<PmocExecution>;
  pmocBeforePhotosDraft?:string[];
  pmocAfterPhotosDraft?:string[];
  changeReason?: string;
  id: string; client: string; unit: string; service: string; tech: string;
  customerId?: string;
  unitId?: string;
  sectorId?: string;
  roomId?: string;
  sourceBudgetId?: string;
  equipmentIds?: string[];
  equipmentId?: string;
  equipmentLabelCode?: string;
  total?: number;
  servicesTotal?: number;
  productsTotal?: number;
  date: string; time: string; address: string; status: string; tone: string; avatar: string;
  checkInAt?: string;
  checkOutAt?: string;
  photoBefore?: string;
  photoAfter?: string;
  clientSignature?: string;
  technicianSignature?: string;
  catalogItems?: { id: string; name: string; kind: "Serviço" | "Produto"; quantity?: number }[];
  reminderEnabled?: boolean;
  reminderAmount?: number;
  reminderUnit?: "Dias" | "Meses";
  reminderDate?: string;
  reminderMessage?: string;
  whatsappConsent?: boolean;
  whatsappOptOut?: boolean;
  reminderStatus?: "Pendente" | "Agendado" | "Enviado";
  lastMaintenanceDate?: string;
  reviewPeriodMonths?: 3 | 6 | 12;
  notifyDaysBefore?: number;
  nfseStatus?: "Não emitida" | "Pendente" | "Validando" | "Transmitindo" | "Processando" | "Autorizada" | "Emitida" | "Rejeitada" | "Erro" | "Cancelada" | "Contingência";
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
  sector?: string;
  room?: string;
  structureId?: string;
  priority?: "Baixa" | "Normal" | "Alta" | "Urgente";
  serviceType?: string;
  checklist?: string;
  tag?: string;
  externalCode?: string;
  checkInRequirement?: string;
  estimatedDurationMinutes?: number;
  googleCalendarEventId?: string;
  googleCalendarEventUrl?: string;
  googleCalendarId?: string;
  googleCalendarSyncedAt?: string;
  googleCalendarSyncEnabled?: boolean;
  pmocRepeatEnabled?: boolean;
  npsEnabled?: boolean;
  request?: string;
  discount?: number;
  photos?: Record<string, string[]>;
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
  changeReason?: string;
  id: string; name: string; doc: string; contact: string; phone: string; whatsapp?: string;
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
type ExternalObservation = { id: string; author: string; role: string; houseId: string; environment?: string; stage?: string; description: string; photos?: string[]; createdAt: string; status: "Aberto" | "Em análise" | "Resolvido" };
type HouseWorkItem = { id: string; block: string; lot: number; kind?: "house" | "common"; name?: string; status: HouseWorkStatus | LegacyHouseWorkStatus; photo?: string; photos?: string[] | HouseStagePhoto[]; note?: string; updatedAt?: string; history: HouseWorkUpdate[]; incidents?: HouseIncident[]; externalObservations?: ExternalObservation[] };
type WorkBlock = { block: string; houses: number };
type WorkExternalAccess = { id: string; name: string; role: "Engenheiro" | "Fiscal"; username: string; passwordHash: string; active: boolean; createdAt: string };
type WorkProject = { id: string; name: string; blocks: WorkBlock[]; commonAreas: string[]; createdAt: string; externalAccess?: WorkExternalAccess[]; materialPlanning?: WorkMaterialPlanning };

const HOUSE_BLOCKS = [
  { block: "A", houses: 5 }, { block: "B", houses: 24 }, { block: "C1", houses: 16 },
  { block: "C2", houses: 16 }, { block: "D", houses: 6 }, { block: "E", houses: 5 },
  { block: "F", houses: 27 }, { block: "G", houses: 12 }, { block: "H1", houses: 10 },
  { block: "H2", houses: 10 }, { block: "I", houses: 12 },
] as const;
const RESERVA_IMPERIAL: WorkProject = { id: "reserva-imperial", name: "Reserva Imperial", blocks: HOUSE_BLOCKS.map(item => ({...item})), commonAreas: ["Academia", "Salão de Festas", "Área Gourmet", "Administrativo"], createdAt: "2026-08-11T00:00:00.000Z", materialPlanning: {...RESERVA_MATERIAL_PLANNING, environments: RESERVA_MATERIAL_PLANNING.environments.map(item => ({...item}))} };
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
  try {
    const current = localStorage.getItem(companyStorageKey(companyId, resource));
    // Dados legados globais só podem ser usados na empresa principal. Em tenants, nunca cruzar caches.
    const allowLegacy = companyId === DEFAULT_COMPANY.id || companyId === "main";
    const legacy = allowLegacy && legacyStorageKeys[resource] ? localStorage.getItem(legacyStorageKeys[resource]) : null;
    const raw = current ?? legacy;
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[ProAR Cache] Não foi possível ler o cache de ${resource}; usando o padrão seguro.`, error);
    return fallback;
  }
}
const normalizeCnpj = (value: string) => value.replace(/\D/g, "").slice(0, 14);
const customerDocumentError = (value?: string) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11) return validateCpf(digits) ? "" : "CPF inválido. Confira os dígitos verificadores.";
  if (digits.length === 14) return validateCnpj(digits) ? "" : "CNPJ inválido. Confira os dígitos verificadores.";
  return "CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos.";
};
const formatCnpj = (value: string) => value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, "$1.$2.$3/$4-$5");
async function prepareCatalogImage(file: File): Promise<{dataUrl:string;name:string}> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");
  if (file.size > 8 * 1024 * 1024) throw new Error("A imagem original deve ter no máximo 8 MB.");
  const source=URL.createObjectURL(file);
  try {
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error("Não foi possível ler a imagem."));
      img.src=source;
    });
    const maxWidth=960,maxHeight=720;
    const scale=Math.min(1,maxWidth/image.naturalWidth,maxHeight/image.naturalHeight);
    const width=Math.max(1,Math.round(image.naturalWidth*scale));
    const height=Math.max(1,Math.round(image.naturalHeight*scale));
    const canvas=document.createElement("canvas");
    canvas.width=width; canvas.height=height;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Não foi possível preparar a imagem.");
    context.drawImage(image,0,0,width,height);
    let quality=.8;
    let dataUrl=canvas.toDataURL("image/webp",quality);
    while(dataUrl.length>520000&&quality>.45){quality-=.1;dataUrl=canvas.toDataURL("image/webp",quality);}
    if(dataUrl.length>700000)throw new Error("A imagem ficou muito grande mesmo após otimização. Escolha outra foto.");
    return {dataUrl,name:file.name.replace(/\.[^.]+$/,"")+".webp"};
  } finally { URL.revokeObjectURL(source); }
}

const companyIdFromCnpj = (cnpj: string) => normalizeCnpj(cnpj) || `empresa-${Date.now()}`;

type ModuleRecord = {
  tracking?: TenderTracking;
  procurement?: ProcurementData;
  pricing?: PricingInput;
  id: string;
  name: string;
  client: string;
  customerId?: string;
  unitId?: string;
  sectorId?: string;
  roomId?: string;
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
  whatsappConsent?: boolean;
  whatsappOptOut?: boolean;
  serviceOrderId?: string;
  unit?: string;
  structureId?: string;
  sector?: string;
  room?: string;
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
  costLines?: CostLine[];
  costTaxPercent?: number;
  costMarginPercent?: number;
  costCardFeePercent?: number;
  unitOfMeasure?: string;
  ncm?: string;
  cest?: string;
  cfop?: string;
  cst?: string;
  csosn?: string;
  taxOrigin?: string;
  serviceCode?: string;
  issRate?: number;
  transactionType?: "Pagar" | "Receber";
  settledValue?: number;
  settlementDate?: string;
  settlementMethod?: string;
  settlementAccount?: string;
  interestValue?: number;
  discountValue?: number;
  discount?: number;
  discountPercent?: number;
  subtotal?: number;
  surcharge?: number;
  reference?: string;
  seller?: string;
  approvalRequired?: boolean;
  approvalStatus?: "Pendente" | "Aprovado" | "Rejeitado";
  approvalDecidedAt?: string;
  approvalDecidedBy?: string;
  approvalDecisionReason?: string;
  changeReason?: string;
  stockAdjustmentReason?: string;
  receiptHistory?: { id: string; createdAt: string; items: { itemId: string; productId: string; quantity: number }[] }[];
  settlementHistory?: { id: string; value: number; interest: number; discount: number; method: string; account: string; createdAt: string }[];
  empenhoId?: string;
  invoiceNumber?: string;
  invoiceIssuedAt?: string;
  employeeRole?: string;
  accessProfile?: string;
  employeePermissions?: Record<string, ("Visualizar" | "Criar" | "Editar" | "Excluir")[]>;
  employeeSignature?:string;
  employeeSignatureUpdatedAt?:string;
  employeeSignatureUpdatedBy?:string;
  employeeUsername?: string;
  employeePasswordHash?: string;
  mobileAccessEnabled?: boolean;
  restrictLoginToWorkHours?: boolean;
  workdayStart?: string;
  workdayEnd?: string;
  requireGpsForOs?: boolean;
  workdayToleranceMinutes?: number;
  monthlyHourTarget?: number;
  overtimeRequiresApproval?: boolean;
  attendanceAdjustmentReason?: string;
  employeeDocuments?: EmployeeComplianceDoc[];
  employeeAssets?: EmployeeAsset[];
  timeBankMinutes?: number;
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
  publicMaintenanceHistoryEnabled?: boolean;
  permanentLabelCode?: string;
  historicalServiceOrderIds?: string[];
  diagnosticHistory?: Record<string,unknown>[];
  lastDiagnosticAt?: string;
  sourceUrl?: string;
  verified?: boolean;
  equipmentTypes?: string[];
  models?: string[];
  capacitiesBtus?: number[];
  catalogImage?: string;
  catalogImageName?: string;
  catalogImageUpdatedAt?: string;
  parentUnit?: string;
  parentId?: string;
  hierarchyLevel?: "Cliente" | "Diretoria" | "Secretaria" | "Departamento" | "Órgão" | "Unidade" | "Filial" | "Setor" | "Sala" | "Ambiente";
  environmentType?: string;
  roomNumber?: string;
  floor?: string;
  block?: string;
  localResponsible?: string;
  extension?: string;
  criticality?: string;
  priorityAttendance?: boolean;
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
  auditModule?: string;
  recordId?: string;
  auditAction?: string;
  auditDetail?: string;
  auditUser?: string;
  auditChanges?: { field:string; before:string; after:string }[];
};

// Fonte única para os seletores Cliente → Unidade/Filial/Setor. Ela lê os
// registros existentes do módulo de estruturas, sem criar cópias paralelas.
const normalizeRelation = (value?: string) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
function customerStructures(customerName: string, customers: Customer[], structures: ModuleRecord[], includeInactive = false) {
  const customer = customers.find(item => item.name === customerName);
  const keys = [customerName, customer?.name, customer?.legalName, customer?.tradeName].map(normalizeRelation).filter(Boolean);
  return structures
    .filter(item => item.customerId ? Boolean(customer?.id && item.customerId === customer.id) : keys.includes(normalizeRelation(item.client)))
    .filter(item => includeInactive || !/^inativ/i.test(item.status ?? ""))
    .sort((a, b) => {
      const aMain = /matriz|unidade principal|sede/i.test(`${a.name} ${a.category ?? ""}`) ? 0 : 1;
      const bMain = /matriz|unidade principal|sede/i.test(`${b.name} ${b.category ?? ""}`) ? 0 : 1;
      return aMain - bMain || a.name.localeCompare(b.name, "pt-BR");
    });
}

function customerLocations(customerName: string, customers: Customer[], structures: ModuleRecord[], unitName = "") {
  const all = customerStructures(customerName, customers, structures);
  const isRoom = (item: ModuleRecord) => Boolean(item.environmentType) || /sala|ambiente|consult|labor|farm|uti|recep|almox|audit|cozinha|cpd|quarto/i.test(`${item.name} ${item.category ?? ""}`);
  const isSector = (item: ModuleRecord) => /secretaria|setor|departamento|área|local de atendimento/i.test(`${item.category ?? ""} ${item.hierarchyLevel ?? ""}`) && !isRoom(item);
  const units = all.filter(item => !isSector(item) && !isRoom(item));
  const selectedUnit = all.find(item => item.name === unitName);
  const sectors = unitName ? all.filter(item => isSector(item) && (normalizeRelation(item.parentUnit) === normalizeRelation(unitName) || item.parentId === selectedUnit?.id)) : [];
  const unlinkedSectors = all.filter(item => isSector(item) && !item.parentUnit && !item.parentId);
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
  unitOfMeasure?: string;
  discountPercent?: number;
};

type PurchaseInstallment = { number: string; dueDate: string; value: number };

const orders: ServiceOrder[] = [];
const customers: Customer[] = [];
const tiagoEmployee: ModuleRecord = { id: "FUN-000001", name: "Tiago Viana", client: "tiago.viana", description: "Funcionário e técnico responsável", createdAt: "Cadastro principal", status: "Ativo", category: "Técnico", employeeRole: "Técnico de Campo", employeePermissions: { Clientes: ["Visualizar"], "Ordens de serviço": ["Visualizar", "Editar"], Agenda: ["Visualizar", "Editar"], Serviços: ["Visualizar"] }, employeeUsername: "tiago.viana" };
const linkedUnits: Record<string, { icon: IconType; name: string; type: string; doc: string; responsible: string; phone: string; address: string; orders: number }[]> = {};
const linkedSectors: Record<string, { icon: IconType; name: string; type: string; doc: string; responsible: string; phone: string; address: string; orders: number }[]> = {};

function normalizeGlobalSearch(value: string) {
  return value.toLocaleLowerCase("pt-BR");
}

function highlightGlobalSearch(value: string, query: string) {
  const term = query.trim();
  if (!term) return value;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.split(new RegExp(`(${escaped})`, "ig")).map((part, index) =>
    part.toLocaleLowerCase("pt-BR") === term.toLocaleLowerCase("pt-BR")
      ? <mark className="proar-search-highlight" key={index}>{part}</mark>
      : part
  );
}

function Header({ title, subtitle, onMenu, searchItems, pendingItems, onSearchSelect, onPendingSelect, userName, userRole, onSwitchUser, online, syncing, onPull }: { title: string; subtitle: string; onMenu: () => void; onNew: (option: string) => void; searchItems: GlobalSearchItem[]; pendingItems: PendingItem[]; onSearchSelect: (item: GlobalSearchItem) => void; onPendingSelect: (item: PendingItem) => void; userName: string; userRole: string; onSwitchUser: () => void; online: boolean; syncing: boolean; onPull: () => void; onPush: () => void }) {
  const [searchOpen,setSearchOpen]=useState(false);
  const [pendingOpen,setPendingOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [searchCategory,setSearchCategory]=useState<"Todos"|"Cliente"|"OS"|"Cadastro">("Todos");
  const [searchHistory,setSearchHistory]=useState<string[]>([]);
  const [activeSearchIndex,setActiveSearchIndex]=useState(-1);
  useEffect(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem("proar-global-search-history")||"[]");
      if(Array.isArray(saved))setSearchHistory(saved.filter((item):item is string=>typeof item==="string").slice(0,5));
    }catch{}
  },[]);
  useEffect(()=>{setActiveSearchIndex(-1);},[query,searchCategory]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();setSearchOpen(true);setPendingOpen(false);
      }
      if(event.key==="Escape"){setSearchOpen(false);setPendingOpen(false);}
    };
    const outside=(event:PointerEvent)=>{
      const target=event.target;
      if(!(target instanceof Element))return;
      if(!target.closest(".header-global-search"))setSearchOpen(false);
      if(!target.closest(".header-pending"))setPendingOpen(false);
    };
    window.addEventListener("keydown",handler);
    document.addEventListener("pointerdown",outside);
    return()=>{window.removeEventListener("keydown",handler);document.removeEventListener("pointerdown",outside);};
  },[]);
  const normalizedQuery=normalizeGlobalSearch(query.trim());
  const matches=normalizedQuery.length<2?[]:searchItems
    .filter(item=>searchCategory==="Todos"||item.kind===searchCategory)
    .filter(item=>normalizeGlobalSearch(`${item.title} ${item.detail} ${item.module}`).includes(normalizedQuery))
    .slice(0,10);
  const selectSearchItem=(item:GlobalSearchItem)=>{
    const term=query.trim();
    if(term.length>=2){
      const next=[term,...searchHistory.filter(entry=>entry.toLocaleLowerCase("pt-BR")!==term.toLocaleLowerCase("pt-BR"))].slice(0,5);
      setSearchHistory(next);
      try{localStorage.setItem("proar-global-search-history",JSON.stringify(next));}catch{}
    }
    onSearchSelect(item);setSearchOpen(false);setQuery("");setActiveSearchIndex(-1);
  };
  const onSearchKeyDown=(event:ReactKeyboardEvent<HTMLInputElement>)=>{
    if(event.key==="ArrowDown"&&matches.length){event.preventDefault();setActiveSearchIndex(index=>index<0?0:(index+1)%matches.length);}
    else if(event.key==="ArrowUp"&&matches.length){event.preventDefault();setActiveSearchIndex(index=>index<=0?matches.length-1:index-1);}
    else if(event.key==="Enter"&&activeSearchIndex>=0&&matches[activeSearchIndex]){event.preventDefault();selectSearchItem(matches[activeSearchIndex]);}
    else if(event.key==="Escape"){event.preventDefault();setSearchOpen(false);}
  };
  return <header className="topbar topbar-user-only">
    <div className="headline">
      <button className="menu-toggle" aria-label="Abrir menu" onClick={onMenu}><Menu size={20}/></button>
      <div className="header-module-mark"><img src="/brand/proar-system-512.png?v=20261015" alt="ProAR"/></div>
      <div className="headline-copy"><div className="eyebrow"><span>PROAR</span><ChevronRight size={10}/><b>Central de operações</b><i>BY TAV's</i></div><h1>{title}</h1><p>{subtitle}</p></div>
    </div>
    <div className="top-actions top-actions-user-only">
      <a href="/mobile" className="header-tool-button" aria-label="Abrir ProAR Mobile no celular" title="ProAR Mobile — versão mobile"><Smartphone size={16}/></a>
      <div className="header-global-search">
        <button className="header-tool-button" aria-label="Busca global" title="Busca global (Ctrl+K)" aria-expanded={searchOpen} aria-controls="proar-global-search-popover" onClick={()=>{setSearchOpen(value=>!value);setPendingOpen(false)}}><Search size={16}/></button>
        {searchOpen&&<div id="proar-global-search-popover" className="header-popover search-popover" role="dialog" aria-label="Busca global do ProAR">
          <label className="proar-search-input"><Search size={14}/><input autoFocus role="combobox" aria-label="Pesquisar em clientes, ordens e cadastros" aria-autocomplete="list" aria-expanded={matches.length>0} aria-controls="proar-global-search-results" aria-activedescendant={activeSearchIndex>=0?`proar-search-result-${activeSearchIndex}`:undefined} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={onSearchKeyDown} placeholder="Cliente, CNPJ, OS, série, NF..." /></label>
          <div className="proar-search-filters" aria-label="Filtrar resultados por tipo">
            {(["Todos","Cliente","OS","Cadastro"] as const).map(category=><button type="button" key={category} aria-pressed={searchCategory===category} onClick={()=>setSearchCategory(category)}>{category}</button>)}
          </div>
          {query.trim().length<2?
            <div className="proar-search-history"><small>{searchHistory.length?"Buscas recentes":"Digite pelo menos 2 caracteres para pesquisar."}</small>{searchHistory.map(term=><button type="button" key={term} onClick={()=>setQuery(term)}><span aria-hidden="true">↺</span>{term}</button>)}</div>:
            matches.length?
              <div id="proar-global-search-results" className="header-result-list" role="listbox" aria-label="Resultados da busca">
                {matches.map((item,index)=><button id={`proar-search-result-${index}`} role="option" aria-selected={activeSearchIndex===index} key={`${item.module}-${item.id}`} onMouseEnter={()=>setActiveSearchIndex(index)} onClick={()=>selectSearchItem(item)}><b>{highlightGlobalSearch(item.title,query)}</b><span>{highlightGlobalSearch(item.detail||item.module,query)}</span><em>{item.module}</em></button>)}
              </div>:
              <small>Nenhum registro encontrado nos dados carregados.</small>}
        </div>}
      </div>
      <div className="header-pending">
        <button className="header-tool-button" aria-label="Próximas ações" title="Próximas ações" aria-expanded={pendingOpen} onClick={()=>{setPendingOpen(value=>!value);setSearchOpen(false)}}><Bell size={16}/>{pendingItems.length>0&&<i>{Math.min(pendingItems.length,99)}</i>}</button>
        {pendingOpen&&<div className="header-popover pending-popover"><div className="header-popover-title"><b>Próximas ações</b><span>{pendingItems.length}</span></div>{pendingItems.length?<div className="header-result-list">{pendingItems.slice(0,10).map(item=><button key={item.id} className={item.tone} onClick={()=>{onPendingSelect(item);setPendingOpen(false)}}><b>{item.title}</b><span>{item.detail}</span><em>{item.module}</em></button>)}</div>:<small>Nenhuma pendência identificada.</small>}</div>}
      </div>
      <button className={`header-tool-button sync-state ${online?"online":"offline"}`} aria-label={online?"Atualizar dados":"Sem conexão"} title={online?"Atualizar dados do banco":"Sem conexão"} disabled={!online||syncing} onClick={onPull}><RefreshCw size={16} className={syncing?"spin":""}/></button>
      <div className="profile"><div className="profile-avatar">{userName.split(" ").map(word => word[0]).slice(0,2).join("").toUpperCase()}<span /></div><div><strong>{userName}</strong><small>{userRole}</small></div></div>
      <button className="switch-user-btn" aria-label="Trocar utilizador" title="Trocar utilizador" onClick={onSwitchUser}><UserRound size={15}/><span>Trocar</span><LogOut size={14}/></button>
    </div>
  </header>;
}

function Sidebar({ current, setCurrent, open, close, permissions, role, entitledModules }: { current: string; setCurrent: (s: string) => void; open: boolean; close: () => void; permissions?: string[]; role?: string; entitledModules?: string[] }) {
  const [versionOpen,setVersionOpen]=useState(false);
  const [selectedVersion,setSelectedVersion]=useState(CURRENT_PROAR_RELEASE.version);
  const selectedRelease=PROAR_RELEASES.find(item=>item.version===selectedVersion)??CURRENT_PROAR_RELEASE;
  const noteClass=(type:ReleaseNoteType)=>type.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const allowed = (name: string) => canNavigateModule(name,{role,permissions},entitledModules);
  return <>
    {open && <button className="backdrop" aria-label="Fechar menu" onClick={close} />}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark brand-logo"><img src="/brand/proar-system-512.png?v=20261015" alt="Ícone ProAR"/></div><div className="brand-copy"><strong>ProAR</strong><small>GESTÃO DE SERVIÇOS</small><em>BY TAV's</em></div></div>
      <nav aria-label="Módulos do ProAR completo">{navGroups.map(group => { const visibleItems = group.items.filter(item => allowed(item.name)); return visibleItems.length ? <div className="nav-group" key={group.label}>
        <p>{group.label}</p>
        {visibleItems.map(({icon: Icon, name, badge}) => <button key={name} aria-current={current===name?"page":undefined} className={current === name ? "active" : ""} onClick={() => { setCurrent(name); close(); }}>
          <span className="nav-icon"><Icon size={17} strokeWidth={1.9}/></span><span>{name}</span>{badge && <em>{badge}</em>}
        </button>)}
      </div> : null; })}</nav>
      <div className="help-card"><div><Headphones size={17}/></div><strong>Suporte ProAR</strong><p>Conte com a nossa equipe sempre que precisar.</p><button>Falar com especialista <ArrowRight size={12}/></button></div>
      <div className="secure"><ShieldCheck size={13}/><span>Ambiente seguro</span><button type="button" className="version-button" onClick={()=>setVersionOpen(true)} title="Ver novidades desta versão">v{CURRENT_PROAR_RELEASE.version}</button></div>
    </aside>
    {versionOpen&&<div className="version-modal-layer" role="dialog" aria-modal="true" aria-label="Novidades do ProAR"><button className="version-modal-backdrop" aria-label="Fechar histórico de versões" onClick={()=>setVersionOpen(false)}/><section className="version-modal">
      <header><div><span><Sparkles size={14}/> NOVIDADES DO PROAR</span><h2>Versão {selectedRelease.version}</h2><p>{selectedRelease.title} • {selectedRelease.date}</p></div><button type="button" aria-label="Fechar" onClick={()=>setVersionOpen(false)}><X size={18}/></button></header>
      <div className="version-modal-body">
        <aside>{PROAR_RELEASES.map((release,index)=><button type="button" key={release.version} className={selectedRelease.version===release.version?"active":""} onClick={()=>setSelectedVersion(release.version)}><b>v{release.version}</b><small>{release.date}</small>{index===0&&<em>Atual</em>}</button>)}</aside>
        <main>
          <div className="version-summary"><span>v{selectedRelease.version}</span><div><h3>{selectedRelease.title}</h3><p>{selectedRelease.summary}</p></div></div>
          <div className="version-notes">{selectedRelease.notes.map((note,index)=><article key={`${note.type}-${note.title}-${index}`} className={`release-${noteClass(note.type)}`}><span>{note.type==="Correção"?<CheckCircle2 size={16}/>:note.type==="Segurança"?<ShieldCheck size={16}/>:note.type==="Novidade"?<Sparkles size={16}/>:<RefreshCw size={16}/>}</span><div><header><b>{note.title}</b><em>{note.type}</em></header><small>{note.module||"Sistema"}</small><p>{note.description}</p></div></article>)}</div>
        </main>
      </div>
      <footer><span>Histórico de melhorias do ProAR</span><button type="button" className="primary-btn" onClick={()=>setVersionOpen(false)}>Entendi</button></footer>
    </section></div>}
    <nav className="mobile-nav" aria-label="Navegação rápida">{(
      /administrador|ger[eê]ncia/i.test(role || "") ? [
        {name:"Painel inicial",label:"Início",icon:LayoutDashboard},{name:"Agenda",label:"Agenda",icon:CalendarDays},{name:"Ordens de serviço",label:"Ordens",icon:ClipboardList},{name:"Obras",label:"Obras",icon:Building2},{name:"Clientes",label:"Clientes",icon:UsersRound}
      ] : /t[eé]cnico/i.test(role || "") ? [
        {name:"Agenda",label:"Agenda",icon:CalendarDays},{name:"Ordens de serviço",label:"Ordens",icon:ClipboardList},{name:"Equipamentos",label:"Equip.",icon:Boxes},{name:"PMOC e conformidade",label:"PMOC",icon:ShieldCheck},{name:"Painel inicial",label:"Início",icon:MoreHorizontal}
      ] : /finance/i.test(role || "") ? [
        {name:"Painel inicial",label:"Início",icon:LayoutDashboard},{name:"Financeiro",label:"Financeiro",icon:WalletCards},{name:"Fiscal",label:"Fiscal",icon:ReceiptText},{name:"Compras",label:"Compras",icon:ShoppingCart},{name:"Central de pendências",label:"Pendências",icon:MoreHorizontal}
      ] : /vendedor/i.test(role || "") ? [
        {name:"Painel inicial",label:"Início",icon:LayoutDashboard},{name:"Clientes",label:"Clientes",icon:UsersRound},{name:"Orçamentos",label:"Orç.",icon:FileText},{name:"Vendas",label:"Vendas",icon:ShoppingBag},{name:"Central de pendências",label:"Pendências",icon:MoreHorizontal}
      ] : [
        {name:"Painel inicial",label:"Início",icon:LayoutDashboard},{name:"Agenda",label:"Agenda",icon:CalendarDays},{name:"Ordens de serviço",label:"Ordens",icon:ClipboardList},{name:"Clientes",label:"Clientes",icon:UsersRound},{name:"Obras",label:"Obras",icon:Building2}
      ]
    ).filter(item=>allowed(item.name)).slice(0,5).map(({name,label,icon:Icon})=><button key={name} className={current === name ? "active" : ""} onClick={() => setCurrent(name)}><Icon size={18}/><span>{label}</span></button>)}</nav>
  </>;
}

function CustomerDetail({ customerName, customers, structures, serviceOrders, modules, canEdit, onBack, onOpen, onUpdateStructure, onDeleteStructure }: { customerName: string; customers: Customer[]; structures: ModuleRecord[]; serviceOrders: ServiceOrder[]; modules: Record<string, ModuleRecord[]>; canEdit: boolean; onBack: () => void; onOpen: (name: string) => void; onUpdateStructure: (record: ModuleRecord) => void | boolean | Promise<boolean>; onDeleteStructure: (record: ModuleRecord) => void | boolean | Promise<boolean> }) {
  const customer = customers.find(item => item.name === customerName);
  if (!customer) return null;
  return <CustomerProfileWorkspace
    customer={customer}
    structures={structures}
    serviceOrders={serviceOrders}
    modules={modules}
    canEdit={canEdit}
    onBack={onBack}
    onOpen={onOpen}
    onUpdateCustomer={updated => window.dispatchEvent(new CustomEvent("proar:update-customer", { detail: updated }))}
    onUpdateStructure={updated => onUpdateStructure(updated as ModuleRecord)}
    onDeleteStructure={record => onDeleteStructure(record as ModuleRecord)}
  />;
}

function Customers({ onOpen, onDelete, onUpdate, onUpdateStructure, onDeleteStructure, canEdit, customers, structures, serviceOrders, modules }: { onOpen: (name: string) => void; onDelete: (customer: Customer) => void; onUpdate: (customer: Customer) => void; onUpdateStructure: (record: ModuleRecord) => void | boolean | Promise<boolean>; onDeleteStructure: (record: ModuleRecord) => void | boolean | Promise<boolean>; canEdit: boolean; customers: Customer[]; structures: ModuleRecord[]; serviceOrders: ServiceOrder[]; modules: Record<string, ModuleRecord[]> }) {
  const [query, setQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingCustomerInitial, setEditingCustomerInitial] = useState<Customer | null>(null);
  const [customerEditError,setCustomerEditError] = useState("");
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const filtered = useMemo(() => customers.filter(c => `${c.name} ${c.doc} ${c.contact}`.toLowerCase().includes(query.toLowerCase())), [query, customers]);
  const customerDirty=Boolean(editingCustomer&&editingCustomerInitial&&JSON.stringify(editingCustomer)!==JSON.stringify(editingCustomerInitial));
  const openCustomerEditor=(customer:Customer)=>{setCustomerEditError("");setEditingCustomer({...customer});setEditingCustomerInitial({...customer});};
  const closeCustomerEditor=()=>{if(customerDirty&&!window.confirm("Existem alterações não salvas neste cliente. Deseja sair e descartar as alterações?"))return;setEditingCustomer(null);setEditingCustomerInitial(null);};
  useEffect(()=>{const beforeUnload=(event:BeforeUnloadEvent)=>{if(!customerDirty)return;event.preventDefault();event.returnValue=""};window.addEventListener("beforeunload",beforeUnload);return()=>window.removeEventListener("beforeunload",beforeUnload)},[customerDirty]);
  if (selectedCustomer) return <CustomerDetail customerName={selectedCustomer} customers={customers} structures={structures} serviceOrders={serviceOrders} modules={modules} canEdit={canEdit} onUpdateStructure={onUpdateStructure} onDeleteStructure={onDeleteStructure} onBack={() => setSelectedCustomer("")} onOpen={name=>name==="Licitações"?window.dispatchEvent(new CustomEvent("proar:navigate",{detail:name})):onOpen(name)}/>;
  return <section className="module-page">
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar cliente, CPF ou CNPJ..." /></label><button className="outline-btn"><Filter size={14}/> Filtros</button><a className="outline-btn" href="/atendimento">Central de atendimento</a><button type="button" className="primary-btn" data-testid="customer-new-button" aria-haspopup="dialog" onClick={() => onOpen("Novo cliente")}><Plus size={16}/> Novo cliente</button></div>
    <div className="module-summary">
      <article><span><UsersRound size={19}/></span><div><small>CLIENTES ATIVOS</small><strong>{customers.filter(item => item.status === "Ativo").length}</strong><em>Cadastros reais</em></div></article>
      <article><span><Building2 size={19}/></span><div><small>UNIDADES CADASTRADAS</small><strong>{customers.reduce((total, item) => total + item.units, 0)}</strong><em>Vinculadas aos clientes</em></div></article>
      <article><span><HandCoins size={19}/></span><div><small>FATURAMENTO NO MÊS</small><strong>R$ 0,00</strong><em>Sem vendas lançadas</em></div></article>
    </div>
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><UsersRound size={12}/> CARTEIRA</span><h2>Clientes cadastrados</h2><p>{filtered.length} registro(s) encontrado(s) • {canEdit ? "Duplo clique para alterar" : "Somente consulta"}</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>CLIENTE</th><th>CPF / CNPJ</th><th>RESPONSÁVEL</th><th>TELEFONE</th><th>ENDEREÇO</th><th>SITUAÇÃO</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id} className={canEdit ? "clickable-row" : undefined} title={canEdit ? "Duplo clique para alterar o cadastro" : "Duplo clique para abrir a ficha"} onDoubleClick={() => canEdit ? openCustomerEditor(c) : setSelectedCustomer(c.name)}><td><div className="client-cell"><span>{c.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><strong>{c.name}</strong></div></td><td>{c.doc || "—"}</td><td>{c.contact || "—"}</td><td>{c.phone || "—"}</td><td>{c.address || "—"}</td><td><span className="status green"><i/> {c.status}</span></td><td><div className="row-actions"><button className="open-client" onClick={() => setSelectedCustomer(c.name)}>Abrir <ChevronRight size={14}/></button>{canEdit && <button onClick={() => openCustomerEditor(c)} title="Alterar"><Edit3 size={14}/></button>}<button title="Histórico do cliente" onClick={()=>setHistoryCustomer(c)}><History size={14}/></button><button className="delete-action" aria-label={`Excluir ${c.name}`} onClick={() => onDelete(c)}><Trash2 size={14}/></button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="linked-empty"><UsersRound size={22}/><h4>Nenhum cliente cadastrado</h4><p>Use “Novo cliente” para iniciar sua base real.</p></div>}</div>
    {editingCustomer && <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" onClick={closeCustomerEditor} aria-label="Fechar"/><div className="modal catalog-edit-modal"><div className="modal-head"><div><span>ALTERAR CLIENTE</span><h2>{editingCustomer.name}</h2><p>Atualize cadastro, endereço e situação.</p></div><button onClick={closeCustomerEditor}><X size={18}/></button></div><div className="catalog-edit-form"><label>Nome / razão social<input value={editingCustomer.name} onChange={event => setEditingCustomer({...editingCustomer,name:event.target.value})}/></label><label>CPF / CNPJ<input value={editingCustomer.doc} onChange={event => setEditingCustomer({...editingCustomer,doc:event.target.value})}/></label><label>Tipo de organização<select value={editingCustomer.organizationType ?? (editingCustomer.personType==="PF"?"Pessoa Física":"Empresa")} onChange={event=>setEditingCustomer({...editingCustomer,organizationType:event.target.value as Customer["organizationType"]})}><option>Empresa</option><option>Pessoa Física</option><option>Prefeitura</option><option>Órgão Público</option><option>Autarquia</option><option>Fundação</option><option>Entidade Pública</option><option>Outro</option></select></label><label>Respons��vel<input value={editingCustomer.contact} onChange={event => setEditingCustomer({...editingCustomer,contact:event.target.value})}/></label><label>Telefone<input value={editingCustomer.phone} onChange={event => setEditingCustomer({...editingCustomer,phone:event.target.value})}/></label><label className="wide">Endereço completo<input value={editingCustomer.address} onChange={event => setEditingCustomer({...editingCustomer,address:event.target.value})}/></label><label>Situação<select value={editingCustomer.status} onChange={event => setEditingCustomer({...editingCustomer,status:event.target.value})}><option>Ativo</option><option>Inativo</option></select></label><label>Limite de crédito<input type="number" min="0" step="0.01" value={editingCustomer.creditLimit ?? 0} onChange={event => setEditingCustomer({...editingCustomer,creditLimit:Math.max(0,Number(event.target.value)||0)})}/></label><label>Saldo lançado<input type="number" min="0" step="0.01" value={editingCustomer.balancePosted ?? 0} onChange={event => setEditingCustomer({...editingCustomer,balancePosted:Math.max(0,Number(event.target.value)||0)})}/></label><label>Situação financeira<select value={editingCustomer.financialStatus ?? "Liberado"} onChange={event => setEditingCustomer({...editingCustomer,financialStatus:event.target.value as Customer["financialStatus"]})}><option>Liberado</option><option>Alerta</option><option>Somente à vista</option><option>Bloqueado</option></select></label></div>{customerEditError&&<p className="customer-document-error" role="alert">{customerEditError}</p>}<div className="modal-actions">{customerDirty&&<span className="unsaved-indicator"><AlertTriangle size={13}/> Alterações não salvas</span>}<button className="outline-btn" onClick={closeCustomerEditor}>Cancelar</button><button className="primary-btn" onClick={() => {const error=customerDocumentError(editingCustomer.doc);if(error){setCustomerEditError(error);return;}setCustomerEditError("");onUpdate(editingCustomer);setEditingCustomer(null);setEditingCustomerInitial(null);}}><CheckCircle2 size={15}/> Salvar alterações</button></div></div></div>}
    {historyCustomer&&(()=>{const audit=(modules.Auditoria??[]).filter(item=>auditMatches(item as unknown as Record<string,unknown>,"Clientes",historyCustomer.id,historyCustomer.name));return <div className="modal-layer" role="dialog" aria-modal="true"><button className="modal-backdrop" aria-label="Fechar histórico" onClick={()=>setHistoryCustomer(null)}/><div className="modal audit-history-modal"><div className="modal-head"><div><span>HISTÓRICO DO REGISTRO</span><h2>{historyCustomer.name}</h2><p>{historyCustomer.id} • alterações registradas na auditoria</p></div><button onClick={()=>setHistoryCustomer(null)}><X size={18}/></button></div><div className="record-audit-list">{audit.length?audit.map(item=><article key={item.id}><span><History size={14}/></span><div><header><b>{item.name}</b><time>{item.createdAt}</time></header><p>{item.auditDetail||item.description}</p><small>{item.auditUser||item.client||"Sistema"}</small>{item.auditChanges?.length?<div className="record-audit-changes">{item.auditChanges.map((change,index)=><em key={index}><b>{change.field}</b> {change.before} → <strong>{change.after}</strong></em>)}</div>:null}</div></article>):<div className="entity-empty"><History size={20}/><span>Nenhuma alteração auditada para este cliente ainda.</span></div>}</div><div className="modal-actions"><button className="primary-btn" onClick={()=>setHistoryCustomer(null)}>Fechar</button></div></div></div>})()}
  </section>;
}

function serviceOrderReviewDate(order: ServiceOrder) {
  if (!order.lastMaintenanceDate || !order.reviewPeriodMonths) return "";
  const date = new Date(`${order.lastMaintenanceDate}T12:00:00`);
  date.setMonth(date.getMonth() + order.reviewPeriodMonths);
  return date.toISOString().slice(0, 10);
}

async function quickPrintServiceOrder(order: ServiceOrder, company: TenantCompany) {
  try {
    const {buildServiceOrderReceiptPdf}=await import("@/lib/service-order-receipt-pdf");
    const document=serviceOrderDocumentData(order as unknown as Record<string,unknown>,{name:company.tradeName||company.legalName,legalName:company.legalName,document:company.cnpj,phone:company.phone,email:company.email,address:company.address,logo:company.logo});
    buildServiceOrderReceiptPdf(document,document.photos.map(photo=>photo.id)).save(`ordem-servico-${order.id.replace(/[^a-z0-9_-]/gi,"-")}.pdf`);
  } catch { window.alert("Não foi possível gerar o PDF da OS. Tente novamente."); }
}

function ServiceOrders({ onOpen, onSelect, onDelete, onUpdate, serviceOrders: sourceServiceOrders, customers, company, role }: { onOpen: (name: string) => void; onSelect: (order: ServiceOrder) => void; onDelete: (order: ServiceOrder) => void; onUpdate: (order: ServiceOrder) => void; serviceOrders: ServiceOrder[]; customers: Customer[]; company: TenantCompany; role?: string }) {
  const [query, setQuery] = useState("");
  const technicianMode = /t[eé]cnico/i.test(role || "");
  const [visibility, setVisibility] = useState(technicianMode ? "Hoje" : "Em aberto");
  useEffect(() => {
    const handler = (event: Event) => {
      const detail=(event as CustomEvent<{module?:string;recordId?:string}>).detail;
      if(detail?.module!=="Ordens de serviço" || !detail.recordId) return;
      const order=sourceServiceOrders.find(item=>item.id===detail.recordId);
      if(order) onSelect(order);
    };
    window.addEventListener("proar:focus-record",handler);
    return()=>window.removeEventListener("proar:focus-record",handler);
  },[sourceServiceOrders,onSelect]);
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const todayIso = new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const isClosed = (status:string) => /conclu[ií]d|finalizad|cancelad/i.test(status);
  const orderStage = (order: ServiceOrder) => {
    const status = normalizeSearch(order.status);
    if (/cancelad/.test(status)) return "Canceladas";
    if (/conclu[ií]d|finalizad/.test(status)) return "Concluídas";
    if (/andamento|em rota|a caminho|check.?in|atendimento|execu[cç][aã]o|aguardando material|aguardando pe[cç]a/.test(status) || Boolean(order.checkInAt && !order.checkOutAt)) return "Em andamento";
    return "Programadas";
  };
  const stageOrders = {
    scheduled: sourceServiceOrders.filter(order => orderStage(order) === "Programadas"),
    active: sourceServiceOrders.filter(order => orderStage(order) === "Em andamento"),
    completed: sourceServiceOrders.filter(order => orderStage(order) === "Concluídas"),
  };
  const billedCount = stageOrders.completed.filter(order => order.nfseStatus === "Autorizada" || order.nfseStatus === "Emitida" || /faturad/i.test(order.status)).length;
  const activeCheckins = stageOrders.active.filter(order => Boolean(order.checkInAt && !order.checkOutAt)).length;
  const visibleOrders = sourceServiceOrders.filter(order => {
    const customer = customers.find(item => item.name === order.client);
    const matchesSearch = !query.trim() || normalizeSearch([order.id, order.client, order.unit, order.address, order.tech, customer?.legalName, customer?.tradeName, customer?.doc, customer?.phone].filter(Boolean).join(" ")).includes(normalizeSearch(query));
    const stage = orderStage(order);
    const matchesFilter = visibility === "Todas" ? true
      : visibility === "Programadas" ? stage === "Programadas"
      : visibility === "Em andamento" ? stage === "Em andamento"
      : visibility === "Concluídas" || visibility === "Concluídas & faturadas" ? stage === "Concluídas"
      : visibility === "Canceladas" ? stage === "Canceladas"
      : visibility === "Hoje" ? order.date === todayIso && !isClosed(order.status)
      : !isClosed(order.status);
    return matchesSearch && matchesFilter;
  });
  const serviceOrders = visibleOrders;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const reviewAlerts = serviceOrders.filter(order => {
    const reviewDate = serviceOrderReviewDate(order);
    if (!reviewDate) return false;
    const alertDate = new Date(`${reviewDate}T12:00:00`);
    alertDate.setDate(alertDate.getDate() - (order.notifyDaysBefore ?? 15));
    return alertDate <= new Date() && new Date(`${reviewDate}T23:59:59`) >= new Date();
  });
  const pmocDueSoon = sourceServiceOrders.flatMap(order => {
    const candidates: { order: ServiceOrder; equipment: string; date: string; daysLeft: number }[] = [];
    const addDueDate = (equipment: string, date?: string) => {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const daysLeft = Math.ceil((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
      if (daysLeft >= 0 && daysLeft <= 5) candidates.push({ order, equipment, date, daysLeft });
    };
    if (order.pmoc?.hasPmoc) addDueDate("Plano / contrato PMOC", order.pmoc.reviewDate || serviceOrderReviewDate(order));
    for (const execution of order.pmocExecutions || []) addDueDate(execution.equipment || "Equipamento sem identificação", execution.nextMaintenanceDate);
    return candidates;
  }).filter((item, index, all) => all.findIndex(candidate => candidate.order.id === item.order.id && candidate.equipment === item.equipment && candidate.date === item.date) === index)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.date.localeCompare(b.date));
  const sendWhatsApp = (order: ServiceOrder) => {
    const customer = customers.find(item => item.name === order.client);
    const phone = String(customer?.whatsapp || customer?.phone || "").replace(/\D/g, "");
    if (!phone) return window.alert("O cliente desta OS não possui WhatsApp cadastrado.");
    const internationalPhone = phone.startsWith("55") ? phone : "55" + phone;
    const scheduled = order.date ? " prevista para " + new Date(order.date + "T12:00:00").toLocaleDateString("pt-BR") + (order.time ? " às " + order.time : "") : "";
    const message = "Olá " + order.client + ", aqui é da PolarTech. Estou entrando em contato sobre a OS " + order.id + ", do serviço " + order.service + ", na unidade " + (order.unit || "informada") + scheduled + ". Como podemos ajudar?";
    window.open("https://wa.me/" + internationalPhone + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  };
  const sendPmocWhatsApp = (order: ServiceOrder, equipment: string, date: string) => {
    const customer = customers.find(item => item.name === order.client);
    const phone = String(customer?.whatsapp || customer?.phone || "").replace(/\D/g, "");
    if (!phone) return window.alert("O cliente desta OS não possui WhatsApp cadastrado.");
    const internationalPhone = phone.startsWith("55") ? phone : "55" + phone;
    const due = new Date(date + "T12:00:00").toLocaleDateString("pt-BR");
    const message = "Olá " + order.client + ", aqui é da PolarTech. A manutenção preventiva do equipamento " + equipment + ", na unidade " + (order.unit || "informada") + ", está prevista para " + due + ". Podemos combinar o agendamento?";
    window.open("https://wa.me/" + internationalPhone + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
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
      const result = await response.json().catch(()=>({}));
      if (response.status === 202 || result.status === "Processando") {
        onUpdate({ ...order, nfseStatus:"Processando", nfseValue:value });
        window.alert("A NFS-e foi recebida para processamento, mas ainda não está autorizada. Consulte novamente antes de enviar ao cliente.");
        return;
      }
      if (!response.ok || result.issued !== true || result.status !== "Autorizada") throw new Error(result.error || "A emissão não foi autorizada pela Prefeitura/provedor.");
      const provider = result.result?.result || result.result?.data || result.result || {};
      onUpdate({ ...order, nfseStatus:"Autorizada", nfseValue:value, nfseNumber:String(provider.number || provider.numero || provider.nfseNumber || ""), nfseVerificationCode:String(provider.verificationCode || provider.codigoVerificacao || provider.chave || provider.key || ""), nfseIssuedAt:new Date().toISOString() });
      window.alert(`NFS-e autorizada${provider.number || provider.numero ? `: ${provider.number || provider.numero}` : "."}`);
    } catch (error) { onUpdate({ ...order, nfseStatus:"Rejeitada", nfseValue:value }); window.alert(error instanceof Error ? error.message : "Não foi possível autorizar a NFS-e."); }
  };
  const myTodayOrders = visibleOrders.filter(order => order.date === todayIso);
  return <section className={`module-page service-orders ${technicianMode ? "technician-mode" : ""}`}>
    {technicianMode && <section className="technician-command">
      <div><span className="section-kicker"><Wrench size={12}/> MODO TÉCNICO</span><h2>Atendimentos do dia</h2><p>Abra a OS, execute o checklist, registre materiais/fotos e finalize com assinatura.</p></div>
      <div className="technician-command-grid">{myTodayOrders.map(order=><button key={order.id} onClick={()=>onSelect(order)}><span><b>{order.time || "A definir"}</b><small>{order.id}</small></span><div><strong>{order.client}</strong><small>{order.unit} • {order.service}</small></div><em>{order.status}</em><ChevronRight size={16}/></button>)}{!myTodayOrders.length&&<div className="linked-empty"><CheckCircle2 size={22}/><h4>Nenhum atendimento hoje</h4><p>Use a Agenda para consultar os próximos serviços.</p></div>}</div>
    </section>}
    <div className="module-toolbar"><label className="list-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Pesquisar por cliente, OS, CPF/CNPJ, telefone ou unidade..."/></label><label className="status-filter"><Filter size={14}/><select aria-label="Exibir ordens" value={visibility} onChange={event=>setVisibility(event.target.value)}><option>Em aberto</option><option>Programadas</option><option>Em andamento</option><option>Todas</option><option>Concluídas</option><option>Canceladas</option><option>Hoje</option></select></label><ContextReports title="Ordens de Serviço" rows={serviceOrders.map(order=>[order.id,order.client,order.status])} options={["Imprimir Ordem de Serviço","Relatório técnico","Certificado de higienização","Relatório fotográfico","Relatório da assistência técnica","Comprovante de entrega","Histórico completo da OS"]}/><button className="primary-btn" onClick={() => onOpen("Nova ordem de serviço")}><Plus size={16}/> Nova ordem de serviço</button></div>
    <div className="service-order-flow" role="group" aria-label="Fluxo das ordens de serviço">
      <button type="button" aria-pressed={visibility === "Programadas"} onClick={() => setVisibility("Programadas")}><span>1</span><div><strong>Programadas</strong><small>Fila e agenda futura</small></div><b>{stageOrders.scheduled.length}</b></button>
      <button type="button" aria-pressed={visibility === "Em andamento"} onClick={() => setVisibility("Em andamento")}><span>2</span><div><strong>Em andamento</strong><small>{activeCheckins} com check-in registrado</small></div><b>{stageOrders.active.length}</b></button>
      <button type="button" aria-pressed={visibility === "Concluídas"} onClick={() => setVisibility("Concluídas")}><span>3</span><div><strong>Concluídas & faturamento</strong><small>{billedCount} faturadas • {Math.max(0,stageOrders.completed.length-billedCount)} aguardam faturamento</small></div><b>{stageOrders.completed.length}</b></button>
    </div>
    <div className="module-summary">
      <article><span><ClipboardList size={19}/></span><div><small>ORDENS ABERTAS</small><strong>{serviceOrders.filter(item => item.status !== "Concluída").length}</strong><em>{serviceOrders.filter(item => item.date === today).length} para hoje</em></div></article>
      <article><span><UserCheck size={19}/></span><div><small>TÉCNICOS EMPENHADOS</small><strong>{new Set(serviceOrders.map(item => item.tech).filter(Boolean)).size}</strong><em>Cadastros reais</em></div></article>
      <article><span><CheckCircle2 size={19}/></span><div><small>FINALIZADAS</small><strong>{serviceOrders.filter(item => item.status === "Concluída").length}</strong><em>Total registrado</em></div></article>
      <article><span><Bell size={19}/></span><div><small>REVISÕES PRÓXIMAS</small><strong>{reviewAlerts.length}</strong><em>Alertas preventivos</em></div></article>
    </div>
    {pmocDueSoon.length > 0 && <section className="pmoc-due-soon-panel" aria-live="polite"><header><div><span className="section-kicker"><Bell size={12}/> PREVENTIVAS PRÓXIMAS</span><h3>PMOC com vencimento em até 5 dias</h3><p>Equipamentos e planos com data registrada nas OS.</p></div><strong>{pmocDueSoon.length} alerta(s)</strong></header><div className="pmoc-due-soon-list">{pmocDueSoon.map((item,index)=>{const customer=customers.find(entry=>entry.name===item.order.client);return <article className="pmoc-due-item urgent" key={item.order.id + "-" + item.equipment + "-" + item.date + "-" + index}><span className="pmoc-due-indicator" aria-hidden="true"/><div className="pmoc-due-copy"><small>{item.order.client} • {item.order.unit || "Unidade não informada"} • {item.order.id}</small><b>{item.equipment}</b><span>Vence {item.daysLeft === 0 ? "hoje" : "em " + item.daysLeft + " dia(s)"} • {new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}</span></div><div className="pmoc-due-actions"><button type="button" onClick={()=>onSelect(item.order)}>Abrir OS</button>{(customer?.whatsapp || customer?.phone) && <button type="button" className="pmoc-whatsapp-action" onClick={()=>sendPmocWhatsApp(item.order,item.equipment,item.date)}>Preparar WhatsApp</button>}</div></article>})}</div></section>}
    <div className="panel customer-panel"><div className="panel-head"><div><span className="section-kicker"><Wrench size={12}/> OPERAÇÃO TÉCNICA</span><h2>Ordens de serviço</h2><p>Duplo clique para abrir • PDF e WhatsApp disponíveis em um clique.</p></div><button>Exportar <ChevronDown size={13}/></button></div><div className="table-wrap"><table><thead><tr><th>ORDEM</th><th>CLIENTE / LOCAL</th><th>DATA / HORÁRIO</th><th>REVISÃO</th><th>TÉCNICO</th><th>SITUAÇÃO</th><th>AÇÕES RÁPIDAS</th></tr></thead><tbody>{serviceOrders.map(order => { const reviewDate = serviceOrderReviewDate(order); return <tr className="clickable-row" title="Clique duas vezes para abrir a ordem" onDoubleClick={() => onSelect(order)} key={`manage-${order.id}`}><td><b className="order-id">{order.id}</b></td><td><div className="client-cell"><span>{order.avatar}</span><div><strong>{order.client}</strong><small>{order.unit}</small></div></div></td><td>{order.date ? new Date(`${order.date}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data"} • {order.time || "Sem horário"}</td><td>{reviewDate ? <span className="review-date"><Bell size={12}/>{new Date(`${reviewDate}T12:00:00`).toLocaleDateString("pt-BR")}</span> : "—"}</td><td><div className="tech"><span>{order.tech.split(" ").map(name => name[0]).slice(0,2).join("")}</span>{order.tech}</div></td><td><span className={`status ${order.tone}`}><i/> {order.status}</span></td><td><div className="row-actions quick-order-actions"><button title="Abrir OS" onClick={() => onSelect(order)}><Eye size={14}/></button><button title="Imprimir PDF" onClick={() => quickPrintServiceOrder(order, company)}><FileText size={14}/></button><button className="whatsapp-action" title="Enviar por WhatsApp" onClick={() => sendWhatsApp(order)}><MessageCircle size={14}/></button><button title={order.nfseStatus === "Emitida" ? `NFS-e ${order.nfseNumber || "emitida"}` : "Emitir NFS-e de serviço"} onClick={() => void emitNfse(order)}><ReceiptText size={14}/></button><button className="delete-action" aria-label={`Excluir ${order.id}`} onClick={() => onDelete(order)}><Trash2 size={14}/></button></div></td></tr>; })}</tbody></table></div>{!serviceOrders.length && <div className="linked-empty"><ClipboardList size={22}/><h4>Nenhuma ordem cadastrada</h4><p>Crie uma nova ordem para iniciar a operação.</p></div>}</div>
  </section>;
}

function Agenda({ companyId, serviceOrders, onOpen, onSelect, onScheduleUpdate, customers, staff }: { companyId:string; serviceOrders: ServiceOrder[]; onOpen: (name: string,seed?:OrderScheduleSeed) => void; onSelect: (order: ServiceOrder) => void; onScheduleUpdate?: (order:ServiceOrder)=>Promise<unknown>;customers:Customer[];staff:ModuleRecord[] }) {
  return <OperationalAgenda companyId={companyId} orders={serviceOrders} customers={customers as unknown as Record<string,unknown>[]} technicians={staff.filter(item=>!/inativ/i.test(item.status||"Ativo")).map(item=>item.name)} onScheduleUpdate={onScheduleUpdate} onCreate={seed=>onOpen("Nova ordem de serviço",seed)} onSelect={onSelect}/>;
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

function OrderDetail({ order, customerPhone, company, catalog, contracts, close, onUpdate, onSyncEquipmentDiagnostic, onToggleEquipmentLabel, onLinkHistoricalOrder, onAssignEquipmentLabel, canManageLabels, serviceOrders, onDelete, canEdit, customers, employees, structures, equipment, errorCodes, manuals }: { order: ServiceOrder; customerPhone?: string; company: TenantCompany; catalog: ModuleRecord[]; contracts: PublicContractRecord[]; close: () => void; onUpdate: (order: ServiceOrder) => Promise<unknown>; onSyncEquipmentDiagnostic?: (equipmentId:string, entry:Record<string,unknown>)=>Promise<unknown>; onToggleEquipmentLabel?: (equipmentId:string, enabled:boolean)=>Promise<boolean>; onLinkHistoricalOrder?: (equipmentId:string, orderId:string, linked:boolean)=>Promise<boolean>; onAssignEquipmentLabel?: (equipmentId:string, code:string, customerId:string)=>Promise<boolean>; canManageLabels?: boolean; serviceOrders?: ServiceOrder[]; onDelete?: (order: ServiceOrder) => void; canEdit: boolean; customers: Customer[]; employees: ModuleRecord[]; structures: ModuleRecord[]; equipment: ModuleRecord[]; errorCodes: ModuleRecord[]; manuals: ModuleRecord[] }) {
  const [currentOrder, setCurrentOrder] = useState(order);
  const [confirmedBase,setConfirmedBase]=useState(order);
  const [detailTab,setDetailTab]=useState("Ordem");
  const [dirty, setDirty] = useState(false);
  const changeWorkspace=useCallback((change:React.SetStateAction<WorkspaceOrder>)=>{if(!canEdit)return;setCurrentOrder(current=>(typeof change==="function"?change(current as unknown as WorkspaceOrder):change) as ServiceOrder);setDirty(true);},[canEdit]);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [googleCalendarSyncing, setGoogleCalendarSyncing] = useState(false);
  const [itemsTab, setItemsTab] = useState<"Serviços" | "Produtos">("Serviços");
  const [itemSearch, setItemSearch] = useState("");
  const [contractItemId, setContractItemId] = useState("");
  const [contractQuantity, setContractQuantity] = useState("1");
  const statusDraft=currentOrder.status;
  const setStatusDraft=(value:string)=>{setCurrentOrder(current=>({...current,status:value,tone:orderStatusTone(value)}));setDirty(true);};
  const internalUpdate=currentOrder.communicationDraft?.internalNote??"";
  const customerUpdate=currentOrder.communicationDraft?.customerNote??"";
  const statusPhotos=currentOrder.communicationDraft?.photos??[];
  const setInternalUpdate=(value:string)=>{setCurrentOrder(current=>({...current,communicationDraft:{...current.communicationDraft,internalNote:value}}));setDirty(true);};
  const setCustomerUpdate=(value:string)=>{setCurrentOrder(current=>({...current,communicationDraft:{...current.communicationDraft,customerNote:value}}));setDirty(true);};
  const setStatusPhotos=(change:React.SetStateAction<string[]>)=>{setCurrentOrder(current=>({...current,communicationDraft:{...current.communicationDraft,photos:typeof change==="function"?change(current.communicationDraft?.photos??[]):change}}));setDirty(true);};
  const [assistanceOpen, setAssistanceOpen] = useState(Boolean(order.assistance?.requestedAt && !order.assistance?.arrivalAt));
  const assistance=currentOrder.assistance??{};
  const setAssistance=(change:React.SetStateAction<AssistanceEntry>)=>{setCurrentOrder(current=>({...current,assistance:typeof change==="function"?change(current.assistance??{}):change}));setDirty(true);};
  const assistancePhotos=currentOrder.assistance?.entryPhotos??[];
  const setAssistancePhotos=(change:React.SetStateAction<string[]>)=>{setCurrentOrder(current=>({...current,assistance:{...current.assistance,entryPhotos:typeof change==="function"?change(current.assistance?.entryPhotos??[]):change}}));setDirty(true);};
  const pmoc=currentOrder.pmoc??{applicability:"Verificar aplicabilidade",hasPmoc:false,plan:[]};
  const setPmoc=(change:React.SetStateAction<PmocRecord>)=>{setCurrentOrder(current=>({...current,pmoc:typeof change==="function"?change(current.pmoc??{applicability:"Verificar aplicabilidade",hasPmoc:false,plan:[]}):change}));setDirty(true);};
  const pmocExecution=currentOrder.pmocExecutionDraft??{equipment:"",location:currentOrder.unit,services:[],products:[],pending:[]};
  const setPmocExecution=(change:React.SetStateAction<Partial<PmocExecution>>)=>{setCurrentOrder(current=>({...current,pmocExecutionDraft:typeof change==="function"?change(current.pmocExecutionDraft??{equipment:"",location:current.unit,services:[],products:[],pending:[]}):change}));setDirty(true);};
  const pmocBeforePhotos=currentOrder.pmocBeforePhotosDraft??[];
  const setPmocBeforePhotos=(change:React.SetStateAction<string[]>)=>{setCurrentOrder(current=>({...current,pmocBeforePhotosDraft:typeof change==="function"?change(current.pmocBeforePhotosDraft??[]):change}));setDirty(true);};
  const pmocAfterPhotos=currentOrder.pmocAfterPhotosDraft??[];
  const setPmocAfterPhotos=(change:React.SetStateAction<string[]>)=>{setCurrentOrder(current=>({...current,pmocAfterPhotosDraft:typeof change==="function"?change(current.pmocAfterPhotosDraft??[]):change}));setDirty(true);};
  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  const mapsEmbed = `https://www.google.com/maps?q=${encodeURIComponent(order.address)}&output=embed`;
  const update = (patch: Partial<ServiceOrder>) => {
    setCurrentOrder(current=>({...current,...patch}));
    setDirty(true);
  };
  const requestClose = () => {
    if(saving){setSaveNotice("Aguarde a confirmação do salvamento para fechar a OS.");return;}
    if (dirty && !window.confirm("Existem alterações não salvas nesta Ordem de Serviço. Clique em OK para sair sem salvar ou Cancelar para continuar editando.")) return;
    try{localStorage.removeItem(workspaceDraftKey(company.id,currentOrder.id));}catch{}
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
  const syncGoogleCalendar = async (sourceOrder: ServiceOrder = currentOrder) => {
    if(!canEdit){setSaveNotice("Você não possui permissão para sincronizar esta OS.");return sourceOrder;}
    if(!sourceOrder.date){setSaveNotice("Informe a data da OS antes de sincronizar com o Google Agenda.");return sourceOrder;}
    setGoogleCalendarSyncing(true); setSaveNotice("Sincronizando com Google Agenda...");
    try{
      const response=await fetch("/api/integrations/google-calendar/sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({order:sourceOrder})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"Não foi possível sincronizar.");
      const next:ServiceOrder={...sourceOrder,googleCalendarEventId:result.eventId,googleCalendarEventUrl:result.eventUrl,googleCalendarId:result.calendarId,googleCalendarSyncedAt:result.syncedAt,googleCalendarSyncEnabled:true};
      const confirmed=await onUpdate(next) as ServiceOrder;
      setCurrentOrder(confirmed);setConfirmedBase(confirmed);setDirty(false);setSaveNotice("✓ OS sincronizada com o Google Agenda");
      window.setTimeout(()=>setSaveNotice(""),2600);
      return confirmed;
    }catch(error){setSaveNotice(error instanceof Error?error.message:"Não foi possível sincronizar o Google Agenda.");return sourceOrder;}
    finally{setGoogleCalendarSyncing(false);}
  };
  const saveChanges = async (sourceOrder:ServiceOrder=currentOrder) => {
    if (!dirty || saving || !canEdit || /^cancelada$/i.test(confirmedBase.status)) throw new Error("Não há alterações disponíveis para salvar.");
    setSaving(true); setSaveNotice("Salvando...");
    try {
      const savedOrder=prepareOrderWorkspaceSave(confirmedBase as unknown as Record<string,unknown>,sourceOrder as unknown as Record<string,unknown>,{internalNote:internalUpdate,customerNote:customerUpdate,photos:statusPhotos,token:trackingToken(),phoneAvailable:Boolean(whatsappPhone),now:new Date().toISOString()}) as ServiceOrder;
      const confirmedOrder = await onUpdate(savedOrder) as ServiceOrder;
      if(!confirmedOrder||confirmedOrder.id!==sourceOrder.id)throw new Error("Gravação não confirmada para esta OS.");
      setCurrentOrder(confirmedOrder); setConfirmedBase(confirmedOrder); setDirty(false); setSaveNotice("✓ Alterações salvas");
      if(confirmedOrder.googleCalendarSyncEnabled && confirmedOrder.date) await syncGoogleCalendar(confirmedOrder);
      return confirmedOrder;
    } catch (error) { setSaveNotice("Não foi possível salvar esta Ordem de Serviço. Verifique os dados e tente novamente."); throw error; }
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
    const statusChanged = statusDraft !== confirmedBase.status;
    if (!statusChanged && !internalUpdate.trim() && !customerUpdate.trim() && !statusPhotos.length) return;
    const token = trackingToken();
    const event: ServiceOrderTimelineEvent = { id: `evt-${Date.now()}`, createdAt: new Date().toISOString(), previousStatus: confirmedBase.status, status: statusDraft, technician: currentOrder.tech, internalNote: internalUpdate.trim() || undefined, customerNote: customerUpdate.trim() || undefined, photos: statusPhotos.length ? statusPhotos : undefined, customerVisible: Boolean(customerUpdate.trim() || statusPhotos.length), whatsappQueued: Boolean(whatsappPhone && currentOrder.whatsappUpdatesEnabled !== false && (customerUpdate.trim() || statusChanged)) };
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
      <div className="modal-head order-detail-head"><div><span>ORDEM DE SERVIÇO</span><h2>{order.id} • {order.client}</h2><p>{order.unit}</p></div><div className="order-detail-actions">{dirty && <small className="order-dirty-indicator">Alterações não salvas</small>}<button className="outline-btn" onClick={()=>setDetailTab("Relatórios")}><FileText size={15}/> Visualizar relatório</button>{canEdit&&<button className="outline-btn google-calendar-sync-btn" disabled={dirty||googleCalendarSyncing||!currentOrder.date} onClick={()=>void syncGoogleCalendar()}><CalendarDays size={15}/>{googleCalendarSyncing?"Sincronizando...":currentOrder.googleCalendarEventId?"Atualizar Google Agenda":"Enviar ao Google Agenda"}</button>}{currentOrder.googleCalendarEventUrl&&<button className="outline-btn" onClick={()=>window.open(currentOrder.googleCalendarEventUrl,"_blank","noopener,noreferrer")}><ArrowRight size={14}/> Abrir evento</button>}{canEdit && onDelete && <button className="outline-btn danger" type="button" onClick={()=>onDelete(currentOrder)}><Trash2 size={15}/> Excluir OS</button>}<button onClick={requestClose} aria-label="Fechar"><X size={18}/></button></div></div>
      {saveNotice && <div className={`order-save-notice ${saveNotice.startsWith("✓") ? "saved" : saveNotice.startsWith("Não") ? "error" :…108415 tokens truncated…lt = await response.json(); return result.company;
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
    const switchedCompany = company.id !== activeCompany.id;
    setActiveCompany(company);
    localStorage.setItem("proar-v4-active-company", company.id);
    if (switchedCompany) {
      setSavedMessage(`Empresa alterada para ${company.tradeName}. Base de dados isolada carregada.`);
      window.setTimeout(() => setSavedMessage(""), 3000);
    }
  };
  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => { setOnline(false); setDatabaseMode("offline"); };
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline);
    const runId = `BOOT-${new Date().toISOString().replace(/\\D/g,"").slice(0,14)}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
    setBootRunId(runId); setBootError(""); setCheckingSession(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    fetch("/api/auth", { cache: "no-store", signal: controller.signal }).then(async response => response.ok ? response.json() : null).then(result => {
      if (result?.authenticated) handleLogin({ username: result.username, displayName: result.displayName, role: result.role, permissions: result.permissions, companyId: result.companyId, companySlug: result.companySlug, trialExpiresAt: result.trialExpiresAt, entitledModules: result.entitledModules });
    }).catch(error => {
      if (!navigator.onLine) {
        try { const cached = JSON.parse(localStorage.getItem("proar-offline-session") || "null"); if (cached?.user && cached.expiresAt > Date.now()) { setAuthenticatedUser(cached.user); return; } } catch {}
      }
      if (error instanceof DOMException && error.name === "AbortError") setBootError("A verificação da sessão excedeu 12 segundos.");
      else setBootError("Não foi possível validar a sessão do ProAR.");
    }).finally(() => { window.clearTimeout(timeout); setCheckingSession(false); });
    return () => { window.clearTimeout(timeout); controller.abort(); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, [bootAttempt]);
  useEffect(() => {
    if (!authenticatedUser) return;
    const verifyManagerAccess = async () => {
      if (!navigator.onLine) return;
      try {
        const response = await fetch("/api/auth", { cache: "no-store" });
        if (response.status === 403 || response.status === 401) {
          localStorage.removeItem("proar-offline-session");
          setAuthenticatedUser(null);
          setSavedMessage("Sistema bloqueado. Entre em contato com a equipe da ProAR.");
          return;
        }
        if (response.ok) {
          const result=await response.json();
          if (Array.isArray(result.entitledModules)) {
            setAuthenticatedUser(currentUser=>{
              if(!currentUser)return currentUser;
              const next={...currentUser,entitledModules:result.entitledModules as string[]};
              localStorage.setItem("proar-offline-session",JSON.stringify({user:next,expiresAt:Date.now()+12*60*60*1000}));
              return next;
            });
          }
        }
      } catch {}
    };
    const interval = window.setInterval(verifyManagerAccess, 60 * 1000);
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
    const visibleModules = navigationModuleNames().filter(name=>canNavigateModule(name,authenticatedUser,effectiveEntitledModules));
    if (visibleModules.length && !visibleModules.includes(current)) setCurrent(visibleModules[0]);
  }, [authenticatedUser, current, effectiveEntitledModules]);
  useEffect(() => {
    if (!authenticatedUser) return;
    const loadSharedState = async () => {
      try {
        if (activeCompany.status === "Bloqueada") throw new Error("blocked");
        if (!navigator.onLine) throw new Error("offline");
        const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, { cache: "no-store" });
        const sharedResult=await response.json().catch(()=>({}));
        if (!response.ok) {
          const error=new Error(typeof sharedResult.error==="string"?sharedResult.error:"Não foi possível carregar a base compartilhada.");
          (error as Error & {code?:string}).code=typeof sharedResult.code==="string"?sharedResult.code:undefined;
          throw error;
        }
        const { state } = sharedResult;
        if (state) {
          setStateRevision(Number(state._revision || 0));
          setServiceOrders(state.serviceOrders ?? []);
          setCustomerRecords(state.customers ?? []);
          const loadedModules = mergeImportedServices(state.moduleRecords ?? {});
          const blockedFictitious = ["João Carlos", "Caio Henrique", "Thiago Souza", "Lucas Mendes"];
          const realEmployees = (loadedModules.Funcionários ?? []).filter((employee: ModuleRecord) => !blockedFictitious.includes(employee.name));
          const employees = realEmployees;
          const migratedModules = { ...loadedModules, Funcionários: employees };
          setModuleRecords(migratedModules);
          localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(state.serviceOrders ?? []));
          localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(state.customers ?? []));
          localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(migratedModules));
          const syncedAt=new Date().toISOString();
          localStorage.setItem(companyStorageKey(activeCompany.id, "last-successful-sync"), syncedAt);
          setLastSuccessfulSyncAt(syncedAt);
          setDatabaseMode("online");
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
      } catch (error) {
        const errorCode=String((error as Error & {code?:string})?.code||"");
        const localOrders = readCompanyStorage(activeCompany.id, "service-orders", []) as ServiceOrder[];
        const localCustomers = readCompanyStorage(activeCompany.id, "customers", []) as Customer[];
        const localModules = mergeImportedServices(readCompanyStorage(activeCompany.id, "module-records", {}) as Record<string, ModuleRecord[]>);
        const cachedAt = localStorage.getItem(companyStorageKey(activeCompany.id, "last-successful-sync")) || "";
        setServiceOrders(localOrders);
        setCustomerRecords(localCustomers);
        setModuleRecords({ ...localModules, Funcionários: localModules.Funcionários ?? [] });
        setLastSuccessfulSyncAt(cachedAt);
        if (navigator.onLine) {
          setDatabaseMode("degraded");
          setSavedMessage(errorCode==="PROAR-DB-004"
            ? `Limite de uso do banco excedido. Modo contingência ativo${cachedAt ? ` com dados sincronizados em ${new Date(cachedAt).toLocaleString("pt-BR")}` : ""}.`
            : `Modo contingência ativado. Exibindo a última cópia sincronizada${cachedAt ? ` em ${new Date(cachedAt).toLocaleString("pt-BR")}` : ""}. O banco será testado novamente automaticamente.`);
        } else {
          setDatabaseMode("offline");
          setSavedMessage(`Sem internet. Exibindo dados deste aparelho${cachedAt ? ` sincronizados em ${new Date(cachedAt).toLocaleString("pt-BR")}` : ""}.`);
        }
      }
    };
    loadSharedState();
  }, [authenticatedUser, activeCompany.id]);
  const [feedbackTone, setFeedbackTone] = useState<FeedbackTone>("info");
  const showFeedback = (message: string, tone: FeedbackTone = "info", duration = 3200, actions?: FeedbackAction[]) => {
    setFeedbackTone(tone);
    notifyFeedback({ message, tone, duration, actions });
  };
  useEffect(() => {
    if (!savedMessage) return;
    const tone=inferFeedbackTone(savedMessage);
    setFeedbackTone(tone);
    notifyFeedback({ message:savedMessage, tone });
    setSavedMessage("");
  }, [savedMessage]);
  const persistSharedState = async (nextCustomers:Customer[],nextOrders:ServiceOrder[],nextModules:Record<string,ModuleRecord[]>):Promise<boolean>=>{
    if(databaseMode==="degraded"){setSavedMessage("Não foi salvo: banco em contingência. O formulário permanece aberto.");return false;}
    const payload={companyId:activeCompany.id,customers:nextCustomers,serviceOrders:nextOrders,moduleRecords:nextModules,_baseRevision:stateRevision};
    if(!navigator.onLine){
      try{
        const queue=JSON.parse(localStorage.getItem("proar-offline-queue")||"[]");
        localStorage.setItem("proar-offline-queue",JSON.stringify([...queue.filter((item:{companyId:string})=>item.companyId!==activeCompany.id),{companyId:activeCompany.id,payload,createdAt:new Date().toISOString()}]));
      }catch{setSavedMessage("Não foi salvo: sem conexão e não foi possível guardar a tentativa neste aparelho.");return false;}
      setSavedMessage("Rascunho local: aguardando conexão. A gravação no banco ainda não foi confirmada.");return false;
    }
    const applyConfirmed=(state:{customers?:unknown;serviceOrders?:unknown;moduleRecords?:unknown;_revision?:unknown})=>{
      const confirmedCustomers=state.customers as Customer[],confirmedOrders=state.serviceOrders as ServiceOrder[],confirmedModules=mergeImportedServices(state.moduleRecords as Record<string,ModuleRecord[]>);
      setCustomerRecords(confirmedCustomers);setServiceOrders(confirmedOrders);setModuleRecords(confirmedModules);setStateRevision(Number(state._revision||0));
      try{localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(confirmedCustomers));localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(confirmedOrders));localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(confirmedModules));}catch{/* Server confirmation remains valid if the local cache is full. */}
    };
    setSyncPhase("syncing");setSavedMessage("Enviando alterações para confirmação no banco…");
    try{
      const response=await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const body=await response.json().catch(()=>null),outcome=stateSaveOutcome(response.status,body,stateRevision);
      if(!outcome.confirmed){
        if(outcome.conflict&&Array.isArray(body?.state?.customers)&&Array.isArray(body?.state?.serviceOrders)&&body?.state?.moduleRecords)applyConfirmed(body.state);
        setSavedMessage("Não foi salvo: "+outcome.error);setSyncPhase("idle");return false;
      }
      applyConfirmed(outcome.state);setSyncPhase("complete");window.setTimeout(()=>setSyncPhase("idle"),1000);return true;
    }catch(error){setSavedMessage(friendlyErrorMessage(error,{fallback:"Não foi salvo: falha de conexão. Os campos permanecem em edição."}));setSyncPhase("idle");return false;}
  };
  const pullFromDatabase = async () => {
    if (!online) { setSavedMessage("Sem internet. Não foi possível atualizar do banco."); return; }
    setSyncing(true); setSyncPhase("syncing");
    try {
      const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}&refresh=${Date.now()}`, { cache: "no-store" });
      const result = await response.json().catch(()=>({}));
      if (!response.ok || !result.state) {
        const error=new Error(typeof result.error==="string"?result.error:"Não foi possível atualizar os dados.");
        (error as Error & {code?:string}).code=typeof result.code==="string"?result.code:undefined;
        throw error;
      }
      const nextCustomers = result.state.customers ?? []; const nextOrders = result.state.serviceOrders ?? []; const nextModules = mergeImportedServices(result.state.moduleRecords ?? {});
      setStateRevision(Number(result.state._revision||0));
      setCustomerRecords(nextCustomers); setServiceOrders(nextOrders); setModuleRecords(nextModules);
      localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(nextCustomers)); localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(nextOrders)); localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(nextModules));
      const syncedAt=new Date().toISOString();
      localStorage.setItem(companyStorageKey(activeCompany.id,"last-successful-sync"),syncedAt);
      setLastSuccessfulSyncAt(syncedAt);
      setDatabaseMode("online");
      setSyncPhase("complete");
      window.setTimeout(() => setSyncPhase("idle"), 1000);
    } catch (error) {
      setSyncPhase("idle");
      const errorCode=String((error as Error & {code?:string})?.code||"");
      const cachedAt=localStorage.getItem(companyStorageKey(activeCompany.id,"last-successful-sync"))||lastSuccessfulSyncAt;
      setLastSuccessfulSyncAt(cachedAt);
      setDatabaseMode(navigator.onLine?"degraded":"offline");
      setSavedMessage(navigator.onLine
        ? errorCode==="PROAR-DB-004"
          ? `Limite de uso do banco excedido. Modo contingência ativo${cachedAt?` com dados de ${new Date(cachedAt).toLocaleString("pt-BR")}`:""}.`
          : `Banco temporariamente indisponível. Modo contingência ativo${cachedAt?` com dados de ${new Date(cachedAt).toLocaleString("pt-BR")}`:""}.`
        : "Sem internet. Os dados deste aparelho foram mantidos.");
    }
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
    if (!previousOrder) {
      showFeedback(`Falha ao salvar • a ordem ${updatedOrder.id || "selecionada"} não foi localizada na base atual.`, "error", 5000);
      return null;
    }
    if (!updatedOrder.client?.trim()) {
      showFeedback("Falha ao salvar • selecione o cliente da ordem de serviço.", "error", 5000);
      return null;
    }
    if (!updatedOrder.service?.trim()) {
      showFeedback("Falha ao salvar • informe o serviço da ordem de serviço.", "error", 5000);
      return null;
    }
    if (updatedOrder.structureId) {
      const structure = (moduleRecords["Unidades e setores"] ?? []).find(item => item.id === updatedOrder.structureId);
      if (!structure || structure.client !== updatedOrder.client) {
        showFeedback("Falha ao salvar • a unidade/setor/ambiente selecionado não pertence ao cliente desta OS.", "error", 6000);
        return null;
      }
    }
    let orderForPersistence: ServiceOrder = { ...updatedOrder, contractItems: (updatedOrder.contractItems ?? []).map(item => ({ ...item })) };
    const reminderId = `LEM-${updatedOrder.id.replace(/\D/g, "")}`;
    let updatedModules = { ...moduleRecords };
    const currentReminders = updatedModules.Lembretes ?? [];
    if (updatedOrder.status === "Concluída" && updatedOrder.reminderEnabled && updatedOrder.reminderDate) {
      const customer = customerRecords.find(item => item.name === updatedOrder.client);
      const reminder: ModuleRecord = { id: reminderId, name: `Lembrete pós-serviço • ${updatedOrder.service}`, client: updatedOrder.client, description: updatedOrder.reminderMessage || "Está na hora de realizar a higienização preventiva do seu ar-condicionado.", reminderMessage: updatedOrder.reminderMessage || "Está na hora de realizar a higienização preventiva do seu ar-condicionado.", createdAt: new Date().toLocaleString("pt-BR"), status: "Agendado", date: updatedOrder.reminderDate, category: customer?.phone || "", serviceOrderId: updatedOrder.id, whatsappConsent: updatedOrder.whatsappConsent === true, whatsappOptOut: updatedOrder.whatsappOptOut === true };
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
          const movements = [...(contractItem.movements ?? [])];
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
    // O servidor deriva faturamento e consumo de produtos com IDs estáveis,
    // confirmados na mesma transação da OS.
    if (!navigator.onLine) {
      showFeedback("Falha ao salvar a OS • sem conexão com o banco. Nenhuma confirmação foi registrada.", "error", 6000);
      return null;
    }
    updatedModules = appendAudit(updatedModules,"OS atualizada",`Ordens de serviço • ${orderForPersistence.id}`,`Status: ${previousOrder.status} → ${orderForPersistence.status}`,{moduleName:"Ordens de serviço",recordId:orderForPersistence.id,before:previousOrder as unknown as Record<string,unknown>,after:orderForPersistence as unknown as Record<string,unknown>});
    const payload = { companyId: activeCompany.id, customers: customerRecords, serviceOrders: updatedOrders, moduleRecords: updatedModules, _baseRevision: stateRevision };
    let response: Response;
    let result: any;
    try {
      response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      result = await response.json();
    } catch (error) {
      showFeedback(error instanceof Error ? `Falha ao salvar a OS • ${error.message}` : "Falha ao salvar a OS • banco indisponível.", "error", 6000);
      return null;
    }
    if (!response.ok) {
      if (response.status === 409 && result.state) {
        const serverCustomers=result.state.customers??[]; const serverOrders=result.state.serviceOrders??[]; const serverModules=mergeImportedServices(result.state.moduleRecords??{});
        setCustomerRecords(serverCustomers); setServiceOrders(serverOrders); setModuleRecords(serverModules); setStateRevision(Number(result.state._revision||0));
        localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(serverCustomers)); localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(serverOrders)); localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(serverModules));
      }
      showFeedback(response.status === 409 ? "Conflito ao salvar a OS • uma versão mais recente do banco foi preservada. Revise e tente novamente." : `Falha ao salvar a OS • ${result.error || "não foi possível confirmar a gravação no banco."}`, response.status === 409 ? "warning" : "error", 6000);
      return null;
    }
    const confirmedCustomers=result.state?.customers??customerRecords; const confirmedOrders=result.state?.serviceOrders??updatedOrders; const confirmedModules=mergeImportedServices(result.state?.moduleRecords??updatedModules);
    setCustomerRecords(confirmedCustomers); setServiceOrders(confirmedOrders); setModuleRecords(confirmedModules); setSelectedOrder(orderForPersistence); setStateRevision(Number(result.state?._revision||stateRevision+1));
    localStorage.setItem(companyStorageKey(activeCompany.id,"customers"),JSON.stringify(confirmedCustomers)); localStorage.setItem(companyStorageKey(activeCompany.id,"service-orders"),JSON.stringify(confirmedOrders)); localStorage.setItem(companyStorageKey(activeCompany.id,"module-records"),JSON.stringify(confirmedModules));
    // O acompanhamento externo recebe somente o recorte liberado ao cliente;
    // observações internas, financeiro e demais dados operacionais ficam na base autenticada.
    if (orderForPersistence.trackingToken) {
      const timeline = (orderForPersistence.timeline ?? []).filter(event => event.customerVisible).map(event => ({ id:event.id, createdAt:event.createdAt, status:event.status, customerNote:event.customerNote, photos:event.photos, customerVisible:true }));
      try {
        const trackingResponse = await fetch("/api/public-service-order", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ companyId:activeCompany.id, orderId:orderForPersistence.id, token:orderForPersistence.trackingToken, client:orderForPersistence.client, service:orderForPersistence.service, date:orderForPersistence.date, time:orderForPersistence.time, status:orderForPersistence.status, timeline }) });
        if (!trackingResponse.ok) showFeedback(`OS ${orderForPersistence.id} salva, mas o acompanhamento público não foi atualizado. Tente salvar novamente.`, "warning", 6000);
      } catch {
        showFeedback(`OS ${orderForPersistence.id} salva, mas houve falha ao sincronizar o acompanhamento público.`, "warning", 6000);
      }
    }
    showFeedback(orderForPersistence.status === "Concluída" && orderForPersistence.reminderEnabled ? `OS ${orderForPersistence.id} salva com sucesso • conclusão confirmada e lembrete agendado.` : `Alteração salva com sucesso • OS ${orderForPersistence.id} confirmada no banco.`, "success");
    return orderForPersistence;
  };
  const hasAction = (moduleName: string, action: "Visualizar" | "Criar" | "Editar" | "Excluir") => Boolean(authenticatedUser?.permissions?.includes("*") || authenticatedUser?.role === "Administrador" || authenticatedUser?.permissions?.includes(`${moduleName}:${action}`));
  const updateCustomer = (updatedCustomer: Customer) => {
    const documentError=customerDocumentError(updatedCustomer.doc);
    if(documentError){setSavedMessage(`Cliente não atualizado • ${documentError}`);return;}
    const previousCustomer=customerRecords.find(customer=>customer.id===updatedCustomer.id);
    const updatedCustomers = customerRecords.map(customer => customer.id === updatedCustomer.id ? updatedCustomer : customer);
    const updatedModules=appendAudit(moduleRecords,"Cliente atualizado",`Clientes • ${updatedCustomer.name}`,"Cadastro do cliente alterado.",{moduleName:"Clientes",recordId:updatedCustomer.id,before:previousCustomer as unknown as Record<string,unknown> | undefined,after:updatedCustomer as unknown as Record<string,unknown>});
    setCustomerRecords(updatedCustomers);
    setModuleRecords(updatedModules);
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, updatedModules);
    showFeedback(`Alteração salva com sucesso • ${updatedCustomer.name}.`, "success");
  };
  const appendAudit = (modules: Record<string, ModuleRecord[]>, action: string, reference: string, detail: string, meta?: { moduleName?:string; recordId?:string; before?:Record<string,unknown>; after?:Record<string,unknown> }) => ({ ...modules, Auditoria: [{ id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, name: action, client: authenticatedUser?.displayName || "Sistema", description: `${reference} • ${detail}`, createdAt: new Date().toLocaleString("pt-BR"), status: "Registrado", category: "Rastreabilidade", auditModule:meta?.moduleName, recordId:meta?.recordId, auditAction:action, auditDetail:detail, auditUser:authenticatedUser?.displayName || "Sistema", auditChanges:diffAuditRecord(meta?.before,meta?.after) }, ...(modules.Auditoria ?? [])].slice(0, 1000) });
  const convertBudget = (budget: ModuleRecord, target: "Pedido" | "Ordem de serviço") => {
    if (budget.approvalRequired && budget.approvalStatus !== "Aprovado") { setSavedMessage("Este orçamento depende de aprovação por alçada antes da conversão."); window.setTimeout(()=>setSavedMessage(""),3500); return; }
    if (target === "Pedido") {
      const sale: ModuleRecord = { ...budget, id:`VEN-${Date.now().toString().slice(-6)}`, name:`Pedido • ${budget.name}`, status:"Pedido confirmado", createdAt:new Date().toLocaleString("pt-BR") };
      const updated = { ...moduleRecords, Vendas:[sale,...(moduleRecords.Vendas ?? [])], Orçamentos:(moduleRecords.Orçamentos ?? []).map(item => item.id === budget.id ? {...item,status:"Convertido em pedido"} : item) };
      setModuleRecords(updated); persistSharedState(customerRecords, serviceOrders, updated); setCurrent("Vendas");
    } else {
      const customer = customerRecords.find(item => item.name === budget.client);
      const budgetStructure = budget.structureId ? (moduleRecords["Unidades e setores"] ?? []).find(item => item.id === budget.structureId && item.client === budget.client) : undefined;
      const order: ServiceOrder = { id:`#OS-${String(Math.max(15499,...serviceOrders.map(item => Number(item.id.replace(/\D/g,""))||0))+1).padStart(5,"0")}`, client:budget.client, customerId:budget.customerId || customer?.id, unit:budget.unitId ? budget.unit || "Matriz" : budgetStructure?.name || budget.unit || "Matriz", structureId:budget.structureId || budgetStructure?.id, unitId:budget.unitId || budgetStructure?.id, sector:budget.sector, sectorId:budget.sectorId, room:budget.room, roomId:budget.roomId, sourceBudgetId:budget.id, service:budget.purchaseItems?.map(item => item.description).join(", ") || budget.name, tech:"Não definido", date:new Date().toISOString().slice(0,10), time:"A definir", address:budgetStructure?.address || customer?.address || "", status:"Aberta", tone:"blue", avatar:budget.client.split(" ").map(item => item[0]).slice(0,2).join(""), catalogItems:budget.purchaseItems?.filter(item => item.kind !== "Custo adicional").map(item => ({ id:item.productId || item.id, name:item.description, kind:item.kind === "Produto" ? "Produto" : "Serviço" })) };
      const updatedOrders = [order,...serviceOrders]; const updatedModules = { ...moduleRecords, Orçamentos:(moduleRecords.Orçamentos ?? []).map(item => item.id === budget.id ? {...item,status:"Convertido em OS"} : item) };
      setServiceOrders(updatedOrders); setModuleRecords(updatedModules); persistSharedState(customerRecords,updatedOrders,updatedModules); setCurrent("Ordens de serviço");
    }
    setSavedMessage(`Orçamento convertido em ${target}.`); window.setTimeout(() => setSavedMessage(""),2500);
  };
  const recordSaveLock=useRef(false);
  const saveRecord = async (data: ModalSave) => {
    if(recordSaveLock.current)return;
    recordSaveLock.current=true;
    try{
    if (data.title.startsWith("Nova unidade, filial ou setor") || data.title.startsWith("Novo setor") || data.title.startsWith("Nova sala") || data.title.startsWith("Nova sala ou ambiente")) {
      const parentCustomer = data.title.split("•")[1]?.trim() || data.client;
      const structure: ModuleRecord = { id:`SET-${Date.now().toString().slice(-6)}`, name:data.name, client:parentCustomer, description:data.description || data.doc, doc:data.doc, contact:data.contact, phone:data.phone, address:data.address, category:data.category || "Setor", parentId:data.parentId || undefined, parentUnit:data.parentUnit || undefined, hierarchyLevel:data.hierarchyLevel || undefined, environmentType:data.environmentType, roomNumber:data.roomNumber, floor:data.floor, block:data.block, localResponsible:data.localResponsible, extension:data.extension, criticality:data.criticality, priorityAttendance:data.priorityAttendance, status:"Ativo", createdAt:new Date().toLocaleString("pt-BR"), legalName:data.legalName, tradeName:data.tradeName, email:data.email, zipCode:data.zipCode, street:data.street, addressNumber:data.addressNumber, complement:data.complement, neighborhood:data.neighborhood, city:data.city, state:data.state, stateRegistration:data.stateRegistration, municipalRegistration:data.municipalRegistration, cnaeMain:data.cnaeMain, taxStatus:data.taxStatus };
      if (!parentCustomer || !customerRecords.some(customer => customer.name === parentCustomer)) {
        setSavedMessage("Não foi possível salvar: cliente principal não identificado.");
        return;
      }
      const updatedModules = { ...moduleRecords, "Unidades e setores":[structure,...(moduleRecords["Unidades e setores"] ?? [])] };
      const updatedCustomers = customerRecords.map(customer => customer.name === parentCustomer ? {...customer,units:(Number(customer.units) || 0)+1} : customer);
      try {
        if(!await persistSharedState(updatedCustomers,serviceOrders,updatedModules))return;
        setSavedMessage(`${data.category || "Setor"} vinculado a ${parentCustomer} com sucesso.`);
        window.setTimeout(() => setSavedMessage(""), 3000);
      } catch (error) {
        setSavedMessage(error instanceof Error ? `Falha ao salvar setor: ${error.message}` : "Falha ao salvar setor. Os dados anteriores foram preservados.");
        return;
      }
    } else if (data.title === "Novo cliente") {
      const documentError = customerDocumentError(data.doc);
      if (documentError) {
        setSavedMessage(`Cliente não salvo • ${documentError}`);
        return;
      }
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
      const updatedModules=appendAudit(moduleRecords,"Cliente criado",`Clientes • ${newCustomer.name}`,"Novo cadastro de cliente.",{moduleName:"Clientes",recordId:newCustomer.id,after:newCustomer as unknown as Record<string,unknown>});
      if(!await persistSharedState(updatedCustomers, serviceOrders, updatedModules))return;
      setCurrent("Clientes");
      showFeedback(`Cliente ${newCustomer.name} cadastrado com sucesso!`, "success", 6000, [{label:"Abrir nova O.S.",onClick:()=>{setCurrent("Ordens de serviço");setModal("Nova ordem de serviço");}}]);
    } else if (data.title === "Nova ordem de serviço") {
      const sequence = Math.max(15499, ...serviceOrders.map(order => Number(order.id.replace(/\D/g, "")) || 0)) + 1;
      const newOrder: ServiceOrder = {
        id: `#OS-${String(sequence).padStart(5, "0")}`,
        client: data.client,
        customerId: data.customerId || customerRecords.find(customer => customer.name === data.client)?.id,
        unit: data.unit || "Unidade principal",
        unitId: data.unitId,
        sectorId: data.sectorId,
        roomId: data.roomId,
        service: data.catalogItems.length ? data.catalogItems.map(item => item.name).join(", ") : data.description || "Atendimento técnico",
        tech: data.tech,
        date: data.date,
        time: data.time || "A definir",
        address: data.address,
        status: data.status === "Rascunho" ? "Rascunho" : "Agendada",
        tone: data.status === "Rascunho" ? "slate" : "violet",
        avatar: data.client.split(" ").map(word => word[0]).slice(0, 2).join("").toUpperCase(),
        catalogItems: data.catalogItems,
        equipmentIds: data.equipmentIds,
        total: data.value,
        servicesTotal: data.servicesTotal,
        productsTotal: data.productsTotal,
        discount: data.discount,
        request: data.description,
        priority: data.priority,
        serviceType: data.serviceType,
        checklist: data.checklist,
        tag: data.tag,
        externalCode: data.externalCode,
        checkInRequirement: data.checkInRequirement,
        estimatedDurationMinutes: data.estimatedDurationMinutes,
        pmocRepeatEnabled: data.pmocRepeatEnabled,
        npsEnabled: data.npsEnabled,
        whatsappPhone: data.phone,
        whatsappUpdatesEnabled: data.whatsappUpdatesEnabled,
        whatsappAppointmentReminderEnabled: data.whatsappAppointmentReminderEnabled,
        whatsappStatusUpdatesEnabled: data.whatsappStatusUpdatesEnabled,
        appointmentReminderHours: data.appointmentReminderHours,
        lastMaintenanceDate: data.date,
        sector: data.sector || undefined,
        room: data.room || undefined,
        structureId: data.structureId,
        reviewPeriodMonths: 6,
        notifyDaysBefore: 15,
      };
      const updatedOrders = [newOrder, ...serviceOrders];
      const updatedModules=appendAudit(moduleRecords,"OS criada",`Ordens de serviço • ${newOrder.id}`,"Nova ordem de serviço cadastrada.",{moduleName:"Ordens de serviço",recordId:newOrder.id,after:newOrder as unknown as Record<string,unknown>});
      if(!await persistSharedState(customerRecords, updatedOrders, updatedModules))return;
      setCurrent("Ordens de serviço");
      showFeedback(`O.S. ${newOrder.id} aberta com sucesso!`, "success", 6000, [{label:"Imprimir Ordem",onClick:()=>{void quickPrintServiceOrder(newOrder,activeCompany);}}]);
    } else {
      const requestedModule = data.title.includes("•") ? data.title.split("•").pop()!.trim() : data.title.replace(/^Novo(a)?\s+/i, "");
      const moduleName = requestedModule === "Serviços" || requestedModule === "Produtos" ? `${data.kind}s` : requestedModule;
      const record: ModuleRecord = {
        id: `${moduleName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        name: data.name || moduleName,
        client: data.client,
        customerId: data.customerId || customerRecords.find(customer=>customer.name===data.client)?.id,
        unitId:data.unitId,sectorId:data.sectorId,roomId:data.roomId,structureId:data.structureId,unit:data.unit,sector:data.sector,room:data.room,
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
        catalogImage: (moduleName==="Produtos"||moduleName==="Serviços") ? data.catalogImage || undefined : undefined,
        catalogImageName: (moduleName==="Produtos"||moduleName==="Serviços") ? data.catalogImageName || undefined : undefined,
        catalogImageUpdatedAt: (moduleName==="Produtos"||moduleName==="Serviços") ? data.catalogImageUpdatedAt || undefined : undefined, ncm:data.kind==="Produto"?data.ncm||undefined:undefined, cest:data.kind==="Produto"?data.cest||undefined:undefined, cfop:data.kind==="Produto"?data.cfop||undefined:undefined, cst:data.kind==="Produto"?data.cst||undefined:undefined, csosn:data.kind==="Produto"?data.csosn||undefined:undefined, taxOrigin:data.kind==="Produto"?data.taxOrigin||undefined:undefined, serviceCode:data.kind==="Serviço"?data.serviceCode||undefined:undefined, issRate:data.kind==="Serviço"?data.issRate||undefined:undefined,
        transactionType: moduleName === "Financeiro" ? (/pagar|despesa|fornecedor/i.test(`${data.name} ${data.category}`) ? "Pagar" : "Receber") : undefined,
        employeeRole: moduleName === "Funcionários" ? data.employeeRole : undefined,
        employeePermissions: moduleName === "Funcionários" ? data.employeePermissions : undefined,
        employeeUsername: moduleName === "Funcionários" ? data.employeeUsername?.trim().toLocaleLowerCase("pt-BR") : undefined,
        employeeSignature:moduleName === "Funcionários" ? data.employeeSignature : undefined,
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
            transactionType: "Pagar",
            purchaseId: record.id,
            installmentNumber: index + 1,
            installments: installmentCount,
          };
        });
        updatedRecords = { ...updatedRecords, Financeiro: [...payables, ...(moduleRecords.Financeiro ?? [])] };
      }
      if(!await persistSharedState(customerRecords, serviceOrders, updatedRecords))return;
      setCurrent(moduleName);
      setSavedMessage(moduleName === "Compras" && data.paymentType === "A prazo" ? `Compra gravada e ${Math.max(1, data.paymentInstallments.length || data.installments)} parcela(s) lançada(s) em Contas a Pagar.` : "Registro gravado com sucesso.");
    }
    setModal("");setOrderSeed(undefined);
    window.setTimeout(() => setSavedMessage(""), 3500);
    }finally{recordSaveLock.current=false;}
  };
  useEffect(() => {
    const handleProfileCustomerUpdate = (event: Event) => {
      const detail = (event as CustomEvent<Customer>).detail;
      if (!detail?.id) return;
      const documentError=customerDocumentError(detail.doc);
      if(documentError){setSavedMessage(`Cliente não atualizado • ${documentError}`);return;}
      const updated = customerRecords.map(item => item.id === detail.id ? { ...item, ...detail } : item);
      setCustomerRecords(updated);
      localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updated));
      persistSharedState(updated, serviceOrders, moduleRecords);
      showFeedback("Cadastro e locais atualizados com sucesso.", "change");
    };
    window.addEventListener("proar:update-customer", handleProfileCustomerUpdate);
    return () => window.removeEventListener("proar:update-customer", handleProfileCustomerUpdate);
  }, [activeCompany.id, customerRecords, serviceOrders, moduleRecords]);
  const titles: Record<string,string> = { "Painel inicial": "Olá", "Atividades": "Central de atividades", "Clientes": "Gestão de clientes", "Obras": "Gestão de obras", "Fiscal": "Central Fiscal", "Integridade do Sistema": "Integridade do Sistema" };
  const subtitles: Record<string,string> = { "Painel inicial": "Uma visão completa da sua empresa em tempo real.", "Atividades": "Histórico operacional de ações, alterações e usuários.", "Clientes": "Cadastros, unidades, histórico e relacionamento.", "Obras": "Planejamento, execução, perdas, custos e progresso em um único módulo.", "Fiscal": "NF-e, NFC-e, NFS-e, DF-e, validação e acompanhamento fiscal.", "Integridade do Sistema": "Diagnóstico empresarial somente leitura da base operacional." };
  const logout = async () => {
    try { await fetch("/api/auth", { method: "DELETE" }); } catch {}
    localStorage.removeItem("proar-offline-session");
    setAuthenticatedUser(null);
  };
  const deleteCustomer = (customer: Customer) => {
    const reason = window.prompt("Motivo da inativação do cliente:"); if (!reason?.trim()) return;
    if (!window.confirm(`Inativar o cliente “${customer.name}”? O cadastro, seus vínculos e histórico serão preservados.`)) return;
    const updatedCustomers = customerRecords.map(item => item.id === customer.id ? { ...item, status: "Inativo", changeReason: reason.trim() } : item);
    setCustomerRecords(updatedCustomers);
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
    setSavedMessage("Cliente inativado com sucesso. O histórico foi preservado.");
  };
  const deleteOrder = (order: ServiceOrder) => {
    const reason = window.prompt("Motivo do cancelamento da OS:"); if (!reason?.trim()) return;
    if (!window.confirm(`Cancelar a ordem ${order.id}? A ordem continuará disponível no histórico.`)) return;
    const updatedOrders = serviceOrders.map(item => item.id === order.id ? { ...item, status: "Cancelada", tone: "red", changeReason: reason.trim() } : item);
    setServiceOrders(updatedOrders);
    localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(updatedOrders));
    persistSharedState(customerRecords, updatedOrders, moduleRecords);
    setSelectedOrder(null);
    setSavedMessage(`Ordem ${order.id} cancelada. O histórico foi preservado.`);
  };
  const deleteModuleRecord = (moduleName: string, record: ModuleRecord) => {
    const reason = window.prompt("Informe o motivo do cancelamento ou inativação:");
    if (!reason?.trim()) return;
    record = { ...record, changeReason: reason.trim() };
    const cancellation = /Vendas|Orçamentos|Compras|Financeiro/.test(moduleName);
    if (!window.confirm(`${cancellation ? "Cancelar" : "Inativar"} o registro “${record.name}”? O histórico será mantido.`)) return;
    const updatedModules = { ...moduleRecords, [moduleName]: (moduleRecords[moduleName] ?? []).map(item => item.id === record.id ? { ...item, changeReason: reason.trim(), status: cancellation ? "Cancelado" : "Inativo" } : item) };
    setModuleRecords(updatedModules);
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    setSavedMessage(`${cancellation ? "Registro cancelado" : "Registro inativado"} com histórico preservado.`);
    window.setTimeout(() => setSavedMessage(""), 3000);
  };
  const updateModuleRecord = (moduleName: string, record: ModuleRecord) => {
    const oldRecord = (moduleRecords[moduleName] ?? []).find(item => item.id === record.id);
    if (moduleName === "Produtos" && oldRecord && Number(record.stockCurrent || 0) !== Number(oldRecord.stockCurrent || 0)) {
      const reason = window.prompt("Motivo do ajuste de estoque:"); if (!reason?.trim()) return;
      record = { ...record, stockAdjustmentReason: reason.trim() };
    }
    if (oldRecord && !/cancelad|inativ/i.test(oldRecord.status || "") && /cancelad|inativ/i.test(record.status || "")) {
      const reason = window.prompt("Motivo do cancelamento ou inativação:"); if (!reason?.trim()) return;
      record = { ...record, changeReason: reason.trim() };
    }
    const currentRecords = moduleRecords[moduleName] ?? [];
    const exists = currentRecords.some(item => item.id === record.id);
    let updatedModules = { ...moduleRecords, [moduleName]: exists ? currentRecords.map(item => item.id === record.id ? record : item) : [record, ...currentRecords] };
    if (moduleName === "Compras" && record.status === "Recebida") {
      const payableId = `FIN-${record.id}`;
      const hasPayable = (updatedModules["Financeiro"] ?? []).some(item => item.id === payableId || item.purchaseId === record.id);
      // Compras a prazo já geram parcelas FIN-<compra>-NN no cadastro. Não criar
      // um segundo título integral quando o recebimento da mercadoria for confirmado.
      const hasInstallmentPayables = (updatedModules["Financeiro"] ?? []).some(item => item.purchaseId === record.id && Boolean(item.installmentNumber));
      if (!hasPayable && !hasInstallmentPayables) updatedModules = { ...updatedModules, "Financeiro": [{ ...record, id: payableId, name: `Conta a pagar • ${record.name}`, status: "Em aberto", category: record.category || "Compra de produtos", transactionType:"Pagar", purchaseId: record.id, createdAt: new Date().toLocaleString("pt-BR") }, ...(updatedModules["Financeiro"] ?? [])] };
      // Recebimentos por item são registrados pelo servidor no livro de estoque.
    }
    updatedModules = appendAudit(updatedModules, exists ? "Registro atualizado" : "Registro criado", `${moduleName} • ${record.name}`, exists ? "Alteração registrada pelo utilizador" : "Novo cadastro registrado pelo utilizador", { moduleName, recordId:record.id, before:oldRecord as unknown as Record<string,unknown> | undefined, after:record as unknown as Record<string,unknown> });
    setModuleRecords(updatedModules);
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    persistSharedState(customerRecords, serviceOrders, updatedModules);
    showFeedback(moduleName === "Compras" && record.status === "Recebida" ? "Compra recebida com sucesso • estoque e conta a pagar atualizados." : exists ? "Alteração salva com sucesso." : "Cadastro salvo com sucesso.", "success");
  };
  const createQuickCustomer = (draft: CustomerDraft): Customer | null => {
    const documentError = customerDocumentError(draft.doc);
    if (documentError) { showFeedback(documentError, "error"); return null; }
    const existing = customerRecords.find(item => normalizeRelation(item.doc) === normalizeRelation(draft.doc) && draft.doc.replace(/\D/g, "").length >= 11);
    if (existing) return existing;
    const created: Customer = {
      id: `CLI-${Date.now().toString().slice(-7)}`,
      name: draft.name,
      legalName: draft.legalName || draft.name,
      tradeName: draft.tradeName || draft.name,
      doc: formatCnpj(draft.doc),
      contact: "",
      phone: draft.phone,
      email: draft.email,
      city: draft.city,
      state: draft.state,
      address: "",
      units: 0,
      status: "Ativo",
      personType: "PJ",
      organizationType: "Empresa",
      financialStatus: "Liberado",
    };
    const updatedCustomers = [created, ...customerRecords];
    setCustomerRecords(updatedCustomers);
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, moduleRecords);
    showFeedback(`Cliente ${created.name} cadastrado com sucesso.`, "success");
    return created;
  };
  const createQuickStructure = (draft: StructureDraft & { client: string }): ModuleRecord | null => {
    const created: ModuleRecord = {
      id: `SET-${Date.now().toString().slice(-7)}`,
      name: draft.name,
      client: draft.client,
      customerId: customerRecords.find(item => item.name === draft.client)?.id,
      description: draft.description,
      category: draft.kind,
      hierarchyLevel: draft.kind === "Ambiente" ? "Sala" : draft.kind,
      parentId: draft.parentId || undefined,
      environmentType: draft.kind === "Ambiente" ? draft.environmentType : undefined,
      roomNumber: draft.roomNumber || undefined,
      status: "Ativo",
      createdAt: new Date().toLocaleString("pt-BR"),
    };
    const owner=customerRecords.find(item=>item.id===created.customerId);
    if(!owner)return null;
    try { prepareCustomerStructureSave(owner,created,moduleRecords["Unidades e setores"]??[]); }
    catch(error) { showFeedback(error instanceof Error?error.message:"Vínculo inválido.","error");return null; }
    const updatedModules = { ...moduleRecords, "Unidades e setores": [created, ...(moduleRecords["Unidades e setores"] ?? [])] };
    const updatedCustomers = customerRecords.map(item => item.name === draft.client ? { ...item, units: draft.kind === "Unidade" ? item.units + 1 : item.units } : item);
    setModuleRecords(updatedModules);
    setCustomerRecords(updatedCustomers);
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(updatedModules));
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(updatedCustomers));
    persistSharedState(updatedCustomers, serviceOrders, updatedModules);
    showFeedback(`${created.category || "Estrutura"} cadastrada com sucesso.`, "success");
    return created;
  };
  const saveConfirmedModuleRecord = async (moduleName: string, record: ModuleRecord, relatedRecords: { moduleName: string; record: ModuleRecord }[] = []) => {
    if (!navigator.onLine) {
      showFeedback("Falha ao salvar • sem conexão com o banco.", "error", 5000);
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
      { moduleName, recordId:record.id, before:(currentRecords.find(item=>item.id===record.id) as unknown as Record<string,unknown> | undefined), after:record as unknown as Record<string,unknown> },
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
        showFeedback("Falha ao salvar • este registro foi alterado por outro usuário. Atualize os dados e tente novamente.", "warning", 5000);
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
      showFeedback(exists ? `${moduleName}: alterações salvas com sucesso.` : `${moduleName}: cadastro salvo com sucesso.`, "success");
      return true;
    } catch (error) {
      console.error("Falha ao salvar registro confirmado", { moduleName, recordId: record.id, relatedModules:relatedRecords.map(item=>item.moduleName), error });
      showFeedback("Falha ao salvar • verifique sua conexão e tente novamente.", "error", 5000);
      setSyncPhase("idle");
      return false;
    }
  };

  const createOrderCustomer=async(draft:CustomerDraft & {address:string;organizationType:Customer["organizationType"]}):Promise<Customer|null>=>{
    if(!hasAction("Clientes","Criar"))throw new Error("Seu perfil não permite cadastrar clientes.");
    if(!navigator.onLine)throw new Error("Sem conexão. Os campos foram mantidos; conecte-se para salvar o cliente.");
    const name=draft.name.trim(),digits=draft.doc.replace(/\D/g,"");
    if(!name)throw new Error("Informe o nome ou razão social do cliente.");
    const documentError=customerDocumentError(draft.doc);
    if(documentError)throw new Error(documentError);
    if(draft.email.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))throw new Error("Confira o e-mail informado.");
    const byDocument=digits?customerRecords.filter(item=>item.doc.replace(/\D/g,"")===digits):[];
    if(byDocument.length>1)throw new Error("Há mais de um cliente com este documento. Regularize o cadastro antes de continuar.");
    if(byDocument.length===1){if(byDocument[0].status==="Inativo")throw new Error("Este documento pertence a um cliente inativo. Revise o cadastro.");return byDocument[0];}
    if(customerRecords.some(item=>normalizeRelation(item.name)===normalizeRelation(name)))throw new Error("Já existe um cliente com este nome. Selecione-o na pesquisa ou diferencie o nome.");
    const created:Customer={id:"CLI-"+crypto.randomUUID(),name,legalName:draft.legalName.trim()||name,tradeName:draft.tradeName.trim()||name,doc:digits,contact:"",phone:draft.phone.trim(),email:draft.email.trim(),city:draft.city.trim(),state:draft.state.trim().toUpperCase(),address:draft.address.trim(),units:0,status:"Ativo",personType:digits.length===11||draft.organizationType==="Pessoa Física"?"PF":"PJ",organizationType:draft.organizationType||"Empresa",financialStatus:"Liberado"};
    if(!await persistSharedState([created,...customerRecords],serviceOrders,moduleRecords))throw new Error("Cliente não salvo. Revise a conexão e tente novamente; o formulário foi preservado.");
    return created;
  };
  const createOrderStructure=async(draft:StructureDraft & {client:string}):Promise<ModuleRecord|null>=>{
    const owner=customerRecords.find(item=>item.name===draft.client);
    if(!owner)return null;
    const created:ModuleRecord={id:"SET-"+crypto.randomUUID(),name:draft.name.trim(),client:owner.name,customerId:owner.id,category:draft.kind,hierarchyLevel:draft.kind,parentId:draft.parentId||undefined,description:draft.description,status:"Ativo",createdAt:new Date().toISOString()};
    try{prepareCustomerStructureSave(owner,created,moduleRecords["Unidades e setores"]||[]);}
    catch(error){throw new Error(error instanceof Error?error.message:"Vínculo inválido.");}
    return await saveConfirmedModuleRecord("Unidades e setores",created)?created:null;
  };
  const saveCustomerStructure = async (record: ModuleRecord, inactivateOnly = false) => {
    if (!navigator.onLine) {
      showFeedback("Falha ao salvar estrutura • sem conexão com o banco.", "error", 5000);
      return false;
    }
    const customer = record.customerId ? customerRecords.find(item=>item.id===record.customerId) : customerRecords.find(item => item.name === record.client);
    if (!customer) {
      showFeedback("Falha ao salvar estrutura • cliente principal não encontrado.", "error", 5000);
      return false;
    }
    let prepared;
    try {
      prepared = inactivateOnly
        ? prepareCustomerStructureInactivation(customer,record.id,moduleRecords["Unidades e setores"] ?? [],customerRecords,String(record.changeReason || "Inativação solicitada no cadastro"))
        : prepareCustomerStructureSave(customer, record, moduleRecords["Unidades e setores"] ?? [], customerRecords);
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : "Vínculo estrutural inválido.", "error", 5000);
      return false;
    }
    const updatedCustomers = customerRecords.map(item => item.id === customer.id ? { ...item, units: prepared.unitCount } : item);
    const updatedModules = appendAudit(
      { ...moduleRecords, "Unidades e setores": prepared.nextStructures as ModuleRecord[] },
      (moduleRecords["Unidades e setores"] ?? []).some(item => item.id === record.id) ? "Estrutura atualizada" : "Estrutura criada",
      `Clientes • ${customer.name} • ${prepared.record.name}`,
      "Vínculo hierárquico confirmado por ID",
    );
    setSyncPhase("syncing");
    try {
      const response = await fetch(`/api/state?company=${encodeURIComponent(activeCompany.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: activeCompany.id,
          customers: updatedCustomers,
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
        showFeedback("Conflito ao salvar estrutura • os dados mais recentes do servidor foram preservados.", "warning", 6000);
        setSyncPhase("idle");
        return false;
      }
      if (!response.ok || !result.state) throw new Error(result.error || "Falha ao confirmar o vínculo.");
      const confirmedCustomers = result.state.customers ?? updatedCustomers;
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
      showFeedback(`${prepared.record.hierarchyLevel || prepared.record.category || "Estrutura"} vinculada a ${customer.name} com sucesso.`, "success");
      return true;
    } catch (error) {
      console.error("Falha ao salvar estrutura do cliente", { customerId: customer.id, recordId: record.id, error });
      showFeedback(error instanceof Error ? error.message : "Falha ao salvar estrutura • nenhuma confirmação foi registrada.", "error", 6000);
      setSyncPhase("idle");
      return false;
    }
  };
  const deleteCustomerStructure = async (record: ModuleRecord) => {
    if (!hasAction("Clientes", "Editar")) return false;
    const customer = record.customerId ? customerRecords.find(item=>item.id===record.customerId) : customerRecords.find(item=>item.name===record.client);
    if (!customer) { showFeedback("Cliente desta estrutura não encontrado.","error",5000); return false; }
    const current = (moduleRecords["Unidades e setores"] ?? []).find(item=>item.id===record.id);
    if (!current) { showFeedback("A estrutura não existe mais. Atualize o cadastro.","warning",5000); return false; }
    if (!window.confirm(`Inativar “${current.name}”? Ela deixará de aparecer nos seletores. O registro e seus vínculos serão preservados no histórico.`)) return false;
    const reason = window.prompt("Motivo da inativação (ex.: setor duplicado):");
    if (!reason?.trim()) return false;
    return Boolean(await saveCustomerStructure({...current, customerId:customer.id, client:customer.name, status:"Inativo", changeReason:reason.trim()},true));
  };

  const operationalRetryRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const runOperationalCommand = async (command: OperationalCommand) => {
    const fingerprint = JSON.stringify({ action: command.action, recordId: command.recordId, data: command.data });
    if (operationalRetryRef.current?.fingerprint === fingerprint) command = { ...command, idempotencyKey: operationalRetryRef.current.key };
    else operationalRetryRef.current = { fingerprint, key: command.idempotencyKey };
    if (!navigator.onLine) throw new Error("Esta operação precisa de conexão com o banco online.");
    const response = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(command) });
    const result = await response.json();
    if (!response.ok || !result.state) throw new Error(result.error || "Operação não confirmada.");
    operationalRetryRef.current = null;
    const confirmedCustomers = result.state.customers ?? customerRecords;
    const confirmedOrders = result.state.serviceOrders ?? serviceOrders;
    const confirmedModules = mergeImportedServices(result.state.moduleRecords ?? moduleRecords);
    setCustomerRecords(confirmedCustomers); setServiceOrders(confirmedOrders); setModuleRecords(confirmedModules);
    setStateRevision(Number(result.state._revision || 0));
    localStorage.setItem(companyStorageKey(activeCompany.id, "customers"), JSON.stringify(confirmedCustomers));
    localStorage.setItem(companyStorageKey(activeCompany.id, "service-orders"), JSON.stringify(confirmedOrders));
    localStorage.setItem(companyStorageKey(activeCompany.id, "module-records"), JSON.stringify(confirmedModules));
    showFeedback("Operação confirmada no banco e registrada na auditoria.", "success");
  };
  const globalSearchItems = useMemo<GlobalSearchItem[]>(() => {
    const customerItems = customerRecords.map(customer => ({ id: customer.id, title: customer.name, detail: [customer.doc, customer.phone, customer.city || customer.address].filter(Boolean).join(" • "), module: "Clientes", kind: "Cliente" as const }));
    const orderItems = serviceOrders.map(order => ({ id: order.id, title: order.id, detail: [order.client, order.service, order.tech].filter(Boolean).join(" • "), module: "Ordens de serviço", kind: "OS" as const }));
    const moduleItems = Object.entries(moduleRecords).flatMap(([module, records]) => records.map(record => ({ id: record.id, title: record.name, detail: [record.id, record.client, record.sku, record.barcode, record.serialNumber, record.doc, record.invoiceNumber, record.empenhoNumber, record.contractNumber, record.address, record.blockLot, record.category].filter(Boolean).join(" • "), module, kind: "Cadastro" as const })));
    return [...customerItems, ...orderItems, ...moduleItems];
  }, [customerRecords, serviceOrders, moduleRecords]);
  const pendingItems = useMemo<PendingItem[]>(
    () => deriveOperationalActions(serviceOrders, moduleRecords).slice(0, 20),
    [serviceOrders, moduleRecords],
  );
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
  if (checkingSession) return <div className="session-loading" data-testid="proar-boot-loading"><div className="brand-mark brand-logo"><img src="/brand/proar-system-512.png?v=20261015" alt="ProAR"/></div><p>A carregar o ProAR...</p><small>{bootRunId}</small></div>;
  if (bootError && !authenticatedUser) return <main className="session-boot-error" data-testid="proar-boot-error"><section><AlertTriangle size={28}/><h2>Não foi possível carregar a sessão</h2><p>{bootError}</p><small>Código de execução: {bootRunId}</small><div><button type="button" className="primary-btn" onClick={()=>setBootAttempt(value=>value+1)}>Tentar novamente</button><button type="button" className="outline-btn" onClick={()=>{localStorage.removeItem("proar-offline-session");setBootError("");}}>Entrar novamente</button><button type="button" className="outline-btn" onClick={()=>window.location.reload()}>Recarregar aplicação</button></div></section></main>;
  if (!authenticatedUser) return <div data-testid="proar-login-screen"><LoginScreen onLogin={handleLogin}/></div>;
  const mobileOperationalModules = new Set(["Painel inicial","Agenda","Ordens de serviço","Clientes","Obras","Funcionários","Equipamentos"]);
  const mobileExperience = typeof window !== "undefined" && isMobileInterfacePath(window.location.pathname);
  const mobileManager = Boolean(authenticatedUser.role === "Administrador" || authenticatedUser.role === "Gerência" || authenticatedUser.permissions?.includes("*") || authenticatedUser.permissions?.includes("rotas.visualizar"));
  const mobileTechnicianModules = new Set(["Painel inicial","Agenda","Ordens de serviço","Clientes","Equipamentos","Estoque","Vendas"]);
  const mobileManagerModules = new Set([...mobileOperationalModules,"Vendas","Estoque"]);
  const mobileAllowedModules = mobileManager ? mobileManagerModules : mobileTechnicianModules;
  const mobileBlocked = mobileExperience && !mobileAllowedModules.has(current);
  const planBlocked = !primaryTenantAccess && Array.isArray(effectiveEntitledModules) && !effectiveEntitledModules.includes(current);
  return <CustomerHierarchyProvider customers={customerRecords} records={moduleRecords["Unidades e setores"] ?? []} equipment={(moduleRecords.Equipamentos ?? []) as unknown as Record<string,unknown>[]} orders={serviceOrders as unknown as Record<string,unknown>[]}><div className={`app-shell ${mobileExperience?"mobile-operation-policy mobile-dedicated-experience":"proar-full-system"}`}><a className="proar-skip-link" href="#conteudo-principal">Pular para o conteúdo</a><ConnectivityBanner/>
    <div data-testid="proar-sidebar"><Sidebar current={current} setCurrent={setCurrent} open={menuOpen} close={() => setMenuOpen(false)} permissions={authenticatedUser.permissions} role={authenticatedUser.role} entitledModules={effectiveEntitledModules}/></div>
    <main id="conteudo-principal" tabIndex={-1} className="main">
      <Header title={current === "Painel inicial" ? `Olá, ${authenticatedUser.displayName.split(" ")[0]}` : titles[current] || current} subtitle={subtitles[current] || "Controle integrado da sua operação."} onMenu={() => setMenuOpen(true)} onNew={openNew} searchItems={globalSearchItems} pendingItems={pendingItems} onSearchSelect={openGlobalSearch} onPendingSelect={openPending} userName={authenticatedUser.displayName} userRole={authenticatedUser.role ?? "Utilizador"} onSwitchUser={logout} online={online} syncing={syncing} onPull={() => void pullFromDatabase()} onPush={() => void pushToDatabase()}/>
      {syncPhase !== "idle" && <div className={`sync-progress ${syncPhase}`} role="status" aria-label={syncPhase === "complete" ? "Dados atualizados" : "Sincronizando dados"}><i/></div>}
      {databaseMode !== "online" && <div className={`database-contingency ${databaseMode}`} role="status">
        <AlertTriangle size={16}/>
        <div><strong>{databaseMode === "degraded" ? "Modo contingência" : "Modo offline"}</strong><span>{databaseMode === "degraded" ? "Banco indisponível no provedor. A última cópia sincronizada permanece visível e as gravações críticas aguardam reconexão." : "Sem conexão com a internet. Os dados armazenados neste aparelho permanecem disponíveis."}</span></div>
        {lastSuccessfulSyncAt && <small>Última sincronização: {new Date(lastSuccessfulSyncAt).toLocaleString("pt-BR")}</small>}
        {online && <button type="button" onClick={()=>void pullFromDatabase()} disabled={syncing}><RefreshCw size={14}/> Testar novamente</button>}
      </div>}

      <div className="company-context"><Building2 size={13}/><span>{activeCompany.tradeName}</span><small>{activeCompany.cnpj || "CNPJ pendente"} • {activeCompany.city}/{activeCompany.state}</small></div>
      {current === "PMOC e conformidade" && !planBlocked ? <TechnicalCompliancePanel plans={(moduleRecords.PMOC ?? []) as any} fluids={(moduleRecords.Refrigerantes ?? []) as any} documents={(moduleRecords["Documentação / Habilitação"] ?? []) as any} onSave={(module,record)=>saveConfirmedModuleRecord(module,record)} onDelete={(module,record)=>deleteModuleRecord(module,record as ModuleRecord)}/> : null}
      <div className="page-content">{planBlocked ? <section className="mobile-module-blocked"><LockKeyhole size={28}/><h2>Módulo não contratado</h2><p>Este módulo não faz parte do plano ativo desta empresa. A liberação é feita pelo ProAR Manager conforme o contrato.</p><button className="primary-btn" onClick={()=>setCurrent(effectiveEntitledModules?.[0]||"Painel inicial")}>Voltar para módulos liberados</button></section> : mobileBlocked ? <section className="mobile-module-blocked"><ShieldCheck size={28}/><h2>Módulo disponível no computador</h2><p>No celular e tablet o ProAR é focado na operação de trabalho. Para gestão administrativa completa, utilize a versão desktop.</p><button className="primary-btn" onClick={()=>setCurrent("Painel inicial")}>Voltar para operação</button></section> : current === "PMOC e conformidade" ? null : current === "Integridade do Sistema" ? <IntegrityAudit/> : current === "Atividades" ? <ActivityCenter records={moduleRecords["Auditoria operacional"] ?? []}/> : current === "Painel inicial" && mobileExperience ? <MobileToday manager={mobileManager}/> : current === "Painel inicial" ? <DashboardWorkspace onNavigate={setCurrent} serviceOrders={serviceOrders} modules={moduleRecords} role={authenticatedUser.role}/> : current === "Central de pendências" ? <OperationsActionCenter serviceOrders={serviceOrders as unknown as Record<string,unknown>[]} modules={moduleRecords as unknown as Record<string,Record<string,unknown>[]>} onNavigate={setCurrent}/> : current === "Clientes" ? <Customers onOpen={name => { setModal(""); window.setTimeout(() => setModal(name), 0); }} onDelete={deleteCustomer} onUpdate={updateCustomer} onUpdateStructure={saveCustomerStructure} onDeleteStructure={deleteCustomerStructure} canEdit={hasAction("Clientes","Editar")} customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} serviceOrders={serviceOrders} modules={moduleRecords}/> : current === "Agenda" ? <Agenda companyId={activeCompany.id} serviceOrders={serviceOrders} onOpen={(name,seed)=>{setOrderSeed(seed);setModal(name);}} onSelect={setSelectedOrder} onScheduleUpdate={hasAction("Ordens de serviço","Editar")?updateServiceOrder:undefined} customers={customerRecords} staff={moduleRecords["Funcionários"]||[]}/> : current === "Obras" ? <HousesWorkModule companyId={activeCompany.id} company={activeCompany} responsibleUser={authenticatedUser.displayName}/> : current === "Licitações" ? <LicitacoesWorkspace company={activeCompany} modules={moduleRecords} customers={customerRecords} orders={serviceOrders} onSaveRecord={(moduleName,record)=>saveConfirmedModuleRecord(moduleName,record)} onDeleteRecord={deleteModuleRecord} onReadyToInvoice={record=>saveConfirmedModuleRecord("Empenhos",{...record,status:"Pronto para faturar"},[{moduleName:"Financeiro",record:{id:`FAT-${record.id}`,name:`Faturamento • ${record.name}`,client:record.client,description:`Aguardando emissão de Nota Fiscal • ${record.empenhoProcess || "processo não informado"}`,createdAt:new Date().toLocaleString("pt-BR"),status:"Pronto para faturar",date:new Date().toISOString().slice(0,10),value:record.value??0,category:"Faturamento público",transactionType:"Receber",empenhoId:record.id}}])} onOpenTender={item=>setModal(`Análise de edital • ${item.numeroControlePNCP || item.objetoCompra || "Licitação"}`)}/> : current === "Orçamentos" ? <BudgetPDV customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} catalog={[...(moduleRecords.Produtos ?? []),...(moduleRecords.Serviços ?? [])]} budgets={moduleRecords.Orçamentos ?? []} onSave={record => updateModuleRecord("Orçamentos",record)} onConvert={convertBudget} onDelete={record => deleteModuleRecord("Orçamentos",record)} onCreateCustomer={createQuickCustomer} onCreateStructure={createQuickStructure}/> : current === "Vendas" ? <SalesPDV customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} records={[...(moduleRecords.Produtos ?? []),...(moduleRecords.Serviços ?? [])]} sales={moduleRecords.Vendas ?? []} onSave={record => updateModuleRecord("Vendas",record)} onDelete={record=>deleteModuleRecord("Vendas",record)}/> : current === "Relatórios" ? <Reports modules={moduleRecords} customers={customerRecords} serviceOrders={serviceOrders} company={activeCompany}/> : current === "Diagnósticos" ? <DiagnosticManagementDashboard serviceOrders={serviceOrders as unknown as Record<string,unknown>[]} equipment={(moduleRecords["Equipamentos"] ?? []) as unknown as Record<string,unknown>[]}/> : current === "Fiscal" ? <FiscalWorkspace modules={moduleRecords} serviceOrders={serviceOrders as unknown as Record<string,unknown>[]} company={activeCompany} onNavigate={setCurrent}/> : current === "Base Técnica" ? <TechnicalBasePanel/> : current === "Configurações" ? <SettingsModule companies={companies} activeCompany={activeCompany} onCompaniesChange={updateCompanies} onSelectCompany={selectCompany} isAdministrator={Boolean(authenticatedUser.role === "Administrador" || authenticatedUser.permissions?.includes("*"))}/> : current === "Aprovações" ? <ApprovalCenter records={moduleRecords["Aprovações"] ?? []} canApprove={Boolean(authenticatedUser.role === "Administrador" || authenticatedUser.permissions?.includes("*") || authenticatedUser.permissions?.includes("aprovacoes.aprovar") || authenticatedUser.permissions?.includes("Aprovações"))} onOperation={runOperationalCommand}/> : current === "Financeiro" ? <FinancialModule records={moduleRecords.Financeiro ?? []} modules={moduleRecords} onOperation={runOperationalCommand} onOpen={setModal} onIssueInvoice={(record,invoiceNumber)=>{const commitment=(moduleRecords.Empenhos??[]).find(item=>item.id===record.empenhoId);const related=commitment?[{moduleName:"Empenhos",record:{...commitment,status:"Faturado"}}]:[];return saveConfirmedModuleRecord("Financeiro",{...record,status:"Em aberto",transactionType:"Receber",invoiceNumber,invoiceIssuedAt:new Date().toISOString()},related)}}/> : current === "Funcionários" ? <EmployeesWorkspace records={moduleRecords["Funcionários"] ?? []} serviceOrders={serviceOrders} onOpen={setModal} onUpdate={(moduleName,record)=>saveConfirmedModuleRecord(moduleName,record)} onDelete={deleteModuleRecord} canEdit={hasAction("Funcionários","Editar")} canManageLogin={Boolean(authenticatedUser.role==="Administrador"||authenticatedUser.permissions?.includes("*"))}/> : current === "Ordens de serviço" ? <ServiceOrders onOpen={setModal} onSelect={setSelectedOrder} onDelete={deleteOrder} onUpdate={updateServiceOrder} serviceOrders={serviceOrders} customers={customerRecords} company={activeCompany} role={authenticatedUser.role}/> : <>{(current === "Compras" || current === "Estoque") && <InventoryOperations mode={current} modules={moduleRecords} onOperation={runOperationalCommand}/>}<GenericModule name={current} onOpen={setModal} onDelete={deleteModuleRecord} onUpdate={updateModuleRecord} onConvert={convertBudget} companyCnpj={activeCompany.cnpj} canEdit={hasAction(current,"Editar")} records={moduleRecords[current] ?? []} allModules={moduleRecords} serviceOrders={serviceOrders}/></>}</div>
      <footer><span>© {new Date().getFullYear()} ProAR Gestão de Serviços</span><span><ShieldCheck size={12}/> Gestão segura e inteligente para prestadores de serviços.</span></footer>
    </main>
    {modal && <div data-testid={modal === "Novo cliente" ? "customer-new-dialog" : undefined}><Modal initialOrderSeed={orderSeed} title={modal} customers={customerRecords} structures={moduleRecords["Unidades e setores"] ?? []} catalogRecords={[...(moduleRecords["Serviços"] ?? []).map(item=>({...item,kind:"Serviço" as const})), ...(moduleRecords["Produtos"] ?? []).map(item=>({...item,kind:"Produto" as const}))]} supplierRecords={moduleRecords["Fornecedores"] ?? []} employeeRecords={moduleRecords["Funcionários"] ?? []} equipmentRecords={moduleRecords["Equipamentos"] ?? []} close={() => {setModal("");setOrderSeed(undefined);}} onSave={saveRecord} canCreateCustomer={hasAction("Clientes","Criar")} onCreateCustomer={createOrderCustomer} onCreateStructure={createOrderStructure}/></div>}
    {selectedOrder && <OrderDetail order={selectedOrder} customerPhone={customerRecords.find(customer => customer.name === selectedOrder.client)?.phone} company={activeCompany} catalog={[...(moduleRecords["Serviços"] ?? []), ...(moduleRecords["Produtos"] ?? [])]} contracts={(moduleRecords.Certames ?? []) as PublicContractRecord[]} customers={customerRecords} employees={moduleRecords["Funcionários"] ?? []} structures={moduleRecords["Unidades e setores"] ?? []} equipment={moduleRecords["Equipamentos"] ?? []} errorCodes={[...(moduleRecords["Códigos HVAC"] ?? []), ...(moduleRecords["Códigos de erro"] ?? []), ...(moduleRecords["ErrorCode"] ?? [])]} manuals={[...(moduleRecords["Base Técnica"] ?? []), ...(moduleRecords["Manuais Técnicos"] ?? []), ...(moduleRecords["Manuais HVAC"] ?? []), ...(moduleRecords["DiagnosticManual"] ?? [])]} close={() => setSelectedOrder(null)} onUpdate={updateServiceOrder} onDelete={deleteOrder} onSyncEquipmentDiagnostic={async (equipmentId, entry) => {
    const currentEquipment=(moduleRecords["Equipamentos"] ?? []).find(item=>item.id===equipmentId);
    if(!currentEquipment)return false;
    const history=Array.isArray(currentEquipment.diagnosticHistory)?currentEquipment.diagnosticHistory as Record<string,unknown>[]:[];
    if(history.some(item=>item.id===entry.id))return true;
    return saveConfirmedModuleRecord("Equipamentos",{...currentEquipment,diagnosticHistory:[entry,...history].slice(0,100),lastDiagnosticAt:String(entry.createdAt||new Date().toISOString())});
  }} onToggleEquipmentLabel={async (equipmentId, enabled) => {
    if (!hasAction("Equipamentos","Editar")) return false;
    const currentEquipment = (moduleRecords["Equipamentos"] ?? []).find(item => item.id === equipmentId);
    if (!currentEquipment) return false;
    return saveConfirmedModuleRecord("Equipamentos", { ...currentEquipment, publicMaintenanceHistoryEnabled: enabled });
  }} onLinkHistoricalOrder={async (equipmentId, orderId, linked) => {
    if (!hasAction("Equipamentos","Editar")) return false;
    const currentEquipment = (moduleRecords["Equipamentos"] ?? []).find(item => item.id === equipmentId);
    const previousOrder = serviceOrders.find(item => item.id === orderId);
    if (!currentEquipment || !previousOrder) return false;
    const historical = Array.isArray(currentEquipment.historicalServiceOrderIds) ? currentEquipment.historicalServiceOrderIds : [];
    if (linked) {
      if (!canLinkHistoricalServiceOrder(currentEquipment as Record<string,unknown>, previousOrder as unknown as Record<string,unknown>, (moduleRecords["Equipamentos"] ?? []) as Record<string,unknown>[])) return false;
      if (historical.length >= 100 && !historical.includes(orderId)) return false;
    } else if (!historical.includes(orderId)) return false;
    return saveConfirmedModuleRecord("Equipamentos", {
      ...currentEquipment,
      historicalServiceOrderIds: linked ? [...new Set([...historical, orderId])] : historical.filter(id => id !== orderId),
    });
  }} onAssignEquipmentLabel={async (equipmentId, rawCode, customerId) => {
    if (!hasAction("Equipamentos","Editar")) return false;
    const code = normalizeEquipmentLabelCode(rawCode);
    if (!isEquipmentLabelCode(code) || !customerId) return false;
    const currentEquipment = (moduleRecords["Equipamentos"] ?? []).find(item => item.id === equipmentId);
    if (!currentEquipment || String(currentEquipment.customerId || "") !== customerId) return false;
    const currentCode = normalizeEquipmentLabelCode(currentEquipment.permanentLabelCode);
    if (currentCode) return currentCode === code;
    if ((moduleRecords["Equipamentos"] ?? []).some(item => item.id !== equipmentId && normalizeEquipmentLabelCode(item.permanentLabelCode) === code)) return false;
    // Check the authoritative tenant lookup, including deterministic QR codes, before saving.
    try {
      const response = await fetch(`/api/equipment-maintenance-label?code=${encodeURIComponent(code)}&customerId=${encodeURIComponent(customerId)}`, { cache:"no-store" });
      if (response.status !== 404) return false;
    } catch { return false; }
    return saveConfirmedModuleRecord("Equipamentos", { ...currentEquipment, permanentLabelCode: code });
  }} canManageLabels={hasAction("Equipamentos","Editar")} serviceOrders={serviceOrders} canEdit={hasAction("Ordens de serviço","Editar")}/>}{/* detalhe da OS */}
  </div></CustomerHierarchyProvider>;
}

