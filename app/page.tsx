"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Briefcase,
  Building2,
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
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
  Eye,
  EyeOff,
  CalendarDays,
  MessageCircle,
  Snowflake,
  X,
} from "lucide-react";

import type { UserSession } from "@/lib/proar-auth";
import { DailyWorkCenter } from "@/components/DailyWorkCenter";
import { ServiceOrdersSection } from "@/components/ServiceOrdersSection";
import { WorkOperationsPanel } from "@/components/WorkOperationsPanel";
import { OrcamentoPanel } from "@/components/OrcamentoPanel";
import { PdvBalcaoPanel } from "@/components/PdvBalcaoPanel";
import { FinanceiroPanel } from "@/components/FinanceiroPanel";
import { PublicContractsPanel } from "@/components/PublicContractsPanel";
import { TechnicalCompliancePanel } from "@/components/TechnicalCompliancePanel";

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

const MODULES: ModuleItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Indicadores operacionais, financeiros e próximos passos.", keywords: ["inicio", "dashboard", "painel", "indicadores"] },
  { key: "clientes", label: "Clientes", icon: Users, description: "Cadastros, contatos, histórico e documentos do cliente.", keywords: ["cliente", "cnpj", "cpf", "telefone", "documento"] },
  { key: "equipamentos", label: "Equipamentos", icon: Snowflake, description: "Patrimônio, série, garantia e vínculo com cliente ou obra.", keywords: ["equipamento", "serie", "patrimonio", "maquina", "condensadora"] },
  { key: "orcamento", label: "Orçamentos", icon: FileText, description: "Propostas comerciais, deslocamento e preço técnico.", keywords: ["orcamento", "proposta", "cotacao", "km"] },
  { key: "pdv", label: "PDV / Vendas", icon: ShoppingCart, description: "Pedidos, balcão, faturamento e conversão comercial.", keywords: ["pdv", "venda", "pedido", "caixa"] },
  { key: "os", label: "Ordens Serviço", icon: Wrench, description: "Abertura, despacho, execução, fotos e assinatura.", keywords: ["os", "ordem", "servico", "chamado"] },
  { key: "agenda", label: "Agenda", icon: CalendarDays, description: "Planejamento diário de equipes, visitas e manutenções.", keywords: ["agenda", "visita", "roteiro", "agendamento"] },
  { key: "obras", label: "Obras", icon: Building2, description: "Etapas, fiscalizações, casas/lotes e consumo em campo.", keywords: ["obra", "casa", "lote", "fiscalizacao", "projeto"] },
  { key: "pmoc", label: "PMOC", icon: ShieldCheck, description: "Conformidade, ART e registros técnicos obrigatórios.", keywords: ["pmoc", "art", "conformidade", "laudo"] },
  { key: "contratos", label: "Licitações", icon: Landmark, description: "Certames, PNCP, documentos oficiais e empenhos.", keywords: ["licitacao", "certame", "pncp", "empenho", "edital"] },
  { key: "estoque", label: "Estoque", icon: Package, description: "Entradas, saídas, inventário, custo e saldo disponível.", keywords: ["estoque", "produto", "saldo", "inventario"] },
  { key: "compras", label: "Compras", icon: Briefcase, description: "Fornecedores, pedidos, recebimento e reposição.", keywords: ["compra", "fornecedor", "pedido compra"] },
  { key: "financeiro", label: "Financeiro", icon: Wallet, description: "Contas, baixas, fluxo de caixa e inadimplência.", keywords: ["financeiro", "conta", "receber", "pagar", "fluxo caixa"] },
  { key: "fiscal", label: "Fiscal", icon: Receipt, description: "Notas, tributos, certificados e configuração fiscal.", keywords: ["fiscal", "nota fiscal", "nfs-e", "tributo"] },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, description: "Alertas, comunicações e automações com clientes.", keywords: ["whatsapp", "mensagem", "alerta"] },
  { key: "relatorios", label: "Relatórios", icon: FileBarChart2, description: "Visões gerenciais, auditoria e acompanhamento executivo.", keywords: ["relatorio", "indicador", "exportacao"] },
  { key: "configuracoes", label: "Configurações", icon: Settings, description: "Preferências, acessos, IA e parâmetros do sistema.", keywords: ["configuracao", "usuario", "perfil", "permissao"] },
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
];

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
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const quickMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const visibleModules = useMemo(() => getAllowedModules(session?.role), [session?.role]);

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
      if (searchBoxRef.current && !searchBoxRef.current.contains(target)) setSearchOpen(false);
      if (quickMenuRef.current && !quickMenuRef.current.contains(target)) setQuickCreateOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setUserMenuOpen(false);
    };

    document.addEventListener("mousedown", closeMenus);
    return () => document.removeEventListener("mousedown", closeMenus);
  }, []);

  const searchResults = useMemo(() => {
    const term = globalSearch.trim().toLowerCase();
    if (!term) return SEARCH_TARGETS.map((item) => ({ type: "target" as const, ...item })).slice(0, 5);

    const moduleResults = visibleModules
      .filter((item) => [item.label, item.description, ...item.keywords].some((value) => value.toLowerCase().includes(term)))
      .map((item) => ({ type: "module" as const, item }));

    const targetResults = SEARCH_TARGETS
      .filter((item) => [item.label, item.context, ...item.keywords].some((value) => value.toLowerCase().includes(term)))
      .map((item) => ({ type: "target" as const, ...item }));

    return [...moduleResults, ...targetResults].slice(0, 8);
  }, [globalSearch, visibleModules]);

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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Painel executivo ProAR</span>
                  <h1 className="mt-3 text-2xl font-black text-slate-950">Área principal do módulo</h1>
                  <p className="mt-2 max-w-3xl text-sm text-slate-600">Layout geral renovado com navegação lateral, busca global e ações rápidas sem apagar dados existentes.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Clientes ativos", "147"],
                    ["OS em aberto", "28"],
                    ["Obras em campo", "8"],
                    ["Pendências críticas", "5"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
                      <div className="mt-1 text-2xl font-black text-slate-950">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <DailyWorkCenter
              onNavigateTab={(tab) => setActiveTab(tab)}
              osCount={3}
              osAtrasadasCount={1}
              obrasCount={2}
              obrasGargaloCount={1}
              orcamentosPendentesCount={4}
              contasVencendoCount={2}
              empenhosFaturarCount={1}
            />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <WorkOperationsPanel />
              <PublicContractsPanel />
            </div>
          </div>
        );
      case "orcamento":
        return <OrcamentoPanel />;
      case "pdv":
        return <PdvBalcaoPanel />;
      case "os":
        return <ServiceOrdersSection />;
      case "obras":
        return <WorkOperationsPanel />;
      case "pmoc":
        return <TechnicalCompliancePanel />;
      case "contratos":
        return <PublicContractsPanel />;
      case "financeiro":
        return <FinanceiroPanel />;
      case "clientes":
        return <PlaceholderModule title="Clientes" description="Espaço preparado para busca global de cliente, CNPJ, CPF, telefone e documentos, preservando todos os cadastros já existentes." bullets={["Ficha única de cliente com histórico, crédito e documentos.", "Atalho para criar cliente, contato e unidade sem sair do fluxo.", "Resultados de busca preparados para abrir OS, vendas e equipamentos relacionados."]} />;
      case "equipamentos":
        return <PlaceholderModule title="Equipamentos" description="Módulo focado em patrimônio, número de série, local de instalação, garantia e vínculos com cliente, OS e obra." bullets={["Busca por patrimônio, série e etiqueta técnica.", "Visual compacto para desktop, tablet e celular.", "Sem alteração de registros ou remoção de dados existentes."]} />;
      case "agenda":
        return <PlaceholderModule title="Agenda" description="Visão compacta para programação diária, visitas técnicas, manutenções e deslocamentos da equipe." bullets={["Agenda por técnico, período e prioridade.", "Integração natural com OS, obras e PMOC.", "Pronta para receber filtros por unidade, rota e cliente."]} />;
      case "estoque":
        return <PlaceholderModule title="Estoque" description="Área dedicada a entradas, saídas, saldo mínimo e rastreabilidade dos itens já cadastrados no sistema." bullets={["Pesquisa por produto, SKU e localização.", "Resumo de saldo, custo e giro em visual executivo.", "Preservação total do histórico de estoque existente."]} />;
      case "compras":
        return <PlaceholderModule title="Compras" description="Painel para acompanhar fornecedores, pedidos de compra, aprovações e recebimentos sem impactar a base operacional existente." bullets={["Atalho rápido para nova compra e fornecedor.", "Integração prevista com estoque e financeiro.", "Resumo de pedidos aguardando aprovação e entrega."]} />;
      case "fiscal":
        return <PlaceholderModule title="Fiscal" description="Ambiente para certificados, notas, parâmetros fiscais e acompanhamento documental da empresa." bullets={["Atalhos para NFS-e, DF-e e certidões.", "Layout corporativo alinhado à identidade PolarTech/ProAR.", "Nenhum dado fiscal atual é removido por esta atualização visual."]} />;
      case "whatsapp":
        return <PlaceholderModule title="WhatsApp" description="Central de alertas e comunicação automatizada com clientes e equipe interna." bullets={["Avisos de licitações, OS e lembretes operacionais.", "Ativação rápida por perfil e contexto.", "Espaço pronto para templates e histórico de conversas."]} />;
      case "relatorios":
        return <PlaceholderModule title="Relatórios" description="Camada gerencial para acompanhar desempenho, auditoria e documentos exportáveis." bullets={["Relatórios por cliente, técnico, obra e período.", "Atalho para desempenho comercial e operacional.", "Layout compacto com foco em leitura rápida."]} />;
      case "configuracoes":
        return <PlaceholderModule title="Configurações" description="Configurações centrais do sistema, perfis, acessos e preferências operacionais." bullets={["Módulos habilitados conforme perfil do usuário logado.", "Atalhos para IA, fiscal, autenticação e parâmetros.", "Atualização visual sem exclusão de registros existentes."]} />;
      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white grid place-items-center">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 px-8 py-6 text-center shadow-2xl">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-blue-600/20 grid place-items-center text-blue-300"><LayoutDashboard className="h-6 w-6" /></div>
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

  const activeModule = visibleModules.find((item) => item.key === activeTab) || visibleModules[0];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white shadow-xl">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => setSidebarOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-slate-900 text-slate-200 lg:hidden" aria-label="Abrir menu lateral">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 shrink-0">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-lg font-black">P</div>
            <div>
              <div className="text-lg font-black tracking-tight">PROAR</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Layout Geral do Sistema</div>
            </div>
          </div>

          <div ref={searchBoxRef} className="relative mx-0 hidden flex-1 md:block lg:mx-6">
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
                    <button type="button" onClick={() => { setActiveTab("configuracoes"); setUserMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-900"><Settings className="h-4 w-4" /> Configurações</button>
                    <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-300 hover:bg-slate-900"><LogOut className="h-4 w-4" /> Sair</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 px-4 py-3 md:hidden">
          <div ref={searchBoxRef} className="relative">
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
                <span className="block text-xs text-slate-400">Visão geral do sistema</span>
              </span>
            </button>
            <div className="mt-4 grid gap-2">
              {visibleModules.map(({ key, label, icon: Icon }) => (
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
            <div className="h-full w-[290px] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <div className="text-sm font-black text-slate-950">PROAR</div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Menu do sistema</div>
                </div>
                <button type="button" onClick={() => setSidebarOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><X className="h-5 w-5" /></button>
              </div>
              <div className="p-5">
                <div className="grid gap-2">
                  {visibleModules.map(({ key, label, icon: Icon }) => (
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
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">ÁREA PRINCIPAL DO MÓDULO</div>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{activeModule?.label || "ProAR"}</h2>
                <p className="mt-1 text-sm text-slate-600">{activeModule?.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">🔔 5 notificações</span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Perfil: {session.role}</span>
              </div>
            </div>
          </div>
          {renderModuleContent()}
        </main>
      </div>
    </div>
  );
}
