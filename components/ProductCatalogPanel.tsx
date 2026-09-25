"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Box, Search } from "lucide-react";

type Product = { id: string | number; sku?: string; name?: string; nome?: string; description?: string; descricao?: string; stock?: number; estoque?: number };

export function ProductCatalogPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("pt-BR"));

  useEffect(() => {
    fetch("/api/catalog/products", { cache: "no-store" }).then(async response => {
      const payload = await response.json();
      if (response.ok && payload.success) setProducts(payload.products);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => products.filter(product => {
    const searchable = `${product.sku || ""} ${product.name || product.nome || ""} ${product.description || product.descricao || ""}`.toLocaleLowerCase("pt-BR");
    return !deferredQuery || searchable.includes(deferredQuery);
  }), [deferredQuery, products]);

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="border-b bg-slate-50 p-6"><h2 className="flex items-center gap-2 text-xl font-bold"><Box className="size-6 text-blue-600"/>Cadastro de Produtos</h2><p className="mt-1 text-xs text-slate-500">Busca instantânea por código SKU, nome ou descrição, sem recarregar a página.</p></header>
    <div className="p-6"><label className="relative block"><span className="sr-only">Pesquisar produtos</span><Search className="absolute left-3 top-3.5 size-4 text-slate-400"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Digite SKU, fluido, compressor, peça ou equipamento..." className="min-h-11 w-full rounded-xl border border-slate-300 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>
      <div className="mt-5 overflow-x-auto rounded-xl border"><table className="w-full min-w-[640px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">SKU</th><th className="p-3">Produto</th><th className="p-3">Descrição</th><th className="p-3 text-right">Estoque</th></tr></thead><tbody className="divide-y">{filtered.map(product=><tr key={product.id}><td className="p-3 font-mono font-bold">{product.sku || "Não informado"}</td><td className="p-3 font-bold">{product.name || product.nome || "Não informado"}</td><td className="p-3 text-slate-600">{product.description || product.descricao || "Não informado"}</td><td className="p-3 text-right font-mono">{product.stock ?? product.estoque ?? "Não informado"}</td></tr>)}</tbody></table></div>
      {!loading && !filtered.length ? <p className="py-10 text-center text-sm text-slate-500">{query ? "Nenhum produto localizado para esta busca." : "Nenhum produto disponível na fonte atual."}</p> : null}
      {loading ? <p className="py-10 text-center text-sm text-slate-500">Carregando produtos...</p> : null}
    </div>
  </section>;
}
