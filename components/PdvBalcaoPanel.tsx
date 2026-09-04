import { StandardDocumentReport } from "@/components/StandardDocumentReport";
"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  ShoppingCart, Search, CreditCard, Banknote, QrCode, 
  Trash2, Plus, Minus, Check, AlertCircle, RefreshCw, X
} from "lucide-react";

interface CartItem {
  id: string;
  codigo: string;
  descricao: string;
  tipo: "PRODUTO" | "SERVIÇO";
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  isRecent?: boolean;
}

export function PdvBalcaoPanel() {
  const [items, setItems] = useState<CartItem[]>([
    {
      id: "1",
      codigo: "GAS-R410A",
      descricao: "Fluído Refrigerante Ecológico R410A (Carga p/ Split 12.000)",
      tipo: "PRODUTO",
      quantidade: 1,
      valorUnitario: 180.0,
      valorTotal: 180.0,
    },
    {
      id: "2",
      codigo: "SRV-HIG-PMOC",
      descricao: "Higienização Completa com Aplicação de Bactericida PMOC",
      tipo: "SERVIÇO",
      quantidade: 1,
      valorUnitario: 220.0,
      valorTotal: 220.0,
    },
  ]);

  const [inputCode, setInputCode] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("1");
  const [cliente, setCliente] = useState("Consumidor Final (Balcão)");
  const [vendedor, setVendedor] = useState("Técnico Balcão ProAR");

  // Modal de Pagamento (F4/F7)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [valorPix, setValorPix] = useState(0);
  const [valorDinheiro, setValorDinheiro] = useState(0);
  const [valorCartao, setValorCartao] = useState(0);
  const [showOrderReportModal, setShowOrderReportModal] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Atalhos de teclado F1-F12
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        const nome = prompt("Informe o nome ou CNPJ/CPF do Cliente:", cliente);
        if (nome) setCliente(nome);
      } else if (e.key === "F4" || e.key === "F7") {
        e.preventDefault();
        setShowPaymentModal(true);
      } else if (e.key === "F8") {
        e.preventDefault();
        handleRemoveItem(selectedItemId);
      } else if (e.key === "F9") {
        e.preventDefault();
        if (confirm("Deseja realmente cancelar toda a venda atual?")) {
          setItems([]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemId, cliente]);

  const totalVenda = items.reduce((acc, i) => acc + i.valorTotal, 0);
  const totalPago = valorPix + valorDinheiro + valorCartao;
  const faltaPagar = Math.max(0, totalVenda - totalPago);
  const troco = Math.max(0, totalPago - totalVenda);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    let multiplier = 1;
    let codeOrDesc = inputCode.trim();

    // Suporte a 10*CODIGO ou 10xCODIGO
    const match = codeOrDesc.match(/^(\d+)[\*xX](.+)$/);
    if (match) {
      multiplier = parseInt(match[1], 10) || 1;
      codeOrDesc = match[2].trim();
    }

    // Preço simulado ou busca de catálogo
    const unitPrice = codeOrDesc.toLowerCase().includes("gas") ? 180 : 150;
    const newItem: CartItem = {
      id: Date.now().toString(),
      codigo: codeOrDesc.toUpperCase(),
      descricao: `Item / Serviço: ${codeOrDesc.toUpperCase()}`,
      tipo: codeOrDesc.toLowerCase().includes("srv") ? "SERVIÇO" : "PRODUTO",
      quantidade: multiplier,
      valorUnitario: unitPrice,
      valorTotal: unitPrice * multiplier,
      isRecent: true,
    };

    // Insere no topo e foca
    setItems([newItem, ...items]);
    setSelectedItemId(newItem.id);
    setInputCode("");

    setTimeout(() => {
      setItems((prev) => prev.map((i) => (i.id === newItem.id ? { ...i, isRecent: false } : i)));
    }, 1500);
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQtd = Math.max(1, item.quantidade + delta);
            return {
              ...item,
              quantidade: newQtd,
              valorTotal: newQtd * item.valorUnitario,
            };
          }
          return item;
        })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-2xl flex flex-col gap-6 font-sans">
      {/* Barra Superior do PDV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              PDV Balcão ProAR — Frente de Caixa
            </h2>
            <div className="text-xs text-slate-400 flex items-center gap-4 mt-0.5">
              <span>Cliente (F1): <strong className="text-white">{cliente}</strong></span>
              <span>Operador: <strong className="text-white">{vendedor}</strong></span>
            </div>
          </div>
        </div>

        {/* Total da Venda em Destaque */}
        <div className="bg-blue-950/80 border border-blue-800/60 px-5 py-2.5 rounded-xl text-right">
          <span className="text-[10px] font-bold tracking-wider text-blue-300 uppercase block">Total a Pagar</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400">
            R$ {totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Grid Principal do PDV */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Barra de Atalhos F1–F12 à Esquerda */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-1.5 text-[11px] font-mono font-semibold text-slate-400">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-2">Atalhos de Balcão</div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F1]</span> <span className="text-slate-300">Cliente</span></div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F2]</span> <span className="text-slate-300">Menu</span></div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F4]</span> <span className="text-slate-300">Pagamento</span></div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F6]</span> <span className="text-slate-300">Pesquisar</span></div>
          <div className="p-2 rounded bg-blue-900/40 border border-blue-700 text-blue-300 flex justify-between"><span>[F7]</span> <span>Finalizar</span></div>
          <div className="p-2 rounded bg-rose-950/40 border border-rose-800 text-rose-300 flex justify-between"><span>[F8]</span> <span>Excluir Item</span></div>
          <div className="p-2 rounded bg-rose-950/40 border border-rose-800 text-rose-300 flex justify-between"><span>[F9]</span> <span>Cancelar</span></div>
        </div>

        {/* Cupom / Lista de Itens no Centro */}
        <div className="lg:col-span-3 flex flex-col justify-between space-y-4">
          {/* Input Código com Foco Permanente */}
          <form onSubmit={handleAddItem} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3" />
              <input
                ref={inputRef}
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Digite o código de barras, código do item ou 5*CODIGO e pressione Enter..."
                className="w-full bg-slate-950 text-white placeholder-slate-500 pl-11 pr-4 py-2.5 rounded-xl border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-mono text-sm font-bold"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow"
            >
              Lançar
            </button>
          </form>

          {/* Grade de Itens Lançados */}
          <div className="bg-slate-950/90 rounded-xl border border-slate-800 overflow-hidden divide-y divide-slate-800/80 min-h-[260px] max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">Nenhum item no cupom atual. Digite um código acima.</div>
            ) : (
              items.map((item) => {
                const isSelected = selectedItemId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`p-3.5 flex items-center justify-between gap-4 transition cursor-pointer ${
                      isSelected
                        ? "bg-blue-950/80 border-l-4 border-l-blue-500 text-white"
                        : "bg-slate-900/40 hover:bg-slate-900 text-slate-300"
                    } ${item.isRecent ? "ring-2 ring-blue-400 bg-blue-900/60" : ""}`}
                  >
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                          {item.codigo}
                        </span>
                        <span className="text-[10px] font-bold text-blue-400 uppercase">{item.tipo}</span>
                      </div>
                      <div className="text-xs font-bold text-white">{item.descricao}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        R$ {item.valorUnitario.toFixed(2)} un
                      </div>
                    </div>

                    {/* Quantidade Compacta e Total do Item */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center border border-slate-700 bg-slate-900 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateQuantity(item.id, -1);
                          }}
                          className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 py-1 text-xs font-mono font-bold text-white">
                          {item.quantidade}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateQuantity(item.id, 1);
                          }}
                          className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="text-right w-24">
                        <span className="text-sm font-black text-emerald-400 font-mono">
                          R$ {item.valorTotal.toFixed(2)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(item.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Barra Inferior de Ação */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              Total de itens: <strong>{items.length}</strong>
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowOrderReportModal(true)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-xs font-bold text-white rounded-xl transition flex items-center gap-1.5 shadow"
              >
                Imprimir Pedido A4
              </button>
              <button
                type="button"
                onClick={() => setItems([])}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition"
              >
                Limpar Venda [F9]
              </button>
              <button
                type="button"
                onClick={() => setShowPaymentModal(true)}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-black text-white rounded-xl shadow-lg transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Finalizar Venda [F7]
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pagamento & Troco Automático */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 shadow-2xl text-white space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-400" /> Formas de Pagamento
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center py-2 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total do Cupom</span>
              <span className="text-2xl font-black text-emerald-400">
                R$ {totalVenda.toFixed(2)}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">PIX Instantâneo (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorPix || ""}
                  onChange={(e) => setValorPix(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full bg-slate-950 text-white p-2 rounded-lg border border-slate-700 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Dinheiro em Espécie (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorDinheiro || ""}
                  onChange={(e) => setValorDinheiro(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full bg-slate-950 text-white p-2 rounded-lg border border-slate-700 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cartão Débito/Crédito (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorCartao || ""}
                  onChange={(e) => setValorCartao(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="w-full bg-slate-950 text-white p-2 rounded-lg border border-slate-700 outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            {/* Painel de Conferência de Troco e Falta Pagar */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Total Informado:</span>
                <span className="font-mono font-bold text-white">R$ {totalPago.toFixed(2)}</span>
              </div>
              {faltaPagar > 0 ? (
                <div className="flex justify-between text-rose-400 font-bold">
                  <span>Falta Pagar:</span>
                  <span className="font-mono">R$ {faltaPagar.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Troco:</span>
                  <span className="font-mono">R$ {troco.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={faltaPagar > 0 || items.length === 0}
                onClick={() => {
                  alert("✓ Venda finalizada com sucesso! Cupom registrado no sistema.");
                  setItems([]);
                  setShowPaymentModal(false);
                  setValorPix(0);
                  setValorDinheiro(0);
                  setValorCartao(0);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-black rounded-lg transition"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Pedido de Venda Balcão Padrão A4 */}
      {showOrderReportModal && (
        <StandardDocumentReport
          tipo="PEDIDO"
          numero={`PED-${Date.now().toString().slice(-6)}`}
          cliente={{
            nome: cliente,
            endereco: "Venda Presencial Balcão - Mirassol/SP",
          }}
          descricaoServico="Venda e fornecimento de peças, fluídos refrigerantes e serviços técnicos de balcão."
          itens={items.map((it, idx) => ({
            itemNum: String(idx + 1).padStart(2, "0"),
            equipamentoOuItem: it.descricao,
            capacidadeOuDetalhes: it.tipo,
            quantidade: it.quantidade,
            valorUnitario: it.valorUnitario,
            valorTotal: it.valorTotal,
          }))}
          valorGlobal={totalVenda}
          condicoesComerciais={{
            formaPagamento: "À vista / PIX / Cartão",
            validade: "Imediata",
            garantia: "90 dias de garantia legal de peças (CDC)",
            prazo: "Entrega imediata em balcão",
          }}
          onClose={() => setShowOrderReportModal(false)}
        />
      )}
    </div>
  );
}
