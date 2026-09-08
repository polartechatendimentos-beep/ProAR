"use client";

import React, { useState, useEffect, use } from "react";
import { 
  Building2, MapPin, Calendar, Clock, CheckCircle2, AlertTriangle, 
  FileText, Printer, ShieldCheck, Lock, Unlock, Plus, Camera, 
  Check, RotateCcw, AlertCircle, Eye, ChevronRight, X, User
} from "lucide-react";

interface Work {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  clienteNome: string;
  endereco: string;
  cidade: string;
  progresso: number;
  status: string;
  engenheiroResponsavel: string;
  equipe: string;
  dataInicio: string;
  previsaoTermino: string;
  valorContrato?: string;
  senhaApontamentos?: string;
}

interface FindingItem {
  id: number;
  quadra: string;
  casa: string;
  ambiente: string;
  etapaRelacionada: string;
  titulo: string;
  descricao: string;
  tipo: string;
  prioridade: string;
  situacao: "pendente" | "em_analise" | "em_correcao" | "aguardando_conferencia" | "aprovada" | "cancelada";
  registradoPor: string;
  funcaoRegistrador: string;
  fotos?: string[];
  observacaoPolartech?: string;
  fotosCorrecao?: string[];
  responsavelCorrecao?: string;
  dataCorrecao?: string;
  aprovadoPor?: string;
  dataAprovacao?: string;
  motivoReprovacao?: string;
  historico?: Array<{
    data: string;
    autor: string;
    funcao: string;
    acao: string;
    descricao?: string;
    observacao?: string;
    motivo?: string;
    situacao?: string;
  }>;
  criadoEm: string;
}

// Cores e rótulos oficiais da situação da fiscalização (separados do status da PolarTech)
const SITUACAO_LABELS: Record<string, { label: string; badge: string; icon: string }> = {
  pendente: { label: "Pendência aberta", badge: "bg-rose-100 text-rose-800 border-rose-300", icon: "🔴" },
  em_analise: { label: "Em análise", badge: "bg-amber-100 text-amber-800 border-amber-300", icon: "🟠" },
  em_correcao: { label: "Correção em andamento", badge: "bg-blue-100 text-blue-800 border-blue-300", icon: "🔵" },
  aguardando_conferencia: { label: "Aguardando conferência", badge: "bg-purple-100 text-purple-800 border-purple-300", icon: "🟣" },
  aprovada: { label: "Aprovada / Resolvida", badge: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "🟢" },
  cancelada: { label: "Cancelada", badge: "bg-slate-100 text-slate-700 border-slate-300", icon: "⚪" },
};

// 8 Status Oficiais da Execução PolarTech
const POLARTECH_ETAPAS = [
  "Início de Obra",
  "Ag. Frigorígena",
  "Ag. Acabamento",
  "Ag. Tubulação Forçada",
  "Ag. Acabamento Exaustão",
  "Ag. Exaustor",
  "Ag. Tampa Frigorígena",
  "Serviço Concluído",
];

