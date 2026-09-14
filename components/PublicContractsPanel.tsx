"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  ExternalLink,
  FileCheck,
  Folder,
  Gavel,
  Landmark,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";

type LicTab =
  | "painel"
  | "oportunidades"
  | "processos"
  | "editais"
  | "checklist"
  | "documentos"
  | "capacidade"
  | "propostas"
  | "sessao"
  | "bidagent"
  | "pendencias"
  | "contratos"
  | "historico"
  | "relatorios";

interface Licitacao {
  id: string | number;
  numeroControlePncp?: string;
  numeroPregao?: string;
  numeroProcesso?: string;
  titulo: string;
  descricao?: string;
  orgao: string;
  cnpj?: string;
  unidade?: string;
  municipio?: string;
  uf: string;
  modalidade: string;
  valorEstimado?: string;
  dataPublicacao?: string;
  dataAbertura?: string;
  dataFimProposta?: string;
  status: string;
  linkEdital?: string;
  notificadoWhatsapp?: boolean;
  habilitacaoPercentual?: number;
  checklistResumo?: {
    atendidos?: number;
    revisar?: number;
    criticos?: number;
    pendentes?: number;
  };
  pisoAbsoluto?: string;
  plataforma?: string;
  responsavelInterno?: string;
  distanciaKm?: number;
  anoCompra?: string;
  sequencialCompra?: string;
  source?: string;
}

type PncpDocument = {
  id: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  dataPublicacao?: string;
  url: string;
};

export type PublicContractRecord = {
  id: string;
  name: string;
  client?: string;
  administrativeProcess?: string;
  certameItems?: { id: string; description: string }[];
};

const SUBTABS: { id: LicTab; label: string }[] = [
  { id: "painel", label: "Painel" },
  { id: "oportunidades", label: "Oportunidades" },
  { id: "processos", label: "Processos" },
  { id: "editais", label: "Editais" },
  { id: "checklist", label: "Checklist IA" },
  { id: "documentos", label: "Documentos" },
  { id: "capacidade", label: "Capacidade Técnica" },
  { id: "propostas", label: "Propostas" },
  { id: "sessao", label: "Sessão de Lances" },
  { id: "bidagent", label: "Bid Agent" },
  { id: "pendencias", label: "Pendências" },
  { id: "contratos", label: "Contratos/Atas" },
  { id: "historico", label: "Histórico" },
  { id: "relatorios", label: "Relatórios" },
];

