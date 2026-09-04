"use client";

import React, { useState, useEffect } from "react";
import { Landmark, RefreshCw, Bell, ExternalLink } from "lucide-react";

interface Licitacao {
  id: number;
  numeroControlePncp: string;
  titulo: string;
  orgao: string;
  uf: string;
  modalidade: string;
  valorEstimado: string;
  dataAbertura: string;
  status: string;
  linkEdital: string;
  notificadoWhatsapp: boolean;
}

export function PublicContractsPanel() {
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchLicitacoes = async () => {
    try {
      const res = await fetch("/api/licitacoes?status=em_andamento");
      const json = await res.json();
      if (json.success) {
        setLicitacoes(json.data);
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
      await fetchLicitacoes();
    } catch (e) {
      console.error("Erro ao sincronizar PNCP:", e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Landmark className="w-6 h-6 text-indigo-600" />
            Contratos Públicos, Prefeituras & Radar PNCP
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Monitoramento em tempo real de pregões, credenciamentos e dispensas de climatização e refrigeração.
          </p>
        </div>
        <button
          onClick={handleSyncPncp}
          disabled={syncing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-sm transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin text-indigo-600" : ""}`} />
          {syncing ? "Sincronizando PNCP..." : "Sincronizar Editais"}
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Buscando oportunidades públicas...</div>
        ) : licitacoes.length === 0 ? (
          <div className="text-center py-12">
            <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Nenhum edital aberto encontrado no momento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {licitacoes.map((item) => (
              <div
                key={item.id}
                className="border border-slate-200 rounded-xl p-4.5 hover:border-indigo-300 hover:bg-indigo-50/20 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      {item.modalidade || "Pregão Eletrônico"}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      UF: {item.uf || "SP"}
                    </span>
                    {item.notificadoWhatsapp && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Bell className="w-3 h-3" /> Alerta Enviado
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.titulo}</h3>
                  <p className="text-xs text-slate-600 font-medium">{item.orgao}</p>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <span className="text-xs text-slate-400 block">Valor Estimado</span>
                    <span className="text-sm font-bold text-slate-900">{item.valorEstimado || "A consultar"}</span>
                  </div>

                  <a
                    href={item.linkEdital || "https://pncp.gov.br"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                  >
                    Edital Completo <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
