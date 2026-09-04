import { StandardDocumentReport } from "@/components/StandardDocumentReport";
"use client";

import React, { useState } from "react";
import { FileText, Plus, Trash2, Calculator, Send, Printer, MapPin, CheckCircle2 } from "lucide-react";
import { getDistanceToMunicipality, calculateDisplacementFee } from "@/lib/municipality-distances";

interface BudgetItem {
  id: string;
  tipo: "PRODUTO" | "SERVIÇO";
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  valorTotal: number;
}

export function OrcamentoPanel() {
  const [cliente, setCliente] = useState("Hospital e Maternidade São Judas - Barretos/SP");
  const [cnpj, setCnpj] = useState("45.123.890/0001-22");
  const [cidadeDestino, setCidadeDestino] = useState("Barretos");
  const [custoAdicionalDeslocamento, setCustoAdicionalDeslocamento] = useState(0);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [items, setItems] = useState<BudgetItem[]>([
    {
      id: "1",
      tipo: "SERVIÇO",
      descricao: "Higienização profunda com laudo PMOC (Aparelhos Split 12.000 BTUs)",
      quantidade: 6,
      valorUnitario: 190.0,
      desconto: 0,
      valorTotal: 1140.0,
    },
    {
      id: "2",
      tipo: "PRODUTO",
      descricao: "Carga de Fluído Refrigerante R410A Ecológico com teste de estanqueidade",
      quantidade: 2,
      valorUnitario: 240.0,
      desconto: 30.0,
      valorTotal: 450.0,
    },
    {
      id: "3",
      tipo: "SERVIÇO",
      descricao: "Manutenção Preventiva em Unidade Condensadora e revisão de quadro elétrico",
      quantidade: 1,
      valorUnitario: 350.0,
      desconto: 0,
      valorTotal: 350.0,
    },
  ]);

  // Atualiza taxa de deslocamento ao mudar a cidade
  const handleCityChange = (cidade: string) => {
    setCidadeDestino(cidade);
    const taxa = calculateDisplacementFee(cidade);
    setCustoAdicionalDeslocamento(taxa.valorDeslocamento);
  };

  // Totalizadores automáticos
  const totalProdutos = items
    .filter((i) => i.tipo === "PRODUTO")
    .reduce((acc, i) => acc + i.valorTotal, 0);

  const totalServicos = items
    .filter((i) => i.tipo === "SERVIÇO")
    .reduce((acc, i) => acc + i.valorTotal, 0);

  const totalDescontos = items.reduce((acc, i) => acc + i.desconto, 0);
  const totalGeral = totalProdutos + totalServicos + custoAdicionalDeslocamento;

  const handleAddItem = (tipo: "PRODUTO" | "SERVIÇO") => {
    const newItem: BudgetItem = {
      id: Date.now().toString(),
      tipo,
      descricao: tipo === "PRODUTO" ? "Peça / Filtro / Tubulação de Cobre" : "Mão de Obra Técnica Especializada",
      quantidade: 1,
      valorUnitario: 150.0,
      desconto: 0,
      valorTotal: 150.0,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header do Orçamento */}
      <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              ORÇ-2026-089
            </span>
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              Aguardando Resposta do Cliente
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Simulador & Emissor de Orçamentos (Grade Integrada)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Produtos e serviços na mesma grade com cálculo de deslocamento KM automático regional.
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Visualizar / Imprimir A4
          </button>
          <button
            onClick={() => alert("✓ Orçamento enviado com sucesso via WhatsApp!")}
            className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition flex items-center gap-1.5 shadow"
          >
            <Send className="w-3.5 h-3.5" /> Enviar WhatsApp
          </button>
        </div>
      </div>

      {/* Dados do Cliente e Deslocamento Regional */}
      <div className="p-6 border-b border-slate-200 bg-white grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block text-slate-500 font-semibold mb-1">Cliente / Razão Social</label>
          <input
            type="text"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium text-slate-900"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-semibold mb-1">CNPJ / CPF</label>
          <input
            type="text"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium text-slate-900 font-mono"
          />
        </div>
        <div>
          <label className="block text-slate-500 font-semibold mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-blue-600" /> Município de Atendimento (SP)
          </label>
          <input
            type="text"
            value={cidadeDestino}
            onChange={(e) => handleCityChange(e.target.value)}
            placeholder="Ex: Barretos, Olímpia, Bebedouro..."
            className="w-full p-2 border border-slate-300 rounded-lg outline-none font-medium text-slate-900"
          />
        </div>
      </div>

      {/* Grade Única de Produtos e Serviços */}
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-900">Itens e Serviços do Orçamento</h3>
          <div className="flex gap-2">
            <button
              onClick={() => handleAddItem("PRODUTO")}
              className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              + Adicionar Produto
            </button>
            <button
              onClick={() => handleAddItem("SERVIÇO")}
              className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
            >
              + Adicionar Serviço
            </button>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descrição</th>
                <th className="p-3 w-20">Qtd</th>
                <th className="p-3 w-28">Valor Unit.</th>
                <th className="p-3 w-24">Desconto</th>
                <th className="p-3 w-28 text-right">Total</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="p-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        item.tipo === "PRODUTO" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {item.tipo}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-slate-900">{item.descricao}</td>
                  <td className="p-3 font-mono font-bold">{item.quantidade}</td>
                  <td className="p-3 font-mono">R$ {item.valorUnitario.toFixed(2)}</td>
                  <td className="p-3 font-mono text-slate-500">R$ {item.desconto.toFixed(2)}</td>
                  <td className="p-3 font-mono font-bold text-slate-900 text-right">
                    R$ {item.valorTotal.toFixed(2)}
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleRemoveItem(item.id)} className="text-slate-400 hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totalizadores Separados com Cálculo de Deslocamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <span className="font-bold text-slate-800 block">Custos Adicionais & Deslocamento Regional</span>
            <div className="flex justify-between text-slate-600">
              <span>Distância a partir da Matriz (Mirassol/SP):</span>
              <span className="font-bold font-mono">{getDistanceToMunicipality(cidadeDestino)} km</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Taxa Técnica de Deslocamento (Ida e Volta):</span>
              <span className="font-bold font-mono text-slate-900">
                R$ {custoAdicionalDeslocamento.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Base de cálculo padronizada de deslocamento para atendimento em campo na região noroeste paulista.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-xs space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Total Produtos:</span>
              <span className="font-mono font-bold">R$ {totalProdutos.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Total Serviços:</span>
              <span className="font-mono font-bold">R$ {totalServicos.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Deslocamento Técnico:</span>
              <span className="font-mono font-bold">R$ {custoAdicionalDeslocamento.toFixed(2)}</span>
            </div>
            {totalDescontos > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Descontos Concedidos:</span>
                <span className="font-mono">- R$ {totalDescontos.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-blue-200 pt-2 flex justify-between items-center text-sm font-black text-slate-900">
              <span>Total do Orçamento:</span>
              <span className="text-xl text-blue-700 font-mono">
                R$ {totalGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Modal de Impressão Oficial A4 Padronizado */}
      {showPrintModal && (
        <StandardDocumentReport
          tipo="ORCAMENTO"
          numero="2505-002"
          cliente={{
            nome: cliente,
            cnpjCpf: cnpj,
            endereco: `${cidadeDestino} - SP (Atendimento Técnico Especializado)`,
            cidade: cidadeDestino,
            uf: "SP",
          }}
          itens={items.map((i, idx) => ({
            itemNum: String(idx + 1).padStart(2, "0"),
            equipamentoOuItem: i.descricao,
            capacidadeOuDetalhes: i.tipo,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            valorTotal: i.valorTotal,
          }))}
          valorGlobal={totalGeral}
          condicoesComerciais={{
            formaPagamento: "A combinar / Faturado",
            validade: "10 (dez) dias úteis",
            garantia: "90 (noventa) dias para serviços e mão de obra (CDC)",
            prazo: "A combinar conforme disponibilidade de equipe",
          }}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
