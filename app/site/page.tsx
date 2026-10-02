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
  Clock3,
  Database,
  LockKeyhole,
  Headphones,
  Workflow,
} from "lucide-react";
import "./site.css";

const modules = [
  { icon: Users, title: "Clientes e equipamentos", text: "Cadastro completo, histórico, unidades, equipamentos, responsáveis, documentos e vínculos por cliente." },
  { icon: ClipboardCheck, title: "Ordens de serviço", text: "Agenda, técnicos, checklists, fotos, assinatura, materiais, serviços executados, relatórios e faturamento." },
  { icon: HardHat, title: "Gestão de obras", text: "Obras, quadras, casas, etapas, equipes, fotos, pendências, perdas, medições e acompanhamento da execução." },
  { icon: BriefcaseBusiness, title: "CRM, vendas e orçamentos", text: "Propostas, aprovações, funil comercial, conversão em venda ou OS e histórico do relacionamento com o cliente." },
  { icon: PackageSearch, title: "Compras e estoque", text: "Solicitações, compras, entradas, saídas, reservas, inventário, estoque mínimo, custos e rastreabilidade de materiais." },
  { icon: WalletCards, title: "Financeiro", text: "Contas a pagar e receber, caixa, vencimentos, conciliação, centros de custo, margem e vínculo com a operação." },
  { icon: ReceiptText, title: "Fiscal", text: "Central fiscal preparada para NFS-e, NF-e e NFC-e, validações, XML, DANFE/DANFSe e tratamento de rejeições." },
  { icon: BarChart3, title: "Indicadores e integridade", text: "Dashboards, Central de Pendências, Test Lab, saúde do sistema, auditoria e códigos de erro padronizados." },
  { icon: FileText, title: "Relatórios profissionais", text: "Relatórios, laudos, PMOC, fotos, assinaturas e documentos com identidade da empresa." },
];

const segments = [
  "Climatização e HVAC",
  "Manutenção técnica",
  "Construção e obras",
  "Prestadores de serviços",
  "Comércio e assistência técnica",
  "Operações com equipes externas",
];

const steps = [
  ["1", "Cadastre sua empresa", "Informe os dados básicos da empresa e do responsável pelo ambiente."],
  ["2", "O ProAR cria seu ambiente", "Sua empresa recebe endereço próprio e estrutura separada dos demais clientes."],
  ["3", "Teste por 30 dias", "Use os módulos na operação, com dados de demonstração opcionais e acesso pelo computador ou celular."],
  ["4", "Continue no plano ideal", "Ao final do período, a equipe ProAR pode converter o ambiente para o plano contratado sem recriar seu cadastro."],
];

