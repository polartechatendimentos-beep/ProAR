"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  Eye,
  EyeOff,
  FileBarChart2,
  FileText,
  HelpCircle,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";

import type { UserSession } from "@/lib/proar-auth";
import { WorkOperationsPanel } from "@/components/WorkOperationsPanel";
import { OrcamentoPanel } from "@/components/OrcamentoPanel";
import { PdvBalcaoPanel } from "@/components/PdvBalcaoPanel";
import { FinanceiroPanel } from "@/components/FinanceiroPanel";
import { PublicContractsPanel } from "@/components/PublicContractsPanel";
import { TechnicalCompliancePanel } from "@/components/TechnicalCompliancePanel";
import { ServiceOrdersSection } from "@/components/ServiceOrdersSection";

type TabType =
  | "dashboard"
  | "clientes"
  | "equipamentos"
  | "orcamento"
  | "pdv"
  | "os"
  | "agenda"
  | "obras"
  | "pmoc"
  | "contratos"
  | "estoque"
  | "compras"
  | "financeiro"
  | "fiscal"
  | "whatsapp"
  | "relatorios"
  | "configuracoes";

type ModuleItem = {
  key: TabType;
  label: string;
  icon: LucideIcon;
  description: string;
  keywords: string[];
};

type SearchTarget = {
  label: string;
  context: string;
  moduleKey: TabType;
  keywords: string[];
};

type DayMetric = {
  label: string;
  value: string;
  tone: "default" | "danger" | "warning" | "success";
  moduleKey: TabType;
};

type Workstream = {
  title: string;
  moduleKey: TabType;
  lines: string[];
  accent: string;
};

const MODULES: ModuleItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Central operacional do dia, alertas e prioridades por perfil.", keywords: ["inicio", "dashboard", "painel", "indicadores"] },
  { key: "clientes", label: "Clientes", icon: Users, description: "Cadastro 360°, hierarquia oficial e histórico completo do cliente.", keywords: ["cliente", "cnpj", "cpf", "telefone", "documento"] },
  { key: "equipamentos", label: "Equipamentos", icon: Wrench, description: "Ativos técnicos com vínculo por unidade, sala e etiqueta inteligente.", keywords: ["equipamento", "serie", "patrimonio", "maquina", "condensadora"] },
  { key: "orcamento", label: "Orçamentos", icon: FileText, description: "Orçamentos operacionais com validade, tabela de preço e itens estruturados.", keywords: ["orcamento", "proposta", "cotacao", "km"] },
  { key: "pdv", label: "PDV / Vendas", icon: ShoppingCart, description: "Cupom, atalhos de operação e destaque para último item inserido.", keywords: ["pdv", "venda", "pedido", "caixa"] },
  { key: "os", label: "Ordens Serviço", icon: Wrench, description: "Resumo técnico, serviços, equipamentos, fotos, financeiro e documentos.", keywords: ["os", "ordem", "servico", "chamado"] },
  { key: "agenda", label: "Agenda", icon: CalendarDays, description: "Programação aberta por hoje, semana, mês e por técnico.", keywords: ["agenda", "visita", "roteiro", "agendamento"] },
  { key: "obras", label: "Obras", icon: Building2, description: "Obra, quadras, casas, materiais, fiscalização e histórico.", keywords: ["obra", "casa", "lote", "fiscalizacao", "projeto"] },
  { key: "pmoc", label: "PMOC", icon: ShieldCheck, description: "Contrato, responsável técnico, vigência e execuções PMOC.", keywords: ["pmoc", "art", "conformidade", "laudo"] },
  { key: "contratos", label: "Licitações", icon: Landmark, description: "Radar, certames, empenhos, saldo contratual e documentos oficiais.", keywords: ["licitacao", "certame", "pncp", "empenho", "edital"] },
  { key: "estoque", label: "Estoque", icon: Package, description: "Saldo, reservado, disponível e origem das movimentações.", keywords: ["estoque", "produto", "saldo", "inventario"] },
  { key: "compras", label: "Compras", icon: Briefcase, description: "Notas, pedidos, fornecedores e materiais por obra.", keywords: ["compra", "fornecedor", "pedido compra"] },
  { key: "financeiro", label: "Financeiro", icon: Wallet, description: "Receber, pagar, fluxo de caixa, conciliação e baixa parcial.", keywords: ["financeiro", "conta", "receber", "pagar", "fluxo caixa"] },
  { key: "fiscal", label: "Fiscal", icon: Receipt, description: "Certificado digital, NF-e, NFS-e e sincronização fiscal.", keywords: ["fiscal", "nota fiscal", "nfs-e", "tributo"] },
  { key: "whatsapp", label: "WhatsApp", icon: Bell, description: "Métricas de envio, falhas, origem da mensagem e rastreio operacional.", keywords: ["whatsapp", "mensagem", "alerta"] },
  { key: "relatorios", label: "Relatórios", icon: FileBarChart2, description: "Central única de relatórios com motor comum entre módulos.", keywords: ["relatorio", "indicador", "exportacao"] },
  { key: "configuracoes", label: "Configurações", icon: Settings, description: "Empresa, usuários, permissões, IA, fiscal, tabelas e auditoria.", keywords: ["configuracao", "usuario", "perfil", "permissao"] },
];

const QUICK_CREATE = [
  "Cliente",
  "OS",
  "Orçamento",
  "Venda",
  "Equipamento",
  "Obra",
  "Compra",
  "Conta financeira",
  "Certame",
];

const SEARCH_TARGETS: SearchTarget[] = [
  { label: "Cliente, CNPJ, CPF e telefone", context: "Busca Global", moduleKey: "clientes", keywords: ["cliente", "cnpj", "cpf", "telefone"] },
  { label: "OS, equipamento, patrimônio e série", context: "Busca Global", moduleKey: "os", keywords: ["os", "equipamento", "patrimonio", "serie"] },
  { label: "Obra, casa/lote e agenda", context: "Busca Global", moduleKey: "obras", keywords: ["obra", "casa", "lote", "agenda"] },
  { label: "Orçamento, venda e conta financeira", context: "Busca Global", moduleKey: "financeiro", keywords: ["orcamento", "venda", "financeiro"] },
  { label: "Certame, empenho, nota fiscal e documento", context: "Busca Global", moduleKey: "contratos", keywords: ["certame", "empenho", "nota fiscal", "documento"] },
  { label: "Sala, ambiente, setor e unidade", context: "Busca Global", moduleKey: "clientes", keywords: ["sala", "ambiente", "setor", "unidade"] },
];

