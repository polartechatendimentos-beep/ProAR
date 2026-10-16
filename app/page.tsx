"use client";

import React, { useEffect, useState } from "react";
import { 
  Building2, Wrench, BookOpen, FileText, ShoppingCart, DollarSign, UsersRound,
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
    const url = new URL(window.location.href);
    if (tab === "dashboard") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col">
      <a href="#conteudo-principal" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Pular para o conteúdo</a>
      {/* Top Header Corporativo ProAR */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
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

          {/* Perfil & Ações Rápidas */}
          <div className="flex items-center gap-3 shrink-0 text-xs">
            <div className="hidden sm:block text-right">
              <span className="font-bold text-white block">Administrador Matriz</span>
              <span className="text-[10px] text-emerald-400 font-mono">Operando Online</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500 flex items-center justify-center font-bold text-blue-300">
              AD
            </div>
          </div>
        </div>

        {/* Barra de Navegação de Módulos Operacionais */}
        <nav aria-label="Módulos do ProAR completo" className="bg-slate-950/90 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8 overflow-x-auto">
          <div className="max-w-7xl mx-auto flex items-center gap-1 py-1.5 min-w-max">
            <button
              onClick={() => navigateTab("clientes")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "clientes" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <UsersRound className="w-3.5 h-3.5" /> Clientes
            </button>
            <button
              onClick={() => navigateTab("dashboard")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "dashboard" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              Central do Dia
            </button>
            <button
              onClick={() => navigateTab("os")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "os" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" /> Ordens de Serviço (PMOC)
            </button>
            <button
              onClick={() => navigateTab("obras")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "obras" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> Obras (8 Etapas)
            </button>
            <button
              onClick={() => navigateTab("orcamento")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "orcamento" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Orçamentos & KM
            </button>
            <button
              onClick={() => navigateTab("pdv")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "pdv" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" /> PDV Balcão [F1-F12]
            </button>
            <button
              onClick={() => navigateTab("financeiro")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "financeiro" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" /> Financeiro / Baixa Parcial
            </button>
            <button
              onClick={() => navigateTab("contratos")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "contratos" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" /> Licitações IA + Bid Agent
            </button>
            <button onClick={() => navigateTab("base-tecnica")} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === "base-tecnica" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900"}`}><BookOpen className="w-3.5 h-3.5" /> Base Técnica</button>
            <button
              onClick={() => navigateTab("pmoc")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "pmoc" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white hover:bg-slate-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Conformidade & ART
            </button>
          </div>
        </nav>
      </header>

      {/* Main Container */}
      <main id="conteudo-principal" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        <div className="flex items-center justify-between gap-3"><p aria-live="polite" className="text-xs font-semibold text-slate-500">ProAR completo / <span className="text-slate-900">{tabLabels[activeTab]}</span></p><span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600">Ambiente completo</span></div>
        {/* Visualização de Dashboard / Cockpit do Dia */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
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