const plans = [
  { name:"Essencial", text:"Para empresas que querem organizar atendimento, clientes, OS, produtos, estoque e operação.", featured:false },
  { name:"Profissional", text:"Para operações que precisam também de financeiro, fiscal, obras, integridade, aprovações e diagnósticos.", featured:true },
  { name:"Enterprise", text:"Para estruturas maiores, com módulos avançados, licitações, maior capacidade e configuração comercial personalizada.", featured:false },
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
          <a href="#como-funciona">Como funciona</a>
          <a href="#planos">Planos</a>
          <a href="#seguranca">Segurança</a>
          <a className="nav-login" href="https://teste.proar.online">Teste grátis por 30 dias</a>
        </nav>
      </header>

      <section id="inicio" className="hero-section">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-content">
          <span className="eyebrow"><Zap size={16} /> Plataforma de gestão para empresas de serviços</span>
          <h1>Da primeira oportunidade ao financeiro, <span>tudo conectado.</span></h1>
          <p className="hero-copy">O ProAR reúne clientes, equipamentos, CRM, orçamentos, vendas, ordens de serviço, obras, estoque, compras, financeiro, fiscal e gestão técnica em uma única plataforma.</p>
          <div className="hero-actions">
            <a className="primary-button" href="https://teste.proar.online">Criar teste grátis por 30 dias <ArrowRight size={18} /></a>
            <a className="secondary-button" href="#funcionalidades">Ver portfólio do sistema</a>
          </div>
          <div className="hero-trust">
            <span><CheckCircle2 size={17} /> Ambiente exclusivo por empresa</span>
            <span><CheckCircle2 size={17} /> Instalação como aplicativo</span>
            <span><CheckCircle2 size={17} /> Acesso web, computador e celular</span>
          </div>
        </div>

        <div className="hero-dashboard" aria-label="Exemplo de painel do ProAR">
          <div className="dash-top"><span>Painel gerencial</span><span className="live-dot">● Online</span></div>
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
        <div><strong>30 dias</strong><span>Teste gratuito</span></div>
        <div><strong>360°</strong><span>Visão da empresa</span></div>
        <div><strong>1</strong><span>Plataforma integrada</span></div>
        <div><strong>Multiempresa</strong><span>Ambientes isolados</span></div>
      </section>

      <section id="funcionalidades" className="section-shell modules-section">
        <div className="section-heading">
          <span className="eyebrow dark"><BarChart3 size={16}/> Portfólio ProAR</span>
          <h2>Uma plataforma completa para administrar a operação inteira.</h2>
          <p>Os módulos compartilham o mesmo fluxo de dados para reduzir retrabalho, duplicidade de cadastro e informações perdidas entre setores.</p>
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

      <section id="como-funciona" className="section-shell trial-journey">
        <div className="section-heading">
          <span className="eyebrow dark"><Clock3 size={16}/> Teste sem complicação</span>
          <h2>Crie sua empresa e use o ProAR por 30 dias.</h2>
          <p>O cadastro é feito online e o ambiente é criado para sua empresa. Depois, o ProAR pode ser instalado como aplicativo compatível no dispositivo.</p>
        </div>
        <div className="journey-grid">
          {steps.map(([number,title,text])=><article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
        <div className="journey-cta">
          <a className="primary-button blue" href="https://teste.proar.online">Cadastrar minha empresa <ArrowRight size={18}/></a>
          <small>O período de 30 dias é controlado pelo servidor e vinculado ao cadastro da empresa.</small>
        </div>
      </section>

      <section id="beneficios" className="feature-band">
        <div className="feature-panel">
          <div className="section-heading align-left">
            <span className="eyebrow light"><Smartphone size={16}/> Feito para a rotina real</span>
            <h2>Escritório e equipe de campo trabalhando no mesmo sistema.</h2>
            <p>Atendimento, comercial, técnicos, compras, estoque, financeiro e gestão acompanham a mesma operação, com permissões por perfil.</p>
          </div>
          <div className="highlight-list">
            <span><CheckCircle2 size={19}/> Sistema responsivo para computador, tablet e celular</span>
            <span><CheckCircle2 size={19}/> Instalação como PWA quando suportado pelo navegador</span>
            <span><CheckCircle2 size={19}/> Subdomínio exclusivo por empresa</span>
            <span><CheckCircle2 size={19}/> Central de Pendências e fluxos automáticos</span>
            <span><CheckCircle2 size={19}/> Auditoria das alterações importantes</span>
            <span><CheckCircle2 size={19}/> Test Lab e monitoramento de integridade</span>
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

      <section className="section-shell segments-section">
        <div className="section-heading">
          <span className="eyebrow dark"><Building2 size={16}/> Para quem é o ProAR</span>
          <h2>Projetado para empresas que vivem de operação e atendimento.</h2>
        </div>
        <div className="segment-grid">{segments.map(item=><span key={item}><CheckCircle2 size={18}/>{item}</span>)}</div>
      </section>

      <section id="seguranca" className="section-shell company-section">
        <div className="company-card">
          <div>
            <span className="eyebrow dark"><ShieldCheck size={16}/> Arquitetura multiempresa</span>
            <h2>Seu ProAR, sua empresa, seu ambiente.</h2>
            <p>Cada cliente possui identificação própria, domínio exclusivo e resolução de banco separada. O ProAR Manager controla licença, provisionamento, saúde e bloqueio do ambiente.</p>
            <div className="domain-example"><span>Exemplo</span><strong>suaempresa.proar.online</strong></div>
          </div>
          <div className="company-points">
            <span><Database size={20}/><div><b>Banco por tenant</b><small>Estrutura preparada para isolamento dos dados de cada cliente.</small></div></span>
            <span><LockKeyhole size={20}/><div><b>Perfis e permissões</b><small>Acesso definido pela função de cada usuário.</small></div></span>
            <span><Workflow size={20}/><div><b>Auditoria e integridade</b><small>Rastreabilidade, Test Lab e health checks do sistema.</small></div></span>
          </div>
        </div>
      </section>

      <section id="planos" className="section-shell plans-section">
        <div className="section-heading">
          <span className="eyebrow dark"><BriefcaseBusiness size={16}/> Planos ProAR</span>
          <h2>Comece no plano adequado à sua operação.</h2>
          <p>O teste de 30 dias permite conhecer a plataforma antes da definição comercial definitiva.</p>
        </div>
        <div className="plans-grid">{plans.map(plan=><article key={plan.name} className={plan.featured?"featured":""}>{plan.featured&&<span className="plan-badge">Mais completo para operação</span>}<h3>{plan.name}</h3><p>{plan.text}</p><a href="https://teste.proar.online">Testar por 30 dias <ArrowRight size={16}/></a></article>)}</div>
      </section>

      <section className="support-strip">
        <Headphones size={24}/>
        <div><b>Implantação e suporte ProAR</b><span>O cliente conta com a equipe ProAR para ativação, configuração do ambiente e continuidade após o período de teste.</span></div>
      </section>

      <section className="cta-section">
        <span className="eyebrow light"><Zap size={16}/> Comece agora</span>
        <h2>30 dias para colocar o ProAR na rotina da sua empresa.</h2>
        <p>Cadastre sua empresa, receba seu ambiente e teste os principais recursos antes de contratar.</p>
        <a className="cta-button" href="https://teste.proar.online">Criar meu teste gratuito de 30 dias <ArrowRight size={19}/></a>
      </section>

      <footer className="marketing-footer">
        <div className="footer-brand"><span className="brand-mark small">P</span><div><strong>ProAR Gestão de Serviços</strong><small>BY TAV&apos;s · Sistema de Gestão Operacional, Comercial e Financeira</small></div></div>
        <div className="footer-links"><a href="/termos">Termos de Uso</a><a href="/privacidade">Privacidade</a><a href="https://teste.proar.online">Teste de 30 dias</a></div>
        <p>© 2026 TAV&apos;s. Todos os direitos reservados.</p>
      </footer>
    </main>
  );
}
