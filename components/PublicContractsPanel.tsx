"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Landmark,
  RefreshCw,
  Bell,
  ExternalLink,
  Search,
  Plus,
  Bot,
  ShieldCheck,
  FileCheck,
  Folder,
  Gavel,
  BarChart3,
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
  id: number;
  numeroPregao?: string;
  numeroProcesso?: string;
  titulo: string;
  orgao: string;
  uf: string;
  modalidade: string;
  valorEstimado?: string;
  dataAbertura?: string;
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
}

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

export function PublicContractsPanel() {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<LicTab>("painel");
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLic, setNewLic] = useState({
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
  });

  const fetchLicitacoes = async (q = "") => {
    try {
      const res = await fetch(`/api/licitacoes?status=todas${q ? `&q=${encodeURIComponent(q)}` : ""}`);
      const json = await res.json();
      if (json.success) {
        setLicitacoes(json.data || []);
      }
    } catch (e) {
      console.error("Erro ao carregar licitações:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicitacoes();
  }, []);

  const handleSyncPncp = async () => {
    setSyncing(true);
    try {
      await fetch("/api/cron/licitacoes");
      await fetchLicitacoes(query);
    } catch (e) {
      console.error("Erro ao sincronizar PNCP:", e);
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
        setNewLic({
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
        });
        fetchLicitacoes(query);
      }
    } finally {
      setSaving(false);
    }
  };

  const resumo = useMemo(() => {
    const total = licitacoes.length;
    const emAndamento = licitacoes.filter((l) => l.status === "em_andamento").length;
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
              {syncing ? "Sincronizando..." : "Buscar PNCP"}
            </button>
          </div>
        </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Licitações" value={String(resumo.total)} icon={<Landmark className="w-4 h-4" />} />
            <Card title="Em andamento" value={String(resumo.emAndamento)} icon={<Gavel className="w-4 h-4" />} />
            <Card title="Habilitação média" value={`${resumo.mediaHab}%`} icon={<ShieldCheck className="w-4 h-4" />} />
            <Card title="Alertas críticos" value={String(resumo.criticos)} icon={<Bell className="w-4 h-4" />} />
          </div>
        )}

        {(activeTab === "oportunidades" || activeTab === "processos" || activeTab === "editais") && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-8 text-slate-500 text-center">Carregando licitações...</div>
            ) : licitacoes.length === 0 ? (
              <div className="py-8 text-slate-500 text-center">Nenhuma licitação encontrada.</div>
            ) : (
              licitacoes.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-bold">{item.modalidade}</span>
                      <span className="text-xs text-slate-600">{item.numeroPregao || "Sem nº pregão"}</span>
                      {item.notificadoWhatsapp && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Bell className="w-3 h-3" /> Alerta
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{item.titulo}</h3>
                    <p className="text-xs text-slate-600">{item.orgao} • {item.uf}</p>
                    <p className="text-xs text-slate-500">Resp.: {item.responsavelInterno || "-"} • Plataforma: {item.plataforma || "-"}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Valor estimado</div>
                    <div className="text-sm font-bold text-slate-900">{item.valorEstimado || "A consultar"}</div>
                    <a
                      href={item.linkEdital || "https://pncp.gov.br"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 font-bold mt-1"
                    >
                      Abrir edital <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
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
            <p className="text-xs text-slate-600">Base pronta para certidões, validade, reutilização e validação cruzada por IA em /api/licitacoes-documents.</p>
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