const WORKDAY_METRICS: DayMetric[] = [
  { label: "OS hoje", value: "12", tone: "default", moduleKey: "os" },
  { label: "Atrasadas", value: "4", tone: "danger", moduleKey: "os" },
  { label: "Ag. material", value: "3", tone: "warning", moduleKey: "compras" },
  { label: "Retornos", value: "5", tone: "warning", moduleKey: "os" },
  { label: "Contas hoje", value: "7", tone: "success", moduleKey: "financeiro" },
  { label: "Obras com pendência", value: "2", tone: "danger", moduleKey: "obras" },
];

const WORKSTREAMS: Workstream[] = [
  { title: "Ordens de Serviço", moduleKey: "os", accent: "border-blue-200 bg-blue-50/60", lines: ["09:00 Hospital Municipal", "10:30 Cliente João", "13:30 Drogaria"] },
  { title: "Obras", moduleKey: "obras", accent: "border-amber-200 bg-amber-50/70", lines: ["Quadra G • 74%", "🔴 3 pendências", "⭐ 2 casas prioritárias"] },
  { title: "Financeiro", moduleKey: "financeiro", accent: "border-emerald-200 bg-emerald-50/70", lines: ["R$ 18.540 vencendo", "R$ 4.800 vencido"] },
  { title: "Licitações", moduleKey: "contratos", accent: "border-indigo-200 bg-indigo-50/70", lines: ["7 oportunidades novas", "2 prazos hoje"] },
  { title: "WhatsApp", moduleKey: "whatsapp", accent: "border-cyan-200 bg-cyan-50/70", lines: ["3 mensagens falharam", "8 lembretes para enviar"] },
  { title: "Compras", moduleKey: "compras", accent: "border-rose-200 bg-rose-50/70", lines: ["4 materiais abaixo do mínimo", "2 solicitações de compra"] },
];

const AI_RECOMMENDATIONS = [
  "Priorizar as 4 OS atrasadas antes das 10h para reduzir retorno improdutivo.",
  "Antecipar compra do material da Quadra G para evitar travar as 3 pendências da obra.",
  "Gerar lembretes de cobrança para as 7 contas do dia e revisar as 3 mensagens com falha no WhatsApp.",
];

const CLIENT_TABS = [
  "Cadastro",
  "Estrutura",
  "Salas",
  "Equipamentos",
  "Histórico",
  "Limites",
  "Contratos",
  "OS",
  "Orçamentos",
  "Financeiro",
  "Documentos",
];

const CLIENT_HIERARCHY = [
  "Prefeitura",
  "├── Saúde",
  "│   ├── Hospital Municipal",
  "│   │   ├── UTI",
  "│   │   │   ├── Sala 01",
  "│   │   │   └── Sala 02",
  "│   │   └── Farmácia",
  "│   └── UBS Centro",
  "├── Educação",
  "│   ├── Escola A",
  "│   └── Escola B",
  "└── Administração",
];

const ROOM_HISTORY = [
  ["14/09/2026", "OS 1548", "Manutenção corretiva"],
  ["02/08/2026", "OS 1420", "Higienização"],
  ["10/05/2026", "OS 1318", "Dreno obstruído"],
] as const;

const EQUIPMENT_ROWS = [
  ["EQ-001", "Cassete 48.000 BTUs", "48.000", "LG", "Prefeitura Municipal", "Hospital Municipal", "Sala 03", "Operando"],
  ["EQ-002", "Split Hi-Wall 12.000 BTUs", "12.000", "Daikin", "Cliente João", "Loja Centro", "Recepção", "Preventiva"],
  ["EQ-003", "Piso Teto 60.000 BTUs", "60.000", "Elgin", "Drogaria", "Filial Norte", "Estoque", "Aguardando peça"],
] as const;

const EQUIPMENT_FIELDS = [
  "Marca",
  "Modelo",
  "Tipo",
  "BTUs",
  "Número de série",
  "Patrimônio",
  "Tensão",
  "Frequência",
  "Corrente",
  "Potência",
  "Fluido refrigerante",
  "Carga",
  "Data fabricação",
  "Cliente",
  "Unidade",
  "Setor",
  "Sala/Ambiente",
];

const OS_TABS = ["Resumo", "Serviços", "Equipamentos", "Fotos", "Histórico", "Financeiro", "Documentos"];

const OS_SUMMARY_FIELDS = [
  ["Tipo atendimento", "Manutenção corretiva"],
  ["Prioridade", "Alta"],
  ["Data / Hora", "14/09/2026 • 09:00"],
  ["Técnico", "Kaio / Team 02"],
  ["Status", "Em atendimento"],
] as const;

const OS_LINES = [
  ["Diagnóstico", "1", "450,00", "-", "450,00"],
  ["Carga R32", "1", "450,00", "-", "450,00"],
] as const;

const AGENDA_FILTERS = ["Hoje", "Semana", "Mês", "Por Técnico"];

const AGENDA_ROWS = [
  ["07:30", "João", "Prefeitura / Hospital", "Aberta"],
  ["09:00", "Lucas", "Drogaria Santa Rita", "Aberta"],
  ["10:30", "Caio", "Cliente Residencial", "Aberta"],
] as const;

const ORCAMENTO_ROWS = [
  ["Serviço", "Higienização", "2", "250,00", "-", "500,00"],
  ["Produto", "Capacitor", "1", "120,00", "-", "120,00"],
] as const;

const PDV_SHORTCUTS = [
  "F1 Cliente",
  "F2 Menu",
  "F3 Operações",
  "F4 Pagamento",
  "F5 Recuperar",
  "F6 Pesquisa",
  "F7 Finalizar",
  "F8 Canc item",
  "F9 Canc venda",
];

const PDV_ITEMS = [
  ["Serviço", "1 × 700,00", "700,00"],
  ["Produto B", "1 × 250,00", "250,00"],
  ["Produto A", "2 × 150,00", "300,00"],
] as const;

const OBRAS_TABS = [
  "Visão Geral",
  "Quadras",
  "Casas/Lotes",
  "Áreas Comuns",
  "Engenharia / Fiscalização",
  "Materiais / Consumo",
  "Alterações de Projeto",
  "Documentos",
  "Histórico",
];

const MATERIAL_ROWS = [
  ["Cobre 1/4", "800 m", "460 m", "340 m", "220 m"],
  ["Cobre 3/8", "700 m", "410 m", "290 m", "180 m"],
  ["PP 4 vias", "900 m", "540 m", "360 m", "250 m"],
] as const;

