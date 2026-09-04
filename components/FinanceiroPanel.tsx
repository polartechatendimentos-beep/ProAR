"use client";

import React, { useState } from "react";
import { DollarSign, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownLeft, Plus, X } from "lucide-react";

interface FinanceRecord {
  id: string;
  descricao: string;
  entidadeNome: string;
  tipo: "PAGAR" | "RECEBER";
  valorTotal: number;
  valorLiquidado: number;
  dataVencimento: string;
  status: "aberta" | "parcial" | "liquidada";
  historicoBaixas: Array<{ data: string; valor: number; forma: string }>;
}

export function FinanceiroPanel() {
  const [records, setRecords] = useState<FinanceRecord[]>([
    {
      id: "FIN-001",
      descricao: "Compra de Tubos de Cobre e Isolamento (Obra Hospital)",
      entidadeNome: "Distribuidora Frigorífica Paulista LTDA",
      tipo: "PAGAR",
      valorTotal: 984.70,
      valorLiquidado: 500.00,
      dataVencimento: "2026-09-10",
      status: "parcial",
      historicoBaixas: [
        { data: "2026-08-30", valor: 500.00, forma: "PIX" },
      ],
    },
    {
      id: "FIN-002",
      descricao: "Higienização PMOC Mensal (Lote 01)",
      entidadeNome: "Prefeitura Municipal de Olímpia",
      tipo: "RECEBER",
      valorTotal: 4850.00,
      valorLiquidado: 0.00,
      dataVencimento: "2026-09-05",
      status: "aberta",
      historicoBaixas: [],
    },
    {
      id: "FIN-003",
      descricao: "Aquisição de Gás R410A DuPont (Cilindros 11.3kg)",
      entidadeNome: "Refrigeração São José do Rio Preto",
      tipo: "PAGAR",
      valorTotal: 1200.00,
      valorLiquidado: 1200.00,
      dataVencimento: "2026-08-25",
      status: "liquidada",
      historicoBaixas: [
        { data: "2026-08-25", valor: 1200.00, forma: "Boleto" },
      ],
    },
  ]);

  const [selectedRecord, setSelectedRecord] = useState<FinanceRecord | null>(null);
  const [valorBaixa, setValorBaixa] = useState<number>(0);
  const [formaPagamento, setFormaPagamento] = useState("PIX");

  const handleOpenBaixa = (record: FinanceRecord) => {
    setSelectedRecord(record);
    setValorBaixa(record.valorTotal - record.valorLiquidado);
  };

  const handleConfirmBaixa = () => {
    if (!selectedRecord || valorBaixa <= 0) return;

    const restanteAtual = selectedRecord.valorTotal - selectedRecord.valorLiquidado;
    const valorAplicado = Math.min(valorBaixa, restanteAtual);
    const novoLiquidado = selectedRecord.valorLiquidado + valorAplicado;
    const isTotalmenteLiquidada = novoLiquidado >= selectedRecord.valorTotal;

    setRecords((prev) =>
      prev.map((r) => {
        if (r.id === selectedRecord.id) {
          return {
            ...r,
            valorLiquidado: novoLiquidado,
            status: isTotalmenteLiquidada ? "liquidada" : "parcial",
            historicoBaixas: [
              ...r.historicoBaixas,
              { data: new Date().toISOString().split("T")[0], valor: valorAplicado, forma: formaPagamento },
            ],
          };
        }
        return r;
      })
    );

    setSelectedRecord(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Contas a Pagar / Receber com Baixa Parcial
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Controle de liquidação proporcional mantendo histórico completo de baixas e saldo restante.
          </p>
        </div>
      </div>

      {/* Tabela de Contas */}
      <div className="p-6">
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-3">Código / Descrição</th>
                <th className="p-3">Favorecido / Cliente</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Valor Total</th>
                <th className="p-3">Liquidado</th>
                <th className="p-3">Saldo Restante</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {records.map((r) => {
                const saldoRestante = r.valorTotal - r.valorLiquidado;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="p-3">
                      <span className="font-bold text-slate-900 block">{r.descricao}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{r.id} • Vencimento: {r.dataVencimento}</span>
                    </td>
                    <td className="p-3 font-medium text-slate-800">{r.entidadeNome}</td>
                    <td className="p-3 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${r.tipo === "PAGAR" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {r.tipo}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">R$ {r.valorTotal.toFixed(2)}</td>
                    <td className="p-3 font-mono text-emerald-700 font-semibold">R$ {r.valorLiquidado.toFixed(2)}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      R$ {saldoRestante.toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === "liquidada"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "parcial"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {r.status === "liquidada"
                          ? "Liquidada"
                          : r.status === "parcial"
                          ? "Parcialmente Paga"
                          : "Em Aberto"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {saldoRestante > 0 ? (
                        <button
                          onClick={() => handleOpenBaixa(r)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition shadow-sm"
                        >
                          Dar Baixa Restante
                        </button>
                      ) : (
                        <span className="text-slate-400 font-bold text-[11px] italic">Liquidado</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Baixa Parcial */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Registrar Baixa de Pagamento</h3>
              <button onClick={() => setSelectedRecord(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl text-xs space-y-1">
              <span className="font-bold text-slate-900 block">{selectedRecord.descricao}</span>
              <div className="flex justify-between text-slate-500">
                <span>Valor Total:</span>
                <span className="font-mono font-bold">R$ {selectedRecord.valorTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Já Liquidado:</span>
                <span className="font-mono font-bold text-emerald-600">R$ {selectedRecord.valorLiquidado.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1">
                <span>Saldo Pendente:</span>
                <span className="font-mono text-blue-700">R$ {(selectedRecord.valorTotal - selectedRecord.valorLiquidado).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Valor a Baixar Agora (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedRecord.valorTotal - selectedRecord.valorLiquidado}
                  value={valorBaixa || ""}
                  onChange={(e) => setValorBaixa(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Forma de Pagamento</label>
                <select
                  value={formaPagamento}
                  onChange={(e) => setFormaPagamento(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg outline-none text-slate-800"
                >
                  <option value="PIX">PIX</option>
                  <option value="Transferência">Transferência Bancária (TED/DOC)</option>
                  <option value="Boleto">Boleto Bancário</option>
                  <option value="Dinheiro">Dinheiro em Espécie</option>
                  <option value="Cartão">Cartão</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmBaixa}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow"
              >
                Confirmar Baixa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
