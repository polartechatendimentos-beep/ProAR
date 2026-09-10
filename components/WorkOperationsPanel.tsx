"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, Plus, ExternalLink, MapPin, AlertTriangle, 
  CheckCircle2, Clock, Wrench, Layers, ChevronRight, Filter, 
  UserCheck, Shield, FileText, ArrowUpRight, CheckSquare, RefreshCw,
  Lock, Key, Copy, Check, Send, RotateCcw, X
} from "lucide-react";

export const OBRA_STATUS_LIST = [
  { id: "inicio_obra", label: "1. INÍCIO DE OBRA", color: "bg-slate-100 text-slate-700 border-slate-300" },
  { id: "ag_frigorigena", label: "2. AG. FRIGORÍGENA", color: "bg-amber-50 text-amber-800 border-amber-300" },
  { id: "ag_acabamento", label: "3. AG. ACABAMENTO", color: "bg-blue-50 text-blue-800 border-blue-300" },
  { id: "ag_tubulacao_forcada", label: "4. AG. TUBULAÇÃO FORÇADA", color: "bg-indigo-50 text-indigo-800 border-indigo-300" },
  { id: "ag_acabamento_exaustao", label: "5. AG. ACABAMENTO EXAUSTÃO", color: "bg-purple-50 text-purple-800 border-purple-300" },
  { id: "ag_exaustor", label: "6. AG. EXAUSTOR", color: "bg-cyan-50 text-cyan-800 border-cyan-300" },
  { id: "ag_tampa_frigorigena", label: "7. AG. TAMPA FRIGORÍGENA", color: "bg-teal-50 text-teal-800 border-teal-300" },
  { id: "servico_concluido", label: "8. SERVIÇO CONCLUÍDO", color: "bg-emerald-50 text-emerald-800 border-emerald-300" },
];

const SITUACAO_LABELS: Record<string, { label: string; badge: string; icon: string }> = {
  pendente: { label: "Pendência aberta", badge: "bg-rose-100 text-rose-800 border-rose-300", icon: "🔴" },
  em_analise: { label: "Em análise", badge: "bg-amber-100 text-amber-800 border-amber-300", icon: "🟠" },
  em_correcao: { label: "Correção em andamento", badge: "bg-blue-100 text-blue-800 border-blue-300", icon: "🔵" },
  aguardando_conferencia: { label: "Aguardando conferência", badge: "bg-purple-100 text-purple-800 border-purple-300", icon: "🟣" },
  aprovada: { label: "Aprovada / Resolvida", badge: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "🟢" },
  cancelada: { label: "Cancelada", badge: "bg-slate-100 text-slate-700 border-slate-300", icon: "⚪" },
};

interface WorkItem {
  id: number;
  codigo: string;
  nome: string;
  clienteNome: string;
  endereco: string;
  cidade: string;
  progresso: number;
  status: string;
  tokenPublico: string;
  senhaApontamentos: string;
  acessoApontamentosAtivo: boolean;
  valorContrato?: string;
  engenheiroResponsavel?: string;
  equipe?: string;
}

interface FindingRecord {
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
  observacaoPolartech?: string;
  responsavelCorrecao?: string;
  dataCorrecao?: string;
  criadoEm: string;
}