const MATERIAL_EXPECTED = [
  ["Cobre 1/4", "9,00 m"],
  ["Cobre 3/8", "9,00 m"],
  ["Isolamento", "18,00 m"],
  ["Cabo PP", "11,00 m"],
  ["Caixa frigorígena", "1 un"],
] as const;

const PMOC_TABS = ["Plano de manutenção", "Execuções", "Equipamentos", "Documentos", "Relatório PMOC"];
const LICITACOES_TABS = ["Radar de Oportunidades", "Certames", "Empenhos", "Saldo do Certame", "Documentos"];
const COMPRA_TABS = ["Nova compra", "Notas recebidas", "Pedidos", "Fornecedores", "Materiais por obra"];
const FINANCEIRO_TABS = ["Receber", "Pagar", "Fluxo Caixa", "Conciliação"];
const RELATORIO_ACTIONS = ["Visualizar", "PDF", "Imprimir", "WhatsApp"];
const CONFIG_TABS = ["Empresa", "Usuários", "Permissões", "IA", "WhatsApp", "Fiscal", "Tabelas de preço", "Serviços", "Produtos", "Status", "Notificações", "Auditoria"];

function normalizeRole(role?: string) {
  return String(role || "").trim().toLowerCase();
}

function getAllowedModules(role?: string) {
  const normalized = normalizeRole(role);
  if (["admin", "administrador", "superadmin", "manager", "gerencia", "gerência"].includes(normalized)) {
    return MODULES;
  }
  if (["tecnico", "técnico"].includes(normalized)) {
    return MODULES.filter((item) => ["dashboard", "clientes", "equipamentos", "os", "agenda", "obras", "pmoc"].includes(item.key));
  }
  if (normalized.includes("finan")) {
    return MODULES.filter((item) => ["dashboard", "clientes", "orcamento", "pdv", "financeiro", "fiscal", "relatorios"].includes(item.key));
  }
  if (normalized.includes("comercial") || normalized.includes("venda")) {
    return MODULES.filter((item) => ["dashboard", "clientes", "equipamentos", "orcamento", "pdv", "contratos", "whatsapp", "relatorios"].includes(item.key));
  }
  return MODULES.filter((item) => ["dashboard", "clientes", "equipamentos", "orcamento", "os", "obras", "contratos", "financeiro", "pmoc"].includes(item.key));
}

function initialsFromName(name?: string) {
  const parts = String(name || "U").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((item) => item[0]?.toUpperCase() || "").join("") || "U";
}

function PlaceholderModule({ title, description, bullets }: { title: string; description: string; bullets: string[] }) {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Módulo preservado</span>
        <h2 className="mt-3 text-2xl font-black text-slate-950">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {bullets.map((bullet) => (
          <div key={bullet} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 shadow-sm">
            {bullet}
          </div>
        ))}
      </div>
    </div>
  );
}

function toneClass(tone: DayMetric["tone"]) {
  if (tone === "danger") return "border-rose-200 bg-rose-50 text-rose-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-white text-slate-700";
}

function tabPillClass(active = false) {
  return active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600";
}

