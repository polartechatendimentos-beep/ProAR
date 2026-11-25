"use client";

import { StandardDocumentReport } from "@/components/StandardDocumentReport";

import React, { useState, useEffect, useRef } from "react";
import { CopperWeightCalculator } from "@/components/CopperWeightCalculator";
import type { QuoteConversionDraft } from "@/lib/commercial-document";
import { useOfflineState } from "@/lib/use-offline-state";
import { 
  ShoppingCart, Search, CreditCard, Trash2, Plus, Minus, Check, X
} from "lucide-react";

interface CartItem {
  id: string;
  codigo: string;
  descricao: string;
  tipo: "PRODUTO" | "SERVIÇO";
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  desconto?: number;
  valorTotal: number;
  catalogItemId?: string;
  estoque?: number;
  isRecent?: boolean;
}

interface CatalogItem extends Omit<CartItem, "id" | "quantidade" | "valorTotal" | "isRecent"> {
  id: string;
  estoque?: number;
}

interface PdvBalcaoPanelProps {
  conversionDraft?: QuoteConversionDraft | null;
  onConversionImported?: () => void;
}

export function PdvBalcaoPanel({ conversionDraft, onConversionImported }: PdvBalcaoPanelProps) {
  const [items, setItems] = useOfflineState<CartItem[]>("pdv-cart", []);
  const [catalog, setCatalog] = useOfflineState<CatalogItem[]>("pdv-catalog", []);

  const [inputCode, setInputCode] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [cliente, setCliente] = useOfflineState("pdv-customer", "Consumidor Final (Balcão)");
  const [vendedor, setVendedor] = useOfflineState("pdv-seller", "Técnico Balcão ProAR");
  const [importedBudgetNumber, setImportedBudgetNumber] = useOfflineState<string | null>("pdv-budget-number", null);

  // Modal de Pagamento (F4/F7)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [valorPix, setValorPix] = useState(0);
  const [valorDinheiro, setValorDinheiro] = useState(0);
  const [valorCartao, setValorCartao] = useState(0);
  const [parcelasCartao, setParcelasCartao] = useState(1);
  const [taxaCartao, setTaxaCartao] = useState(0);
  const [recentSales, setRecentSales] = useOfflineState<Array<{ numero: string; cliente: string; total: number; forma: string; dinheiro: number }>>("pdv-recent-sales", []);
  const [completedSale, setCompletedSale] = useState<{ numero: string; cliente: string; itens: CartItem[]; total: number; forma: string } | null>(null);
  const [cashOpen, setCashOpen] = useOfflineState("pdv-cash-open", false);
  const [openingCash, setOpeningCash] = useOfflineState("pdv-opening-cash", 0);
  const [openingCashInput, setOpeningCashInput] = useOfflineState("pdv-opening-cash-input", "");
  const [countedCashInput, setCountedCashInput] = useOfflineState("pdv-counted-cash-input", "");
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashModalAction, setCashModalAction] = useState<"open" | "close">("open");
  const [lastCashDifference, setLastCashDifference] = useOfflineState<number | null>("pdv-last-cash-difference", null);
  const [showOrderReportModal, setShowOrderReportModal] = useState(false);
  const [showQuickItemModal, setShowQuickItemModal] = useState(false);
  const [newItemType, setNewItemType] = useState<"PRODUTO" | "SERVIÇO">("PRODUTO");
  const [newItemCode, setNewItemCode] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("UN");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemStock, setNewItemStock] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!conversionDraft) return;
    setImportedBudgetNumber(conversionDraft.numero);
    setCliente(conversionDraft.cliente);
    setItems(conversionDraft.itens.map((item) => ({
      id: `${conversionDraft.id}-${item.id}`,
      codigo: item.tipo === "PRODUTO" ? "ORCAMENTO" : "SERVICO",
      descricao: item.descricao,
      tipo: item.tipo,
      unidade: item.unidade || (item.tipo === "SERVIÇO" ? "SV" : "UN"),
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      desconto: item.desconto,
      valorTotal: item.valorTotal,
    })));
    onConversionImported?.();
  }, [conversionDraft, onConversionImported]);

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
        if (selectedItemId) handleRemoveItem(selectedItemId);
      } else if (e.key === "F9") {
        e.preventDefault();
        if (confirm("Deseja realmente cancelar toda a venda atual?")) {
          setItems([]);
        }
      } else if (e.key === "F2") {
        e.preventDefault();
        setShowQuickItemModal(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        setCashModalAction(cashOpen ? "close" : "open");
        setShowCashModal(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemId, cliente, cashOpen]);

  const totalVenda = items.reduce((acc, i) => acc + i.valorTotal, 0);
  const taxaCartaoValor = valorCartao * (taxaCartao / 100);
  const totalCobrar = totalVenda + taxaCartaoValor;
  const totalPago = valorPix + valorDinheiro + valorCartao + taxaCartaoValor;
  const faltaPagar = Math.max(0, totalCobrar - totalPago);
  const troco = Math.max(0, totalPago - totalCobrar);
  const cashReceived = recentSales.reduce((sum, sale) => sum + sale.dinheiro, 0);
  const expectedCash = openingCash + cashReceived;

  const addCatalogItem = (product: CatalogItem, quantity = 1) => {
    const quantityAlreadyInCart = items.filter((item) => item.catalogItemId === product.id).reduce((sum, item) => sum + item.quantidade, 0);
    if (product.estoque !== undefined && quantity + quantityAlreadyInCart > product.estoque) {
      alert(`Estoque disponível: ${product.estoque} ${product.unidade}. Ajuste a quantidade ou atualize o cadastro.`);
      return;
    }
    const newItem: CartItem = { ...product, catalogItemId: product.id, id: `${product.id}-${Date.now()}`, quantidade: quantity, valorTotal: quantity * product.valorUnitario, isRecent: true };
    setItems((current) => [newItem, ...current]);
    setSelectedItemId(newItem.id);
    setInputCode("");
    setTimeout(() => setItems((current) => current.map((item) => item.id === newItem.id ? { ...item, isRecent: false } : item)), 1500);
  };

  const handleAddItem = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputCode.trim()) return;
    let search = inputCode.trim();
    let quantity = 1;
    const match = search.match(/^(\d+(?:[.,]\d+)?)[*xX](.+)$/);
    if (match) {
      quantity = Math.max(0.01, Number(match[1].replace(",", ".")) || 1);
      search = match[2].trim();
    }
    const normalizedSearch = search.toLocaleLowerCase("pt-BR");
    const product = catalog.find((item) => item.codigo.toLocaleLowerCase("pt-BR") === normalizedSearch || item.descricao.toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    if (product) {
      addCatalogItem(product, quantity);
      return;
    }
    setNewItemCode(search.toUpperCase());
    setNewItemDescription(search);
    setShowQuickItemModal(true);
  };

  const handleQuickRegister = (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(newItemPrice.replace(",", "."));
    if (!newItemCode.trim() || !newItemDescription.trim() || !Number.isFinite(price) || price <= 0) return;
    if (catalog.some((item) => item.codigo.toLocaleLowerCase("pt-BR") === newItemCode.trim().toLocaleLowerCase("pt-BR"))) {
      alert("Já existe um item com esse código no catálogo desta sessão. Pesquise o item ou informe outro código.");
      return;
    }
    const product: CatalogItem = {
      id: `CAT-${Date.now()}`,
      codigo: newItemCode.trim().toUpperCase(),
      descricao: newItemDescription.trim(),
      tipo: newItemType,
      unidade: newItemUnit,
      valorUnitario: price,
      estoque: newItemType === "PRODUTO" && newItemStock !== "" ? Number(newItemStock) : undefined,
    };
    setCatalog((current) => [product, ...current]);
    addCatalogItem(product);
    setNewItemCode(""); setNewItemDescription(""); setNewItemPrice(""); setNewItemStock("");
    setShowQuickItemModal(false);
  };

  const catalogMatches = inputCode.trim() ? catalog.filter((product) => `${product.codigo} ${product.descricao}`.toLocaleLowerCase("pt-BR").includes(inputCode.toLocaleLowerCase("pt-BR"))).slice(0, 6) : [];

  const handleUpdateQuantity = (id: string, delta: number) => {
    const selectedItem = items.find((item) => item.id === id);
    const quantityInOtherLines = selectedItem?.catalogItemId ? items.filter((item) => item.catalogItemId === selectedItem.catalogItemId && item.id !== id).reduce((sum, item) => sum + item.quantidade, 0) : 0;
    const maxQuantity = selectedItem?.estoque === undefined ? Number.POSITIVE_INFINITY : Math.max(0, selectedItem.estoque - quantityInOtherLines);
    setItems((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQtd = Math.min(maxQuantity, Math.max(0.01, item.quantidade + delta));
            return {
              ...item,
              quantidade: newQtd,
              valorTotal: Math.max(0, newQtd * item.valorUnitario - (item.desconto || 0)),
            };
          }
          return item;
        })
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const maxQuantityFor = (item: CartItem) => {
    if (item.estoque === undefined || !item.catalogItemId) return item.estoque;
    const otherLines = items.filter((row) => row.catalogItemId === item.catalogItemId && row.id !== item.id).reduce((sum, row) => sum + row.quantidade, 0);
    return Math.max(0, item.estoque - otherLines);
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
            <span className={cashOpen ? "font-bold text-emerald-300" : "font-bold text-amber-300"}>{cashOpen ? "Caixa aberto" : "Caixa fechado"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setCashModalAction(cashOpen ? "close" : "open"); setShowCashModal(true); }} className={`rounded-lg border px-3 py-2 text-xs font-bold ${cashOpen ? "border-emerald-700 bg-emerald-950 text-emerald-300" : "border-slate-700 bg-slate-800 text-slate-300"}`}>{cashOpen ? "Fechar caixa [F3]" : "Abrir caixa [F3]"}</button>
          <CopperWeightCalculator dark />
        </div>

        {/* Total da Venda em Destaque */}
        <div className="bg-blue-950/80 border border-blue-800/60 px-5 py-2.5 rounded-xl text-right">
          <span className="text-[10px] font-bold tracking-wider text-blue-300 uppercase block">Total a Pagar</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400">
            R$ {totalCobrar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {importedBudgetNumber && (
        <div role="status" className="rounded-lg border border-emerald-700/70 bg-emerald-950/50 px-3 py-2 text-xs font-semibold text-emerald-300">
          Orçamento {importedBudgetNumber} importado para a venda. Revise os itens e valores antes de finalizar.
        </div>
      )}

      {/* Grid Principal do PDV */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Barra de Atalhos F1–F12 à Esquerda */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-1.5 text-[11px] font-mono font-semibold text-slate-400">
          <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 px-2">Atalhos de Balcão</div>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F1]</span> <span className="text-slate-300">Cliente</span></div>
          <button type="button" onClick={() => setShowQuickItemModal(true)} className="w-full p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F2]</span> <span className="text-slate-300">Cadastro rápido</span></button>
          <button type="button" onClick={() => { setCashModalAction(cashOpen ? "close" : "open"); setShowCashModal(true); }} className="w-full p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F3]</span> <span className="text-slate-300">{cashOpen ? "Fechar caixa" : "Abrir caixa"}</span></button>
          <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F4]</span> <span className="text-slate-300">Pagamento</span></div>
          <button type="button" onClick={() => inputRef.current?.focus()} className="w-full p-2 rounded bg-slate-900 border border-slate-800 flex justify-between"><span>[F6]</span> <span className="text-slate-300">Pesquisar item</span></button>
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
                placeholder="Buscar item cadastrado ou código de barras; use 2,5*CODIGO para lançar quantidade..."
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

          {inputCode.trim() && (
            <div className="-mt-3 rounded-xl border border-slate-700 bg-slate-950 p-2">
              {catalogMatches.length ? catalogMatches.map((product) => (
                <button key={product.id} type="button" onClick={() => addCatalogItem(product)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800">
                  <span><b className="block text-xs text-white">{product.descricao}</b><small className="text-[10px] text-slate-400">{product.codigo} · {product.tipo} · {product.unidade}{product.estoque !== undefined ? ` · Estoque ${product.estoque}` : ""}</small></span>
                  <strong className="whitespace-nowrap text-xs text-emerald-300">R$ {product.valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                </button>
              )) : <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"><span className="text-xs text-slate-400">Item não encontrado no catálogo desta sessão.</span><button type="button" onClick={() => { setNewItemCode(inputCode.trim().toUpperCase()); setNewItemDescription(inputCode.trim()); setShowQuickItemModal(true); }} className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white">Cadastrar item [F2]</button></div>}
            </div>
          )}

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
                        <input aria-label={`Quantidade em ${item.unidade}`} type="number" min="0.01" max={maxQuantityFor(item)} step="0.01" value={item.quantidade} onChange={(event) => { const requested = Math.max(0.01, Number(event.target.value) || 0.01); const quantity = Math.min(maxQuantityFor(item) ?? Number.POSITIVE_INFINITY, requested); setItems((current) => current.map((row) => row.id === item.id ? { ...row, quantidade: quantity, valorTotal: Math.max(0, quantity * row.valorUnitario - (row.desconto || 0)) } : row)); }} className="w-16 bg-transparent px-1 py-1 text-center text-xs font-mono font-bold text-white outline-none" />
                        <span className="pr-2 text-[10px] font-bold text-slate-400">{item.unidade}</span>
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
                disabled={items.length === 0}
                onClick={() => setShowOrderReportModal(true)}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-xs font-bold text-white rounded-xl transition flex items-center gap-1.5 shadow"
              >
                Imprimir Pedido A4
              </button>
              <button
                type="button"
                onClick={() => { if (confirm("Deseja realmente cancelar toda a venda atual?")) { setItems([]); setImportedBudgetNumber(null); setValorPix(0); setValorDinheiro(0); setValorCartao(0); } }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition"
              >
                Limpar Venda [F9]
              </button>
              <button
                type="button"
                disabled={items.length === 0 || !cashOpen}
                onClick={() => setShowPaymentModal(true)}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-black text-white rounded-xl shadow-lg transition flex items-center gap-1.5"
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
              <span className="text-2xl font-black text-emerald-400">R$ {totalCobrar.toFixed(2)}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">PIX Instantâneo (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorPix || ""}
                  onChange={(e) => setValorPix(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                  className="w-full bg-slate-950 text-white p-2 rounded-lg border border-slate-700 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Dinheiro em Espécie (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorDinheiro || ""}
                  onChange={(e) => setValorDinheiro(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                  className="w-full bg-slate-950 text-white p-2 rounded-lg border border-slate-700 outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Cartão Débito/Crédito (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorCartao || ""}
                  onChange={(e) => setValorCartao(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                  className="w-full bg-slate-950 text-white p-2 rounded-lg border border-slate-700 outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-slate-300 font-semibold">Parcelas no cartão
                  <select value={parcelasCartao} onChange={(event) => setParcelasCartao(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-white">
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}x</option>)}
                  </select>
                </label>
                <label className="block text-slate-300 font-semibold">Taxa adquirente (%)
                  <input type="number" min="0" step="0.01" value={taxaCartao || ""} onChange={(event) => setTaxaCartao(Math.max(0, Number(event.target.value) || 0))} placeholder="0,00" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 p-2 font-mono text-white" />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setValorPix(Math.max(0, totalVenda - valorDinheiro - valorCartao)); }} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Completar com Pix</button>
                <button type="button" onClick={() => { setValorDinheiro(Math.max(0, totalVenda - valorPix - valorCartao)); }} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Completar com dinheiro</button>
                <button type="button" onClick={() => { setValorCartao(Math.max(0, totalVenda - valorPix - valorDinheiro)); }} className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Completar com cartão</button>
              </div>
            </div>

            {/* Painel de Conferência de Troco e Falta Pagar */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Produtos e serviços:</span>
                <span className="font-mono font-bold text-white">R$ {totalVenda.toFixed(2)}</span>
              </div>
              {taxaCartaoValor > 0 && <div className="flex justify-between text-slate-400"><span>Taxa cartão ({parcelasCartao}x):</span><span className="font-mono font-bold text-white">R$ {taxaCartaoValor.toFixed(2)}</span></div>}
              <div className="flex justify-between text-slate-400">
                <span>Valor pago (incluindo taxa):</span>
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
                disabled={faltaPagar > 0 || items.length === 0 || !cashOpen}
                onClick={() => {
                  const numero = `VEN-${Date.now().toString().slice(-6)}`;
                  const forma = [valorPix > 0 ? "Pix" : "", valorDinheiro > 0 ? "Dinheiro" : "", valorCartao > 0 ? `Cartão ${parcelasCartao}x` : ""].filter(Boolean).join(" + ") || "A definir";
                  setCompletedSale({ numero, cliente, itens: items.map((item) => ({ ...item })), total: totalCobrar, forma });
                  setRecentSales((current) => [{ numero, cliente, total: totalCobrar, forma, dinheiro: valorDinheiro }, ...current]);
                  setCatalog((current) => current.map((product) => {
                    const quantitySold = items.filter((item) => item.catalogItemId === product.id).reduce((sum, item) => sum + item.quantidade, 0);
                    return quantitySold && product.estoque !== undefined ? { ...product, estoque: Math.max(0, product.estoque - quantitySold) } : product;
                  }));
                  setItems([]);
                  setShowPaymentModal(false);
                  setValorPix(0);
                  setValorDinheiro(0);
                  setValorCartao(0);
                  setTaxaCartao(0);
                  setParcelasCartao(1);
                  setImportedBudgetNumber(null);
                  setShowOrderReportModal(true);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-black rounded-lg transition"
              >
                {cashOpen ? "Confirmar Pagamento" : "Abra o caixa antes de finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Histórico restrito à sessão atual; a persistência exige o repositório de vendas da aplicação. */}
      {recentSales.length > 0 && <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-300">Vendas recentes nesta sessão</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{recentSales.slice(0, 5).map((sale) => <article key={sale.numero} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs"><div className="flex justify-between gap-2"><b className="text-blue-300">{sale.numero}</b><b className="text-emerald-300">R$ {sale.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></div><p className="mt-1 truncate text-slate-300">{sale.cliente}</p><small className="text-slate-500">{sale.forma}</small></article>)}</div>
      </section>}

      {showQuickItemModal && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowQuickItemModal(false); }}>
        <form onSubmit={handleQuickRegister} className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl">
          <header className="flex items-start justify-between"><div><h3 className="text-base font-black">Cadastro rápido de item</h3><p className="mt-1 text-xs text-slate-400">O item será adicionado ao catálogo desta sessão e à venda atual.</p></div><button type="button" onClick={() => setShowQuickItemModal(false)} aria-label="Fechar" className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button></header>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="grid gap-1.5 text-slate-300">Tipo<select value={newItemType} onChange={(event) => { const type = event.target.value as "PRODUTO" | "SERVIÇO"; setNewItemType(type); setNewItemUnit(type === "SERVIÇO" ? "SV" : "UN"); }} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option>PRODUTO</option><option>SERVIÇO</option></select></label>
            <label className="grid gap-1.5 text-slate-300">Código<input required value={newItemCode} onChange={(event) => setNewItemCode(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>
            <label className="col-span-2 grid gap-1.5 text-slate-300">Descrição<input required value={newItemDescription} onChange={(event) => setNewItemDescription(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>
            <label className="grid gap-1.5 text-slate-300">Unidade<select value={newItemUnit} onChange={(event) => setNewItemUnit(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white">{["UN","M","KG","L","SV","H"].map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label className="grid gap-1.5 text-slate-300">Preço unitário (R$)<input required type="number" min="0.01" step="0.01" value={newItemPrice} onChange={(event) => setNewItemPrice(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>
            {newItemType === "PRODUTO" && <label className="col-span-2 grid gap-1.5 text-slate-300">Estoque disponível (opcional)<input type="number" min="0" step="0.01" value={newItemStock} onChange={(event) => setNewItemStock(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" /></label>}
          </div>
          <footer className="flex justify-end gap-2"><button type="button" onClick={() => setShowQuickItemModal(false)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold">Cancelar</button><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-black">Cadastrar e incluir</button></footer>
        </form>
      </div>}
      {showCashModal && <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCashModal(false); }}>
        <section role="dialog" aria-modal="true" className="w-full max-w-md space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl">
          <header className="flex items-start justify-between"><div><h3 className="text-base font-black">{cashModalAction === "open" ? "Abertura do caixa" : "Fechamento do caixa"}</h3><p className="mt-1 text-xs text-slate-400">Resumo calculado durante esta sessão do PDV.</p></div><button type="button" onClick={() => setShowCashModal(false)} aria-label="Fechar" className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button></header>
          {cashModalAction === "open" ? <label className="grid gap-1.5 text-xs font-bold text-slate-300">Valor inicial em dinheiro (R$)<input type="number" min="0" step="0.01" value={openingCashInput} onChange={(event) => setOpeningCashInput(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-white" placeholder="0,00" /></label> : <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs"><div className="flex justify-between text-slate-300"><span>Saldo inicial:</span><b>R$ {openingCash.toFixed(2)}</b></div><div className="flex justify-between text-slate-300"><span>Vendas em dinheiro:</span><b>R$ {cashReceived.toFixed(2)}</b></div><div className="flex justify-between border-t border-slate-700 pt-2 text-white"><span>Dinheiro esperado:</span><b>R$ {expectedCash.toFixed(2)}</b></div><label className="mt-3 grid gap-1.5 font-bold text-slate-300">Dinheiro contado (R$)<input type="number" min="0" step="0.01" value={countedCashInput} onChange={(event) => setCountedCashInput(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-white" placeholder="Informar conferência" /></label>{lastCashDifference !== null && <p className="text-slate-400">Diferença no último fechamento: <b className={lastCashDifference === 0 ? "text-emerald-300" : "text-amber-300"}>R$ {lastCashDifference.toFixed(2)}</b></p>}</div>}
          <footer className="flex justify-end gap-2"><button type="button" onClick={() => setShowCashModal(false)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold">Voltar</button><button type="button" onClick={() => { if (cashModalAction === "open") { setOpeningCash(Number(openingCashInput) || 0); setRecentSales([]); setCashOpen(true); setCountedCashInput(""); } else { setLastCashDifference((Number(countedCashInput) || 0) - expectedCash); setCashOpen(false); setOpeningCash(0); setRecentSales([]); setCountedCashInput(""); } setShowCashModal(false); }} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-black">{cashModalAction === "open" ? "Abrir caixa" : "Conferir e fechar"}</button></footer>
          <p className="text-[10px] text-amber-300">O fechamento ainda é local nesta tela; não grava movimento financeiro no banco.</p>
        </section>
      </div>}
      {/* Modal de Pedido de Venda Balcão Padrão A4 */}
      {showOrderReportModal && (
        <StandardDocumentReport
          tipo="PEDIDO"
          numero={completedSale?.numero || `PED-${Date.now().toString().slice(-6)}`}
          cliente={{
            nome: completedSale?.cliente || cliente,
            endereco: "Venda Presencial Balcão - Mirassol/SP",
          }}
          descricaoServico="Venda e fornecimento de peças, fluídos refrigerantes e serviços técnicos de balcão."
          itens={(completedSale?.itens || items).map((it, idx) => ({
            itemNum: String(idx + 1).padStart(2, "0"),
            equipamentoOuItem: it.descricao,
            capacidadeOuDetalhes: `${it.tipo} · ${it.unidade}`,
            quantidade: it.quantidade,
            valorUnitario: it.valorUnitario,
            valorTotal: it.valorTotal,
          }))}
          valorGlobal={completedSale?.total || totalVenda}
          condicoesComerciais={{
            formaPagamento: completedSale?.forma || "À vista / PIX / Cartão",
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
