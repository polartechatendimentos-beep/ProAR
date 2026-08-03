'use client';

import React, { useState, useEffect } from "react";
import { 
  FileText, ShieldCheck, MessageSquare, Database, RefreshCw, CheckCircle2, 
  Search, Download, Plus, Printer, Filter, CheckSquare, Clock, MapPin, Phone,
  Mail, User, Building, ExternalLink, ArrowRight, Upload, FileSpreadsheet
} from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"licitacoes" | "relatorios" | "export">("licitacoes");
  const [licitacoesList, setLicitacoesList] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("em_andamento");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Estados da Ordem de Serviço (Modelo Polartech)
  const [relatoriosList, setRelatoriosList] = useState<any[]>([]);
  const [selectedOs, setSelectedOs] = useState<any>(null);
  const [showOsModal, setShowOsModal] = useState(false);

  // Form para nova OS
  const [formOs, setFormOs] = useState({
    numeroTarefa: "77756554",
    clienteNome: "LANDSOL SERVICOS E PARTICIPACOES S.A.",
    clienteCnpjCpf: "44.378.865/0001-61",
    clienteContato: "JOSE VITOR DE PAIVA",
    clienteTelefone: "(11) 9999-9999",
    clienteEmail: "email@email.com",
    equipe: "TEAM 11",
    tipoTarefa: "Higienização",
    endereco: "Rua Rui Barbosa, 2295, Centro, Mirassol - SP, 15130-055, Brasil",
    orientacao: "HIGIENIZAÇÃO DE AR CONDICIONADO",
    relatoExecucao: "Higienização da unidade interna e externa concluída sem alterações.",
    assinaturaTecnicoNome: "Jhonnatan",
    assinaturaTecnicoDoc: "451.467.248-30",
    assinaturaClienteNome: "Bárbara Fernandes Brito",
    assinaturaClienteDoc: "067.969.435-89",
  });

  const fetchLicitacoes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/licitacoes?status=${statusFilter}&q=${encodeURIComponent(searchQuery)}`);
      const json = await res.json();
      if (json.success) setLicitacoesList(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatorios = async () => {
    try {
      const res = await fetch("/api/relatorios");
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setRelatoriosList(json.data);
        if (!selectedOs) setSelectedOs(json.data[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchLicitacoes();
    fetchRelatorios();
  }, [statusFilter]);

  const handleSyncPncp = async () => {
    setLoading(true);
    try {
      await fetch("/api/cron/licitacoes");
      await fetchLicitacoes();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/relatorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formOs),
      });
      const json = await res.json();
      if (json.success) {
        fetchRelatorios();
        setShowOsModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportToJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ licitacoes: licitacoesList, relatorios: relatoriosList }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `proar_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      {/* Top Navbar */}
      <nav className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg font-bold tracking-wider text-lg">ProAR</div>
            <div>
              <span className="font-semibold text-base block leading-tight">POLARTECH Climatização</span>
              <span className="text-xs text-slate-400">Sistema Autônomo de Licitações & Relatórios OS</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab("licitacoes")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "licitacoes" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
            >
              Licitações em Andamento
            </button>
            <button 
              onClick={() => setActiveTab("relatorios")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "relatorios" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
            >
              Relatórios de OS (Polartech)
            </button>
            <button 
              onClick={() => setActiveTab("export")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "export" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
            >
              Exportar / Importar
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* TABA 1: LICITAÇÕES EM ANDAMENTO */}
        {activeTab === "licitacoes" && (
          <div className="space-y-6">
            {/* Header & Controls */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Licitações em Andamento</h1>
                  <p className="text-sm text-slate-500">
                    Monitoramento contínuo de pregões e concorrências ativas no PNCP e portais públicos.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncPncp}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-sm transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    {loading ? "Sincronizando PNCP..." : "Buscar Licitações Agora"}
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                <div className="md:col-span-2 relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por objeto, órgão, número ou palavra-chave..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchLicitacoes()}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="em_andamento">🟢 Status: Em Andamento</option>
                    <option value="fase_lance">🟡 Status: Fase de Lances</option>
                    <option value="proposta_enviada">🔵 Status: Proposta Enviada</option>
                    <option value="todas">⚪ Todos os Status</option>
                  </select>
                </div>

                <button
                  onClick={fetchLicitacoes}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition"
                >
                  Filtrar Resultados
                </button>
              </div>
            </div>

            {/* List of Licitacoes */}
            <div className="grid grid-cols-1 gap-4">
              {licitacoesList.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3 hover:border-blue-300 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> EM ANDAMENTO
                      </span>
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        PNCP: {item.numeroControlePncp || "Disponível"}
                      </span>
                    </div>

                    <div className="text-sm font-semibold text-slate-900">
                      Valor Estimado: <span className="text-blue-600">{item.valorEstimado || "A consultar"}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-snug">{item.titulo}</h3>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{item.descricao}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-slate-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Building className="w-3.5 h-3.5 text-slate-400" /> {item.orgao}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> UF: {item.uf || "SP"}
                      </span>
                      <span>Modalidade: <strong>{item.modalidade || "Pregão Eletrônico"}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={item.linkEdital || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-medium text-xs transition"
                      >
                        Acessar Edital <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TABA 2: RELATÓRIOS / ORDEM DE SERVIÇO (MODELO POLARTECH) */}
        {activeTab === "relatorios" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Relatório de Ordem de Serviço (Modelo POLARTECH)</h1>
                <p className="text-xs text-slate-500">Emissão de relatórios fotográficos e checklists operacionais conforme modelo padrão.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition"
                >
                  <Printer className="w-4 h-4" /> Imprimir / PDF
                </button>

                <button
                  onClick={() => setShowOsModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  <Plus className="w-4 h-4" /> Nova Ordem de Serviço
                </button>
              </div>
            </div>

            {/* Impressão / Documento Visual Formatado (Fiel ao Modelo POLARTECH / LANDSOL) */}
            {selectedOs && (
              <div className="bg-white border-2 border-slate-900 p-8 shadow-md rounded-none max-w-4xl mx-auto space-y-6 print:border-none print:shadow-none print:p-0">
                {/* Cabeçalho da Empresa */}
                <div className="border-b-2 border-slate-900 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-900 text-white font-extrabold px-3 py-2 text-xl tracking-wider uppercase">
                      POLARTECH
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 leading-tight">POLARTECH AR CONDICIONADO</h2>
                      <p className="text-xs text-slate-600">Telefone: (17) 2122-2806 | CNPJ: 45.823.828/0001-88</p>
                      <p className="text-xs text-slate-600">Email: atendimentos@polartechsolucoes.com.br</p>
                      <p className="text-xs text-slate-600">Rua Sao Pedro, 2184, Sala 01, Centro, Mirassol, SP</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold bg-slate-100 px-3 py-1 border border-slate-300 rounded">
                      Ordem de Serviço nº {selectedOs.numeroTarefa}
                    </span>
                    <p className="text-xs text-slate-500 mt-2"><strong>Cliente:</strong> {selectedOs.clienteNome}</p>
                  </div>
                </div>

                {/* Informações do Cliente & Atividade */}
                <div className="grid grid-cols-2 gap-4 border border-slate-300 p-4 bg-slate-50 text-xs">
                  <div>
                    <h3 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2 uppercase">Informações do Cliente</h3>
                    <p><strong>Falar com:</strong> {selectedOs.clienteContato}</p>
                    <p><strong>CPF/CNPJ:</strong> {selectedOs.clienteCnpjCpf}</p>
                    <p><strong>Telefone:</strong> {selectedOs.clienteTelefone}</p>
                    <p><strong>E-mail:</strong> {selectedOs.clienteEmail}</p>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2 uppercase">Informações da Atividade</h3>
                    <p><strong>Para:</strong> {selectedOs.equipe}</p>
                    <p><strong>Tipo tarefa:</strong> {selectedOs.tipoTarefa}</p>
                    <p><strong>Check-In:</strong> 31/07/2026 às 15:42</p>
                    <p><strong>Check-Out:</strong> 31/07/2026 às 16:31</p>
                    <p><strong>Duração:</strong> {selectedOs.duracao}</p>
                    <p><strong>Endereço:</strong> {selectedOs.endereco}</p>
                  </div>
                </div>

                {/* Questionário / Checklist */}
                <div className="border border-slate-300 p-4 text-xs space-y-2">
                  <h3 className="font-bold text-slate-900 border-b border-slate-300 pb-1 uppercase">Questionário: CHECKLIST HIGIENIZAÇÃO / LIMPEZA</h3>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="flex justify-between border-b border-slate-100 py-1">
                      <span>Limpeza dos filtros</span> <strong className="text-emerald-700">Sim</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 py-1">
                      <span>Limpeza da serpentina e bandeja</span> <strong className="text-emerald-700">Sim</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 py-1">
                      <span>Limpeza do dreno</span> <strong className="text-emerald-700">Sim</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 py-1">
                      <span>Aplicação de produto bactericida</span> <strong className="text-emerald-700">Sim</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 py-1">
                      <span>Limpeza da unidade externa</span> <strong className="text-emerald-700">Sim</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 py-1">
                      <span>Teste final de funcionamento</span> <strong className="text-emerald-700">Sim</strong>
                    </div>
                  </div>
                </div>

                {/* Fotos Antes e Fotos Depois */}
                <div className="border border-slate-300 p-4 text-xs space-y-3">
                  <h3 className="font-bold text-slate-900 border-b border-slate-300 pb-1 uppercase">Registro Fotográfico</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-semibold block mb-2 text-slate-700">Fotos Antes:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <img src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=300" alt="Foto Antes" className="w-full h-32 object-cover border border-slate-300" />
                        <img src="https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=300" alt="Foto Antes 2" className="w-full h-32 object-cover border border-slate-300" />
                      </div>
                    </div>

                    <div>
                      <span className="font-semibold block mb-2 text-slate-700">Fotos Depois:</span>
                      <div className="grid grid-cols-1 gap-2">
                        <img src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300" alt="Foto Depois" className="w-full h-32 object-cover border border-slate-300" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assinaturas */}
                <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs text-center">
                  <div>
                    <div className="border-b border-slate-900 mb-1 pb-4 italic font-semibold text-slate-800">
                      Thomota
                    </div>
                    <p><strong>Assinatura do Técnico:</strong> {selectedOs.assinaturaTecnicoNome || "Jhonnatan"}</p>
                    <p className="text-slate-500">Doc: {selectedOs.assinaturaTecnicoDoc || "451.467.248-30"}</p>
                  </div>

                  <div>
                    <div className="border-b border-slate-900 mb-1 pb-4 italic font-semibold text-slate-800">
                      Bárbara F. Brito
                    </div>
                    <p><strong>Assinado por:</strong> {selectedOs.assinaturaClienteNome || "Bárbara Fernandes Brito"}</p>
                    <p className="text-slate-500">Doc: {selectedOs.assinaturaClienteDoc || "067.969.435-89"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TABA 3: EXPORTAR / IMPORTAR PARA SISTEMA DE DESENVOLVIMENTO */}
        {activeTab === "export" && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Exportação e Importação de Dados</h1>
              <p className="text-sm text-slate-500 mt-1">
                Exporte o banco de dados em formato JSON/CSV para integração com seu sistema externo de desenvolvimento.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-200 p-6 rounded-xl space-y-3 bg-slate-50">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Exportar Licitações e Relatórios em JSON</h2>
                <p className="text-xs text-slate-600">
                  Gera um arquivo estruturado contendo todas as licitações em andamento e ordens de serviço cadastradas.
                </p>
                <button
                  onClick={exportToJson}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  <Download className="w-4 h-4" /> Baixar Dados (.JSON)
                </button>
              </div>

              <div className="border border-slate-200 p-6 rounded-xl space-y-3 bg-slate-50">
                <Upload className="w-8 h-8 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Importação para Sistema de Desenvolvimento</h2>
                <p className="text-xs text-slate-600">
                  Estrutura de dados pronta para importação via API REST ou banco de dados PostgreSQL.
                </p>
                <div className="bg-slate-900 text-slate-200 text-xs font-mono p-3 rounded-lg">
                  GET /api/licitacoes?status=em_andamento<br />
                  GET /api/relatorios
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Modal Nova OS */}
      {showOsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-900 border-b pb-2">Nova Ordem de Serviço (Modelo Polartech)</h2>
            <form onSubmit={handleCreateOs} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Cliente / Razão Social</label>
                  <input
                    type="text"
                    value={formOs.clienteNome}
                    onChange={(e) => setFormOs({ ...formOs, clienteNome: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">CPF/CNPJ</label>
                  <input
                    type="text"
                    value={formOs.clienteCnpjCpf}
                    onChange={(e) => setFormOs({ ...formOs, clienteCnpjCpf: e.target.value })}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Falar com (Contato)</label>
                  <input
                    type="text"
                    value={formOs.clienteContato}
                    onChange={(e) => setFormOs({ ...formOs, clienteContato: e.target.value })}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Telefone</label>
                  <input
                    type="text"
                    value={formOs.clienteTelefone}
                    onChange={(e) => setFormOs({ ...formOs, clienteTelefone: e.target.value })}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Endereço de Atendimento</label>
                <input
                  type="text"
                  value={formOs.endereco}
                  onChange={(e) => setFormOs({ ...formOs, endereco: e.target.value })}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowOsModal(false)}
                  className="px-4 py-2 border rounded font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                >
                  Salvar e Gerar OS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