export default function HomePage() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileSidebarCloseRef = useRef<HTMLButtonElement | null>(null);

  const visibleModules = useMemo(() => getAllowedModules(session?.role), [session?.role]);
  const sidebarModules = useMemo(() => visibleModules.filter((item) => item.key !== "dashboard"), [visibleModules]);
  const canAccessSettings = useMemo(
    () => visibleModules.some((item) => item.key === "configuracoes"),
    [visibleModules]
  );

  useEffect(() => {
    const syncSession = async () => {
      try {
        const response = await fetch("/api/auth", { cache: "no-store" });
        const json = await response.json().catch(() => ({}));
        setSession(response.ok && json.authenticated ? json.user : null);
      } catch {
        setSession(null);
      } finally {
        setAuthLoading(false);
      }
    };

    void syncSession();
  }, []);

  useEffect(() => {
    if (!visibleModules.some((item) => item.key === activeTab)) {
      setActiveTab(visibleModules[0]?.key || "dashboard");
    }
  }, [activeTab, visibleModules]);

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideDesktopSearch = desktopSearchRef.current?.contains(target) || false;
      const isInsideMobileSearch = mobileSearchRef.current?.contains(target) || false;
      if (!isInsideDesktopSearch && !isInsideMobileSearch) setSearchOpen(false);
      if (quickMenuRef.current && !quickMenuRef.current.contains(target)) setQuickCreateOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
    };

    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    mobileSidebarCloseRef.current?.focus();
  }, [sidebarOpen]);

  const searchResults = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    if (!term) {
      return SEARCH_TARGETS
        .filter((item) => visibleModules.some((module) => module.key === item.moduleKey))
        .map((item) => ({ type: "target" as const, ...item }))
        .slice(0, 6);
    }

    const moduleResults = visibleModules
      .filter((item) => [item.label, item.description, ...item.keywords].some((value) => value.toLowerCase().includes(term)))
      .map((item) => ({ type: "module" as const, item }));

    const targetResults = SEARCH_TARGETS
      .filter((item) => visibleModules.some((module) => module.key === item.moduleKey))
      .filter((item) => [item.label, item.context, ...item.keywords].some((value) => value.toLowerCase().includes(term)))
      .map((item) => ({ type: "target" as const, ...item }));

    return [...moduleResults, ...targetResults].slice(0, 8);
  }, [globalSearch, visibleModules]);

  const activeModule = visibleModules.find((item) => item.key === activeTab) || visibleModules[0];

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthError("");

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, usuario: identifier, email: identifier, senha: password, rememberMe }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        setAuthError(json.message || json.error || "Não foi possível entrar no sistema.");
        return;
      }
      setSession(json.user);
      setActiveTab("dashboard");
      setIdentifier("");
      setPassword("");
    } catch {
      setAuthError("Não foi possível validar o acesso agora. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setSession(null);
    setUserMenuOpen(false);
    setSidebarOpen(false);
  };

  const renderModuleContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Central de Trabalho do Dia</span>
                    <h1 className="mt-3 text-2xl font-black text-slate-950">Tela inicial operacional com foco em prioridades, pendências e próxima ação.</h1>
                    <p className="mt-2 max-w-3xl text-sm text-slate-600">Sem apagar dados existentes, a home passa a priorizar execução diária, obras, financeiro, licitações, WhatsApp, compras e recomendações assistidas por IA.</p>
                  </div>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                    <div className="font-bold uppercase tracking-[0.16em] text-[11px] text-blue-700">IA supervisionada</div>
                    <div className="mt-1">A IA recomenda ações e alertas, mas não executa alterações sozinha.</div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  {WORKDAY_METRICS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveTab(item.moduleKey)}
                      className={`rounded-2xl border px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 ${toneClass(item.tone)}`}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em]">{item.label}</div>
                      <div className="mt-2 text-3xl font-black">{item.value}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              {WORKSTREAMS.map((stream) => (
                <button
                  key={stream.title}
                  type="button"
                  onClick={() => setActiveTab(stream.moduleKey)}
                  className={`rounded-3xl border p-5 text-left shadow-sm transition hover:-translate-y-0.5 ${stream.accent}`}
                >
                  <div className="text-sm font-black text-slate-950">{stream.title}</div>
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    {stream.lines.map((line) => (
                      <div key={line} className="rounded-2xl bg-white/80 px-4 py-3">{line}</div>
                    ))}
                  </div>
                </button>
              ))}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">Recomendações e alertas da IA</h2>
                  <p className="text-sm text-slate-600">Sugestões assistidas para o time decidir, sempre com confirmação humana.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                {AI_RECOMMENDATIONS.map((item, index) => (
                  <div key={item} className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">Alerta {index + 1}</div>
                    <p className="mt-2 leading-6">{item}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Wrench className="h-5 w-5" /></div>
                  <div>
                    <h2 className="text-lg font-black text-slate-950">Modo mobile técnico</h2>
                    <p className="text-sm text-slate-600">No celular, o técnico vê apenas o necessário para trabalhar.</p>
                  </div>
                </div>
                <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-950 p-4 text-white">
                  <div className="text-sm font-black">PROAR</div>
                  <div className="mt-1 text-slate-300">Bom dia, João</div>
                  <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300">Atendimentos de hoje</div>
                  <div className="mt-3 space-y-3">
                    {[
                      ["09:00", "Hospital Municipal", "UTI • Sala 03"],
                      ["13:30", "Drogaria", "Loja 02"],
                    ].map(([hour, client, detail]) => (
                      <div key={`${hour}-${client}`} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
                        <div className="text-lg font-black">{hour}</div>
                        <div className="mt-1 text-sm font-semibold">{client}</div>
                        <div className="text-sm text-slate-400">{detail}</div>
                        <button type="button" className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white">Abrir OS</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-lg font-black text-slate-950">Arquitetura operacional</div>
                <p className="mt-1 text-sm text-slate-600">Estruturas finais reforçadas no layout geral do sistema.</p>
                <div className="mt-5 space-y-3 text-sm text-slate-700">
                  {[
                    "Cliente → Estrutura física → Sala/Ambiente → Equipamento → OS → Serviço → Financeiro → Histórico",
                    "Obra → Quadra → Casa/Lote → Etapa → Materiais → Engenharia/Fiscalização → Histórico",
                    "Prefeitura → Secretaria → Unidade → Setor → Sala → Equipamento → Certame → OS → Empenho",
                  ].map((line) => (
                    <div key={line} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 leading-6">{line}</div>
                  ))}
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <WorkOperationsPanel />
              <PublicContractsPanel />
            </div>
          </div>
        );
      case "clientes":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Cliente</div>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Prefeitura Municipal de XXXXX</h2>
                  <p className="mt-2 text-sm text-slate-600">CNPJ XX.XXX.XXX/0001-XX</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Editar</button>
                  <button type="button" className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">+ Nova OS</button>
                  <button type="button" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">+ Orçamento</button>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {CLIENT_TABS.map((tab) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(tab === "Cadastro")}`}>{tab}</span>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Cadastro 360°</h3>
                    <p className="text-sm text-slate-600">Hierarquia oficial: Cliente → Secretaria/Área → Unidade → Setor → Sala/Ambiente → Equipamento.</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Estrutura validada</span>
                </div>
                <div className="mt-5 rounded-3xl bg-slate-950 px-5 py-5 font-mono text-sm leading-7 text-slate-100">
                  {CLIENT_HIERARCHY.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Building2 className="h-5 w-5" /></div>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Visão da Sala / Ambiente</h3>
                    <p className="text-sm text-slate-600">Cada sala passa a existir como registro próprio no fluxo operacional.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Sala", "SALA 03 — UTI"],
                    ["Cliente", "Hospital Municipal"],
                    ["Código", "HM-UTI-S03"],
                    ["Bloco", "A"],
                    ["Andar", "1º"],
                    ["Responsável local", "Maria"],
                    ["Ramal", "204"],
                    ["Criticidade", "Alta"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Equipamentos", "Histórico", "OS", "Fotos", "Documentos"].map((tab) => (
                    <span key={tab} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{tab}</span>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {ROOM_HISTORY.map(([date, os, description]) => (
                    <div key={`${date}-${os}`} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                      <span className="font-semibold text-slate-950">{date}</span>
                      <span className="mx-2 text-slate-300">•</span>
                      <span className="font-semibold text-blue-700">{os}</span>
                      <span className="mx-2 text-slate-300">•</span>
                      <span>{description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        );
      case "equipamentos":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Equipamentos</span>
                  <h2 className="mt-3 text-2xl font-black text-slate-950">Lista operacional com vínculo por cliente, unidade e sala.</h2>
                </div>
                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">A IA pode ler a etiqueta e sugerir o preenchimento, mas o usuário confirma antes de salvar.</div>
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        {["Código", "Equipamento", "BTUs", "Marca", "Cliente", "Unidade", "Sala", "Status"].map((header) => (
                          <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                      {EQUIPMENT_ROWS.map((row) => (
                        <tr key={row[0]}>
                          {row.map((value) => (
                            <td key={`${row[0]}-${value}`} className="px-4 py-3">{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-black text-slate-950">Novo equipamento</h3>
                  <p className="text-sm text-slate-600">Cadastro preparado para foto, etiqueta e preenchimento assistido por IA.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"><Camera className="h-4 w-4" /> Tirar foto</button>
                  <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Galeria</button>
                  <button type="button" className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"><Sparkles className="h-4 w-4" /> Preencher com IA</button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {EQUIPMENT_FIELDS.map((field) => (
                  <div key={field} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    <div className="font-semibold text-slate-800">{field}</div>
                    <div className="mt-3 text-slate-400">Preencher</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      case "orcamento":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Novo orçamento</div>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Estrutura com cliente, unidade, sala, validade e tabela de preço.</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">+ Adicionar item</button>
                  <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Importar</button>
                  <button type="button" className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"><Sparkles className="h-4 w-4" /> IA</button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Cliente", "Selecionar cliente"],
                  ["Unidade / Setor / Sala", "Hospital Municipal / UTI / Sala 03"],
                  ["Validade", "7 dias"],
                  ["Tabela de preço", "Padrão contratos"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      {["Tipo", "Descrição", "Qtd", "Unit.", "Desc.", "Total"].map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {ORCAMENTO_ROWS.map((row) => (
                      <tr key={`${row[0]}-${row[1]}`}>
                        {row.map((value) => (
                          <td key={`${row[1]}-${value}`} className="px-4 py-3">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {[
                  ["Produtos", "120,00"],
                  ["Serviços", "500,00"],
                  ["Custos adicionais", "0,00"],
                  ["Subtotal", "620,00"],
                  ["Desconto", "0,00"],
                  ["Total", "620,00"],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-2xl px-4 py-4 ${label === "Total" ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-900"}`}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-2 text-xl font-black">{value}</div>
                  </div>
                ))}
              </div>
            </section>
            <OrcamentoPanel />
          </div>
        );
      case "pdv":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 xl:grid-cols-[220px_1fr_320px]">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm font-black text-slate-950">Atalhos</div>
                  <div className="mt-4 grid gap-2">
                    {PDV_SHORTCUTS.map((shortcut) => (
                      <button key={shortcut} type="button" className="rounded-2xl bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm">{shortcut}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-black text-slate-950">Cupom</div>
                  <div className="mt-4 space-y-3">
                    {PDV_ITEMS.map((item, index) => (
                      <div key={item[0]} className={`grid grid-cols-[1fr_auto_auto] gap-3 rounded-2xl px-4 py-4 text-sm ${index === 0 ? "bg-blue-50 text-blue-950 ring-1 ring-blue-200" : "bg-slate-50 text-slate-700"}`}>
                        <div className="font-semibold">{item[0]}</div>
                        <div>{item[1]}</div>
                        <div className="font-bold">{item[2]}</div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-blue-700">O último item inserido sobe para o topo e recebe destaque azul temporário.</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-white">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Total da venda</div>
                  <div className="mt-2 text-3xl font-black">R$ 1.250,00</div>
                  <div className="mt-5 space-y-3 text-sm">
                    {[
                      ["Produto/Código", "Pesquisar item"],
                      ["Qtd", "1"],
                      ["Cliente", "Selecionar cliente"],
                      ["Tabela", "Padrão balcão"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
                        <div className="mt-2 font-semibold">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
            <PdvBalcaoPanel />
          </div>
        );
      case "os":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-lg font-black text-slate-950">ORDEM DE SERVIÇO #001548</span>
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Em atendimento</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">Prefeitura → Saúde → Hospital → UTI → Sala 03</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Gerar sem valores</button>
                  <button type="button" className="inline-flex items-center gap-2 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-bold text-white"><Printer className="h-4 w-4" /> Imprimir relatório completo</button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {OS_TABS.map((tab) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(tab === "Resumo")}`}>{tab}</span>
                ))}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {OS_SUMMARY_FIELDS.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {[
                  "Solicitação do cliente",
                  "Diagnóstico técnico",
                  "Serviço executado",
                  "Recomendação técnica",
                ].map((label) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-bold text-slate-900">{label}</div>
                      <button type="button" className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"><Sparkles className="h-3.5 w-3.5" /> IA</button>
                    </div>
                    <div className="mt-3 min-h-24 rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">Campo pronto para preenchimento assistido por IA, sempre com revisão do usuário antes de salvar.</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><FileText className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-950">Serviços e valores</h2>
                  <p className="text-sm text-slate-600">Estrutura da OS com composição de serviços, produtos e total consolidado.</p>
                </div>
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      {["Descrição", "Qtd", "Unit.", "Desc.", "Total"].map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {OS_LINES.map((row) => (
                      <tr key={row[0]}>
                        {row.map((value) => (
                          <td key={`${row[0]}-${value}`} className="px-4 py-3">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Produtos", "R$ 320,00"],
                  ["Serviços", "R$ 900,00"],
                  ["Desconto", "R$ 100,00"],
                  ["Total", "R$ 1.120,00"],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-2xl px-4 py-4 ${label === "Total" ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-900"}`}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-2 text-xl font-black">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <ServiceOrdersSection />
          </div>
        );
      case "agenda":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Agenda</div>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Mostrar apenas operações abertas por padrão.</h2>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Filtro inicial ativo: operações abertas.</div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {AGENDA_FILTERS.map((tab, index) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(index === 0)}`}>{tab}</span>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {AGENDA_ROWS.map(([hour, tech, customer, status]) => (
                  <div key={`${hour}-${tech}`} className="grid gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-sm text-slate-700 md:grid-cols-[90px_160px_1fr_120px]">
                    <div className="font-black text-slate-950">{hour}</div>
                    <div className="font-semibold">{tech}</div>
                    <div>{customer}</div>
                    <div className="text-emerald-700 font-semibold">{status}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      case "obras":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Obras</div>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Green Village III</h2>
                  <p className="mt-2 text-sm text-slate-600">74% concluído</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Abrir Obra</button>
                  <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Alterar Obra</button>
                  <button type="button" className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white">Relatório</button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {[
                  ["Casas", "142"],
                  ["Concluídas", "105"],
                  ["Em execução", "22"],
                  ["Pendentes", "15"],
                  ["Pendências", "3"],
                  ["Recomendações", "6"],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-2xl px-4 py-4 ${label === "Pendências" ? "border border-rose-200 bg-rose-50 text-rose-700" : label === "Recomendações" ? "border border-violet-200 bg-violet-50 text-violet-700" : label === "Em execução" ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-slate-200 bg-slate-50 text-slate-900"}`}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em]">{label}</div>
                    <div className="mt-2 text-2xl font-black">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {OBRAS_TABS.map((tab, index) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(index === 0)}`}>{tab}</span>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700"><ShieldCheck className="h-5 w-5" /></div>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Engenharia / Fiscalização</h3>
                    <p className="text-sm text-slate-600">Cadastro na própria obra com acesso externo controlado.</p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {[
                    ["Nome", "Engenheiro Responsável"],
                    ["Empresa", "PolarTech Engenharia"],
                    ["Telefone", "(17) 99999-0000"],
                    ["E-mail", "engenharia@proar.com.br"],
                    ["Função", "Responsável técnico"],
                    ["Acesso via link", "Ativo"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Gerar acesso", "Copiar link", "Redefinir senha", "Bloquear"].map((action) => (
                    <button key={action} type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">{action}</button>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">No acesso externo, pode fazer apontamento, marcar prioridade e adicionar recomendação, mas nunca alterar status operacional.</div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Package className="h-5 w-5" /></div>
                  <div>
                    <h3 className="text-lg font-black text-slate-950">Materiais / Consumo</h3>
                    <p className="text-sm text-slate-600">Comprado, disponível, reservado e consumido com avanço de etapa.</p>
                  </div>
                </div>
                <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        {["Material", "Comprado", "Consumido", "Saldo", "Necessário"].map((header) => (
                          <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                      {MATERIAL_ROWS.map((row) => (
                        <tr key={row[0]}>
                          {row.map((value) => (
                            <td key={`${row[0]}-${value}`} className="px-4 py-3">{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Alterar status</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">AG. FRIGORÍGENA → AG. ACABAMENTO</div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {MATERIAL_EXPECTED.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                        <span>{label}</span>
                        <span className="font-semibold text-slate-950">{value}</span>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-4 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Confirmar consumo e avançar</button>
                </div>
              </div>
            </section>

            <WorkOperationsPanel />
          </div>
        );
      case "pmoc":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">PMOC</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {[
                  ["Cliente", "Prefeitura Municipal"],
                  ["Unidade", "Hospital Municipal"],
                  ["Contrato", "PMOC-2026-014"],
                  ["Responsável técnico", "Kaio"],
                  ["ART / TRT", "TRT 45678"],
                  ["Vigência", "Até 12/2026"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Equipamentos", "24"],
                  ["Em dia", "21"],
                  ["Vencidos", "2"],
                  ["Próximos", "1"],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-2xl px-4 py-4 ${label === "Vencidos" ? "border border-rose-200 bg-rose-50 text-rose-700" : label === "Próximos" ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-slate-200 bg-white text-slate-900"}`}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em]">{label}</div>
                    <div className="mt-2 text-2xl font-black">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {PMOC_TABS.map((tab, index) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(index === 0)}`}>{tab}</span>
                ))}
              </div>
            </section>
            <TechnicalCompliancePanel />
          </div>
        );
      case "contratos":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Licitações</div>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">Radar de oportunidades, certames e saldo do certame sem misturar com estoque físico.</h2>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">Público: Prefeitura → Secretaria → Unidade → Setor → Sala → Equipamento → Certame → OS → Empenho.</div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {LICITACOES_TABS.map((tab, index) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(index === 0)}`}>{tab}</span>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      {["Certame", "Órgão", "Valor", "Prazo", "Status"].map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    <tr>
                      {[
                        "033/2025",
                        "Bálsamo",
                        "R$ 480.000,00",
                        "19/09/2026",
                        "Ativo",
                      ].map((value) => (
                        <td key={value} className="px-4 py-3">{value}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                {[
                  ["Quantidade contratada", "240"],
                  ["Quantidade utilizada", "82"],
                  ["Saldo", "158"],
                  ["Valor contratado", "R$ 480.000,00"],
                  ["Valor consumido", "R$ 163.200,00"],
                  ["Valor restante", "R$ 316.800,00"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-950">Radar ProAR</h3>
                  <p className="text-sm text-slate-600">Inteligência de mercado para licitações, equipamentos, grandes obras e preços de serviços.</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                {[
                  ["Prioridade A", "Pregão - PMOC - Cidade X", "Distância: 82 km", "Score: 91/100"],
                  ["Grandes Obras", "Complexo Residencial Norte", "Distância: 35 km", "Score: 86/100"],
                  ["Preços de Serviços", "Reajuste regional PMOC", "Faixa: R$ 230 a R$ 310", "Score: 80/100"],
                ].map(([tag, title, detail, score]) => (
                  <div key={title} className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-700">{tag}</div>
                    <div className="mt-2 font-black">{title}</div>
                    <div className="mt-2">{detail}</div>
                    <div className="mt-1">{score}</div>
                    <div className="mt-4 flex gap-2">
                      {["Analisar", "Participar", "Descartar"].map((action) => (
                        <button key={action} type="button" className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-violet-700 shadow-sm">{action}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <PublicContractsPanel />
          </div>
        );
      case "estoque":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Estoque</div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      {["Produto", "Atual", "Reservado", "Disponível", "Mínimo"].map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {[
                      ["Cobre 1/4", "200 m", "60 m", "140 m", "100 m"],
                      ["R32", "8 kg", "2 kg", "6 kg", "4 kg"],
                    ].map((row) => (
                      <tr key={row[0]}>
                        {row.map((value) => (
                          <td key={`${row[0]}-${value}`} className="px-4 py-3">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Movimentações com origem: compra, OS, obra, ajuste, devolução e perda.</div>
            </section>
          </div>
        );
      case "compras":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Compras</div>
              <div className="mt-5 flex flex-wrap gap-2">
                {COMPRA_TABS.map((tab, index) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(index === 0)}`}>{tab}</span>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      {["NF", "Fornecedor", "Valor", "Obra", "Status"].map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    <tr>
                      {[
                        "1256",
                        "Fornecedor A",
                        "8.200,00",
                        "Green III",
                        "Recebida",
                      ].map((value) => (
                        <td key={value} className="px-4 py-3">{value}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        );
      case "financeiro":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Financeiro</div>
              <div className="mt-5 flex flex-wrap gap-2">
                {FINANCEIRO_TABS.map((tab, index) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(index === 0)}`}>{tab}</span>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      {["Descrição", "Original", "Liquidado", "Restante", "Status"].map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    <tr>
                      {[
                        "OS 1548",
                        "984,70",
                        "500,00",
                        "484,70",
                        "Parcial",
                      ].map((value) => (
                        <td key={value} className="px-4 py-3">{value}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
                <span>Enquanto houver saldo de pelo menos R$ 0,01, o botão Dar baixa permanece ativo.</span>
                <button type="button" className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Dar baixa</button>
              </div>
            </section>
            <FinanceiroPanel />
          </div>
        );
      case "fiscal":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-black text-slate-950">Certificado digital</div>
                  <div className="mt-5 space-y-3 text-sm text-slate-700">
                    {[
                      ["Arquivo", "certificado.pfx"],
                      ["Titular", "POLARTECH"],
                      ["CNPJ", "XX.XXX.XXX/0001-XX"],
                      ["Validade", "12/2026"],
                      ["Status", "Ativo"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                        <div className="mt-2 font-semibold text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["Testar certificado", "Alterar", "Remover"].map((action) => (
                      <button key={action} type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">{action}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-black text-slate-950">NF-e</div>
                  <p className="mt-2 text-sm text-slate-600">Última sincronização: Hoje 08:42</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["NF-e recebidas", "NF-e emitidas", "NFS-e"].map((tab) => (
                      <span key={tab} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{tab}</span>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      case "whatsapp":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">WhatsApp</div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Enviadas hoje", "28"],
                  ["Entregues", "25"],
                  ["Lidas", "21"],
                  ["Falhas", "3"],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-2xl px-4 py-4 ${label === "Falhas" ? "border border-rose-200 bg-rose-50 text-rose-700" : "border border-slate-200 bg-slate-50 text-slate-900"}`}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em]">{label}</div>
                    <div className="mt-2 text-2xl font-black">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      {["Data", "Cliente", "Tipo", "Status"].map((header) => (
                        <th key={header} className="px-4 py-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                    {[
                      ["09:12", "João", "Lembrete", "Entregue"],
                      ["09:15", "Prefeitura", "OS", "Lida"],
                      ["09:22", "Maria", "Cobrança", "Falhou"],
                    ].map((row) => (
                      <tr key={`${row[0]}-${row[1]}`}>
                        {row.map((value) => (
                          <td key={`${row[1]}-${value}`} className="px-4 py-3">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">Detalhe da mensagem mostra origem, OS, cliente, telefone, ID da mensagem e horários de envio, entrega e leitura.</div>
            </section>
          </div>
        );
      case "relatorios":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Central de Relatórios</div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Categoria", "OS"],
                  ["Período inicial", "01/09/2026"],
                  ["Período final", "14/09/2026"],
                  ["Cliente", "Todos"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-5 rounded-2xl bg-blue-700 px-4 py-3 text-sm font-bold text-white">Gerar</button>
              <div className="mt-5 flex flex-wrap gap-2">
                {RELATORIO_ACTIONS.map((action) => (
                  <button key={action} type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">{action}</button>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">OS, clientes, equipamentos, vendas, financeiro, obras, certames, empenhos, PMOC, estoque, compras, orçamento e certificados usam o mesmo motor.</div>
            </section>
          </div>
        );
      case "configuracoes":
        return (
          <div className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Configurações</div>
              <div className="mt-5 flex flex-wrap gap-2">
                {CONFIG_TABS.map((tab, index) => (
                  <span key={tab} className={`rounded-full px-3 py-1 text-xs font-semibold ${tabPillClass(index === 0)}`}>{tab}</span>
                ))}
              </div>
              <div className="mt-5 grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm font-black text-slate-950">IA</div>
                  <div className="mt-5 space-y-3 text-sm text-slate-700">
                    {[
                      ["OpenAI", "Configurada"],
                      ["Chave", "••••••••A92F"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</div>
                        <div className="mt-2 font-semibold text-slate-900">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {["Testar conexão", "Alterar credencial", "Remover"].map((action) => (
                      <button key={action} type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">{action}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-black text-slate-950">Auditoria operacional</div>
                  <p className="mt-2 text-sm text-slate-600">Permissões, notificações, status e tabelas permanecem centralizados sem expor segredos completos.</p>
                </div>
              </div>
            </section>
          </div>
        );
      default:
        return <PlaceholderModule title="Módulo preservado" description="Área mantida no shell principal para futuras integrações operacionais." bullets={["Fluxo visual corporativo", "Preservação dos dados existentes", "Acesso controlado por perfil"]} />;
    }
  };

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 px-8 py-6 text-center shadow-2xl">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-600/20 text-blue-300"><LayoutDashboard className="h-6 w-6" /></div>
          <h1 className="mt-4 text-xl font-black">Carregando ProAR</h1>
          <p className="mt-2 text-sm text-slate-400">Validando sessão e preparando os módulos permitidos.</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-10">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl overflow-hidden rounded-[32px] border border-slate-800 bg-slate-900 shadow-2xl lg:grid-cols-[1.15fr_460px]">
          <section className="relative hidden overflow-hidden lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.35),_transparent_42%),linear-gradient(180deg,_rgba(2,6,23,0.72),_rgba(2,6,23,0.96))]" />
            <div className="relative flex h-full flex-col justify-between p-10">
              <div>
                <div className="inline-flex items-center gap-3 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                  <ShieldCheck className="h-4 w-4" />
                  Plataforma PolarTech / ProAR
                </div>
                <h1 className="mt-6 text-4xl font-black leading-tight text-white">Controle sua operação com uma interface compacta, profissional e pronta para qualquer tela.</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">Clientes, OS, obras, PMOC, licitações, estoque e financeiro no mesmo ambiente, sem apagar dados existentes e com módulos liberados conforme o perfil do usuário.</p>
              </div>
              <div className="rounded-[28px] border border-slate-700/70 bg-slate-950/70 p-6 backdrop-blur">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <span className="text-sm font-bold text-white">IMAGEM INSTITUCIONAL</span>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">online</span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {[
                    ["Clientes ativos", "147"],
                    ["OS executadas", "328"],
                    ["Licitações em análise", "12"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
                      <div className="mt-2 text-2xl font-black text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center bg-white px-6 py-10 sm:px-10">
            <div className="w-full max-w-sm">
              <div className="mb-8 flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-xl font-black text-white">P</div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">ProAR</div>
                  <h2 className="text-2xl font-black text-slate-950">Acessar o sistema</h2>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleLogin}>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>Usuário ou e-mail</span>
                  <input
                    autoFocus
                    autoComplete="username"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    className="h-12 rounded-2xl border border-slate-300 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    placeholder="Digite seu acesso"
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  <span>Senha</span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-slate-300 px-4 pr-12 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      placeholder="Digite sua senha"
                    />
                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-3 text-slate-400 hover:text-slate-700" aria-label="Mostrar ou ocultar senha">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </label>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex items-center gap-2 text-slate-600">
                    <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                    Lembrar-me
                  </label>
                  <a href="/trocar-senha" className="font-semibold text-blue-700 hover:text-blue-800">Esqueci minha senha</a>
                </div>

                {authError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{authError}</div>}

                <button disabled={submitting} className="h-12 w-full rounded-2xl bg-blue-700 text-sm font-bold uppercase tracking-[0.16em] text-white transition hover:bg-blue-800 disabled:opacity-60">
                  {submitting ? "Entrando..." : "Entrar"}
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-slate-900 text-slate-200 lg:hidden" aria-label="Abrir menu lateral">
            <Menu className="h-5 w-5" />
          </button>
          <div className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-lg font-black">P</div>
              <div>
                <div className="text-lg font-black tracking-tight">PROAR</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Layout Geral do Sistema</div>
              </div>
            </div>
          </div>

          <div ref={desktopSearchRef} className="relative mx-0 hidden flex-1 md:block lg:mx-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={globalSearch}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setGlobalSearch(event.target.value);
                setSearchOpen(true);
              }}
              placeholder="Buscar cliente, OS, obra, equipamento..."
              className="h-12 w-full rounded-2xl border border-slate-800 bg-slate-900/90 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
            {searchOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                <div className="border-b border-slate-800 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Busca Global</div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {searchResults.map((entry) => entry.type === "module" ? (
                    <button
                      key={`module-${entry.item.key}`}
                      type="button"
                      onClick={() => {
                        setActiveTab(entry.item.key);
                        setSearchOpen(false);
                      }}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-900"
                    >
                      <entry.item.icon className="mt-0.5 h-4 w-4 text-blue-400" />
                      <span>
                        <span className="block text-sm font-semibold text-white">{entry.item.label}</span>
                        <span className="block text-xs text-slate-400">{entry.item.description}</span>
                      </span>
                    </button>
                  ) : (
                    <button
                      key={`target-${entry.label}`}
                      type="button"
                      onClick={() => {
                        setActiveTab(entry.moduleKey);
                        setSearchOpen(false);
                      }}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-900"
                    >
                      <Search className="mt-0.5 h-4 w-4 text-blue-400" />
                      <span>
                        <span className="block text-sm font-semibold text-white">{entry.label}</span>
                        <span className="block text-xs text-slate-400">Abrir módulo relacionado: {MODULES.find((module) => module.key === entry.moduleKey)?.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div ref={quickMenuRef} className="relative">
              <button type="button" onClick={() => setQuickCreateOpen((value) => !value)} className="hidden h-11 items-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:inline-flex">
                <Plus className="h-4 w-4" /> NOVO
              </button>
              {quickCreateOpen && (
                <div className="absolute right-0 top-[calc(100%+0.6rem)] w-56 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                  <div className="border-b border-slate-800 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Criar rápido</div>
                  <div className="p-2">
                    {QUICK_CREATE.map((item) => (
                      <button key={item} type="button" onClick={() => setQuickCreateOpen(false)} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900">{item}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300"><Bell className="h-5 w-5" /></button>
            <button type="button" className="hidden h-11 w-11 place-items-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 sm:grid"><HelpCircle className="h-5 w-5" /></button>
            <div ref={userMenuRef} className="relative">
              <button type="button" onClick={() => setUserMenuOpen((value) => !value)} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-left text-white">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600/20 text-sm font-black text-blue-300">{initialsFromName(session.nome)}</div>
                <div className="hidden sm:block">
                  <div className="text-sm font-semibold">{session.nome}</div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{session.role}</div>
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.6rem)] w-64 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                  <div className="border-b border-slate-800 px-4 py-3">
                    <div className="text-sm font-semibold text-white">{session.nome}</div>
                    <div className="text-xs text-slate-400">{session.email}</div>
                  </div>
                  <div className="p-2">
                    {canAccessSettings && (
                      <button type="button" onClick={() => { setActiveTab("configuracoes"); setUserMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900"><Settings className="h-4 w-4" /> Configurações</button>
                    )}
                    <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-900"><LogOut className="h-4 w-4" /> Sair</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 px-4 py-3 md:hidden">
          <div ref={mobileSearchRef} className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={globalSearch}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setGlobalSearch(event.target.value);
                setSearchOpen(true);
              }}
              placeholder="Buscar cliente, OS, obra, equipamento..."
              className="h-11 w-full rounded-2xl border border-slate-800 bg-slate-900/90 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-500"
            />
            {searchOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
                <div className="max-h-72 overflow-y-auto p-2">
                  {searchResults.map((entry) => entry.type === "module" ? (
                    <button key={`mobile-${entry.item.key}`} type="button" onClick={() => { setActiveTab(entry.item.key); setSearchOpen(false); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-900">
                      <entry.item.icon className="mt-0.5 h-4 w-4 text-blue-400" />
                      <span>
                        <span className="block text-sm font-semibold text-white">{entry.item.label}</span>
                        <span className="block text-xs text-slate-400">{entry.item.description}</span>
                      </span>
                    </button>
                  ) : (
                    <button key={`mobile-target-${entry.label}`} type="button" onClick={() => { setActiveTab(entry.moduleKey); setSearchOpen(false); }} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-900">
                      <Search className="mt-0.5 h-4 w-4 text-blue-400" />
                      <span>
                        <span className="block text-sm font-semibold text-white">{entry.label}</span>
                        <span className="block text-xs text-slate-400">Abrir módulo relacionado</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden min-h-[calc(100vh-73px)] w-[290px] shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="p-5">
            <button type="button" onClick={() => setActiveTab("dashboard")} className="flex w-full items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-left text-white shadow-sm">
              <Home className="h-5 w-5 text-blue-300" />
              <span>
                <span className="block text-sm font-bold">Início</span>
                <span className="block text-xs text-slate-400">Central de Trabalho do Dia</span>
              </span>
            </button>
            <div className="mt-4 grid gap-2">
              {sidebarModules.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${activeTab === key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 lg:hidden">
            <div className="h-full w-[290px] bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="mobile-sidebar-title">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-sm font-black text-slate-950">PROAR</div>
                  <div id="mobile-sidebar-title" className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Menu do sistema</div>
                </div>
                <button ref={mobileSidebarCloseRef} type="button" onClick={() => setSidebarOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-5">
                <div className="grid gap-2">
                  {sidebarModules.map(({ key, label, icon: Icon }) => (
                    <button key={key} type="button" onClick={() => { setActiveTab(key); setSidebarOpen(false); }} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${activeTab === key ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}>
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Área principal do módulo</div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{activeModule?.label || "ProAR"}</h2>
                <p className="mt-1 text-sm text-slate-600">{activeModule?.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">🔔 5 notificações</span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Perfil: {session.role}</span>
                <span className="inline-flex items-center rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"><Sparkles className="mr-1 h-3.5 w-3.5" /> IA assistiva</span>
              </div>
            </div>
          </div>
          {renderModuleContent()}
        </main>
      </div>
    </div>
  );
}
