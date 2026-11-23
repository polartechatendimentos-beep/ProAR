"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CheckCircle2,
  Clipboard,
  Clock3,
  ExternalLink,
  FileCheck,
  Landmark,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Siren,
  X,
} from "lucide-react";
import type { CertameItem, CertameMovement } from "@/lib/public-contracts";
import { procurementStatusLabel } from "@/lib/procurement/domain";

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
  statusOriginal?: string | null;
  relevance?: { matchedTerms?: string[]; context?: string; evidence?: string | null };
};

type PreflightCheck = { code: string; status: "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE"; origin: string; message: string; correctiveAction: string };
type Preflight = { readyToSubmit: boolean; calculatedAt: string; summary: { passed: number; warnings: number; blockers: number; notApplicable: number }; checks: PreflightCheck[]; dryRun: boolean };
type Source = { id: string; name: string; mode: string; status: string; officialUrl: string; docsUrl?: string | null; note: string };
type SourceHealth = { status: string; lastAttemptAt?: string | null; lastSuccessAt?: string | null; durationMs?: number; pagesRead?: number; accepted?: number; rejected?: number; duplicates?: number; errorMessage?: string; docsUrl?: string };
type ChecklistItem = { id: number; categoria: string; requisito: string; status: string; risco?: string | null; paginaClausula?: string | null; documentoRelacionado?: string | null };
type DocumentItem = { id: number; tipo: string; empresa: string; cnpj: string; validade?: string | null; arquivoNome?: string | null; arquivoUrl?: string | null; situacao?: string; metadadosIa?: Record<string, unknown> | null; criadoEm?: string | null; computedStatus?: string; expiresInDays?: number | null };
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

const TAB_GROUPS: { id: string; label: string; tabs: LicTab[] }[] = [
  { id: "radar", label: "Radar", tabs: ["radar"] },
  { id: "documentos", label: "Documentos e habilitação", tabs: ["documentos", "checklist", "preflight", "capacidade"] },
  { id: "disputa", label: "Proposta e lances", tabs: ["propostas", "lances"] },
  { id: "acompanhamento", label: "Prazos e resultado", tabs: ["prazos", "resultado", "historico"] },
  { id: "fontes", label: "Fontes", tabs: ["fontes"] },
];

