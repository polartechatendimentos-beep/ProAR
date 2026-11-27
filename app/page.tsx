"use client";

import React, { useEffect, useState } from "react";
import { 
  Building2, Wrench, BookOpen, FileText, ShoppingCart, DollarSign, UsersRound, Menu, PanelLeftClose, LayoutDashboard, Sun, Moon,
  ShieldCheck, Landmark, Search, Bell, Settings, LogOut, CheckCircle2
} from "lucide-react";

import { DailyWorkCenter } from "@/components/DailyWorkCenter";
import { ServiceOrdersSection } from "@/components/ServiceOrdersSection";
import { WorkOperationsPanel } from "@/components/WorkOperationsPanel";
import { OrcamentoPanel } from "@/components/OrcamentoPanel";
import { PdvBalcaoPanel } from "@/components/PdvBalcaoPanel";
import { FinanceiroPanel } from "@/components/FinanceiroPanel";
import { PublicContractsPanel } from "@/components/PublicContractsPanel";
import { TechnicalCompliancePanel } from "@/components/TechnicalCompliancePanel";
import { TechnicalBasePanel } from "@/components/TechnicalBasePanel";
import { CustomerProfileWorkspace } from "@/components/CustomerProfileWorkspace";

type TabType = "dashboard" | "clientes" | "os" | "obras" | "orcamento" | "pdv" | "financeiro" | "contratos" | "pmoc" | "base-tecnica";

