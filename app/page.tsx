"use client";

import { useState, type ComponentType } from "react";
import { Building2, FileText, Gauge, Landmark, Menu, Package, Search, ShieldCheck, ShoppingCart, UsersRound, WalletCards, Wrench, X } from "lucide-react";
import { DailyWorkCenter } from "@/components/DailyWorkCenter";
import { ServiceOrdersSection } from "@/components/ServiceOrdersSection";
import { WorkOperationsPanel } from "@/components/WorkOperationsPanel";
import { OrcamentoPanel } from "@/components/OrcamentoPanel";
import { PdvBalcaoPanel } from "@/components/PdvBalcaoPanel";
import { FinanceiroPanel } from "@/components/FinanceiroPanel";
import { PublicContractsPanel } from "@/components/PublicContractsPanel";
import { TechnicalCompliancePanel } from "@/components/TechnicalCompliancePanel";
import { CustomerProfileWorkspace } from "@/components/CustomerProfileWorkspace";
import { ProductCatalogPanel } from "@/components/ProductCatalogPanel";

type TabType = "dashboard" | "clientes" | "produtos" | "os" | "obras" | "orcamento" | "pdv" | "financeiro" | "contratos" | "pmoc";
type NavItem = { id: TabType; label: string; detail: string; icon: ComponentType<{ className?: string }> };

const navigation: NavItem[] = [
  { id: "dashboard", label: "Dashboard", detail: "Central operacional", icon: Gauge },
  { id: "clientes", label: "Clientes", detail: "Cadastros e unidades", icon: UsersRound },
  { id: "produtos", label: "Produtos", detail: "Catálogo HVAC", icon: Package },
  { id: "os", label: "O.S.", detail: "Ordens de serviço", icon: Wrench },
  { id: "obras", label: "Obras", detail: "Quadras e casas", icon: Building2 },
  { id: "orcamento", label: "Orçamentos", detail: "Propostas e margem", icon: FileText },
  { id: "pdv", label: "PDV", detail: "Vendas de balcão", icon: ShoppingCart },
  { id: "financeiro", label: "Financeiro", detail: "Contas e baixas", icon: WalletCards },
  { id: "contratos", label: "Licitações", detail: "Radar e processos", icon: Landmark },
  { id: "pmoc", label: "PMOC", detail: "Laudos e conformidade", icon: ShieldCheck },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [globalSearch, setGlobalSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const current = navigation.find(item => item.id === activeTab) || navigation[0];

  const navigate = (tab: TabType) => { setActiveTab(tab); setSidebarOpen(false); };

  return <div className="proar-shell">
    <button aria-label="Fechar menu" className={`proar-overlay ${sidebarOpen ? "open" : ""}`} onClick={()=>setSidebarOpen(false)}/>
    <aside className={`proar-sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Navegação principal">
      <button className="proar-brand" onClick={()=>navigate("dashboard")} aria-label="Ir para o Dashboard"><span className="proar-brand-mark">P</span></button>
      <nav className="proar-nav">
        {navigation.map(item => { const Icon = item.icon; return <button key={item.id} className={activeTab === item.id ? "active" : ""} onClick={()=>navigate(item.id)} aria-current={activeTab === item.id ? "page" : undefined}><Icon className="size-5"/><span>{item.label}</span></button>; })}
      </nav>
      <div className="proar-sidebar-foot">PROAR 3.0<br/>POLARTECH</div>
    </aside>

    <div className="proar-main">
      <header className="proar-topbar">
        <button className="proar-mobile-toggle" onClick={()=>setSidebarOpen(value=>!value)} aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}>{sidebarOpen ? <X className="size-5"/> : <Menu className="size-5"/>}</button>
        <div className="proar-page-identity"><strong>{current.label}</strong><span>{current.detail}</span></div>
        <label className="proar-search"><span className="sr-only">Busca global</span><Search/><input value={globalSearch} onChange={event=>setGlobalSearch(event.target.value)} placeholder="Buscar cliente, OS, CNPJ, obra, produto ou certame..."/></label>
        <div className="proar-user"><div className="proar-user-copy"><b>Administrador Matriz</b><span>● Operando online</span></div><div className="proar-avatar">AD</div></div>
      </header>

      <main className="proar-canvas">
        {activeTab === "dashboard" && <div className="space-y-6"><DailyWorkCenter onNavigateTab={navigate} osCount={3} osAtrasadasCount={1} obrasCount={2} obrasGargaloCount={1} orcamentosPendentesCount={4} contasVencendoCount={2} empenhosFaturarCount={1}/><div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><WorkOperationsPanel/><PublicContractsPanel/></div><ServiceOrdersSection/></div>}
        {activeTab === "clientes" && <CustomerProfileWorkspace/>}
        {activeTab === "produtos" && <ProductCatalogPanel/>}
        {activeTab === "os" && <ServiceOrdersSection/>}
        {activeTab === "obras" && <WorkOperationsPanel/>}
        {activeTab === "orcamento" && <OrcamentoPanel/>}
        {activeTab === "pdv" && <PdvBalcaoPanel/>}
        {activeTab === "financeiro" && <FinanceiroPanel/>}
        {activeTab === "contratos" && <PublicContractsPanel/>}
        {activeTab === "pmoc" && <TechnicalCompliancePanel/>}
      </main>

      <footer className="proar-footer">© 2026 ProAR · Gestão operacional, comercial e financeira</footer>
    </div>
  </div>;
}