const DOCUMENT_TAB_LABELS: Partial<Record<LicTab, string>> = {
  documentos: "Dossiê documental",
  checklist: "Matriz do edital",
  preflight: "Auditoria pré-envio",
  capacidade: "Capacidade técnica",
  propostas: "Proposta",
  lances: "Central de lances",
  prazos: "Prazos",
  resultado: "Resultado e pós-disputa",
  historico: "Histórico",
};

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
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Não confirmado";
  const raw = String(value).trim();
  const normalized = raw.includes(",")
    ? raw.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".")
    : raw.replace(/[^0-9.-]/g, "");
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
  const [documentForm, setDocumentForm] = useState({ tipo: "Certidão", empresa: "", cnpj: "", validade: "", arquivoNome: "", arquivoUrl: "", documentoAnteriorId: "" });
  const [checklistForm, setChecklistForm] = useState({ categoria: "Habilitação", requisito: "", paginaClausula: "", documentoRelacionado: "", risco: "medio" });
  const [savingDossierItem, setSavingDossierItem] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth | null>(null);
  const [bestMarket, setBestMarket] = useState("");
  const [proposedBid, setProposedBid] = useState("");
  const [minimumIncrement, setMinimumIncrement] = useState("1,00");
  const [simulation, setSimulation] = useState<BidSimulation | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedWhy, setExpandedWhy] = useState<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const detailRequestId = useRef(0);
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
    detailRequestId.current += 1;
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
    const requestId = ++detailRequestId.current;
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
      if (requestId === detailRequestId.current) setPreflight(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível executar o preflight.");
    } finally {
      setDetailLoading(false);
    }
  }, [selectedPersistedId]);

  const loadChecklist = useCallback(async () => {
    if (!selectedPersistedId) return;
    const requestId = ++detailRequestId.current;
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/licitacoes-checklist?licitacao_id=${selectedPersistedId}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Checklist indisponível.");
      if (requestId === detailRequestId.current) setChecklist(json.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checklist indisponível.");
    } finally { setDetailLoading(false); }
  }, [selectedPersistedId]);

  const loadDocuments = useCallback(async () => {
    if (!selectedPersistedId) return;
    const requestId = ++detailRequestId.current;
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/licitacoes-documents?licitacao_id=${selectedPersistedId}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Documentos indisponíveis.");
      if (requestId === detailRequestId.current) setDocuments(json.data || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Documentos indisponíveis.");
    } finally { setDetailLoading(false); }
  }, [selectedPersistedId]);

  const saveDocumentVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPersistedId) return;
    setSavingDossierItem(true);
    setError("");
    try {
      const previous = documents.find(document => document.id === Number(documentForm.documentoAnteriorId));
      const previousVersion = Number(previous?.metadadosIa?.versao || 1);
      const response = await fetch("/api/licitacoes-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...documentForm, documentoAnteriorId: undefined, licitacaoId: selectedPersistedId, validade: documentForm.validade || null, situacao: "pendente_revisao", metadadosIa: { versao: previous ? previousVersion + 1 : 1, documentoAnteriorId: previous?.id || null, versaoRegistradaEm: new Date().toISOString() } }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Não foi possível vincular o documento.");
      setDocumentForm({ tipo: "Certidão", empresa: "", cnpj: "", validade: "", arquivoNome: "", arquivoUrl: "", documentoAnteriorId: "" });
      setNotice("Documento vinculado ao dossiê desta licitação.");
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível vincular o documento.");
    } finally { setSavingDossierItem(false); }
  };

  const reviewDocument = async (document: DocumentItem, situacao: "aprovado" | "revisar") => {
    setSavingDossierItem(true);
    setError("");
    try {
      const response = await fetch("/api/licitacoes-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: document.id, situacao, observacao: situacao === "aprovado" ? "Documento conferido para este dossiê." : "Documento devolvido para revisão." }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Não foi possível registrar a revisão.");
      setNotice(situacao === "aprovado" ? "Revisão aprovada e registrada." : "Documento marcado para revisão.");
      await loadDocuments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a revisão.");
    } finally { setSavingDossierItem(false); }
  };

  const addChecklistRequirement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPersistedId) return;
    setSavingDossierItem(true);
    setError("");
    try {
      const response = await fetch("/api/licitacoes-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...checklistForm, licitacaoId: selectedPersistedId, status: "pendente" }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Não foi possível incluir a exigência.");
      setChecklistForm({ categoria: "Habilitação", requisito: "", paginaClausula: "", documentoRelacionado: "", risco: "medio" });
      setNotice("Exigência adicionada à matriz do edital.");
      await loadChecklist();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível incluir a exigência.");
    } finally { setSavingDossierItem(false); }
  };

  const updateChecklistStatus = async (item: ChecklistItem, nextStatus: string) => {
    try {
      const response = await fetch("/api/licitacoes-checklist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status: nextStatus }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Não foi possível atualizar a exigência.");
      await loadChecklist();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a exigência.");
    }
  };

  useEffect(() => {
    if (activeTab === "preflight" && selectedPersistedId && !preflight) void runPreflight();
    if (activeTab === "checklist" && selectedPersistedId && !checklist.length) void loadChecklist();
    if (activeTab === "checklist" && selectedPersistedId && !documents.length) void loadDocuments();
    if (activeTab === "documentos" && selectedPersistedId && !documents.length) void loadDocuments();
  }, [activeTab, selectedPersistedId, preflight, checklist.length, documents.length, runPreflight, loadChecklist, loadDocuments]);

  const simulate = async () => {
    if (!selectedPersistedId) return;
    const requestId = ++detailRequestId.current;
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
      if (requestId === detailRequestId.current) setSimulation(json.data);
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
    };
  }, [currentRows]);
  const activeGroup = TAB_GROUPS.find(group => group.tabs.includes(activeTab)) ?? TAB_GROUPS[0];

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
            <p className="mt-1 max-w-3xl text-sm text-slate-300">Encontre oportunidades, prepare a habilitação e acompanhe cada disputa.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && <button type="button" onClick={() => setShowNewModal(true)} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100"><Plus className="h-4 w-4" /> Nova licitação</button>}
            <button type="button" onClick={() => void loadPersisted()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Recarregar ProAR</button>
            <button type="button" onClick={() => void searchPncp()} disabled={syncing} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-bold hover:bg-indigo-400 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Consultando..." : "Consultar PNCP"}</button>
          </div>
        </div>

        <form onSubmit={event => { event.preventDefault(); void loadPersisted(); }} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar licitações</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por objeto, órgão, processo ou pregão" className="w-full rounded-lg border border-white/15 bg-white px-9 py-2 text-sm text-slate-900 outline-none ring-indigo-400 focus:ring-2" /></label>
          <button type="submit" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-600">Buscar</button>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-center text-sm font-bold hover:bg-white/20">Filtros</summary>
            <div className="absolute right-0 z-20 mt-2 grid min-w-64 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl">
              <label className="grid gap-1 text-xs font-bold">Estado<select value={uf} onChange={event => setUf(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Todas as UFs</option><option value="SP">SP</option><option value="MG">MG</option><option value="PR">PR</option><option value="RJ">RJ</option><option value="MS">MS</option></select></label>
              <label className="grid gap-1 text-xs font-bold">Situação<select value={status} onChange={event => setStatus(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="todas">Todas</option><option value="rascunho">Rascunho</option><option value="oportunidade">Oportunidade</option><option value="em_andamento">Em andamento</option><option value="em_disputa">Em disputa</option><option value="vencedora">Vencedora</option><option value="cancelada">Cancelada</option><option value="abertas">Abertas</option><option value="encerradas">Encerradas / canceladas</option></select></label>
              <button type="button" onClick={() => void loadPersisted()} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white">Aplicar filtros</button>
            </div>
          </details>
        </form>
      </header>

      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        {error && <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"><Siren className="mt-0.5 h-4 w-4 shrink-0" /> {error}</div>}
        {notice && <div className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900"><Bell className="mt-0.5 h-4 w-4 shrink-0" /> {notice}</div>}
        {preview && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><span><strong>Prévia PNCP:</strong> estes resultados não foram persistidos e não alteram dados reais.</span><button type="button" onClick={() => { setPreview(null); setSelected(null); }} className="font-bold underline">Voltar aos registros do ProAR</button></div>}
        <nav role="tablist" aria-label="Áreas de licitações" className="flex gap-2 overflow-x-auto pb-1">
          {TAB_GROUPS.map(group => <button key={group.id} type="button" role="tab" aria-selected={activeGroup.id === group.id} onClick={() => setActiveTab(group.tabs[0])} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${activeGroup.id === group.id ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>{group.label}</button>)}
        </nav>
        {activeGroup.tabs.length > 1 && <div className="mt-2 flex flex-wrap gap-2" aria-label={`Opções de ${activeGroup.label}`}>
          {activeGroup.tabs.map(tabId => <button key={tabId} type="button" onClick={() => setActiveTab(tabId)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${activeTab === tabId ? "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200" : "text-slate-600 hover:bg-white"}`}>{DOCUMENT_TAB_LABELS[tabId] || TABS.find(tab => tab.id === tabId)?.label}</button>)}
        </div>}
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className="font-bold text-slate-800"><Landmark className="mr-2 inline h-4 w-4 text-indigo-600" />{preview ? "Oportunidades nesta consulta" : "Licitações encontradas"}: {metrics.total}</span>
          <span className="text-slate-600"><Clock3 className="mr-2 inline h-4 w-4 text-amber-600" />Sessões nas próximas 48h: <strong>{metrics.next48h}</strong></span>
          {selected && <span className="truncate text-slate-500">Em análise: <strong className="text-slate-700">{selected.numeroPregao || selected.titulo}</strong></span>}
        </div>

        {activeTab === "radar" && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div><h3 className="font-black text-slate-900">Radar de oportunidades e processos</h3><p className="text-xs text-slate-500">Fonte, atualização e incerteza permanecem visíveis. Score não é inventado quando faltam dados.</p></div>
              {sourceHealth && <HealthBadge health={sourceHealth} />}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1050px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Score</th><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Órgão / UF</th><th className="px-4 py-3">Objeto</th><th className="px-4 py-3">Modalidade</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Abertura</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Por que aparece?</th><th className="px-4 py-3">Ação</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando...</td></tr> : currentRows.length === 0 ? <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">Nenhuma oportunidade encontrada para os filtros atuais.</td></tr> : currentRows.map(item => (
                    <tr key={rowKey(item)} className={selected && rowKey(selected) === rowKey(item) ? "bg-indigo-50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3 font-bold text-slate-400">Não calculado</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-indigo-100 px-2 py-1 font-bold text-indigo-800">{item.source || item.plataforma || "Manual"}</span><div className="mt-1 text-[10px] text-slate-400">{item.collectedAt ? formatDate(item.collectedAt) : "Origem sem coleta automática"}</div></td>
                      <td className="px-4 py-3"><strong className="block text-slate-800">{item.orgao}</strong><span className="text-slate-500">{item.uf || "Não confirmado"}</span></td>
                      <td className="max-w-[320px] px-4 py-3"><strong className="line-clamp-2 text-slate-800">{item.titulo}</strong><span className="text-slate-500">{item.numeroPregao || item.numeroProcesso || "Número não confirmado"}</span></td>
                      <td className="px-4 py-3 text-slate-700">{item.modalidade || "Não confirmado"}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{formatMoney(item.valorEstimado)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(item.dataAbertura)}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">{procurementStatusLabel(item.status, item.dataFimProposta)}</span><div className="mt-1 text-[10px] text-slate-400">Fonte: {item.statusOriginal || item.status || "Não confirmado"}</div></td>
                      <td className="max-w-[220px] px-4 py-3 align-top"><button type="button" className="font-bold text-indigo-700 underline" onClick={() => setExpandedWhy(expandedWhy === rowKey(item) ? null : rowKey(item))}>🔎 Ver evidência</button>{expandedWhy === rowKey(item) && <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-[10px] text-indigo-950"><b>Contexto:</b> {item.relevance?.context === "frota_automotiva_revisar" ? "Possível contexto de frota automotiva — requer revisão." : "HVAC / climatização"}<br /><b>Termos:</b> {item.relevance?.matchedTerms?.join(", ") || "Não confirmado"}<br /><b>Evidência:</b> {item.relevance?.evidence || item.sourceUrl || "Não confirmado"}</div>}</td>
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

        {activeTab === "checklist" && selected && (
          <div className="space-y-4">
            {!selectedPersistedId ? <HonestLimit title="Matriz disponível após salvar o processo" text="Salve a oportunidade no ProAR para vincular exigências e evidências com segurança." /> : <>
              <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div><h3 className="font-black text-slate-900">Matriz de atendimento do edital</h3><p className="text-xs text-slate-600">Relacione cada exigência a uma evidência e acompanhe a revisão.</p></div>
                <div className="flex gap-3 text-xs font-bold"><span className="text-emerald-700">{checklist.filter(item => item.status === "atendido").length} atendidas</span><span className="text-amber-700">{checklist.filter(item => item.status === "pendente" || item.status === "revisar").length} pendentes</span><span className="text-red-700">{checklist.filter(item => item.status === "nao_atendido" || item.status === "critico").length} riscos</span></div>
              </div>
              {canEdit && <form onSubmit={addChecklistRequirement} className="grid gap-2 rounded-xl border border-slate-200 p-4 md:grid-cols-6">
                <label className="grid gap-1 text-[11px] font-bold text-slate-600 md:col-span-1">Grupo<select value={checklistForm.categoria} onChange={event => setChecklistForm(state => ({ ...state, categoria: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm"><option>Habilitação</option><option>Fiscal</option><option>Técnica</option><option>Econômico-financeira</option><option>Proposta</option><option>Visita técnica</option><option>Prazo</option></select></label>
                <label className="grid gap-1 text-[11px] font-bold text-slate-600 md:col-span-2">Exigência do edital<input required value={checklistForm.requisito} onChange={event => setChecklistForm(state => ({ ...state, requisito: event.target.value }))} placeholder="Descreva o requisito" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                <label className="grid gap-1 text-[11px] font-bold text-slate-600">Página / cláusula<input value={checklistForm.paginaClausula} onChange={event => setChecklistForm(state => ({ ...state, paginaClausula: event.target.value }))} placeholder="Ex.: 7.2" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                <label className="grid gap-1 text-[11px] font-bold text-slate-600">Evidência relacionada<select value={checklistForm.documentoRelacionado} onChange={event => setChecklistForm(state => ({ ...state, documentoRelacionado: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Selecionar documento</option>{documents.map(document => <option key={document.id} value={String(document.id)}>{document.tipo} · {document.empresa}</option>)}</select></label>
                <button disabled={savingDossierItem} className="self-end rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><Plus className="mr-1 inline h-4 w-4" />Adicionar exigência</button>
              </form>}
              {detailLoading && !checklist.length ? <LoadingBlock /> : checklist.length ? <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Exigência / referência</th><th className="px-4 py-3">Evidência</th><th className="px-4 py-3">Risco</th><th className="px-4 py-3">Atendimento</th></tr></thead><tbody className="divide-y divide-slate-100">{checklist.map(item => { const linkedDocument = documents.find(document => String(document.id) === item.documentoRelacionado); return <tr key={item.id}><td className="px-4 py-3"><strong className="block text-slate-800">{item.requisito}</strong><span className="text-slate-500">{item.categoria} · {item.paginaClausula || "Cláusula não indicada"}</span></td><td className="px-4 py-3">{linkedDocument ? `${linkedDocument.tipo} · ${linkedDocument.empresa}` : item.documentoRelacionado || "Vincular evidência"}</td><td className="px-4 py-3"><StatusPill value={item.risco || "médio"} /></td><td className="px-4 py-3">{canEdit ? <select aria-label={`Atendimento: ${item.requisito}`} value={item.status} onChange={event => void updateChecklistStatus(item, event.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-bold"><option value="pendente">Pendente</option><option value="atendido">Atendido</option><option value="revisar">Revisar</option><option value="nao_atendido">Não atendido</option><option value="critico">Crítico</option></select> : <StatusPill value={item.status} />}</td></tr>; })}</tbody></table></div> : <HonestLimit title="Comece pela matriz do edital" text="Adicione as exigências mais importantes e associe cada uma à evidência correspondente." />}
            </>}
          </div>
        )}

        {activeTab === "documentos" && selected && (
          <div className="space-y-4">
            {!selectedPersistedId ? <HonestLimit title="Dossiê disponível após salvar o processo" text="Salve a oportunidade no ProAR para criar o dossiê documental vinculado." /> : <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><div><h3 className="font-black text-slate-900">Dossiê desta licitação</h3><p className="text-xs text-slate-600">Documentos, validade, versões e revisão ficam vinculados ao processo.</p></div><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">{documents.filter(document => document.situacao !== "aprovado").length} para revisar</span><span className="rounded-full bg-slate-200 px-3 py-1 text-slate-700">{documents.length} evidência(s)</span></div></div>
              {canEdit && <details className="rounded-xl border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-bold text-indigo-700">Vincular documento ou nova versão</summary>
                <form onSubmit={saveDocumentVersion} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Tipo de documento"><input required value={documentForm.tipo} onChange={event => setDocumentForm(state => ({ ...state, tipo: event.target.value }))} placeholder="Ex.: CND Federal" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></Field>
                  <Field label="Empresa"><input required value={documentForm.empresa} onChange={event => setDocumentForm(state => ({ ...state, empresa: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></Field>
                  <Field label="CNPJ"><input required value={documentForm.cnpj} onChange={event => setDocumentForm(state => ({ ...state, cnpj: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></Field>
                  <Field label="Validade"><input type="date" value={documentForm.validade} onChange={event => setDocumentForm(state => ({ ...state, validade: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></Field>
                  <Field label="Nome do arquivo"><input value={documentForm.arquivoNome} onChange={event => setDocumentForm(state => ({ ...state, arquivoNome: event.target.value }))} placeholder="arquivo.pdf" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></Field>
                  <Field label="Link da evidência"><input type="url" value={documentForm.arquivoUrl} onChange={event => setDocumentForm(state => ({ ...state, arquivoUrl: event.target.value }))} placeholder="https://..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /></Field>
                  <Field label="Substitui versão anterior" className="sm:col-span-2 lg:col-span-2"><select value={documentForm.documentoAnteriorId} onChange={event => setDocumentForm(state => ({ ...state, documentoAnteriorId: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="">Novo documento</option>{documents.map(document => <option key={document.id} value={document.id}>{document.tipo} · {document.empresa} · v{Number(document.metadadosIa?.versao || 1)}</option>)}</select></Field>
                  <button disabled={savingDossierItem} className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{savingDossierItem ? "Salvando..." : "Vincular ao dossiê"}</button>
                  <p className="sm:col-span-2 lg:col-span-3 text-[11px] text-slate-500">O arquivo precisa estar em um endereço acessível; o ProAR registra o vínculo, a versão e a revisão.</p>
                </form>
              </details>}
              {detailLoading && !documents.length ? <LoadingBlock /> : documents.length ? <div className="grid gap-3 md:grid-cols-2">{documents.map(document => {
                const expiresAt = document.validade ? new Date(document.validade) : null;
                const days = expiresAt && !Number.isNaN(expiresAt.getTime()) ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000) : null;
                const validity = days === null ? "Validade não informada" : days < 0 ? "Vencido" : days <= 30 ? `Vence em ${days} dia(s)` : "Vigente";
                const reviewHistory = Array.isArray(document.metadadosIa?.historicoRevisao) ? document.metadadosIa?.historicoRevisao as { data?: string; usuario?: string; situacao?: string }[] : [];
                const version = Number(document.metadadosIa?.versao || 1);
                return <article key={document.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-slate-900">{document.tipo} <span className="text-xs font-normal text-slate-500">v{version}</span></strong><p className="text-xs text-slate-500">{document.empresa} · {document.cnpj}</p></div><StatusPill value={document.situacao || "pendente_revisao"} /></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className={`rounded-full px-2 py-1 font-bold ${days !== null && days < 0 ? "bg-red-100 text-red-800" : days !== null && days <= 30 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{validity}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Validade: {formatDate(document.validade)}</span></div>{document.arquivoUrl ? <a href={document.arquivoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-700">{document.arquivoNome || "Abrir evidência"} <ExternalLink className="h-3 w-3" /></a> : <p className="mt-3 text-xs font-bold text-amber-800">Sem evidência vinculada</p>}{document.metadadosIa?.documentoAnteriorId && <p className="mt-1 text-[11px] text-slate-500">Nova versão do documento #{String(document.metadadosIa.documentoAnteriorId)}</p>}{reviewHistory.length > 0 && <p className="mt-2 text-[11px] text-slate-500">Última revisão: {reviewHistory[reviewHistory.length - 1]?.usuario || "usuário"} · {reviewHistory[reviewHistory.length - 1]?.data ? formatDate(reviewHistory[reviewHistory.length - 1]?.data) : "data não informada"}</p>}{canEdit && <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><button type="button" disabled={savingDossierItem || document.situacao === "aprovado"} onClick={() => void reviewDocument(document, "aprovado")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Aprovar</button><button type="button" disabled={savingDossierItem} onClick={() => void reviewDocument(document, "revisar")} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Solicitar revisão</button></div>}</article>;
              })}</div> : <HonestLimit title="Dossiê ainda vazio" text="Vincule as evidências exigidas e registre validade e revisão antes da auditoria pré-envio." />}
              {documents.length > 1 && new Set(documents.map(document => document.cnpj.replace(/\D/g, ""))).size > 1 && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />Há CNPJs diferentes entre as evidências deste dossiê. Confira se pertencem à mesma empresa licitante.</div>}
              {documents.some(document => document.validade && new Date(document.validade).getTime() < Date.now()) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mr-2 inline h-4 w-4" />Há documento vencido. Revise a validade antes de preparar o envio.</div>}
            </>}
          </div>
        )}

        {activeTab === "capacidade" && selected && <HonestLimit title="Capacidade técnica — bloqueador obrigatório" text="O schema atual ainda não estrutura atestados, quantitativos e matriz Exigência × Comprovado. O sistema não presumirá atendimento." />}
        {activeTab === "propostas" && selected && <HonestLimit title="Proposta — bloqueador obrigatório" text="Itens, lotes, custos, tributos, margens e totais ainda não possuem modelo estruturado. Nenhuma proposta incompleta será marcada como pronta." />}

        {activeTab === "lances" && selected && (
          !selectedPersistedId ? <HonestLimit title="Copiloto indisponível para prévia" text="A simulação exige um processo persistido com pisos autorizados." /> : <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-black text-slate-900"><Bot className="h-5 w-5 text-indigo-600" /> Copiloto de decisão</h3><p className="mt-1 text-xs text-slate-500">Simula e copia valores. Nunca envia lance a portal externo.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Field label="Melhor lance conhecido"><input value={bestMarket} onChange={event => setBestMarket(event.target.value)} placeholder="R$ 0,00" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field><Field label="Nosso lance (opcional)"><input value={proposedBid} onChange={event => setProposedBid(event.target.value)} placeholder="R$ 0,00" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field><Field label="Intervalo mínimo"><input value={minimumIncrement} onChange={event => setMinimumIncrement(event.target.value)} placeholder="1,00" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" /></Field></div><button type="button" onClick={() => void simulate()} disabled={detailLoading} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Simular com segurança</button></div>
            <div className={`rounded-xl border p-4 ${simulation?.authorizationRequired ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}><h3 className="font-black text-slate-900">Resultado da simulação</h3>{simulation ? <><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><DataPoint label="Piso efetivo" value={simulation.effectiveFloor === null ? "Não confirmado" : formatMoney(simulation.effectiveFloor)} /><DataPoint label="Sugestão" value={simulation.suggestedBid === null ? "Não calculada" : formatMoney(simulation.suggestedBid)} /></div><p className={`mt-3 text-sm font-bold ${simulation.authorizationRequired ? "text-red-800" : "text-slate-700"}`}>{simulation.message}</p><button type="button" onClick={() => void copyBid()} disabled={!simulation.canCopy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Clipboard className="h-4 w-4" /> {copied ? "Valor copiado" : "Copiar valor"}</button><p className="mt-2 text-[11px] font-bold text-red-700">Envio externo: bloqueado</p></> : <p className="mt-3 text-sm text-slate-500">Informe os dados para uma recomendação explicável.</p>}</div>
          </div>
        )}

        {activeTab === "prazos" && selected && <div className="space-y-3"><p className="text-xs text-slate-500">Prazos importados ou cadastrados no processo. Confirme retificações no portal oficial.</p><div className="grid gap-3 sm:grid-cols-2"><DataCard icon={<Clock3 className="h-5 w-5" />} title="Abertura / sessão" value={formatDate(selected.dataAbertura)} deadline={selected.dataAbertura} /><DataCard icon={<Bell className="h-5 w-5" />} title="Limite para propostas" value={formatDate(selected.dataFimProposta)} deadline={selected.dataFimProposta} /></div></div>}
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
function DataCard({ icon, title, value, deadline }: { icon: React.ReactNode; title: string; value: string; deadline?: string | null }) {
  const timestamp = deadline ? new Date(deadline).getTime() : NaN;
  const days = Number.isFinite(timestamp) ? Math.ceil((timestamp - Date.now()) / 86400000) : null;
  const urgency = days === null ? "Data não informada" : days < 0 ? "Prazo encerrado" : days === 0 ? "Hoje" : days === 1 ? "Amanhã" : `Em ${days} dias`;
  const tone = days !== null && days < 0 ? "text-slate-500" : days !== null && days <= 2 ? "text-red-700" : days !== null && days <= 7 ? "text-amber-700" : "text-emerald-700";
  return <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-xs font-bold">{title}</span></div><p className="mt-2 font-black text-slate-900">{value}</p><p className={`mt-1 text-xs font-bold ${tone}`}>{urgency}</p></div>;
}
