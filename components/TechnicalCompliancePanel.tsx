"use client";

import React, { useState } from "react";
import { ShieldCheck, FileCheck, Award, AlertCircle, CheckCircle } from "lucide-react";

export function TechnicalCompliancePanel() {
  const [activeTab, setActiveTab] = useState<"pmoc" | "crea" | "anvisa">("pmoc");

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Conformidade Técnica, PMOC & Certificações
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Atendimento integral à Lei Federal 13.589/2018, Resolução ANVISA nº 9 e normas ABNT NBR 13971 / 16401.
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={() => setActiveTab("pmoc")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "pmoc"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            PMOC Digital & Laudos
          </button>
          <button
            onClick={() => setActiveTab("crea")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "crea"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Responsabilidade Técnica & ART
          </button>
          <button
            onClick={() => setActiveTab("anvisa")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "anvisa"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Padrões ANVISA & Qualidade do Ar
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === "pmoc" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                <span className="text-xs font-bold text-emerald-800 uppercase">Laudo PMOC Válido</span>
                <p className="text-2xl font-black text-emerald-950 mt-1">100%</p>
                <p className="text-xs text-emerald-700 mt-0.5">Todos os planos em conformidade legal</p>
              </div>
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                <span className="text-xs font-bold text-blue-800 uppercase">Aparelhos Monitorados</span>
                <p className="text-2xl font-black text-blue-950 mt-1">+1.480</p>
                <p className="text-xs text-blue-700 mt-0.5">Com etiquetas QR Code e histórico</p>
              </div>
              <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/50">
                <span className="text-xs font-bold text-purple-800 uppercase">Higienizações Concluídas</span>
                <p className="text-2xl font-black text-purple-950 mt-1">98,4%</p>
                <p className="text-xs text-purple-700 mt-0.5">Taxa de pontualidade no cronograma</p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Checklist Operacional Padrão de Higienização e Manutenção
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Limpeza e assepsia profunda dos filtros de ar
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Higienização da serpentina evaporadora e bandeja de condensado
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Desobstrução e lavagem do sistema de dreno
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Aplicação de produto bactericida biodegradável registrado no MS
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Revisão de fiações elétricas, capacitores e aperto de bornes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Medição de superaquecimento, sub-resfriamento e pressão de gás
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "crea" && (
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-600" />
              Responsabilidade Técnica Habilitada (CREA-SP)
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Todas as ordens de serviço complexas, laudos PMOC de grande porte e instalações de sistemas VRF/Chiller são chancelados por Engenheiro Mecânico / Eletricista com emissão de Anotação de Responsabilidade Técnica (ART).
            </p>
            <div className="text-xs text-slate-500 font-mono bg-white p-3 rounded border border-slate-200">
              Engenheiro Responsável: CREA-SP Ativo | ProAR Climatização & Engenharia Térmica LTDA | Matriz Mirassol/SP
            </div>
          </div>
        )}

        {activeTab === "anvisa" && (
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-600" />
              Padrões de Referência da Qualidade do Ar de Interiores
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              O sistema ProAR monitora indicadores de temperatura (23°C a 26°C), umidade relativa (40% a 65%) e periodicidade de troca de elementos filtrantes conforme preconizado pela ANVISA (RE nº 09/2003).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
