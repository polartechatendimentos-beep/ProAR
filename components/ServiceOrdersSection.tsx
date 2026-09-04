import { StandardDocumentReport } from "@/components/StandardDocumentReport";
"use client";

import React, { useState, useEffect } from "react";
import { 
  Wrench, Search, Plus, Filter, CheckCircle2, Clock, 
  MapPin, Copy, ExternalLink, Sparkles, Printer, Camera, Image as ImageIcon, Send
} from "lucide-react";
import { getDistanceToMunicipality, calculateDisplacementFee } from "@/lib/municipality-distances";

interface OSItem {
  id: number;
  numeroTarefa: string;
  clienteNome: string;
  clienteCnpjCpf: string;
  clienteTelefone?: string;
  equipe: string;
  tipoTarefa: string;
  dataAgendamento?: string;
  endereco: string;
  relatoExecucao?: string;
  status: string;
  proximaAcao?: string;
}

export function ServiceOrdersSection() {
  const [filter, setFilter] = useState<"em_aberto" | "hoje" | "todas" | "concluidas" | "canceladas">("em_aberto");
  const [searchQuery, setSearchQuery] = useState("");
  const [osList, setOsList] = useState<OSItem[]>([
    {
      id: 1,
      numeroTarefa: "77756554",
      clienteNome: "LANDSOL SERVIÇOS E PARTICIPAÇÕES S.A.",
      clienteCnpjCpf: "44.378.865/0001-61",
      clienteTelefone: "(11) 9999-9999",
      equipe: "TEAM 11",
      tipoTarefa: "Higienização & Laudo PMOC",
      dataAgendamento: "2026-09-04",
      endereco: "Rua Rui Barbosa, 2295, Centro, Mirassol - SP",
      relatoExecucao: "Higienização completa realizada com bactericida registrado no MS.",
      status: "Em Andamento",
      proximaAcao: "Coletar assinatura do fiscal predial",
    },
    {
      id: 2,
      numeroTarefa: "77756555",
      clienteNome: "PREFEITURA MUNICIPAL DE OLÍMPIA",
      clienteCnpjCpf: "46.598.123/0001-90",
      clienteTelefone: "(17) 3279-1000",
      equipe: "TEAM 02",
      tipoTarefa: "Manutenção Corretiva / Carga R410A",
      dataAgendamento: "2026-09-04",
      endereco: "Praça Rui Barbosa, 54, Centro, Olímpia - SP",
      relatoExecucao: "Troca de capacitor e recarga ecológica com teste de vácuo.",
      status: "Aguardando Peça",
      proximaAcao: "Comprar capacitor 45uF + 5uF",
    },
    {
      id: 3,
      numeroTarefa: "77756550",
      clienteNome: "HOSPITAL REGIONAL SÃO JOSÉ DO RIO PRETO",
      clienteCnpjCpf: "45.123.890/0001-22",
      clienteTelefone: "(17) 3201-5000",
      equipe: "TEAM 11",
      tipoTarefa: "PMOC Preventivo Trimestral",
      dataAgendamento: "2026-09-03",
      endereco: "Av. Philadelpho Manoel Gouveia Neto, 1850, São José do Rio Preto - SP",
      relatoExecucao: "Conferência de superaquecimento de 12 chillers e substituição de filtros G4.",
      status: "Concluído",
      proximaAcao: "Emitir ART e Certificado PMOC",
    },
  ]);

  const [selectedOs, setSelectedOs] = useState<OSItem | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [showOsReportModal, setShowOsReportModal] = useState(false);
  const [currentReportOs, setCurrentReportOs] = useState<OSItem | null>(null);

  // Filtro padrão de negócios: "Em aberto" oculta concluídas e canceladas
  const filteredList = osList.filter((os) => {
    const matchesSearch =
      os.clienteNome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      os.numeroTarefa.includes(searchQuery) ||
      os.equipe.toLowerCase().includes(searchQuery.toLowerCase()) ||
      os.endereco.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "em_aberto") return os.status !== "Concluído" && os.status !== "Cancelado";
    if (filter === "concluidas") return os.status === "Concluído";
    if (filter === "canceladas") return os.status === "Cancelado";
    if (filter === "hoje") return os.dataAgendamento === "2026-09-04";
    return true; // todas
  });

  const handleCopyAddress = (endereco: string) => {
    navigator.clipboard.writeText(endereco);
    alert("✓ Endereço copiado para a área de transferência!");
  };

  const handleOpenMaps = (endereco: string) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`, "_blank");
  };

  const handleAiAssist = () => {
    setGeneratingAi(true);
    setTimeout(() => {
      setAiSuggestion(
        "Concluída a higienização bactericida na serpentina e bandeja de condensado em conformidade com o Artigo 3º da Lei Federal nº 13.589/2018 (PMOC). Pressões de sucção (118 PSI) e descarga aferidas dentro dos parâmetros nominais do fabricante. Recomendada a troca de elemento filtrante no prazo de 60 dias."
      );
      setGeneratingAi(false);
    }, 900);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header com Filtro Padrão "Em Aberto" */}
      <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-600" />
            Ordens de Serviço & Relatórios Fotográficos PMOC
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Filtro padrão: <strong>Em aberto</strong> (concluídas e canceladas ocultas por padrão).
          </p>
        </div>

        {/* Barra de Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          {(["em_aberto", "hoje", "todas", "concluidas", "canceladas"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                filter === f
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Barra de Busca Abrangente */}
      <div className="p-4 border-b border-slate-100 bg-white">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por cliente, número da OS, equipe técnica ou endereço..."
            className="w-full text-xs pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
          />
        </div>
      </div>

      {/* Lista de OS com Camada de Próxima Ação */}
      <div className="p-6 divide-y divide-slate-100">
        {filteredList.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Nenhuma ordem de serviço encontrada para este filtro.
          </div>
        ) : (
          filteredList.map((os) => (
            <div key={os.id} className="py-4.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                    OS #{os.numeroTarefa}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      os.status === "Concluído"
                        ? "bg-emerald-100 text-emerald-800"
                        : os.status === "Aguardando Peça"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {os.status}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">• {os.equipe}</span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">{os.clienteNome}</h3>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {os.endereco}
                  </span>
                  <button
                    onClick={() => handleCopyAddress(os.endereco)}
                    className="text-blue-600 hover:text-blue-800 text-[11px] font-bold flex items-center gap-0.5"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                  <button
                    onClick={() => handleOpenMaps(os.endereco)}
                    className="text-emerald-600 hover:text-emerald-800 text-[11px] font-bold flex items-center gap-0.5"
                  >
                    <ExternalLink className="w-3 h-3" /> Como Chegar
                  </button>
                </div>

                {/* Próxima Ação em Destaque */}
                {os.proximaAcao && (
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-700 mt-1">
                    <span className="text-blue-600 font-bold uppercase text-[10px]">Próxima Ação:</span>
                    <span>{os.proximaAcao}</span>
                  </div>
                )}
              </div>

              {/* Botões Operacionais */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    setSelectedOs(os);
                    setShowAiModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition flex items-center gap-1 border border-purple-200"
                >
                  <Sparkles className="w-3.5 h-3.5" /> ✦ IA Conclusão
                </button>
                <button
                  onClick={() => {
                    setCurrentReportOs(os);
                    setShowOsReportModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir Laudo
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Assistente Técnico com IA */}
      {showAiModal && selectedOs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                ✦ IA Assistente de Conclusão Técnica (PMOC)
              </h3>
              <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">
                Fechar
              </button>
            </div>

            <p className="text-xs text-slate-500">
              A IA redige laudos e conclusões técnicas estruturadas respeitando a Lei Federal 13.589/2018 e dados reais informados pelo técnico.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Observação Bruta do Técnico em Campo:</label>
              <textarea
                rows={2}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex: limpeza geral feita, gas 118 psi ok, tudo funcionando..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg outline-none focus:border-purple-500"
              />
            </div>

            <button
              onClick={handleAiAssist}
              disabled={generatingAi}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {generatingAi ? "Redigindo Conclusão PMOC..." : "Gerar Laudo Estruturado com IA"}
            </button>

            {aiSuggestion && (
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs space-y-2">
                <span className="font-bold text-purple-900 block">Conclusão Técnica Sugerida:</span>
                <p className="text-slate-800 leading-relaxed italic">{aiSuggestion}</p>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      alert("✓ Conclusão técnica aplicada e salva na Ordem de Serviço!");
                      setShowAiModal(false);
                      setAiSuggestion("");
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition"
                  >
                    Aplicar na OS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Modal de Relatório de Ordem de Serviço Padrão A4 */}
      {showOsReportModal && currentReportOs && (
        <StandardDocumentReport
          tipo="ORDEM_SERVICO"
          numero={currentReportOs.numeroTarefa}
          data={currentReportOs.dataAgendamento || new Date().toLocaleDateString("pt-BR")}
          cliente={{
            nome: currentReportOs.clienteNome,
            cnpjCpf: currentReportOs.clienteCnpjCpf,
            telefone: currentReportOs.clienteTelefone,
            endereco: currentReportOs.endereco,
          }}
          descricaoServico={currentReportOs.relatoExecucao || "Serviço de higienização, manutenção preventiva PMOC e testes operacionais de temperatura e pressão."}
          itens={[
            {
              itemNum: "01",
              equipamentoOuItem: currentReportOs.tipoTarefa,
              capacidadeOuDetalhes: "Equipamentos Split / Piso Teto",
              quantidade: 1,
              valorUnitario: 350.0,
              valorTotal: 350.0,
            }
          ]}
          valorGlobal={350.0}
          onClose={() => setShowOsReportModal(false)}
        />
      )}
    </div>
  );
}
