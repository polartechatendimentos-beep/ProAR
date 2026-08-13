import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  HardHat,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Users,
  WalletCards,
  Wrench,
  Zap,
} from "lucide-react";
import "./site.css";

const modules = [
  { icon: Users, title: "Clientes e unidades", text: "Cadastre matriz, filiais, setores, equipamentos, responsáveis, histórico e análise de crédito em uma única ficha." },
  { icon: ClipboardCheck, title: "Ordens de serviço", text: "Controle abertura, agenda, técnicos, produtos, serviços, fotos antes/depois, assinaturas, relatórios e faturamento." },
  { icon: HardHat, title: "Gestão de obras", text: "Acompanhe obras, quadras, casas, etapas, fotos obrigatórias, pendências, perdas e evolução operacional em tempo real." },
  { icon: BriefcaseBusiness, title: "Vendas e orçamentos", text: "Gerencie propostas, aprovações, pedidos, vendas, conversões em OS e todo o histórico comercial do cliente." },
  { icon: PackageSearch, title: "Produtos e estoque", text: "Controle compras, entradas, saídas, reservas, inventário, estoque mínimo, custo, margem e histórico de consumo." },
  { icon: WalletCards, title: "Financeiro", text: "Contas a pagar e receber, fluxo de caixa, vencimentos, comissões, centros de custo e visão financeira por cliente." },
  { icon: ReceiptText, title: "Fiscal e NFS-e", text: "Estrutura preparada para emissão de nota fiscal de serviço integrada ao fluxo da ordem de serviço." },
  { icon: FileText, title: "Relatórios profissionais", text: "Relatórios com identidade da empresa, dados cadastrais, fotos, assinaturas, históricos e exportação para gestão." },
  { icon: BarChart3, title: "Indicadores gerenciais", text: "Dashboards operacionais, comerciais e financeiros para acompanhar o que precisa de atenção no dia a dia." },
];

const highlights = [
  "Sistema web responsivo para computador, tablet e celular",
  "Cada empresa com ambiente e banco de dados isolados",
  "Subdomínio exclusivo: nomefantasia.proar.online",
  "Sincronização entre aparelhos com controle de versão",
  "Cadastro automático por CNPJ",
  "Histórico e auditoria das principais alterações",
];

