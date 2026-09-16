"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  Clipboard,
  Clock3,
  ExternalLink,
  FileCheck,
  Folder,
  Gavel,
  Landmark,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  X,
} from "lucide-react";
import type { CertameItem, CertameMovement } from "@/lib/public-contracts";

type LicTab = "radar" | "preflight" | "checklist" | "documentos" | "capacidade" | "propostas" | "lances" | "prazos" | "resultado" | "fontes" | "historico";

type Licitacao = {
  id: string | number | null;
  numeroControlePncp?: string | null;
  numeroPregao?: string | null;
  numeroProcesso?: string | null;
  titulo: string;
  descricao?: string | null;
  orgao: string;
  uf?: string | null;
  modalidade?: string | null;
  valorEstimado?: string | null;
  dataAbertura?: string | null;
  dataFimProposta?: string | null;
  status?: string | null;
  linkEdital?: string | null;
  plataforma?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  collectedAt?: string | null;
  fingerprint?: string | null;
  pisoTecnico?: string | null;
  pisoAbsoluto?: string | null;
  margemMinima?: string | null;
  responsavelInterno?: string | null;
  readyToSubmit?: boolean;
};

type PreflightCheck = { code: string; status: "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE"; origin: string; message: string; correctiveAction: string };
type Preflight = { readyToSubmit: boolean; calculatedAt: string; summary: { passed: number; warnings: number; blockers: number; notApplicable: number }; checks: PreflightCheck[]; dryRun: boolean };
type Source = { id: string; name: string; mode: string; status: string; officialUrl: string; docsUrl?: string | null; note: string };
type SourceHealth = { status: string; lastAttemptAt?: string | null; lastSuccessAt?: string | null; durationMs?: number; pagesRead?: number; accepted?: number; rejected?: number; duplicates?: number; errorMessage?: string; docsUrl?: string };
type ChecklistItem = { id: number; categoria: string; requisito: string; status: string; risco?: string | null; paginaClausula?: string | null; documentoRelacionado?: string | null };
type DocumentItem = { id: number; tipo: string; empresa: string; validade?: string | null; arquivoNome?: string | null; arquivoUrl?: string | null; computedStatus?: string; expiresInDays?: number | null };
type BidSimulation = { suggestedBid: number | null; evaluatedBid: number | null; effectiveFloor: number | null; authorizationRequired: boolean; canCopy: boolean; canSubmitExternally: false; message: string };

export type PublicContractRecord = {
  id: string;
  name: string;
  client?: string;
  administrativeProcess?: string;
  certameItems?: (CertameItem & { movements?: CertameMovement[] })[];
};

const TABS: { id: LicTab; label: string }[] = [
  { id: "radar", label: "Radar" },
  { id: "preflight", label: "Auditoria pré-envio" },
  { id: "checklist", label: "Checklist" },
  { id: "documentos", label: "Documentos" },
  { id: "capacidade", label: "Capacidade técnica" },
  { id: "propostas", label: "Proposta" },
  { id: "lances", label: "Central de lances" },
  { id: "prazos", label: "Prazos" },
  { id: "resultado", label: "Resultado" },
  { id: "fontes", label: "Saúde das fontes" },
  { id: "historico", label: "Histórico" },
];

const emptyForm = {
  orgao: "",
  numeroPregao: "",
  numeroProcesso: "",
  titulo: "",
  descricao: "",
  plataforma: "Cadastro manual",
  modalidade: "Pregão Eletrônico",
  uf: "SP",
  dataAbertura: "",
  dataFimProposta: "",
  horaSessao: "09:00",
  tipoJulgamento: "menor_preco_global",
  modoDisputa: "aberto",
  valorEstimado: "",
  responsavelInterno: "",
  linkEdital: "",
};

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || String(value).trim() === "") return "Não confirmado";
  if (typeof value === "string" && /R\$/.test(value)) return value;
  const normalized = String(value).replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não confirmado";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Não confirmado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Não confirmado" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function rowKey(item: Licitacao) {
  return String(item.id ?? item.numeroControlePncp ?? item.fingerprint ?? `${item.orgao}-${item.titulo}`);
}