const INITIAL_NEW_LIC = {
  orgao: "",
  numeroPregao: "",
  numeroProcesso: "",
  titulo: "",
  descricao: "",
  plataforma: "",
  modalidade: "Pregão Eletrônico",
  dataAbertura: "",
  horaSessao: "09:00",
  tipoJulgamento: "menor_preco_global",
  modoDisputa: "aberto",
  valorEstimado: "",
  responsavelInterno: "Administrador Matriz",
  linkEdital: "",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function formatDateValue(value?: string, withTime = false) {
  if (!value) return "A informar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime ? dateTimeFormatter.format(date) : dateFormatter.format(date);
}

function formatStatusLabel(value?: string) {
  if (!value) return "Sem status";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDistance(value?: number | null) {
  return value === null || value === undefined ? "Não calculada" : `${value} km`;
}

function canLoadPncpDocuments(item: Licitacao) {
  return Boolean(item.numeroControlePncp || (item.cnpj && item.anoCompra && item.sequencialCompra));
}

export function PublicContractsPanel() {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<LicTab>("painel");
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Licitacao | null>(null);
  const [documents, setDocuments] = useState<PncpDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [newLic, setNewLic] = useState(INITIAL_NEW_LIC);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const fetchLicitacoes = async (q = "") => {
    try {
      const res = await fetch(`/api/licitacoes?status=todas${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      const json = await res.json();
      if (json.success) {
        setLicitacoes(Array.isArray(json.data) ? json.data : []);
      }
    } catch (e) {
      console.error("Erro ao carregar licitações:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLicitacoes();
  }, []);

  useEffect(() => {
    if (!selectedOpportunity) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedOpportunity(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedOpportunity]);

  const loadDocuments = async (item: Licitacao) => {
    if (!canLoadPncpDocuments(item)) {
      setDocuments([]);
      setDocumentsError("");
      return;
    }

    const params = new URLSearchParams();
    if (item.numeroControlePncp) params.set("numero_controle_pncp", item.numeroControlePncp);
    if (item.cnpj) params.set("cnpj", item.cnpj);
    if (item.anoCompra) params.set("ano_compra", item.anoCompra);
    if (item.sequencialCompra) params.set("sequencial_compra", item.sequencialCompra);

    setDocumentsLoading(true);
    setDocumentsError("");
    try {
      const response = await fetch(`/api/licitacoes/pncp-documents?${params.toString()}`);
      const json = await response.json();
      if (!response.ok || !json.success) {
        setDocuments([]);
        setDocumentsError(json.error || "Não foi possível consultar os documentos oficiais agora.");
        return;
      }
      setDocuments(Array.isArray(json.data) ? json.data : []);
    } catch {
      setDocuments([]);
      setDocumentsError("Não foi possível carregar os documentos do PNCP no momento.");
    } finally {
      setDocumentsLoading(false);
    }
  };

  const openOpportunity = async (item: Licitacao) => {
    setSelectedOpportunity(item);
    setDocuments([]);
    setDocumentsError("");
    await loadDocuments(item);
  };

  const handleSyncPncp = async () => {
    setSyncing(true);
    setNotice("");
    try {
      const response = await fetch("/api/licitacoes/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uf: "SP", days: 14 }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        setNotice(json.error || "Não foi possível consultar o PNCP agora.");
        return;
      }
      setNotice(json.persistence ? `${json.message || "Consulta PNCP concluída."} ${json.persistence}` : (json.message || "Consulta PNCP concluída."));
      if (Array.isArray(json.data)) {
        setLicitacoes(json.data);
        setLoading(false);
        setActiveTab("oportunidades");
      }
    } catch {
      setNotice("Não foi possível conectar ao PNCP. Tente novamente.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetchLicitacoes(query);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLic.orgao || !newLic.titulo) return;

    setSaving(true);
    try {
      const payload = {
        ...newLic,
        status: "em_andamento",
        habilitacaoPercentual: 0,
        checklistResumo: { atendidos: 0, revisar: 0, criticos: 0, pendentes: 0 },
      };

      const res = await fetch("/api/licitacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowNewModal(false);
        setNewLic(INITIAL_NEW_LIC);
        void fetchLicitacoes(query);
      }
    } finally {
      setSaving(false);
    }
  };

  const resumo = useMemo(() => {
    const total = licitacoes.length;
    const emAndamento = licitacoes.filter((l) => l.status === "em_andamento" || l.status === "oportunidade").length;
    const mediaHab = total
      ? Math.round(licitacoes.reduce((acc, l) => acc + (l.habilitacaoPercentual || 0), 0) / total)
      : 0;
    const criticos = licitacoes.reduce((acc, l) => acc + (l.checklistResumo?.criticos || 0), 0);
    return { total, emAndamento, mediaHab, criticos };
  }, [licitacoes]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Landmark className="w-6 h-6 text-indigo-600" />
              LICITAÇÕES IA + BID AGENT
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Descoberta, checklist de habilitação, proposta, disputa e pós-disputa em fluxo único.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              <Plus className="w-4 h-4" /> Nova Licitação
            </button>
            <button
              onClick={handleSyncPncp}
              disabled={syncing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-indigo-600" : ""}`} />
              {syncing ? "Buscando..." : "Buscar oportunidades"}
            </button>
          </div>
        </div>

        {notice && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">{notice}</div>}

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por órgão, objeto, número do pregão, processo..."
              className="w-full border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button type="submit" className="px-3.5 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg">
            Buscar
          </button>
        </form>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {SUBTABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap ${
                activeTab === tab.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-4">
        {activeTab === "painel" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card title="Licitações" value={String(resumo.total)} icon={<Landmark className="w-4 h-4" />} />
              <Card title="Em andamento" value={String(resumo.emAndamento)} icon={<Gavel className="w-4 h-4" />} />
              <Card title="Habilitação média" value={`${resumo.mediaHab}%`} icon={<ShieldCheck className="w-4 h-4" />} />
              <Card title="Alertas críticos" value={String(resumo.criticos)} icon={<Bell className="w-4 h-4" />} />
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs text-indigo-900 flex flex-col gap-1">
              <span className="font-bold">Resultados ao vivo do PNCP</span>
              <span>Busque oportunidades e abra a ficha detalhada para consultar dados do processo e anexos oficiais.</span>
            </div>
          </>
        )}

        {(activeTab === "oportunidades" || activeTab === "processos" || activeTab === "editais") && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-8 text-slate-500 text-center">Carregando licitações...</div>
            ) : licitacoes.length === 0 ? (
              <div className="py-8 text-slate-500 text-center">Nenhuma licitação encontrada.</div>
            ) : (
              licitacoes.map((item) => (
                <article
                  key={item.id}
                  className="border border-slate-200 rounded-xl p-4 flex flex-col gap-4 hover:border-indigo-300 hover:shadow-sm transition cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={() => void openOpportunity(item)}
                    className="w-full text-left space-y-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    aria-label={`Abrir ficha detalhada da licitação ${item.titulo}`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-bold">{item.modalidade}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 font-semibold">{formatStatusLabel(item.status)}</span>
                          <span className="text-xs text-slate-600">{item.numeroPregao || item.numeroProcesso || "Sem identificação interna"}</span>
                          {item.notificadoWhatsapp && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                              <Bell className="w-3 h-3" /> Alerta
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{item.titulo}</h3>
                          <p className="text-xs text-slate-600 mt-1">{item.orgao} • {item.uf}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-start lg:items-end gap-2">
                        <div className="text-xs text-slate-400">Valor estimado</div>
                        <div className="text-sm font-bold text-slate-900">{item.valorEstimado || "A consultar"}</div>
                        <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-bold">
                          Ver ficha detalhada <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                      <DetailChip icon={<Building2 className="w-3.5 h-3.5" />} label="Unidade" value={item.unidade || "Não informada"} />
                      <DetailChip icon={<MapPin className="w-3.5 h-3.5" />} label="Município" value={item.municipio ? `${item.municipio}/${item.uf}` : `UF ${item.uf}`} />
                      <DetailChip icon={<CalendarDays className="w-3.5 h-3.5" />} label="Publicação" value={formatDateValue(item.dataPublicacao)} />
                      <DetailChip icon={<CalendarDays className="w-3.5 h-3.5" />} label="Encerramento" value={formatDateValue(item.dataFimProposta, true)} />
                    </div>
                  </button>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>CNPJ: {item.cnpj || "Aguardando PNCP"}</span>
                      <span>PNCP: {item.numeroControlePncp || "Sem número"}</span>
                      <span>Distância: {formatDistance(item.distanciaKm)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.linkEdital && (
                        <a
                          href={item.linkEdital}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700"
                        >
                          Abrir origem <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => void openOpportunity(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
                      >
                        Abrir ficha
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === "checklist" && (
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2"><FileCheck className="w-4 h-4 text-indigo-600" /> Checklist IA</h3>
            <p className="text-xs text-slate-600 mb-3">Semáforo de habilitação com justificativa, página e cláusula do edital.</p>
            {licitacoes.slice(0, 4).map((l) => (
              <div key={l.id} className="text-xs border-t py-2 flex items-center justify-between">
                <span className="font-semibold text-slate-700">{l.numeroPregao || l.titulo}</span>
                <span className="font-bold text-indigo-700">{l.habilitacaoPercentual || 0}%</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "documentos" && (
          <div className="border border-slate-200 rounded-xl p-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-2"><Folder className="w-4 h-4 text-indigo-600" /> Cofre documental inteligente</h3>
            <p className="text-xs text-slate-600">A ficha da oportunidade consulta editais e anexos oficiais do PNCP quando o processo informar CNPJ, ano e sequencial da contratação.</p>
          </div>
        )}

        {activeTab === "capacidade" && (
          <div className="border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
            Currículo técnico digital (atestados, contratos, NF, OS e PMOC) com vinculação por pregão e quantitativos.
          </div>
        )}

        {activeTab === "propostas" && (
          <div className="border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
            Formação de preço com piso técnico e piso absoluto por processo. Recomendação IA sem ultrapassar alçadas.
          </div>
        )}

        {activeTab === "sessao" && (
          <div className="border border-slate-200 rounded-xl p-4 text-xs text-slate-700">
            Sessão de lances com trilha de eventos em /api/licitacoes-bid-events e controle de sessão em /api/licitacoes-bid-sessions.
          </div>
        )}

        {activeTab === "bidagent" && (
          <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4 space-y-2">
            <h3 className="font-bold text-indigo-900 flex items-center gap-2"><Bot className="w-4 h-4" /> ProAR Bid Agent (Windows)</h3>
            <p className="text-xs text-indigo-900">
              Primeira operação recomendada: <strong>Modo Aprendizado + Observador</strong> (sem envio automático de lances).
            </p>
            <ul className="text-xs text-indigo-800 list-disc pl-4 space-y-1">
              <li>Selecionar janela do portal e iniciar aprendizado.</li>
              <li>Reconhecer melhor lance, nosso lance, cronômetro, campo e botão de envio.</li>
              <li>Registrar confiança por elemento e pausar se abaixo do limite.</li>
              <li>Respeitar piso absoluto e kill switch (CTRL + ALT + F8).</li>
            </ul>
          </div>
        )}

        {(activeTab === "pendencias" || activeTab === "contratos" || activeTab === "historico" || activeTab === "relatorios") && (
          <div className="border border-slate-200 rounded-xl p-4 text-xs text-slate-700 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            Estrutura preparada para auditoria completa, pendências pós-disputa, contratos e relatórios gerenciais.
          </div>
        )}
      </div>

      {selectedOpportunity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="licitacao-detail-title"
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-slate-200 shadow-xl"
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600">Ficha detalhada da oportunidade</p>
                <h3 id="licitacao-detail-title" className="text-lg font-bold text-slate-900 mt-1">{selectedOpportunity.titulo}</h3>
                <p className="text-xs text-slate-500 mt-1">{selectedOpportunity.orgao}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedOpportunity.linkEdital && (
                  <a
                    href={selectedOpportunity.linkEdital}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700"
                  >
                    Portal de origem <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOpportunity(null)}
                  ref={closeButtonRef}
                  aria-label="Fechar a ficha detalhada"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <InfoBlock label="Órgão" value={selectedOpportunity.orgao} />
                <InfoBlock label="Unidade" value={selectedOpportunity.unidade || "Não informada"} />
                <InfoBlock label="Município" value={selectedOpportunity.municipio ? `${selectedOpportunity.municipio}/${selectedOpportunity.uf}` : `UF ${selectedOpportunity.uf}`} />
                <InfoBlock label="CNPJ" value={selectedOpportunity.cnpj || "Não informado"} />
                <InfoBlock label="Número PNCP" value={selectedOpportunity.numeroControlePncp || "Não informado"} />
                <InfoBlock label="Modalidade" value={selectedOpportunity.modalidade} />
                <InfoBlock label="Publicação" value={formatDateValue(selectedOpportunity.dataPublicacao)} />
                <InfoBlock label="Encerramento" value={formatDateValue(selectedOpportunity.dataFimProposta, true)} />
                <InfoBlock label="Valor estimado" value={selectedOpportunity.valorEstimado || "A consultar"} />
                <InfoBlock label="Processo" value={selectedOpportunity.numeroProcesso || "Não informado"} />
                <InfoBlock label="Pregão/Edital" value={selectedOpportunity.numeroPregao || "Não informado"} />
                <InfoBlock label="Distância" value={selectedOpportunity.distanciaKm === null || selectedOpportunity.distanciaKm === undefined ? "Não calculada" : `${selectedOpportunity.distanciaKm} km de Mirassol/SP`} />
              </div>

              {selectedOpportunity.descricao && (
                <section className="rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-2">Objeto</h4>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedOpportunity.descricao}</p>
                </section>
              )}

              <section className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Documentos oficiais do PNCP</h4>
                    <p className="text-xs text-slate-500 mt-1">Edital e anexos abertos diretamente na ficha quando o PNCP informar o processo completo.</p>
                  </div>
                  {canLoadPncpDocuments(selectedOpportunity) && (
                    <button
                      type="button"
                      onClick={() => void loadDocuments(selectedOpportunity)}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${documentsLoading ? "animate-spin" : ""}`} /> Atualizar anexos
                    </button>
                  )}
                </div>

                {!canLoadPncpDocuments(selectedOpportunity) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    O PNCP ainda não informou CNPJ, ano e sequencial suficientes para abrir os anexos oficiais deste processo.
                  </div>
                )}
                {documentsError && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{documentsError}</div>
                )}
                {documentsLoading ? (
                  <div className="rounded-lg border border-slate-200 px-3 py-6 text-sm text-slate-500 text-center">Consultando documentos oficiais...</div>
                ) : documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((document) => (
                      <article key={document.id} className="rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">{document.tipo}</p>
                          <h5 className="text-sm font-bold text-slate-900 mt-1">{document.titulo}</h5>
                          <p className="text-xs text-slate-500 mt-1">{document.descricao || "Documento oficial disponibilizado pelo PNCP."}</p>
                          <p className="text-xs text-slate-400 mt-2">Publicado em {formatDateValue(document.dataPublicacao)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={document.url}
                            target="_self"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700"
                          >
                            Abrir aqui <ExternalLink className="w-3 h-3" />
                          </a>
                          <a
                            href={document.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
                          >
                            Nova aba <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : canLoadPncpDocuments(selectedOpportunity) ? (
                  <div className="rounded-lg border border-slate-200 px-3 py-6 text-sm text-slate-500 text-center">Nenhum anexo oficial foi retornado pelo PNCP para esta contratação.</div>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 p-4 flex items-center justify-center">
          <div className="bg-white rounded-xl w-full max-w-2xl p-5 border">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Nova Licitação</h3>
            <p className="text-xs text-slate-500 mb-4">Cadastro do processo + preparação para análise IA e Bid Agent.</p>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="Órgão">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex.: Prefeitura de Tanabi" value={newLic.orgao} onChange={(e) => setNewLic((s) => ({ ...s, orgao: e.target.value }))} required />
              </Field>
              <Field label="Modalidade">
                <select className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value={newLic.modalidade} onChange={(e) => setNewLic((s) => ({ ...s, modalidade: e.target.value }))}>
                  <option>Pregão Eletrônico</option><option>Concorrência</option><option>Dispensa</option><option>Inexigibilidade</option><option>Chamamento Público</option>
                </select>
              </Field>
              <Field label="Número do pregão">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex.: PE 088/2026" value={newLic.numeroPregao} onChange={(e) => setNewLic((s) => ({ ...s, numeroPregao: e.target.value }))} />
              </Field>
              <Field label="Número do processo">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Número administrativo" value={newLic.numeroProcesso} onChange={(e) => setNewLic((s) => ({ ...s, numeroProcesso: e.target.value }))} />
              </Field>
              <Field label="Objeto da licitação" className="sm:col-span-2">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Descrição resumida do objeto" value={newLic.titulo} onChange={(e) => setNewLic((s) => ({ ...s, titulo: e.target.value }))} required />
              </Field>
              <Field label="Descrição complementar" className="sm:col-span-2">
                <textarea className="w-full min-h-20 resize-y border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Escopo, itens, exigências iniciais ou observações" value={newLic.descricao} onChange={(e) => setNewLic((s) => ({ ...s, descricao: e.target.value }))} />
              </Field>
              <Field label="Plataforma">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex.: ComprasGov, BLL, Licitanet" value={newLic.plataforma} onChange={(e) => setNewLic((s) => ({ ...s, plataforma: e.target.value }))} />
              </Field>
              <Field label="Valor estimado">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="R$ 0,00" value={newLic.valorEstimado} onChange={(e) => setNewLic((s) => ({ ...s, valorEstimado: e.target.value }))} />
              </Field>
              <Field label="Data da sessão">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" type="date" value={newLic.dataAbertura} onChange={(e) => setNewLic((s) => ({ ...s, dataAbertura: e.target.value }))} />
              </Field>
              <Field label="Hora da sessão">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" type="time" value={newLic.horaSessao} onChange={(e) => setNewLic((s) => ({ ...s, horaSessao: e.target.value }))} />
              </Field>
              <Field label="Tipo de julgamento">
                <select className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value={newLic.tipoJulgamento} onChange={(e) => setNewLic((s) => ({ ...s, tipoJulgamento: e.target.value }))}>
                  <option value="menor_preco_global">Menor preço global</option><option value="menor_preco_item">Menor preço por item</option><option value="menor_preco_lote">Menor preço por lote</option><option value="maior_desconto">Maior desconto</option><option value="tecnica_preco">Técnica e preço</option>
                </select>
              </Field>
              <Field label="Modo de disputa">
                <select className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value={newLic.modoDisputa} onChange={(e) => setNewLic((s) => ({ ...s, modoDisputa: e.target.value }))}>
                  <option value="aberto">Aberto</option><option value="aberto_fechado">Aberto e fechado</option><option value="fechado_aberto">Fechado e aberto</option><option value="fechado">Fechado</option>
                </select>
              </Field>
              <Field label="Responsável interno">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Usuário responsável" value={newLic.responsavelInterno} onChange={(e) => setNewLic((s) => ({ ...s, responsavelInterno: e.target.value }))} />
              </Field>
              <Field label="Link do edital" className="sm:col-span-2">
                <input className="w-full border border-slate-300 rounded-lg p-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" type="url" placeholder="https://..." value={newLic.linkEdital} onChange={(e) => setNewLic((s) => ({ ...s, linkEdital: e.target.value }))} />
              </Field>
              <p className="sm:col-span-2 text-slate-500">O edital poderá ser anexado e analisado com IA após a migração do banco e a configuração da credencial central.</p>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowNewModal(false)} className="px-3 py-2 rounded-lg bg-slate-100 font-semibold">Cancelar</button>
                <button disabled={saving} type="submit" className="px-3 py-2 rounded-lg bg-indigo-600 text-white font-semibold">
                  {saving ? "Salvando..." : "Salvar licitação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`grid gap-1 font-semibold text-slate-700 ${className}`}><span>{label}</span>{children}</label>;
}

function Card({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
      <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
        <span>{title}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
}

function DetailChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-1 break-words">{value}</p>
    </div>
  );
}