export default function ProARInstitutionalSite() {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <a className="brand" href="#inicio" aria-label="ProAR - início">
          <span className="brand-mark">P</span>
          <span><strong>ProAR</strong><small>Gestão de Serviços · BY TAV&apos;s</small></span>
        </a>
        <nav className="nav-links" aria-label="Navegação principal">
          <a href="#funcionalidades">Funcionalidades</a>
          <a href="#beneficios">Benefícios</a>
          <a href="#empresas">Para empresas</a>
          <a className="nav-login" href="https://teste.proar.online">Teste grátis</a>
        </nav>
      </header>

      <section id="inicio" className="hero-section">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-content">
          <span className="eyebrow"><Zap size={16} /> Gestão integrada para prestadores de serviços</span>
          <h1>Controle sua operação inteira em <span>um único sistema.</span></h1>
          <p className="hero-copy">O ProAR Gestão de Serviços — BY TAV&apos;s reúne operação, comercial e financeiro para sua empresa ganhar controle, produtividade e rastreabilidade no dia a dia.</p>
          <div className="hero-actions">
            <a className="primary-button" href="https://teste.proar.online">Testar grátis por 7 dias <ArrowRight size={18} /></a>
            <a className="secondary-button" href="#funcionalidades">Conhecer funcionalidades</a>
          </div>
          <div className="hero-trust">
            <span><CheckCircle2 size={17} /> Ambiente exclusivo por empresa</span>
            <span><CheckCircle2 size={17} /> Acesso web e mobile</span>
            <span><CheckCircle2 size={17} /> Dados organizados e rastreáveis</span>
          </div>
        </div>

        <div className="hero-dashboard" aria-label="Exemplo de painel do ProAR">
          <div className="dash-top"><span>Visão geral</span><span className="live-dot">● Online</span></div>
          <div className="dash-grid">
            <article><small>OS abertas</small><strong>38</strong><span>8 para hoje</span></article>
            <article><small>Orçamentos</small><strong>24</strong><span>R$ 68,4 mil</span></article>
            <article><small>A receber</small><strong>R$ 42,8k</strong><span>6 vencimentos</span></article>
            <article><small>Obras</small><strong>12</strong><span>74% execução</span></article>
          </div>
          <div className="activity-card">
            <div className="activity-title"><span>Operação de hoje</span><small>Atualizado agora</small></div>
            <div className="progress-line"><span style={{ width: "78%" }} /></div>
            <div className="activity-row"><span><Wrench size={16}/> Serviços em andamento</span><strong>17</strong></div>
            <div className="activity-row"><span><Building2 size={16}/> Equipes em campo</span><strong>6</strong></div>
            <div className="activity-row"><span><ShieldCheck size={16}/> Pendências críticas</span><strong>3</strong></div>
          </div>
        </div>
      </section>

      <section className="stats-strip" aria-label="Diferenciais do sistema">
        <div><strong>360°</strong><span>Visão da empresa</span></div>
        <div><strong>1</strong><span>Plataforma integrada</span></div>
        <div><strong>7 dias</strong><span>Teste gratuito</span></div>
        <div><strong>Multiempresa</strong><span>Ambientes isolados</span></div>
      </section>

      <section id="funcionalidades" className="section-shell modules-section">
        <div className="section-heading">
          <span className="eyebrow dark"><BarChart3 size={16}/> Plataforma completa</span>
          <h2>Do atendimento ao financeiro, tudo conectado.</h2>
          <p>O ProAR organiza os principais processos da empresa sem depender de planilhas separadas ou informações espalhadas em vários aplicativos.</p>
        </div>
        <div className="modules-grid">
          {modules.map(({ icon: Icon, title, text }) => (
            <article className="module-card" key={title}>
              <span className="module-icon"><Icon size={23}/></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="beneficios" className="feature-band">
        <div className="feature-panel">
          <div className="section-heading align-left">
            <span className="eyebrow light"><Smartphone size={16}/> Feito para a rotina real</span>
            <h2>Informação disponível onde sua equipe estiver.</h2>
            <p>Atendimento, escritório e campo trabalham sobre o mesmo ambiente, reduzindo retrabalho e divergências entre aparelhos.</p>
          </div>
          <div className="highlight-list">
            {highlights.map((item) => <span key={item}><CheckCircle2 size={19}/>{item}</span>)}
          </div>
        </div>
        <div className="phone-demo">
          <div className="phone-shell">
            <div className="phone-notch" />
            <div className="phone-header"><span className="mini-logo">P</span><span><b>ProAR</b><small>Serviços de hoje</small></span></div>
            <div className="phone-summary"><small>Em andamento</small><strong>8 OS</strong><span>3 equipes em campo</span></div>
            {["OS #1058 · Manutenção preventiva", "OS #1060 · Instalação", "OS #1062 · Higienização"].map((text, i) => (
              <div className="phone-item" key={text}><span className={`status-ball s${i}`}/><div><b>{text}</b><small>{i === 0 ? "Cliente Alpha · 09:00" : i === 1 ? "Obra Residencial · 10:30" : "Empresa Beta · 13:00"}</small></div></div>
            ))}
          </div>
        </div>
      </section>

      <section id="empresas" className="section-shell company-section">
        <div className="company-card">
          <div>
            <span className="eyebrow dark"><Building2 size={16}/> Seu ProAR, sua empresa</span>
            <h2>Um ambiente exclusivo para cada negócio.</h2>
            <p>Cada empresa pode operar em seu próprio endereço, com identidade visual, configurações, usuários e banco de dados isolados.</p>
            <div className="domain-example"><span>Exemplo</span><strong>suaempresa.proar.online</strong></div>
          </div>
          <div className="company-points">
            <span><ShieldCheck size={20}/><div><b>Dados isolados</b><small>Sem mistura de informações entre empresas.</small></div></span>
            <span><Building2 size={20}/><div><b>Identidade própria</b><small>Logo, dados e configurações carregados por empresa.</small></div></span>
            <span><Users size={20}/><div><b>Perfis e permissões</b><small>Controle de acesso conforme a função de cada usuário.</small></div></span>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <span className="eyebrow light"><Zap size={16}/> Comece agora</span>
        <h2>Experimente o ProAR na rotina da sua empresa.</h2>
        <p>Crie seu ambiente de demonstração e conheça os principais recursos do sistema durante 7 dias.</p>
        <a className="cta-button" href="https://teste.proar.online">Criar meu ambiente de teste <ArrowRight size={19}/></a>
      </section>

      <footer className="marketing-footer">
        <div className="footer-brand"><span className="brand-mark small">P</span><div><strong>ProAR Gestão de Serviços</strong><small>BY TAV&apos;s · Sistema de Gestão Operacional, Comercial e Financeira</small></div></div>
        <div className="footer-links"><a href="/termos">Termos de Uso</a><a href="/privacidade">Privacidade</a><a href="https://teste.proar.online">Teste grátis</a></div>
        <p>© 2026 TAV&apos;s. Todos os direitos reservados.</p>
      </footer>
    </main>
  );
}
