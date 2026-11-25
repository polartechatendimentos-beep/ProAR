"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Clock, AlertTriangle, FileText, DollarSign, Building2, ShieldCheck, ArrowRight, Flame, RefreshCw } from "lucide-react";

interface DailyWorkCenterProps {
  onNavigateTab: (tab: "dashboard" | "os" | "obras" | "orcamento" | "pdv" | "financeiro" | "contratos" | "pmoc") => void;
}

interface DashboardSummary {
  osCount: number | null;
  osAtrasadasCount: number | null;
  obrasCount: number | null;
  obrasGargaloCount: number | null;
  orcamentosPendentesCount: number | null;
  contasVencendoCount: number | null;
  empenhosFaturarCount: number | null;
  atualizadoEm: string;
}

const emptySummary: DashboardSummary = {
  osCount: null,
  osAtrasadasCount: null,
  obrasCount: null,
  obrasGargaloCount: null,
  orcamentosPendentesCount: null,
  contasVencendoCount: null,
  empenhosFaturarCount: null,
  atualizadoEm: "",
};

const displayCount = (value: number | null) => value === null ? "—" : value;

export function DailyWorkCenter({
  onNavigateTab,
}: DailyWorkCenterProps) {
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard/summary", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error || "Falha ao atualizar os indicadores.");
      setSummary(payload.data as DashboardSummary);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao atualizar os indicadores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSummary(); }, [loadSummary]);
  const { osCount, osAtrasadasCount, obrasCount, obrasGargaloCount, orcamentosPendentesCount, contasVencendoCount, empenhosFaturarCount } = summary;
  const overdueCount = osAtrasadasCount ?? 0;
  const updatedAt = summary.atualizadoEm
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(summary.atualizadoEm))
    : "";

  return (
    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
      {/* Cabeçalho da Central Operacional */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
              INDICADORES DA EMPRESA ATIVA
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Flame className="w-6 h-6 text-amber-500" />
            Central de Trabalho do Dia
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Painel de prioridades imediatas com camada de <strong>Próxima Ação</strong> orientada à equipe e atendimento.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-400 block">{error ? "Indicadores indisponíveis" : loading ? "Atualizando indicadores" : "Última atualização"}</span>
            <span className="text-sm font-bold text-emerald-400">{error ? "Falha ao atualizar" : updatedAt ? `${updatedAt} · horário de Brasília` : "Aguardando dados"}</span>
          </div>
          <button type="button" onClick={() => void loadSummary()} disabled={loading} aria-label="Atualizar indicadores" title="Atualizar indicadores" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => onNavigateTab("os")}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
          >
            Abrir Chamados <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid de Indicadores Clicáveis */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
        {/* Card 1: OS de Hoje */}
        <button
          onClick={() => onNavigateTab("os")}
          className="text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500 transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <Clock className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">Hoje</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{displayCount(osCount)}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">OS Agendadas</div>
            <div className="text-[10px] text-blue-400 mt-2 font-bold flex items-center gap-1">
              Despachar equipe →
            </div>
          </div>
        </button>

        {/* Card 2: OS Atrasadas / Urgentes */}
        <button
          onClick={() => onNavigateTab("os")}
          className={`text-left p-4 rounded-xl transition group flex flex-col justify-between border ${
            overdueCount > 0
              ? "bg-rose-950/40 border-rose-800/60 hover:border-rose-500" 
              : "bg-slate-800/80 border-slate-700/80"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <AlertTriangle className={`w-5 h-5 ${overdueCount > 0 ? "text-rose-400" : "text-slate-400"}`} />
            {overdueCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">Urgente</span>
            )}
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400">{displayCount(osAtrasadasCount)}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">OS Atrasadas</div>
            <div className="text-[10px] text-rose-300 mt-2 font-bold">
              Priorizar técnico →
            </div>
          </div>
        </button>

        {/* Card 3: Obras com Gargalo */}
        <button
          onClick={() => onNavigateTab("obras")}
          className="text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500 transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <Building2 className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Etapas</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{displayCount(obrasGargaloCount)}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">Gargalo de Obra</div>
            <div className="text-[10px] text-amber-400 mt-2 font-bold">
              {obrasCount === null ? "Verificar obras" : `${displayCount(obrasCount)} em andamento · abrir obras →`}
            </div>
          </div>
        </button>

        {/* Card 4: Orçamentos sem resposta */}
        <button
          onClick={() => onNavigateTab("orcamento")}
          className="text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-purple-500 transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <FileText className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Follow-up</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{displayCount(orcamentosPendentesCount)}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">Orçamentos</div>
            <div className="text-[10px] text-purple-400 mt-2 font-bold">
              {orcamentosPendentesCount === null ? "Sem indicador disponível" : "Cobrar no WhatsApp →"}
            </div>
          </div>
        </button>

        {/* Card 5: Contas Vencendo */}
        <button
          onClick={() => onNavigateTab("financeiro")}
          className="text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <DollarSign className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Hoje</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{displayCount(contasVencendoCount)}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">Contas a Pagar</div>
            <div className="text-[10px] text-emerald-400 mt-2 font-bold">
              {contasVencendoCount === null ? "Sem indicador disponível" : "Dar baixa / saldo →"}
            </div>
          </div>
        </button>

        {/* Card 6: Empenhos Públicos */}
        <button
          onClick={() => onNavigateTab("contratos")}
          className="text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500 transition group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between w-full mb-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">PNCP</span>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{displayCount(empenhosFaturarCount)}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">Empenhos Prefeitura</div>
            <div className="text-[10px] text-indigo-400 mt-2 font-bold">
              {empenhosFaturarCount === null ? "Sem indicador disponível" : "Pronto para faturar →"}
            </div>
          </div>
        </button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg border border-rose-800 bg-rose-950/50 px-3 py-2 text-xs text-rose-200">{error}</p>}
    </div>
  );
}