export function WorkOperationsPanel() {
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"lista" | "fiscalizacao" | "gargalos" | "materiais" | "medidas">("lista");
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingWorkId, setEditingWorkId] = useState<number | null>(null);
  const [externalLinks, setExternalLinks] = useState<Record<string, string>>({});

  // Apontamentos da Fiscalização
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [filterSituacao, setFilterSituacao] = useState("Todas");
  const [selectedFindingToRespond, setSelectedFindingToRespond] = useState<FindingRecord | null>(null);
  const [obsPolartech, setObsPolartech] = useState("");
  const [respCorrecao, setRespCorrecao] = useState("TEAM 11 (Técnico Jhonnatan)");

  // Form de Nova Obra
  const [nome, setNome] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("Mirassol");
  const [valorContrato, setValorContrato] = useState("");
  const [senhaApontamentos, setSenhaApontamentos] = useState("123456");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchWorksAndFindings = async () => {
    try {
      const [resWorks, resFindings] = await Promise.all([
        fetch("/api/work-projects"),
        fetch("/api/work-findings"),
      ]);

      const jsonWorks = await resWorks.json();
      const jsonFindings = await resFindings.json();

      if (jsonWorks.success && jsonWorks.data.length > 0) {
        setWorks(jsonWorks.data);
      } else {
        setWorks([
          {
            id: 1,
            codigo: "OBR-2026-042",
            nome: "Instalação VRF Central - Hospital Regional / Bloco Cirúrgico",
            clienteNome: "Secretaria de Saúde do Estado de SP",
            endereco: "Av. Philadelpho Manoel Gouveia Neto, 1850",
            cidade: "São José do Rio Preto",
            progresso: 65,
            status: "ag_tubulacao_forcada",
            tokenPublico: "obr-demo-token-proar-2026",
            senhaApontamentos: "123456",
            acessoApontamentosAtivo: true,
            valorContrato: "185000.00",
            engenheiroResponsavel: "Eng. Mecânico Responsável (CREA-SP)",
            equipe: "TEAM 11 ProAR",
          },
          {
            id: 2,
            codigo: "OBR-2026-055",
            nome: "Infraestrutura Frigorígena - Residencial Damha V (Lotes 12 a 24)",
            clienteNome: "Construtora & Incorporadora Noroeste",
            endereco: "Rodovia Washington Luís, KM 438",
            cidade: "Mirassol",
            progresso: 32,
            status: "ag_frigorigena",
            tokenPublico: "damha-v-proar-mirassol",
            senhaApontamentos: "damha2026",
            acessoApontamentosAtivo: true,
            valorContrato: "94500.00",
            engenheiroResponsavel: "Eng. Eletricista / CREA-SP Ativo",
            equipe: "TEAM 02",
          },
        ]);
      }

      if (jsonFindings.success && jsonFindings.data) {
        setFindings(jsonFindings.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorksAndFindings();
  }, []);

  const handleCreateWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !clienteNome || !endereco) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/work-projects", {
        method: editingWorkId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingWorkId || undefined,
          nome,
          clienteNome,
          endereco,
          cidade,
          valorContrato: valorContrato ? parseFloat(valorContrato) : 0,
          senhaApontamentos,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowNewModal(false);
        setEditingWorkId(null);
        setNome("");
        setClienteNome("");
        setEndereco("");
        setValorContrato("");
        setFeedbackMessage(editingWorkId ? "✓ Obra atualizada com sucesso." : "✓ Obra cadastrada e token público gerado com sucesso.");
        setTimeout(() => setFeedbackMessage(null), 3500);
        fetchWorksAndFindings();
      }
    } catch (e) {
      alert("Não foi possível salvar. Código: ERR-OBRA-01");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditWorkModal = (work: WorkItem) => {
    setEditingWorkId(work.id);
    setNome(work.nome);
    setClienteNome(work.clienteNome);
    setEndereco(work.endereco);
    setCidade(work.cidade);
    setValorContrato(work.valorContrato ? String(work.valorContrato) : "");
    setSenhaApontamentos(work.senhaApontamentos || "123456");
    setShowNewModal(true);
  };

  const handleSaveExternalAccess = async (work: WorkItem, tipo: "engenharia" | "fiscalizacao") => {
    const nomeCred = window.prompt(`Nome do responsável (${tipo}):`);
    if (!nomeCred) return;
    const funcaoCred = window.prompt(`Função (${tipo}):`, tipo === "engenharia" ? "Engenheiro Responsável" : "Fiscal da Obra");
    if (!funcaoCred) return;
    const senha = window.prompt(`Defina a senha do acesso ${tipo}:`);
    if (!senha) return;
    const email = window.prompt(`E-mail (${tipo}) [opcional]:`) || "";

    const res = await fetch("/api/work-external-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workId: work.id,
        tipo,
        nome: nomeCred,
        funcao: funcaoCred,
        email,
        senha,
        enabled: true,
        allowLinkAccess: true,
      }),
    });
    const json = await res.json();
    if (json.success) {
      const key = `${work.id}:${tipo}`;
      if (json.data?.accessLink) setExternalLinks((prev) => ({ ...prev, [key]: json.data.accessLink }));
      setFeedbackMessage(`✓ Acesso ${tipo} salvo com sucesso.`);
      setTimeout(() => setFeedbackMessage(null), 3500);
    } else {
      alert(json.error || "Falha ao salvar acesso externo.");
    }
  };

  const handleResetExternalPassword = async (work: WorkItem, tipo: "engenharia" | "fiscalizacao") => {
    const novaSenha = window.prompt(`Nova senha para ${tipo}:`);
    if (!novaSenha) return;
    const res = await fetch("/api/work-external-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId: work.id, tipo, action: "reset_password", novaSenha }),
    });
    const json = await res.json();
    if (json.success) {
      setFeedbackMessage(`✓ Senha redefinida para ${tipo}.`);
      setTimeout(() => setFeedbackMessage(null), 3500);
    } else {
      alert(json.error || "Falha ao redefinir senha.");
    }
  };

  const handleBlockExternalAccess = async (work: WorkItem, tipo: "engenharia" | "fiscalizacao", block: boolean) => {
    const res = await fetch("/api/work-external-access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId: work.id, tipo, action: block ? "block" : "unblock" }),
    });
    const json = await res.json();
    if (json.success) {
      setFeedbackMessage(`✓ Acesso ${tipo} ${block ? "bloqueado" : "ativado"}.`);
      setTimeout(() => setFeedbackMessage(null), 3500);
    } else {
      alert(json.error || "Falha ao atualizar status do acesso.");
    }
  };

  // 8. RESPOSTA DA POLARTECH (ENVIAR PARA CONFERÊNCIA)
  const handleEnviarConferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFindingToRespond || !obsPolartech) return;

    try {
      const res = await fetch("/api/work-findings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedFindingToRespond.id,
          action: "resposta_polartech",
          observacaoPolartech: obsPolartech,
          responsavelCorrecao: respCorrecao,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSelectedFindingToRespond(null);
        setObsPolartech("");
        setFeedbackMessage("✓ Correção registrada! Situação alterada para: Aguardando conferência da Fiscalização.");
        setTimeout(() => setFeedbackMessage(null), 4000);
        fetchWorksAndFindings();
      }
    } catch (e) {
      alert("Erro ao responder apontamento.");
    }
  };

  // Contadores de Apontamentos
  const countPendentes = findings.filter((f) => f.situacao === "pendente").length;
  const countEmCorrecao = findings.filter((f) => f.situacao === "em_correcao" || f.situacao === "em_analise").length;
  const countAguardando = findings.filter((f) => f.situacao === "aguardando_conferencia").length;
  const countResolvidas = findings.filter((f) => f.situacao === "aprovada").length;

  const filteredFindings = findings.filter((f) => {
    if (filterSituacao === "Todas") return true;
    if (filterSituacao === "Pendentes") return f.situacao === "pendente";
    if (filterSituacao === "Em correção") return f.situacao === "em_correcao";
    if (filterSituacao === "Aguardando conferência") return f.situacao === "aguardando_conferencia";
    if (filterSituacao === "Resolvidas") return f.situacao === "aprovada";
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Top Header */}
      <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-full font-mono">
              ENGENHARIA TÉRMICA & CLIMATIZAÇÃO
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-600" />
            Módulo Operacional de Obras (8 Etapas + Fiscalização Externa)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Controle de etapas PolarTech com camada paralela isolada de apontamentos da engenharia e fiscalização.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setEditingWorkId(null);
              setShowNewModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" /> Nova Obra
          </button>
        </div>
      </div>

      {/* 8. ALERTA CRÍTICO: NOVA PENDÊNCIA DA FISCALIZAÇÃO */}
      {countPendentes > 0 && (
        <div className="bg-rose-50 border-b border-rose-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-base">🔴</span>
            <div>
              <span className="font-bold text-rose-900 block">
                Nova Pendência da Fiscalização Externa ({countPendentes} aberta{countPendentes > 1 ? "s" : ""})
              </span>
              <span className="text-rose-700">
                A fiscalização externa registrou apontamentos de qualidade que necessitam de correção pela equipe.
              </span>
            </div>
          </div>
          <button
            onClick={() => setActiveSubTab("fiscalizacao")}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-sm transition shrink-0"
          >
            VER APONTAMENTOS
          </button>
        </div>
      )}

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 p-3 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {feedbackMessage}
        </div>
      )}

      {/* Subtabs de Gestão de Obra */}
      <div className="flex border-b border-slate-200 px-6 gap-6 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveSubTab("lista")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "lista"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" /> Obras em Andamento ({works.length})
        </button>

        <button
          onClick={() => setActiveSubTab("fiscalizacao")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "fiscalizacao"
              ? "border-rose-600 text-rose-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Shield className="w-4 h-4" /> Engenharia / Fiscalização ({findings.length})
          {countPendentes > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("gargalos")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "gargalos"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Onde a Obra Está Parada (Gargalos)
        </button>

        <button
          onClick={() => setActiveSubTab("materiais")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "materiais"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wrench className="w-4 h-4" /> Kits de Material & Baixa Automática
        </button>

        <button
          onClick={() => setActiveSubTab("medidas")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
            activeSubTab === "medidas"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" /> Alterações de Medidas
        </button>
      </div>

      {/* Conteúdo da Subtab Ativa */}
      <div className="p-6">
        {/* ============================================================== */}
        {/* ABA 1: LISTA DE OBRAS + CONFIGURAÇÃO DE SENHA (ITEM 12)       */}
        {/* ============================================================== */}
        {activeSubTab === "lista" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {works.map((w) => {
              const currentStatusObj = OBRA_STATUS_LIST.find((s) => s.id === w.status) || OBRA_STATUS_LIST[1];
              return (
                <div
                  key={w.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800">
                        {w.codigo}
                      </span>
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${currentStatusObj.color}`}>
                        {currentStatusObj.label}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-base leading-tight mb-1">{w.nome}</h3>
                    <p className="text-xs text-slate-600 font-semibold mb-3">{w.clienteNome}</p>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{w.endereco} — {w.cidade}/SP</span>
                    </div>

                    {/* Régua de Progresso Físico */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5">
                        <span>Avanço Físico</span>
                        <span className="font-bold text-blue-600">{w.progresso}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${w.progresso}%` }}
                        />
                      </div>
                    </div>

                    {/* 12. CARD DE CONFIGURAÇÃO DE ACESSO ENGENHARIA / FISCALIZAÇÃO */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-blue-600" /> Acesso Engenharia / Fiscalização
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${w.acessoApontamentosAtivo ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>
                          {w.acessoApontamentosAtivo ? "Ativo" : "Bloqueado"}
                        </span>
                      </div>
                      <div className="space-y-2 text-[11px]">
                        {(["engenharia", "fiscalizacao"] as const).map((tipo) => (
                          <div key={tipo} className="bg-white p-2 rounded-lg border border-slate-200">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 uppercase">{tipo}</span>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleSaveExternalAccess(w, tipo)} className="text-blue-700 font-bold">Gerar acesso</button>
                                <button onClick={() => handleResetExternalPassword(w, tipo)} className="text-amber-700 font-bold">Redefinir senha</button>
                                <button onClick={() => handleBlockExternalAccess(w, tipo, true)} className="text-rose-700 font-bold">Bloquear</button>
                                <button onClick={() => handleBlockExternalAccess(w, tipo, false)} className="text-emerald-700 font-bold">Ativar</button>
                              </div>
                            </div>
                            {externalLinks[`${w.id}:${tipo}`] && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(externalLinks[`${w.id}:${tipo}`]);
                                  alert(`✓ Link de ${tipo} copiado.`);
                                }}
                                className="mt-1 text-blue-600 font-semibold"
                              >
                                Copiar link individual
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center pt-1 text-[11px]">
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/obra/${w.tokenPublico}`;
                            navigator.clipboard.writeText(link);
                            alert("✓ Link público de acompanhamento copiado!");
                          }}
                          className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar Link Externo
                        </button>
                        <a
                          href={`/obra/${w.tokenPublico}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1"
                        >
                          Abrir Acompanhamento <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">
                      Equipe: <strong>{w.equipe}</strong>
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEditWorkModal(w)}
                        className="px-3 py-1 rounded-lg border border-blue-200 text-blue-700 font-bold"
                      >
                        Alterar Obra
                      </button>
                      {w.valorContrato && (
                        <span className="font-bold text-slate-800">
                          R$ {Number(w.valorContrato).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* ABA 2: PAINEL ENGENHARIA / FISCALIZAÇÃO (ITEM 10)              */}
        {/* ============================================================== */}
        {activeSubTab === "fiscalizacao" && (
          <div className="space-y-6">
            {/* 10. Contadores no topo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50">
                <span className="text-[10px] uppercase font-bold text-rose-700 block">Pendentes</span>
                <span className="text-2xl font-black text-rose-900 mt-1 block font-mono">{countPendentes}</span>
                <span className="text-[10px] text-rose-600 mt-0.5 block">Aguardando correção PolarTech</span>
              </div>
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
                <span className="text-[10px] uppercase font-bold text-blue-700 block">Em Correção</span>
                <span className="text-2xl font-black text-blue-900 mt-1 block font-mono">{countEmCorrecao}</span>
                <span className="text-[10px] text-blue-600 mt-0.5 block">Equipe em campo atuando</span>
              </div>
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50">
                <span className="text-[10px] uppercase font-bold text-purple-700 block">Aguardando Conferência</span>
                <span className="text-2xl font-black text-purple-900 mt-1 block font-mono">{countAguardando}</span>
                <span className="text-[10px] text-purple-600 mt-0.5 block">Enviadas para o fiscal aprovar</span>
              </div>
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Resolvidas / Aprovadas</span>
                <span className="text-2xl font-black text-emerald-900 mt-1 block font-mono">{countResolvidas}</span>
                <span className="text-[10px] text-emerald-600 mt-0.5 block">100% liberadas pela engenharia</span>
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-2 border-b pb-3">
              {(["Todas", "Pendentes", "Em correção", "Aguardando conferência", "Resolvidas"] as const).map((sit) => (
                <button
                  key={sit}
                  onClick={() => setFilterSituacao(sit)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    filterSituacao === sit
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {sit}
                </button>
              ))}
            </div>

            {/* Tabela de Apontamentos com Ação de Resposta */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">Local (Quadra/Casa)</th>
                    <th className="p-3">Ambiente / Etapa</th>
                    <th className="p-3">Tipo / Título</th>
                    <th className="p-3">Registrado Por</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3 text-right">Ação PolarTech</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredFindings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Nenhum apontamento encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredFindings.map((f) => {
                      const sitObj = SITUACAO_LABELS[f.situacao] || SITUACAO_LABELS.pendente;
                      return (
                        <tr key={f.id} className="hover:bg-slate-50/80">
                          <td className="p-3 font-bold text-slate-900">
                            {f.quadra} — {f.casa}
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-800 block">{f.ambiente}</span>
                            <span className="text-[10px] text-slate-500">{f.etapaRelacionada}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{f.titulo}</span>
                            <span className="text-[11px] text-slate-500 line-clamp-1">{f.descricao}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-slate-800 block">{f.registradoPor}</span>
                            <span className="text-[10px] text-slate-400">{f.funcaoRegistrador}</span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${sitObj.badge}`}>
                              {sitObj.icon} {sitObj.label}
                            </span>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {f.situacao === "pendente" || f.situacao === "em_correcao" ? (
                              <button
                                onClick={() => setSelectedFindingToRespond(f)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] shadow-sm transition"
                              >
                                Responder / Corrigir
                              </button>
                            ) : f.situacao === "aguardando_conferencia" ? (
                              <span className="text-purple-700 font-bold text-[11px] italic">
                                Aguardando Fiscal
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[11px]">✓ Liberado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: GARGALOS */}
        {activeSubTab === "gargalos" && (
          <div className="space-y-6">
            <div className="bg-amber-50/60 p-5 rounded-xl border border-amber-200">
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Painel: Onde a Obra Está Parada (Distribuição de Casas por Etapa)
              </h3>
              <p className="text-xs text-amber-700">
                Mapeamento das casas paralisadas na esteira produtiva da PolarTech.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-500 uppercase">2. Ag. Frigorígena</span>
                <div className="text-2xl font-black text-slate-900 mt-1">3 casas</div>
                <p className="text-[11px] text-amber-600 font-bold mt-1">Aguardando cobre 1/4 e dreno</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-500 uppercase">3. Ag. Acabamento</span>
                <div className="text-2xl font-black text-slate-900 mt-1">7 casas</div>
                <p className="text-[11px] text-blue-600 font-bold mt-1">Gesso em execução</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-500 uppercase">4. Ag. Tubulação Forçada</span>
                <div className="text-2xl font-black text-slate-900 mt-1">11 casas</div>
                <p className="text-[11px] text-purple-600 font-bold mt-1">Tubos de exaustão em trânsito</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold text-slate-500 uppercase">6. Ag. Exaustor</span>
                <div className="text-2xl font-black text-slate-900 mt-1">2 casas</div>
                <p className="text-[11px] text-emerald-600 font-bold mt-1">Kits Ventokit liberados</p>
              </div>
            </div>
          </div>
        )}

        {/* ABA: MATERIAIS */}
        {activeSubTab === "materiais" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 text-xs text-blue-900 leading-relaxed">
              <strong>Regra de Baixa Automática por Transição de Etapa:</strong> Ao avançar de <em>AG. FRIGORÍGENA</em> para <em>AG. ACABAMENTO</em>, o sistema baixa automaticamente do estoque o kit de cobre correspondente às bitolas configuradas (1/4 + 3/8), isolamento térmico e cabo PP.
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">Etapa da Obra</th>
                    <th className="p-3">Gatilho de Baixa</th>
                    <th className="p-3">Itens do Kit Automático</th>
                    <th className="p-3">Fórmula de Perda</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Frigorígena</td>
                    <td className="p-3">Avanço para Acabamento</td>
                    <td className="p-3">Caixa de Dreno, Cobre 1/4", 3/8", Isolamento, Cabo PP</td>
                    <td className="p-3 font-mono">Cobre + 3% / PP = Cobre+2m+5%</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Ativa</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Tubulação Forçada</td>
                    <td className="p-3">Avanço para Acab. Exaustão</td>
                    <td className="p-3">Tubo de Exaustão flexível e abraçadeiras</td>
                    <td className="p-3 font-mono">Comprimento + 5% perda</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Ativa</span></td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Exaustão</td>
                    <td className="p-3">Avanço para Tampa Frigorígena</td>
                    <td className="p-3">Exaustor / Ventokit padrão e veneziana externa</td>
                    <td className="p-3 font-mono">1 un / ambiente banho</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Ativa</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA: MEDIDAS */}
        {activeSubTab === "medidas" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Histórico de Alterações de Projeto e Medidas de Campo</h3>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-900 block">Quadra 04 — Casa 18 (Ambiente: Suíte Master)</span>
                <span className="text-slate-500 mt-0.5 block">
                  Aumento de tubulação de 4,50m para 7,20m devido a desvio de viga estrutural.
                </span>
                <span className="text-[10px] text-slate-400 font-mono mt-1 block">Solicitado por: Eng. Fiscalização (10/08/2026)</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                Executada e Conferida
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 8. MODAL DE RESPOSTA DA POLARTECH (ENVIAR PARA CONFERÊNCIA)     */}
      {/* ============================================================== */}
      {selectedFindingToRespond && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-600" /> Registrar Correção da PolarTech
              </h3>
              <button onClick={() => setSelectedFindingToRespond(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl text-xs space-y-1">
              <span className="font-bold text-slate-900 block">
                {selectedFindingToRespond.quadra} — {selectedFindingToRespond.casa} ({selectedFindingToRespond.ambiente})
              </span>
              <span className="text-slate-600 block italic font-medium">"{selectedFindingToRespond.descricao}"</span>
              <span className="text-[10px] text-slate-400 block font-mono">
                Registrado por: {selectedFindingToRespond.registradoPor}
              </span>
            </div>

            <form onSubmit={handleEnviarConferencia} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Observação da PolarTech / Ação Executada *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descreva o que foi corrigido pela equipe técnica..."
                  value={obsPolartech}
                  onChange={(e) => setObsPolartech(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Responsável Técnico pela Correção *</label>
                <input
                  type="text"
                  required
                  value={respCorrecao}
                  onChange={(e) => setRespCorrecao(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedFindingToRespond(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-black shadow transition flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> ENVIAR PARA CONFERÊNCIA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVA OBRA */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingWorkId ? "Alterar Obra" : "Cadastrar Nova Obra de Climatização"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {editingWorkId
                ? "Edição da obra existente preservando histórico, progresso, link público e registros relacionados."
                : "Gera automaticamente o token de acompanhamento e senha para a fiscalização."}
            </p>

            <form onSubmit={handleCreateWork} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nome da Obra / Projeto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instalação VRF Central - Bloco Cirúrgico"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full p-2 border rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cliente / Órgão *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prefeitura Municipal de Mirassol"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="w-full p-2 border rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Endereço *</label>
                  <input
                    type="text"
                    required
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full p-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Município</label>
                  <input
                    type="text"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="w-full p-2 border rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Valor Contrato (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorContrato}
                    onChange={(e) => setValorContrato(e.target.value)}
                    className="w-full p-2 border rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Senha de Apontamentos *</label>
                  <input
                    type="text"
                    required
                    value={senhaApontamentos}
                    onChange={(e) => setSenhaApontamentos(e.target.value)}
                    className="w-full p-2 border rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewModal(false);
                    setEditingWorkId(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black shadow"
                >
                  {submitting ? "Salvando..." : editingWorkId ? "Salvar Alterações" : "Salvar Obra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
