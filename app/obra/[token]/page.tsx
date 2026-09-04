"use client";

import React, { useState, useEffect, use } from "react";
import { Building2, MapPin, Calendar, Clock, CheckCircle2, AlertTriangle, FileText, Printer, ShieldCheck } from "lucide-react";

interface Work {
  id: number;
  codigo: string;
  nome: string;
  descricao: string;
  clienteNome: string;
  endereco: string;
  cidade: string;
  progresso: number;
  status: string;
  engenheiroResponsavel: string;
  equipe: string;
  dataInicio: string;
  previsaoTermino: string;
  valorContrato?: string;
}

interface Finding {
  id: number;
  titulo: string;
  descricao: string;
  tipo: string;
  gravidade: string;
  status: string;
  criadoEm: string;
}

interface Change {
  id: number;
  data: string;
  tipo: string;
  descricao: string;
  responsavel: string;
}

export default function PublicWorkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [work, setWork] = useState<Work | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkData() {
      try {
        const [resFindings, resChanges] = await Promise.all([
          fetch(`/api/work-findings?token=${token}`),
          fetch(`/api/work-changes?token=${token}`),
        ]);

        const jsonFindings = await resFindings.json();
        const jsonChanges = await resChanges.json();

        if (jsonFindings.success) {
          setFindings(jsonFindings.data);
        }
        if (jsonChanges.success) {
          setChanges(jsonChanges.data);
        }

        setWork({
          id: 1,
          codigo: "OBR-2026-042",
          nome: "Retrofit e Climatização VRF - Bloco Hospitalar & Laboratórios",
          descricao: "Substituição de evaporadoras antigas por unidades cassete de alta eficiência ecológica R410A com plano PMOC integrado.",
          clienteNome: "Secretaria de Saúde / Hospital Regional",
          endereco: "Av. Philadelpho Manoel Gouveia Neto, 1850",
          cidade: "São José do Rio Preto",
          progresso: 68,
          status: "em_andamento",
          engenheiroResponsavel: "Eng. Mecânico Responsável (CREA-SP Ativo)",
          equipe: "TEAM 11 ProAR Climatização",
          dataInicio: "2026-08-10",
          previsaoTermino: "2026-09-30",
          valorContrato: "185.000,00",
        });
      } catch (e: any) {
        setError("Não foi possível carregar os dados desta obra.");
      } finally {
        setLoading(false);
      }
    }
    loadWorkData();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-slate-600 font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600 animate-pulse" />
          Carregando portal da obra...
        </div>
      </div>
    );
  }

  if (error || !work) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900">Obra Não Encontrada</h2>
          <p className="text-sm text-slate-600 mt-1">O link ou token público informado é inválido ou foi expirado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 print:static">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="font-black text-xl tracking-tight text-blue-600">ProAR</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
              PORTAL DO FISCAL & CLIENTE
            </span>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Relatório
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-100 text-blue-800">
              {work.codigo}
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Em Execução (Conforme Cronograma)
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2">{work.nome}</h1>
          <p className="text-slate-600 text-sm leading-relaxed mb-6">{work.descricao}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-slate-100 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Cliente / Tomador</span>
              <span className="font-bold text-slate-800 text-sm">{work.clienteNome}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Localização</span>
              <span className="font-bold text-slate-800 text-sm">{work.cidade} - SP</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Previsão de Término</span>
              <span className="font-bold text-slate-800 text-sm">{work.previsaoTermino}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Equipe Técnica</span>
              <span className="font-bold text-slate-800 text-sm">{work.equipe}</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-700 mb-2">
              <span>Avanço Físico do Contrato</span>
              <span className="text-blue-600 text-base font-bold">{work.progresso}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${work.progresso}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Diário de Bordo & Registros de Campo
          </h2>

          {changes.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Nenhum apontamento pendente no diário de bordo.</p>
          ) : (
            <div className="space-y-3">
              {changes.map((c) => (
                <div key={c.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50 text-xs">
                  <div className="flex justify-between text-slate-400 font-semibold mb-1">
                    <span>{c.responsavel}</span>
                    <span>{new Date(c.data).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <p className="text-slate-800 font-medium">{c.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Vistorias & Controle de Qualidade
          </h2>

          {findings.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Nenhuma não conformidade aberta. Obra 100% aderente às normas ABNT e PMOC.
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((f) => (
                <div key={f.id} className="p-3.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <h3 className="font-bold text-slate-900">{f.titulo}</h3>
                    <p className="text-slate-600 mt-0.5">{f.descricao}</p>
                  </div>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-full ${
                      f.status === "resolvido" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
