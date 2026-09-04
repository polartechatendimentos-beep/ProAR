"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, Plus, ExternalLink, MapPin, AlertTriangle, 
  CheckCircle2, Clock, Wrench, Layers, ChevronRight, Filter, 
  UserCheck, Shield, FileText, ArrowUpRight, CheckSquare, RefreshCw
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
  valorContrato?: string;
  engenheiroResponsavel?: string;
  equipe?: string;
}

export function WorkOperationsPanel() {
  const [works, setWorks] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"lista" | "gargalos" | "medidas" | "materiais">("lista");
  const [showNewModal, setShowNewModal] = useState(false);

  // Form de Nova Obra
  const [nome, setNome] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("Mirassol");
  const [valorContrato, setValorContrato] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Estado de feedback profissional
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchWorks = async () => {
    try {
      const res = await fetch("/api/work-projects");
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setWorks(json.data);
      } else {
        // Obra padrão do setor para demonstração contínua
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
            valorContrato: "94500.00",
            engenheiroResponsavel: "Eng. Eletricista / CREA-SP Ativo",
            equipe: "TEAM 02",
          },
        ]);
      }
    } catch (e) {
      console.error("Erro ao carregar obras:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorks();
  }, []);

  const handleCreateWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !clienteNome || !endereco) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/work-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          clienteNome,
          endereco,
          cidade,
          valorContrato: valorContrato ? parseFloat(valorContrato) : 0,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowNewModal(false);
        setNome("");
        setClienteNome("");
        setEndereco("");
        setValorContrato("");
        setFeedbackMessage("✓ Obra cadastrada e token público gerado com sucesso.");
        setTimeout(() => setFeedbackMessage(null), 3500);
        fetchWorks();
      }
    } catch (e) {
      alert("Não foi possível salvar. Código: ERR-OBRA-01");
    } finally {
      setSubmitting(false);
    }
  };

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
            Módulo Operacional de Obras (8 Etapas Padronizadas)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestão por quadra/lote, baixa automática de kits de material por etapa e portal público de fiscalização.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition"
          >
            <Plus className="w-4 h-4" /> Nova Obra
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 p-3 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {feedbackMessage}
        </div>
      )}

      {/* Subtabs de Gestão de Obra */}
      <div className="flex border-b border-slate-200 px-6 gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveSubTab("lista")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 ${
            activeSubTab === "lista"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" /> Obras em Andamento ({works.length})
        </button>

        <button
          onClick={() => setActiveSubTab("gargalos")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 ${
            activeSubTab === "gargalos"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> Onde a Obra Está Parada (Gargalos)
        </button>

        <button
          onClick={() => setActiveSubTab("materiais")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 ${
            activeSubTab === "materiais"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Wrench className="w-4 h-4" /> Kits de Material & Baixa Automática
        </button>

        <button
          onClick={() => setActiveSubTab("medidas")}
          className={`py-3.5 border-b-2 transition flex items-center gap-1.5 ${
            activeSubTab === "medidas"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" /> Alterações de Medidas / Projeto
        </button>
      </div>

      {/* Conteúdo da Subtab Ativa */}
      <div className="p-6">
        {activeSubTab === "lista" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {works.map((w) => {
              const currentStatusObj = OBRA_STATUS_LIST.find((s) => s.id === w.status) || OBRA_STATUS_LIST[1];
              return (
                <div
                  key={w.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between"
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

                    {/* Camada de Próxima Ação */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 mb-4 text-xs flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Próxima Ação</span>
                        <span className="text-slate-800 font-bold">
                          {w.status === "ag_frigorigena" ? "Liberar kit cobre 1/4 + 3/8 para Quadra B" : "Conferir tubulação forçada e exaustão"}
                        </span>
                      </div>
                      <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition shadow-sm">
                        Avançar Etapa
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <a
                      href={`/obra/${w.tokenPublico}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold"
                    >
                      Portal Público do Fiscal <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                    {w.valorContrato && (
                      <span className="font-bold text-slate-800">
                        R$ {Number(w.valorContrato).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeSubTab === "gargalos" && (
          <div className="space-y-6">
            <div className="bg-amber-50/60 p-5 rounded-xl border border-amber-200">
              <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Painel: Onde a Obra Está Parada (Distribuição de Casas por Etapa)
              </h3>
              <p className="text-xs text-amber-700">
                Identifica gargalos imediatos na linha de montagem e frentes de serviço paralisadas por falta de material ou liberação da construtora.
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

        {activeSubTab === "materiais" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 text-xs text-blue-900 leading-relaxed">
              <strong>Regra de Baixa Automática por Transição de Etapa:</strong> Ao avançar de <em>AG. FRIGORÍGENA</em> para <em>AG. ACABAMENTO</em>, o sistema baixa automaticamente do estoque o kit de cobre correspondente às bitolas configuradas (ex: 1/4 + 3/8), o isolamento térmico e o cabo PP (calculado como <code>comprimento do cobre + 2m + perda configurada de 3% a 5%</code>).
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">Etapa da Obra</th>
                    <th className="p-3">Gatilho de Baixa</th>
                    <th className="p-3">Itens do Kit Automático</th>
                    <th className="p-3">Fórmula de Perda</th>
                    <th className="p-3">Status de Conferência</th>
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
                  <tr>
                    <td className="p-3 font-bold text-slate-900">Tampa Frigorígena</td>
                    <td className="p-3">Avanço para Concluído</td>
                    <td className="p-3">Tampa plástica de acabamento (se casa utiliza tampa = Sim)</td>
                    <td className="p-3 font-mono">1 un / ponto</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Ativa</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === "medidas" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900">Histórico de Alterações de Projeto e Medidas de Campo</h3>
              <button className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                + Solicitar Alteração de Medida
              </button>
            </div>

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

      {/* Modal Nova Obra */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Cadastrar Nova Obra de Climatização</h3>
            <p className="text-xs text-slate-500 mb-4">Gera automaticamente o token criptografado para o cliente e fiscais.</p>

            <form onSubmit={handleCreateWork} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Obra / Projeto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Instalação VRF Central - Bloco Administrativo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente / Órgão Público *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prefeitura Municipal de Mirassol"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço da Obra *</label>
                  <input
                    type="text"
                    required
                    placeholder="Rua, número, bairro"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Município (SP)</label>
                  <input
                    type="text"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Valor do Contrato (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={valorContrato}
                  onChange={(e) => setValorContrato(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow transition disabled:opacity-50"
                >
                  {submitting ? "Salvando..." : "Salvar Obra"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