export function PublicContractsPanel({ canEdit = true }: { canEdit?: boolean }) {
  const [persisted, setPersisted] = useState<Licitacao[]>([]);
  const [preview, setPreview] = useState<Licitacao[] | null>(null);
  const [selected, setSelected] = useState<Licitacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [uf, setUf] = useState("SP");
  const [status, setStatus] = useState("todas");
  const [activeTab, setActiveTab] = useState<LicTab>("radar");
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newLic, setNewLic] = useState(emptyForm);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth | null>(null);
  const [bestMarket, setBestMarket] = useState("");
  const [proposedBid, setProposedBid] = useState("");
  const [minimumIncrement, setMinimumIncrement] = useState("1,00");
  const [simulation, setSimulation] = useState<BidSimulation | null>(null);
  const [copied, setCopied] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const currentRows = preview ?? persisted;
  const selectedPersistedId = selected && typeof selected.id === "number" ? selected.id : null;

  const loadPersisted = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status });
      if (query.trim()) params.set("q", query.trim());
      if (uf) params.set("uf", uf);
      const response = await fetch(`/api/licitacoes?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Não foi possível carregar as licitações.");
      const rows = Array.isArray(json.data) ? json.data : [];
      setPersisted(rows);
      setPreview(null);
      setNotice("Registros do ProAR atualizados. Nenhum dado foi modificado.");
      setSelected(current => current && typeof current.id === "number" ? rows.find((row: Licitacao) => row.id === current.id) ?? null : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar as licitações.");
    } finally {
      setLoading(false);
    }
  }, [query, status, uf]);

  useEffect(() => { void loadPersisted(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/licitacoes/sources", { cache: "no-store" })
      .then(async response => ({ response, json: await response.json() }))
      .then(({ response, json }) => { if (response.ok && json.success) setSources(json.data || []); })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!showNewModal) return;
    titleInputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setShowNewModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showNewModal]);

  const selectProcess = (item: Licitacao, tab: LicTab = "preflight") => {
    setSelected(item);
    setPreflight(null);
    setChecklist([]);
    setDocuments([]);
    setSimulation(null);
    setActiveTab(tab);
  };

  const searchPncp = async () => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/licitacoes/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uf, days: 14, maxPages: 2, terms: query.trim() ? [query.trim()] : undefined }),
        signal: controller.signal,
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || json.message || "Não foi possível consultar o PNCP.");
      setPreview(Array.isArray(json.data) ? json.data : []);
      setSourceHealth(json.health || null);
      if (Array.isArray(json.sources)) setSources(json.sources);
      setNotice(`${json.message || "Consulta concluída."} ${json.persistence?.message || "Prévia não persistida."}`);
      setSelected(null);
      setActiveTab("radar");
    } catch (cause) {
      if ((cause as Error)?.name !== "AbortError") setError(cause instanceof Error ? cause.message : "Não foi possível consultar o PNCP.");
    } finally {
      if (requestController.current === controller) setSyncing(false);
    }
  };

  const runPreflight = useCallback(async () => {
    if (!selectedPersistedId) return;
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch("/api/licitacoes/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licitacaoId: selectedPersistedId, dryRun: true }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Não foi possível executar o preflight.");
      setPreflight(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível executar o preflight.");
    } finally {
      setDetailLoading(false);
    }
  }, [selectedPersistedId]);

  const loadChecklist = useCallback(async () => {
    if (!selectedPersistedId) return;
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/licitacoes-checklist?licitacao_id=${selectedPersistedId}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Checklist indisponível.");
      setChecklist(json.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checklist indisponível.");
    } finally { setDetailLoading(false); }
  }, [selectedPersistedId]);

  const loadDocuments = useCallback(async () => {
    if (!selectedPersistedId) return;
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/licitacoes-documents?licitacao_id=${selectedPersistedId}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Documentos indisponíveis.");
      setDocuments(json.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Documentos indisponíveis.");
    } finally { setDetailLoading(false); }
  }, [selectedPersistedId]);

  useEffect(() => {
    if (activeTab === "preflight" && selectedPersistedId && !preflight) void runPreflight();
    if (activeTab === "checklist" && selectedPersistedId && !checklist.length) void loadChecklist();
    if (activeTab === "documentos" && selectedPersistedId && !documents.length) void loadDocuments();
  }, [activeTab, selectedPersistedId, preflight, checklist.length, documents.length, runPreflight, loadChecklist, loadDocuments]);

  const simulate = async () => {
    if (!selectedPersistedId) return;
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch("/api/licitacoes-bids/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licitacaoId: selectedPersistedId, bestMarket, proposedBid, minimumIncrement }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Simulação indisponível.");
      setSimulation(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Simulação indisponível.");
    } finally { setDetailLoading(false); }
  };

  const copyBid = async () => {
    if (!simulation?.canCopy || simulation.evaluatedBid === null) return;
    await navigator.clipboard.writeText(simulation.evaluatedBid.toFixed(2).replace(".", ","));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/licitacoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newLic, status: "rascunho" }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Não foi possível salvar a licitação.");
      setShowNewModal(false);
      setNewLic(emptyForm);
      setNotice("Licitação cadastrada em rascunho e registrada na auditoria.");
      await loadPersisted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a licitação.");
    } finally { setSaving(false); }
  };

  const metrics = useMemo(() => {
    const now = Date.now();
    const next48h = currentRows.filter(item => {
      if (!item.dataAbertura) return false;
      const delta = new Date(item.dataAbertura).getTime() - now;
      return delta >= 0 && delta <= 48 * 3600000;
    }).length;
    return {
      total: currentRows.length,
      next48h,
      ready: 0,
      blockers: preflight?.summary.blockers ?? "—",
    };
  }, [currentRows, preflight]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Workspace de licitações públicas">
      <header className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-5 text-white">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-200">
              <span>ProAR Procurement Workspace</span>
              <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-1 text-emerald-200">Fontes externas somente leitura</span>
            </div>
            <h2 className="flex items-center gap-2 text-2xl font-black"><Landmark className="h-7 w-7 text-indigo-300" /> Licitações públicas</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">RADAR → EDITAL → CHECKLIST → PROPOSTA → AUDITORIA → LANCES → RESULTADO → CONTRATO/ARP → EMPENHO → OS → FINANCEIRO</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && <button type="button" onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100"><Plus className="h-4 w-4" /> Nova licitação</button>}
            <button type="button" onClick={() => void loadPersisted()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Recarregar ProAR</button>
            <button type="button" onClick={() => void searchPncp()} disabled={syncing} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-bold hover:bg-indigo-400 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Consultando..." : "Consultar PNCP"}</button>
          </div>
        </div>

        <form onSubmit={event => { event.preventDefault(); void loadPersisted(); }} className="mt-5 grid gap-2 sm:grid-cols-[minmax(240px,1fr)_100px_150px_auto]">
          <label className="relative"><span className="sr-only">Buscar licitações</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Objeto, órgão, processo, pregão ou termo HVAC" className="w-full rounded-lg border border-white/15 bg-white px-9 py-2 text-sm text-slate-900 outline-none ring-indigo-400 focus:ring-2" /></label>
          <label><span className="sr-only">UF</span><select value={uf} onChange={event => setUf(event.target.value)} className="w-full rounded-lg border border-white/15 bg-white px-3 py-2 text-sm text-slate-900"><option value="">Todas UF</option><option value="SP">SP</option><option value="MG">MG</option><option value="PR">PR</option><option value="RJ">RJ</option><option value="MS">MS</option></select></label>
          <label><span className="sr-only">Status</span><select value={status} onChange={event => setStatus(event.target.value)} className="w-full rounded-lg border border-white/15 bg-white px-3 py-2 text-sm text-slate-900"><option value="todas">Todos os status</option><option value="rascunho">Rascunho</option><option value="oportunidade">Oportunidade</option><option value="em_andamento">Em andamento</option><option value="em_disputa">Em disputa</option><option value="vencedora">Vencedora</option><option value="cancelada">Cancelada</option></select></label>
          <button type="submit" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-600">Buscar no ProAR</button>
        </form>
      </header>

      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        {error && <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><Siren className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
        {notice && <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"><Bell className="mt-0.5 h-4 w-4 shrink-0" /> {notice}</div>}
        {preview && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><span><strong>Prévia PNCP:</strong> estes resultados não foram persistidos e não alteram dados reais.</span><button type="button" onClick={() => { setPreview(null); setSelected(null); }} className="font-bold underline">Voltar aos registros do ProAR</button></div>}
        <nav role="tablist" aria-label="Etapas de licitações" className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${activeTab === tab.id ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{tab.label}</button>)}
        </nav>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title={preview ? "Oportunidades na prévia" : "Registros no ProAR"} value={String(metrics.total)} icon={<Landmark className="h-4 w-4" />} />
          <Metric title="Abertura em até 48h" value={String(metrics.next48h)} icon={<Clock3 className="h-4 w-4" />} />
          <Metric title="Prontas para envio" value={String(metrics.ready)} icon={<ShieldCheck className="h-4 w-4" />} help="Calculado somente pelo backend" />
          <Metric title="Bloqueadores do processo" value={String(metrics.blockers)} icon={<ShieldAlert className="h-4 w-4" />} help="Selecione e audite um processo" />
        </div>

        {activeTab === "radar" && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div><h3 className="font-black text-slate-900">Radar de oportunidades e processos</h3><p className="text-xs text-slate-500">Fonte, atualização e incerteza permanecem visíveis. Score não é inventado quando faltam dados.</p></div>
              {sourceHealth && <HealthBadge health={sourceHealth} />}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Score</th><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Órgão / UF</th><th className="px-4 py-3">Objeto</th><th className="px-4 py-3">Modalidade</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Abertura</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ação</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando...</td></tr> : currentRows.length === 0 ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">Nenhuma oportunidade encontrada para os filtros atuais.</td></tr> : currentRows.map(item => (
                    <tr key={rowKey(item)} className={selected && rowKey(selected) === rowKey(item) ? "bg-indigo-50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-bold text-slate-400">Não calculado</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-indigo-100 px-2 py-1 font-bold text-indigo-800">{item.source || item.plataforma || "Manual"}</span><div className="mt-1 text-[10px] text-slate-400">{item.collectedAt ? formatDate(item.collectedAt) : "Origem sem coleta automática"}</div></td>
                      <td className="px-4 py-3"><strong className="block text-slate-800">{item.orgao}</strong><span className="text-slate-500">{item.uf || "Não confirmado"}</span></td>
                      <td className="max-w-[320px] px-4 py-3"><strong className="line-clamp-2 text-slate-800">{item.titulo}</strong><span className="text-slate-500">{item.numeroPregao || item.numeroProcesso || "Número não confirmado"}</span></td>
                      <td className="px-4 py-3 text-slate-700">{item.modalidade || "Não confirmado"}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{formatMoney(item.valorEstimado)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(item.dataAbertura)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">{item.status || "Não confirmado"}</span></td>
                      <td className="px-4 py-3"><button type="button" onClick={() => selectProcess(item)} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white hover:bg-indigo-700">Analisar</button>{item.linkEdital ? <a href={item.linkEdital} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 font-bold text-indigo-700">Fonte <ExternalLink className="h-3 w-3" /></a> : <span className="ml-2 text-slate-400">Sem link</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab !== "radar" && activeTab !== "fontes" && (
          <SelectedProcess item={selected} preview={Boolean(preview)} onBack={() => setActiveTab("radar")} />
        )}

        {activeTab === "preflight" && selected && (
          <div className="space-y-4">
            {!selectedPersistedId ? <HonestLimit title="Auditoria indisponível para prévia" text="A oportunidade PNCP ainda não foi persistida. Criar processo será implementado com deduplicação antes de ativar escrita." /> : detailLoading && !preflight ? <LoadingBlock /> : preflight ? <>
              <div className={`rounded-xl border p-4 ${preflight.readyToSubmit ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">{preflight.readyToSubmit ? "Pronta para envio" : "Não liberada para envio"}</h3><p className="text-sm text-slate-700">{preflight.summary.blockers} bloqueador(es), {preflight.summary.warnings} alerta(s), {preflight.summary.passed} conforme.</p></div><button type="button" onClick={() => void runPreflight()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Recalcular prévia</button></div>
                <p className="mt-2 text-xs text-slate-600">Resultado calculado no backend. Esta execução é somente leitura e não altera status.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">{preflight.checks.map(check => <PreflightCard key={check.code} check={check} />)}</div>
            </> : <HonestLimit title="Auditoria ainda não executada" text="Selecione um processo persistido para calcular os bloqueadores no backend." />}
          </div>
        )}

        {activeTab === "checklist" && selected && (detailLoading && !checklist.length ? <LoadingBlock /> : checklist.length ? <div className="overflow-hidden rounded-xl border border-slate-200"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Exigência</th><th className="px-4 py-3">Página/seção</th><th className="px-4 py-3">Risco</th><th className="px-4 py-3">Resultado</th></tr></thead><tbody className="divide-y divide-slate-100">{checklist.map(item => <tr key={item.id}><td className="px-4 py-3 font-bold">{item.categoria}</td><td className="px-4 py-3">{item.requisito}</td><td className="px-4 py-3">{item.paginaClausula || "Não confirmado"}</td><td className="px-4 py-3">{item.risco || "Não confirmado"}</td><td className="px-4 py-3"><StatusPill value={item.status} /></td></tr>)}</tbody></table></div> : <HonestLimit title="Checklist não estruturado" text="Sem itens revisados. A auditoria pré-envio manterá este processo bloqueado." />)}

        {activeTab === "documentos" && selected && (detailLoading && !documents.length ? <LoadingBlock /> : documents.length ? <div className="grid gap-3 md:grid-cols-2">{documents.map(document => <div key={document.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-slate-900">{document.tipo}</strong><p className="text-xs text-slate-500">{document.empresa}</p></div><StatusPill value={document.computedStatus || "não confirmado"} /></div><p className="mt-3 text-xs text-slate-600">Validade: {formatDate(document.validade)}{typeof document.expiresInDays === "number" ? ` • ${document.expiresInDays} dia(s)` : ""}</p>{document.arquivoUrl ? <a href={document.arquivoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-700">Abrir evidência <ExternalLink className="h-3 w-3" /></a> : <p className="mt-2 text-xs font-bold text-red-700">Sem evidência de arquivo</p>}</div>)}</div> : <HonestLimit title="Cofre sem evidências vinculadas" text="Documentos ausentes ou sem validade impedem a liberação para envio." />)}

        {activeTab === "capacidade" && selected && <HonestLimit title="Capacidade técnica — bloqueador obrigatório" text="O schema atual ainda não estrutura atestados, quantitativos e matriz Exigência × Comprovado. O sistema não presumirá atendimento." />}
        {activeTab === "propostas" && selected && <HonestLimit title="Proposta — bloqueador obrigatório" text="Itens, lotes, custos, tributos, margens e totais ainda não possuem modelo estruturado. Nenhuma proposta incompleta será marcada como pronta." />}

        {activeTab === "lances" && selected && (
          !selectedPersistedId ? <HonestLimit title="Copiloto indisponível para prévia" text="A simulação exige um processo persistido com pisos autorizados." /> : <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-black text-slate-900"><Bot className="h-5 w-5 text-indigo-600" /> Copiloto de decisão</h3><p className="mt-1 text-xs text-slate-500">Simula e copia valores. Nunca envia lance a portal externo.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Melhor lance conhecido"><input value={bestMarket} onChange={event => setBestMarket(event.target.value)} placeholder="R$ 0,00" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field><Field label="Nosso lance (opcional)"><input value={proposedBid} onChange={event => setProposedBid(event.target.value)} placeholder="R$ 0,00" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field><Field label="Intervalo mínimo"><input value={minimumIncrement} onChange={event => setMinimumIncrement(event.target.value)} placeholder="1,00" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field></div><button type="button" onClick={() => void simulate()} disabled={detailLoading} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Simular com segurança</button></div>
            <div className={`rounded-xl border p-4 ${simulation?.authorizationRequired ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}><h3 className="font-black text-slate-900">Resultado da simulação</h3>{simulation ? <><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><DataPoint label="Piso efetivo" value={simulation.effectiveFloor === null ? "Não confirmado" : formatMoney(simulation.effectiveFloor)} /><DataPoint label="Sugestão" value={simulation.suggestedBid === null ? "Não calculada" : formatMoney(simulation.suggestedBid)} /></div><p className={`mt-3 text-sm font-bold ${simulation.authorizationRequired ? "text-red-800" : "text-slate-700"}`}>{simulation.message}</p><button type="button" onClick={() => void copyBid()} disabled={!simulation.canCopy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Clipboard className="h-4 w-4" /> {copied ? "Valor copiado" : "Copiar valor"}</button><p className="mt-2 text-[11px] font-bold text-red-700">Envio externo: bloqueado</p></> : <p className="mt-3 text-sm text-slate-500">Informe os dados para uma recomendação explicável.</p>}</div>
          </div>
        )}

        {activeTab === "prazos" && selected && <div className="grid gap-3 sm:grid-cols-2"><DataCard icon={<Clock3 className="h-5 w-5" />} title="Abertura / sessão" value={formatDate(selected.dataAbertura)} /><DataCard icon={<Bell className="h-5 w-5" />} title="Fim para propostas" value={formatDate(selected.dataFimProposta)} /></div>}
        {activeTab === "resultado" && selected && <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-slate-900">Fluxo pós-resultado</h3><div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">{["Licitação", "Contrato / ARP", "Saldo do certame", "Empenho", "OS", "Financeiro"].map((step, index) => <React.Fragment key={step}><span className={`rounded-full px-3 py-2 ${index === 0 ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>{step}</span>{index < 5 && <span>→</span>}</React.Fragment>)}</div><p className="mt-3 text-xs text-slate-500">Saldo do certame é administrativo/contratual e permanece separado do estoque físico.</p></div>}

        {activeTab === "fontes" && <div className="grid gap-3 lg:grid-cols-2">{sources.map(source => <div key={source.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black text-slate-900">{source.name}</h3><p className="mt-1 text-xs text-slate-500">{source.note}</p></div><StatusPill value={source.status} /></div><div className="mt-3 flex flex-wrap gap-3 text-xs font-bold"><a href={source.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-700"><Link2 className="h-3 w-3" /> Site oficial</a>{source.docsUrl && <a href={source.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-700"><ExternalLink className="h-3 w-3" /> Documentação</a>}</div></div>)}</div>}
        {activeTab === "historico" && selected && <HonestLimit title="Auditoria server-side ativa" text="Criação, revisão de checklist, documentos, preflight registrado e decisões de lance geram eventos no backend. A consulta consolidada do histórico ficará bloqueada até unificar as duas trilhas existentes sem alterar o schema." />}
      </div>

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setShowNewModal(false); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="new-lic-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><h3 id="new-lic-title" className="text-lg font-black text-slate-900">Nova licitação</h3><p className="text-xs text-slate-500">Cadastro manual em rascunho. Prontidão será calculada pelo backend.</p></div><button type="button" onClick={() => setShowNewModal(false)} aria-label="Fechar" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
            <form onSubmit={handleCreate} className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
              <Field label="Objeto da licitação" className="sm:col-span-2"><input ref={titleInputRef} required value={newLic.titulo} onChange={event => setNewLic(state => ({ ...state, titulo: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Órgão"><input required value={newLic.orgao} onChange={event => setNewLic(state => ({ ...state, orgao: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="UF"><input maxLength={2} value={newLic.uf} onChange={event => setNewLic(state => ({ ...state, uf: event.target.value.toUpperCase() }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Número do pregão"><input value={newLic.numeroPregao} onChange={event => setNewLic(state => ({ ...state, numeroPregao: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Processo administrativo"><input value={newLic.numeroProcesso} onChange={event => setNewLic(state => ({ ...state, numeroProcesso: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Modalidade"><select value={newLic.modalidade} onChange={event => setNewLic(state => ({ ...state, modalidade: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"><option>Pregão Eletrônico</option><option>Concorrência</option><option>Dispensa</option><option>Inexigibilidade</option></select></Field>
              <Field label="Plataforma"><input value={newLic.plataforma} onChange={event => setNewLic(state => ({ ...state, plataforma: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Abertura"><input type="datetime-local" value={newLic.dataAbertura} onChange={event => setNewLic(state => ({ ...state, dataAbertura: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Fim das propostas"><input type="datetime-local" value={newLic.dataFimProposta} onChange={event => setNewLic(state => ({ ...state, dataFimProposta: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Valor estimado"><input value={newLic.valorEstimado} onChange={event => setNewLic(state => ({ ...state, valorEstimado: event.target.value }))} placeholder="R$ 0,00" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Responsável"><input value={newLic.responsavelInterno} onChange={event => setNewLic(state => ({ ...state, responsavelInterno: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Link oficial do edital" className="sm:col-span-2"><input type="url" value={newLic.linkEdital} onChange={event => setNewLic(state => ({ ...state, linkEdital: event.target.value }))} placeholder="https://..." className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field>
              <Field label="Descrição complementar" className="sm:col-span-2"><textarea value={newLic.descricao} onChange={event => setNewLic(state => ({ ...state, descricao: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 min-h-24 resize-y" /></Field>
              <div className="sm:col-span-2 flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => setShowNewModal(false)} className="rounded-lg bg-slate-100 px-4 py-2 font-bold">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar rascunho"}</button></div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ title, value, icon, help }: { title: string; value: string; icon: React.ReactNode; help?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>{title}</span>{icon}</div><div className="mt-1 text-2xl font-black text-slate-900">{value}</div>{help && <p className="mt-1 text-[10px] text-slate-400">{help}</p>}</div>;
}

function HealthBadge({ health }: { health: SourceHealth }) {
  const healthy = health.status === "healthy";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${healthy ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{healthy ? "PNCP saudável" : "PNCP degradado"} • {health.pagesRead ?? 0} pág. • {health.accepted ?? 0} aceitos</span>;
}

function SelectedProcess({ item, preview, onBack }: { item: Licitacao | null; preview: boolean; onBack: () => void }) {
  if (!item) return <HonestLimit title="Selecione um processo no Radar" text="As etapas operacionais são sempre vinculadas a uma oportunidade ou licitação específica." />;
  return <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-bold uppercase text-white">{preview ? "Prévia PNCP" : "Processo ProAR"}</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-700">{item.status || "Não confirmado"}</span></div><h3 className="mt-2 font-black text-slate-900">{item.titulo}</h3><p className="text-xs text-slate-600">{item.orgao} • {item.numeroPregao || item.numeroProcesso || "Número não confirmado"}</p></div><button type="button" onClick={onBack} className="text-xs font-bold text-indigo-700 underline">Voltar ao Radar</button></div></div>;
}

function PreflightCard({ check }: { check: PreflightCheck }) {
  const styles = check.status === "PASS" ? "border-emerald-200 bg-emerald-50" : check.status === "WARNING" ? "border-amber-200 bg-amber-50" : check.status === "BLOCKER" ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50";
  const Icon = check.status === "PASS" ? CheckCircle2 : check.status === "BLOCKER" ? AlertTriangle : FileCheck;
  return <div className={`rounded-xl border p-4 ${styles}`}><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0" /><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{check.code}</strong><StatusPill value={check.status} /></div><p className="mt-1 text-xs text-slate-700">{check.message}</p><p className="mt-2 text-[11px] text-slate-500"><strong>Origem:</strong> {check.origin}</p><p className="text-[11px] text-slate-500"><strong>Correção:</strong> {check.correctiveAction}</p></div></div></div>;
}

function HonestLimit({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="flex items-center gap-2 font-black text-amber-950"><ShieldAlert className="h-5 w-5" /> {title}</h3><p className="mt-2 text-sm text-amber-900">{text}</p></div>;
}

function LoadingBlock() { return <div className="rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando dados vinculados...</div>; }
function StatusPill({ value }: { value: string }) { const normalized = value.toLowerCase(); const good = ["pass", "atendido", "vigente", "active", "healthy"].some(part => normalized.includes(part)); const bad = ["block", "critico", "vencido", "indisponivel", "authorization"].some(part => normalized.includes(part)); return <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${good ? "bg-emerald-100 text-emerald-800" : bad ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-700"}`}>{value.replaceAll("_", " ")}</span>; }
function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) { return <label className={`grid gap-1 font-bold text-slate-700 ${className}`}><span>{label}</span>{children}</label>; }
function DataPoint({ label, value }: { label: string; value: string }) { return <div><div className="text-slate-500">{label}</div><div className="mt-1 font-black text-slate-900">{value}</div></div>; }
function DataCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) { return <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-xs font-bold">{title}</span></div><p className="mt-2 font-black text-slate-900">{value}</p></div>; }