const validTabs: TabType[] = ["dashboard","clientes","os","obras","orcamento","pdv","financeiro","contratos","pmoc","base-tecnica"];
const tabLabels: Record<TabType,string> = { dashboard:"Central do Dia",clientes:"Clientes",os:"Ordens de Serviço",obras:"Obras",orcamento:"Orçamentos",pdv:"PDV",financeiro:"Financeiro",contratos:"Licitações",pmoc:"Conformidade e ART","base-tecnica":"Base Técnica" };

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [globalSearch, setGlobalSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [compact, setCompact] = useState(true);
  const [colorTheme, setColorTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try { if (window.localStorage.getItem("proar:color-theme") === "dark") setColorTheme("dark"); } catch { /* storage unavailable */ }
  }, []);
  function changeColorTheme(next: "light" | "dark") {
    setColorTheme(next);
    try { window.localStorage.setItem("proar:color-theme", next); } catch { /* storage unavailable */ }
  }
  const [appHealth, setAppHealth] = useState<"checking" | "running" | "unavailable">("checking");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("health"); return r.json(); })
      .then((data) => setAppHealth(data.status === "running" ? "running" : "unavailable"))
      .catch(() => { if (!controller.signal.aborted) setAppHealth("unavailable"); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const syncFromUrl = () => {
      const requested = new URLSearchParams(window.location.search).get("tab");
      setActiveTab(requested && validTabs.includes(requested as TabType) ? requested as TabType : "dashboard");
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);
  function navigateTab(tab: TabType) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    const url = new URL(window.location.href);
    if (tab === "dashboard") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
  }

  return (
    <div data-proar-theme={colorTheme} className="proar-app min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <a href="#conteudo-principal" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Pular para o conteúdo</a>
      {/* Top Header Corporativo ProAR */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 rounded-lg hover:bg-slate-800" aria-label="Abrir ou fechar menu" aria-expanded={mobileMenuOpen}><Menu className="h-5 w-5" /></button>
          {/* Logo & Identidade */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-black text-xl tracking-tighter shadow">
              P
            </div>
            <div>
              <span className="font-black text-lg tracking-tight block leading-tight text-white">
                ProAR <span className="text-blue-400 font-normal text-xs ml-1">ENGENHARIA</span>
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                MATRIZ MIRASSOL/SP • PMOC CREA-SP
              </span>
            </div>
          </div>

          {/* Barra de Busca Global */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Busca global: cliente, OS, CNPJ, série, obra, certame..."
                className="w-full bg-slate-800/80 text-white placeholder-slate-400 text-xs pl-10 pr-4 py-2 rounded-xl border border-slate-700 outline-none focus:border-blue-500 transition font-medium"
              />
            </div>
          </div>

          <button type="button" onClick={() => changeColorTheme(colorTheme === "dark" ? "light" : "dark")} aria-label={colorTheme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"} title={colorTheme === "dark" ? "Tema claro" : "Tema escuro"} className="rounded-lg border border-slate-700 p-2 hover:bg-slate-800">{colorTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          {/* Perfil & Ações Rápidas */}
          <div className="flex items-center gap-3 shrink-0 text-xs">
            <div className="hidden sm:block text-right">
              <span className="font-bold text-white block">Administrador Matriz</span>
              <span className="text-[10px] text-emerald-400 font-mono">{appHealth === "running" ? "Aplicação acessível • Banco não verificado" : appHealth === "checking" ? "Verificando aplicação..." : "Aplicação sem confirmação"}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500 flex items-center justify-center font-bold text-blue-300">
              AD
            </div>
          </div>
        </div>

      </header>

      <div className="flex min-h-0 flex-1">
        <aside aria-label="Menu principal do ProAR" className={`${mobileMenuOpen ? "block" : "hidden"} md:block shrink-0 bg-slate-900 text-white border-r border-slate-800 ${sidebarOpen ? "w-56" : "w-16"} transition-all`}>
          <div className="sticky top-16 p-2 space-y-1">
            <button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="hidden md:flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-300 hover:bg-slate-800" aria-label={sidebarOpen ? "Recolher menu" : "Expandir menu"}><PanelLeftClose className="h-4 w-4" />{sidebarOpen && "Recolher menu"}</button>
            <button type="button" title="Painel Inicial" aria-current={activeTab === "dashboard" ? "page" : undefined} onClick={() => navigateTab("dashboard")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "dashboard" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><LayoutDashboard className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Painel Inicial</span>}</button>
<button type="button" title="Clientes" aria-current={activeTab === "clientes" ? "page" : undefined} onClick={() => navigateTab("clientes")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "clientes" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><UsersRound className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Clientes</span>}</button>
<button type="button" title="Ordens de Serviço" aria-current={activeTab === "os" ? "page" : undefined} onClick={() => navigateTab("os")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "os" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><Wrench className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Ordens de Serviço</span>}</button>
<button type="button" title="Obras" aria-current={activeTab === "obras" ? "page" : undefined} onClick={() => navigateTab("obras")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "obras" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><Building2 className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Obras</span>}</button>
<button type="button" title="Orçamentos" aria-current={activeTab === "orcamento" ? "page" : undefined} onClick={() => navigateTab("orcamento")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "orcamento" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><FileText className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Orçamentos</span>}</button>
<button type="button" title="PDV" aria-current={activeTab === "pdv" ? "page" : undefined} onClick={() => navigateTab("pdv")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "pdv" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><ShoppingCart className="h-4 w-4 shrink-0" />{sidebarOpen && <span>PDV</span>}</button>
<button type="button" title="Financeiro" aria-current={activeTab === "financeiro" ? "page" : undefined} onClick={() => navigateTab("financeiro")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "financeiro" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><DollarSign className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Financeiro</span>}</button>
<button type="button" title="Licitações" aria-current={activeTab === "contratos" ? "page" : undefined} onClick={() => navigateTab("contratos")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "contratos" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><Landmark className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Licitações</span>}</button>
<button type="button" title="Conformidade & ART" aria-current={activeTab === "pmoc" ? "page" : undefined} onClick={() => navigateTab("pmoc")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "pmoc" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><ShieldCheck className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Conformidade & ART</span>}</button>
<button type="button" title="Base Técnica" aria-current={activeTab === "base-tecnica" ? "page" : undefined} onClick={() => navigateTab("base-tecnica")} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${activeTab === "base-tecnica" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><BookOpen className="h-4 w-4 shrink-0" />{sidebarOpen && <span>Base Técnica</span>}</button>
          </div>
        </aside>
      {/* Main Container */}
      <main id="conteudo-principal" data-density={compact ? "compact" : "comfortable"} className="min-w-0 mx-auto px-3 sm:px-5 lg:px-6 py-4 flex-1 w-full space-y-4">
        <div className="flex items-center justify-between gap-3"><p aria-live="polite" className="text-xs font-semibold text-slate-500">ProAR completo / <span className="text-slate-900">{tabLabels[activeTab]}</span></p><div className="flex items-center gap-2"><button type="button" onClick={() => setCompact(!compact)} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600" aria-pressed={compact}>{compact ? "Modo compacto" : "Modo confortável"}</button><span className="hidden sm:inline rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600">Ambiente completo</span></div></div>
        {/* Visualização de Dashboard / Cockpit do Dia */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">Indicadores do painel em modo demonstrativo: os números abaixo ainda não foram conectados a consultas verificadas do banco real.</p>
            <DailyWorkCenter
              onNavigateTab={(t) => { if(validTabs.includes(t as TabType)) navigateTab(t as TabType); }}
              osCount={3}
              osAtrasadasCount={1}
              obrasCount={2}
              obrasGargaloCount={1}
              orcamentosPendentesCount={4}
              contasVencendoCount={2}
              empenhosFaturarCount={1}
            />

            {/* Painéis operacionais em destaque */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WorkOperationsPanel />
              <PublicContractsPanel />
            </div>

            <ServiceOrdersSection />
          </div>
        )}

        {/* Abas Específicas */}
        {activeTab === "os" && <ServiceOrdersSection />}
        {activeTab === "clientes" && <CustomerProfileWorkspace />}
        {activeTab === "obras" && <WorkOperationsPanel />}
        {activeTab === "orcamento" && <OrcamentoPanel />}
        {activeTab === "pdv" && <PdvBalcaoPanel />}
        {activeTab === "financeiro" && <FinanceiroPanel />}
        {activeTab === "contratos" && <PublicContractsPanel />}
        {activeTab === "pmoc" && <TechnicalCompliancePanel />}
        {activeTab === "base-tecnica" && <TechnicalBasePanel />}
      </main>
      </div>

      {/* Rodapé Institucional */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">
          © 2026 ProAR Climatização & Engenharia Térmica LTDA • Todos os direitos reservados
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Matriz: Mirassol/SP • Atendimento e Obras em todo o Estado de São Paulo • Em conformidade com ABNT e Lei Federal 13.589/2018 (PMOC)
        </p>
      </footer>
    </div>
  );
}