export default function PublicWorkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [work, setWork] = useState<Work | null>(null);
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [housePendencies, setHousePendencies] = useState<Record<string, { count: number; worstStatus: string }>>({});
  const [loading, setLoading] = useState(true);

  // Autenticação Externa da Engenharia / Fiscalização
  const [isAuthExterno, setIsAuthExterno] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [inputSenha, setInputSenha] = useState("");
  const [authError, setAuthError] = useState("");

  // Modal Novo Apontamento
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [tipoApontamento, setTipoApontamento] = useState("Não conformidade");
  const [quadra, setQuadra] = useState("Quadra 03");
  const [casa, setCasa] = useState("Casa 17");
  const [ambiente, setAmbiente] = useState("Quarto Frente");
  const [etapaRelacionada, setEtapaRelacionada] = useState("Rede Frigorígena");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [nomeRegistrador, setNomeRegistrador] = useState("");
  const [funcaoRegistrador, setFuncaoRegistrador] = useState("Fiscalização");
  const [submitting, setSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState("");

  // Modal de Reprovação com Justificativa
  const [reprovandoId, setReprovandoId] = useState<number | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [fiscalNome, setFiscalNome] = useState("Eng. Fiscal Responsável");

  // Quadras da Obra (visão física)
  const quadrasDemo = [
    {
      nome: "QUADRA 03",
      progresso: 85,
      totalCasas: 22,
      casasConcluidas: 18,
      casasEmExecucao: 4,
      casas: [
        { numero: "Casa 15", statusPolartech: "Serviço Concluído", pendenciasCount: 0 },
        { numero: "Casa 16", statusPolartech: "Ag. Tampa Frigorígena", pendenciasCount: 0 },
        { numero: "Casa 17", statusPolartech: "Ag. Acabamento", pendenciasCount: 1, worstStatus: "pendente" },
        { numero: "Casa 18", statusPolartech: "Ag. Frigorígena", pendenciasCount: 0 },
      ],
    },
    {
      nome: "QUADRA 04",
      progresso: 64,
      totalCasas: 19,
      casasConcluidas: 12,
      casasEmExecucao: 7,
      casas: [
        { numero: "Casa 20", statusPolartech: "Ag. Tubulação Forçada", pendenciasCount: 0 },
        { numero: "Casa 21", statusPolartech: "Ag. Tubulação Forçada", pendenciasCount: 1, worstStatus: "aguardando_conferencia" },
        { numero: "Casa 22", statusPolartech: "Ag. Frigorígena", pendenciasCount: 0 },
      ],
    },
  ];

  const loadData = async () => {
    try {
      const res = await fetch(`/api/work-findings?token=${token}`);
      const json = await res.json();
      if (json.success) {
        setFindings(json.data);
        if (json.housePendencies) {
          setHousePendencies(json.housePendencies);
        }
      }

      setWork({
        id: 1,
        codigo: "OBR-2026-042",
        nome: "Retrofit e Climatização VRF - Bloco Hospitalar & Laboratórios",
        descricao: "Substituição de evaporadoras antigas por unidades cassete de alta eficiência ecológica R410A com plano PMOC integrado.",
        clienteNome: "Secretaria de Saúde / Hospital Regional",
        endereco: "Av. Philadelpho Manoel Gouveia Neto, 1850",
        cidade: "São José do Rio Preto",
        progresso: 68,
        status: "em_andamento",
        engenheiroResponsavel: "Eng. Mecânico Responsável (CREA-SP Ativo)",
        equipe: "TEAM 11 ProAR Climatização",
        dataInicio: "2026-08-10",
        previsaoTermino: "2026-09-30",
        valorContrato: "185.000,00",
        senhaApontamentos: "123456",
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Recupera autenticação de sessão se já logado nesta obra
    const saved = sessionStorage.getItem(`proar_auth_obra_${token}`);
    if (saved === "true") {
      setIsAuthExterno(true);
    }
  }, [token]);

  const handleLoginExterno = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      const res = await fetch("/api/work-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, senha: inputSenha }),
      });
      const json = await res.json();
      if (json.success && json.authorized) {
        setIsAuthExterno(true);
        sessionStorage.setItem(`proar_auth_obra_${token}`, "true");
        setShowAuthModal(false);
        setInputSenha("");
      } else {
        setAuthError(json.error || "Senha incorreta. Verifique com a equipe PolarTech.");
      }
    } catch (e) {
      setAuthError("Erro na conexão. Tente novamente.");
    }
  };

  const handleLogoutExterno = () => {
    setIsAuthExterno(false);
    sessionStorage.removeItem(`proar_auth_obra_${token}`);
  };

  const handleCreateApontamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !descricao || !nomeRegistrador) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/work-findings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          quadra,
          casa,
          ambiente,
          etapaRelacionada,
          titulo,
          descricao,
          tipo: tipoApontamento,
          prioridade,
          registradoPor: nomeRegistrador,
          funcaoRegistrador,
          fotos: [],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowNovoModal(false);
        setTitulo("");
        setDescricao("");
        setSuccessToast("✓ Apontamento registrado com sucesso.");
        setTimeout(() => setSuccessToast(""), 4000);
        loadData();
      } else {
        alert(json.error || "Erro ao registrar apontamento.");
      }
    } catch (e) {
      alert("Erro ao registrar apontamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAprovar = async (id: number) => {
    if (!confirm("Deseja aprovar e encerrar esta pendência?")) return;
    try {
      const res = await fetch("/api/work-findings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "aprovar",
          aprovadoPor: fiscalNome || "Engenharia / Fiscalização",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessToast("✓ Correção aprovada e liberada pela Fiscalização!");
        setTimeout(() => setSuccessToast(""), 4000);
        loadData();
      }
    } catch (e) {}
  };

  const handleReprovar = async () => {
    if (!reprovandoId || !motivoReprovacao) return;
    try {
      const res = await fetch("/api/work-findings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reprovandoId,
          action: "reprovar",
          motivoReprovacao,
          reprovadoPor: fiscalNome || "Engenharia / Fiscalização",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setReprovandoId(null);
        setMotivoReprovacao("");
        setSuccessToast("↩ Correção reprovada. Retornada para a equipe PolarTech.");
        setTimeout(() => setSuccessToast(""), 4000);
        loadData();
      }
    } catch (e) {}
  };

  if (loading || !work) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-slate-600 font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600 animate-pulse" />
          Carregando acompanhamento da obra...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-16">
      {/* ============================================================== */}
      {/* 1 & 2. HEADER: ACOMPANHAMENTO ABERTO + BOTÃO NO CANTO DIREITO */}
      {/* ============================================================== */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-black text-xl tracking-tight text-white">
              ProAR <span className="text-blue-400 font-normal text-xs ml-1">POLARTECH</span>
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold uppercase hidden sm:inline-block">
              ACOMPANHAMENTO PÚBLICO DE OBRA
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.print()}
              className="p-2 text-slate-300 hover:text-white bg-slate-800 rounded-lg text-xs font-semibold transition print:hidden"
              title="Imprimir Relatório de Obra"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* BOTÃO CRÍTICO: 🔒 ACESSO ENGENHARIA / FISCALIZAÇÃO */}
            {!isAuthExterno ? (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5 text-amber-300" />
                <span>ACESSO ENGENHARIA / FISCALIZAÇÃO</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-blue-950 border border-blue-700/80 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-blue-200">Fiscalização Ativa</span>
                <button
                  onClick={handleLogoutExterno}
                  className="text-[10px] text-slate-400 hover:text-rose-300 underline ml-2 font-mono"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Toast de Confirmação */}
      {successToast && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-4">
          <div className="p-3.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4" /> {successToast}
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        
        {/* ============================================================== */}
        {/* 1. VISÃO PÚBLICA GERAL DA OBRA (NÃO ALTERADA)                   */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-100 text-blue-900">
              {work.codigo}
            </span>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Execução em Andamento (Normal)
            </span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-2">{work.nome}</h1>
          <p className="text-slate-600 text-xs leading-relaxed mb-6">{work.descricao}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Contratante</span>
              <span className="font-bold text-slate-900">{work.clienteNome}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Município</span>
              <span className="font-bold text-slate-900">{work.cidade} - SP</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Previsão Término</span>
              <span className="font-bold text-slate-900">{work.previsaoTermino}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Equipe Técnica</span>
              <span className="font-bold text-slate-900">{work.equipe}</span>
            </div>
          </div>

          {/* Progresso Geral de Execução */}
          <div className="mt-6">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-2">
              <span>Avanço Físico Operacional</span>
              <span className="text-blue-600 text-base font-black">{work.progresso}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${work.progresso}%` }}
              />
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 6 & 11. INDICADORES POR QUADRA E MARCAÇÃO VISUAL DA CASA       */}
        {/* ============================================================== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Acompanhamento por Quadras & Casas/Lotes
              </h2>
              <p className="text-xs text-slate-500">
                O andamento físico da PolarTech é 100% independente dos apontamentos de fiscalização.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {quadrasDemo.map((q, qIndex) => {
              // Contabiliza pendências da quadra
              const pendenciasQuadra = q.casas.reduce((acc, c) => acc + c.pendenciasCount, 0);

              return (
                <div key={qIndex} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">{q.nome} — {q.progresso}% executada</h3>
                      <span className="text-xs text-slate-500">
                        {q.casasConcluidas} casas concluídas • {q.casasEmExecucao} em execução
                      </span>
                    </div>

                    {pendenciasQuadra > 0 ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1.5">
                        🔴 {pendenciasQuadra} pendência(s) de fiscalização
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                        🟢 0 pendências
                      </span>
                    )}
                  </div>

                  {/* Grid de Casas com Marcação Visual Dupla */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {q.casas.map((c, cIndex) => {
                      const hasPendency = c.pendenciasCount > 0;
                      return (
                        <div
                          key={cIndex}
                          className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
                            hasPendency ? "bg-rose-50/50 border-rose-300" : "bg-white border-slate-200"
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="font-black text-slate-900 text-xs">{c.numero}</span>
                              {hasPendency ? (
                                <span className="text-[10px] font-black text-rose-700 bg-rose-200/70 px-2 py-0.5 rounded-md">
                                  ⚠ {c.pendenciasCount} PENDÊNCIA
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                  Regular
                                </span>
                              )}
                            </div>

                            {/* Status Operacional da PolarTech */}
                            <div className="text-[11px] text-slate-600">
                              <span className="text-[10px] text-slate-400 block font-bold uppercase">Status PolarTech:</span>
                              <span className="font-bold text-slate-800">{c.statusPolartech}</span>
                            </div>
                          </div>

                          {/* Badge de Fiscalização se houver */}
                          {hasPendency && (
                            <div className="mt-3 pt-2 border-t border-rose-200 text-[10px] font-bold text-rose-800 flex items-center gap-1">
                              🔴 Fiscalização: {c.worstStatus === "aguardando_conferencia" ? "Aguardando conferência" : "Pendência aberta"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4 & 5. ÁREA RESTRITA: ENGENHARIA E FISCALIZAÇÃO (SE LOGADO)    */}
        {/* ============================================================== */}
        {isAuthExterno && (
          <div className="bg-white rounded-2xl shadow-md border-2 border-blue-600 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    ÁREA EXCLUSIVA DE FISCALIZAÇÃO
                  </span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mt-1">
                  Engenharia e Fiscalização — Apontamentos da Obra
                </h2>
                <p className="text-xs text-slate-500">
                  Registre não conformidades, sugestões de qualidade e aprove ou devolva as correções feitas pela PolarTech.
                </p>
              </div>

              <button
                onClick={() => setShowNovoModal(true)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow transition flex items-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" /> + NOVO APONTAMENTO
              </button>
            </div>

            {/* Apontamentos da Obra */}
            <div className="space-y-4">
              {findings.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Nenhum apontamento registrado para esta obra.
                </div>
              ) : (
                findings.map((f) => {
                  const sitObj = SITUACAO_LABELS[f.situacao] || SITUACAO_LABELS.pendente;
                  const isAguardando = f.situacao === "aguardando_conferencia";

                  return (
                    <div
                      key={f.id}
                      className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 hover:border-slate-300 transition space-y-3.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${sitObj.badge}`}>
                            {sitObj.icon} {f.tipo.toUpperCase()}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {f.quadra} — {f.casa}
                          </span>
                          <span className="text-xs text-slate-500">
                            • Ambiente: <strong className="text-slate-700">{f.ambiente}</strong>
                          </span>
                          <span className="text-xs text-slate-500">
                            • Etapa: <strong className="text-slate-700">{f.etapaRelacionada}</strong>
                          </span>
                        </div>

                        <span className="text-[11px] font-bold text-slate-500 font-mono">
                          Situação: <span className="uppercase text-slate-800">{sitObj.label}</span>
                        </span>
                      </div>

                      {/* Título e Descrição */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-1">{f.titulo}</h4>
                        <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 italic">
                          "{f.descricao}"
                        </p>
                      </div>

                      {/* Informações de Autoria */}
                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          Registrado por: <strong className="text-slate-600">{f.registradoPor}</strong> ({f.funcaoRegistrador})
                        </span>
                        <span>
                          {new Date(f.criadoEm).toLocaleDateString("pt-BR")} às {new Date(f.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {/* Resposta da PolarTech se houver */}
                      {f.observacaoPolartech && (
                        <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs space-y-1.5">
                          <span className="font-bold text-purple-900 block flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" /> Resposta da PolarTech / Correção Realizada:
                          </span>
                          <p className="text-slate-800 italic">"{f.observacaoPolartech}"</p>
                          <span className="text-[10px] text-purple-700 block font-semibold">
                            Responsável: {f.responsavelCorrecao} {f.dataCorrecao && `• em ${new Date(f.dataCorrecao).toLocaleDateString("pt-BR")}`}
                          </span>
                        </div>
                      )}

                      {/* 9. ENGENHARIA / FISCALIZAÇÃO CONFIRMA (APROVAR OU REPROVAR) */}
                      {isAguardando && (
                        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border">
                          <div className="text-xs text-purple-900 font-bold flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-purple-600" />
                            Aguardando sua conferência técnica:
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setReprovandoId(f.id)}
                              className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> ↩ REPROVAR / DEVOLVER
                            </button>
                            <button
                              onClick={() => handleAprovar(f.id)}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow transition flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" /> ✓ APROVAR CORREÇÃO
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* 2. JANELA MODAL: ACESSO PARA APONTAMENTOS                      */}
      {/* ============================================================== */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Lock className="w-4 h-4 text-blue-600" /> Acesso para apontamentos
              </h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Informe a senha fornecida pela PolarTech para registrar pendências, observações ou não conformidades desta obra.
            </p>

            <form onSubmit={handleLoginExterno} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Senha de Acesso:</label>
                <input
                  type="password"
                  required
                  placeholder="Informe a senha da obra..."
                  value={inputSenha}
                  onChange={(e) => setInputSenha(e.target.value)}
                  className="w-full text-sm p-2.5 border border-slate-300 rounded-xl outline-none focus:border-blue-600 font-mono"
                  autoFocus
                />
              </div>

              {authError && (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 p-2 rounded-lg">{authError}</p>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow transition"
              >
                ACESSAR APONTAMENTOS
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL: CADASTRO DO APONTAMENTO                             */}
      {/* ============================================================== */}
      {showNovoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4 text-rose-600" /> Registrar Apontamento / Não Conformidade
              </h3>
              <button onClick={() => setShowNovoModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateApontamento} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipo de Apontamento *</label>
                  <select
                    value={tipoApontamento}
                    onChange={(e) => setTipoApontamento(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                  >
                    <option value="Não conformidade">Não conformidade</option>
                    <option value="Qualidade do serviço">Qualidade do serviço</option>
                    <option value="Alteração necessária">Alteração necessária</option>
                    <option value="Alteração de medida">Alteração de medida</option>
                    <option value="Divergência de projeto">Divergência de projeto</option>
                    <option value="Serviço incompleto">Serviço incompleto</option>
                    <option value="Correção necessária">Correção necessária</option>
                    <option value="Observação da engenharia">Observação da engenharia</option>
                    <option value="Observação da fiscalização">Observação da fiscalização</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Prioridade</label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Quadra *</label>
                  <input
                    type="text"
                    required
                    value={quadra}
                    onChange={(e) => setQuadra(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Casa / Lote *</label>
                  <input
                    type="text"
                    required
                    value={casa}
                    onChange={(e) => setCasa(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ambiente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Quarto, Sala..."
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Etapa Relacionada *</label>
                <select
                  value={etapaRelacionada}
                  onChange={(e) => setEtapaRelacionada(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                >
                  <option value="Início de Obra">Início de Obra</option>
                  <option value="Rede Frigorígena">Rede Frigorígena</option>
                  <option value="Acabamento">Acabamento</option>
                  <option value="Tubulação Forçada">Tubulação Forçada</option>
                  <option value="Acabamento Exaustão">Acabamento Exaustão</option>
                  <option value="Exaustor">Exaustor</option>
                  <option value="Tampa Frigorígena">Tampa Frigorígena</option>
                  <option value="Geral da Obra">Geral da Obra</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Título do Apontamento *</label>
                <input
                  type="text"
                  required
                  placeholder="Resumo objetivo da pendência..."
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Descrição / Observação *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detalhes técnicos da não conformidade..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Seu Nome (Responsável) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome completo..."
                    value={nomeRegistrador}
                    onChange={(e) => setNomeRegistrador(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sua Função</label>
                  <select
                    value={funcaoRegistrador}
                    onChange={(e) => setFuncaoRegistrador(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                  >
                    <option value="Fiscalização">Fiscalização</option>
                    <option value="Engenharia">Engenharia</option>
                    <option value="Construtora">Construtora</option>
                    <option value="Cliente">Cliente</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowNovoModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black shadow transition disabled:opacity-50"
                >
                  {submitting ? "Gravando..." : "REGISTRAR APONTAMENTO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Reprovação com Justificativa */}
      {reprovandoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" /> Reprovar / Devolver para Correção
            </h3>
            <p className="text-xs text-slate-500">
              Informe o motivo técnico da reprovação para que a equipe PolarTech execute o ajuste necessário.
            </p>

            <textarea
              rows={3}
              required
              placeholder="Descreva por que a correção não foi aprovada..."
              value={motivoReprovacao}
              onChange={(e) => setMotivoReprovacao(e.target.value)}
              className="w-full text-xs p-2.5 border rounded-xl outline-none focus:border-rose-500"
            />

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button
                type="button"
                onClick={() => setReprovandoId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleReprovar}
                className="px-4 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow"
              >
                Confirmar Devolução
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
