"use client";

import React from "react";
import { 
  Clock, AlertTriangle, CheckCircle2, Wrench, FileText, 
  DollarSign, Building2, Package, ShieldCheck, ArrowRight, UserCheck, Flame
} from "lucide-react";

interface DailyWorkCenterProps {
  onNavigateTab: (tab: "dashboard" | "os" | "obras" | "orcamento" | "pdv" | "financeiro" | "contratos" | "pmoc") => void;
  osCount: number;
  osAtrasadasCount: number;
  obrasCount: number;
  obrasGargaloCount: number;
  orcamentosPendentesCount: number;
  contasVencendoCount: number;
  empenhosFaturarCount: number;
}

export function DailyWorkCenter({
  onNavigateTab,
  osCount = 3,
  osAtrasadasCount = 1,
  obrasCount = 2,
  obrasGargaloCount = 1,
  orcamentosPendentesCount = 4,
  contasVencendoCount = 2,
  empenhosFaturarCount = 1,
}: DailyWorkCenterProps) {
  return (
    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-lg border border-slate-800">
      {/* Cabeçalho da Central Operacional */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono">
              OPERAÇÃO EM TEMPO REAL — MATRIZ MIRASSOL
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
            <span className="text-[11px] text-slate-400 block">Eficiência Operacional</span>
            <span className="text-sm font-bold text-emerald-400">98,2% em dia</span>
          </div>
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
            <div className="text-2xl font-black text-white">{osCount}</div>
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
            osAtrasadasCount > 0 
              ? "bg-rose-950/40 border-rose-800/60 hover:border-rose-500" 
              : "bg-slate-800/80 border-slate-700/80"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <AlertTriangle className={`w-5 h-5 ${osAtrasadasCount > 0 ? "text-rose-400" : "text-slate-400"}`} />
            {osAtrasadasCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">Urgente</span>
            )}
          </div>
          <div>
            <div className="text-2xl font-black text-rose-400">{osAtrasadasCount}</div>
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
            <div className="text-2xl font-black text-white">{obrasGargaloCount}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">Gargalo de Obra</div>
            <div className="text-[10px] text-amber-400 mt-2 font-bold">
              Resolver material →
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
            <div className="text-2xl font-black text-white">{orcamentosPendentesCount}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">Orçamentos</div>
            <div className="text-[10px] text-purple-400 mt-2 font-bold">
              Cobrar no WhatsApp →
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
            <div className="text-2xl font-black text-white">{contasVencendoCount}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">Contas a Pagar</div>
            <div className="text-[10px] text-emerald-400 mt-2 font-bold">
              Dar baixa / saldo →
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
            <div className="text-2xl font-black text-white">{empenhosFaturarCount}</div>
            <div className="text-xs font-medium text-slate-300 mt-0.5">Empenhos Prefeitura</div>
            <div className="text-[10px] text-indigo-400 mt-2 font-bold">
              Pronto para faturar →
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
