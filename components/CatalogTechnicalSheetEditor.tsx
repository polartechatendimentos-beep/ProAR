"use client";

import { Plus, Trash2 } from "lucide-react";
import type { TechnicalSheetLine } from "@/lib/catalog-quantity-pricing";

type CatalogOption = { id: string; name: string; kind?: string; unitOfMeasure?: string };
export function CatalogTechnicalSheetEditor({ value, options, onChange }: {
  value: TechnicalSheetLine[];
  options: CatalogOption[];
  onChange: (value: TechnicalSheetLine[]) => void;
}) {
  const products = options.filter(item => item.kind === "Produto");
  const add = () => onChange([...value, { productId: products[0]?.id ?? "", quantityPerUnit: 1 }]);
  return <section className="wide" aria-label="Ficha técnica de consumo">
    <div className="catalog-composition-head"><span><b>Ficha técnica de consumo</b><small>Materiais por unidade deste serviço ou produto. O técnico confirma o consumo real ao concluir a OS.</small></span><button type="button" className="outline-btn" disabled={!products.length} onClick={add}><Plus size={14}/>Adicionar material</button></div>
    {value.map((line, index) => <div className="catalog-composition-line" key={`${index}-${line.productId}`}>
      <label>Material<select value={line.productId} onChange={event => onChange(value.map((row, i) => i === index ? { ...row, productId: event.target.value } : row))}>
        <option value="">Selecionar produto</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} • {product.unitOfMeasure || "un"}</option>)}
      </select></label>
      <label>Quantidade por unidade<input type="number" min="0.001" step="0.001" value={line.quantityPerUnit} onChange={event => onChange(value.map((row, i) => i === index ? { ...row, quantityPerUnit: Number(event.target.value) || 0 } : row))}/></label>
      <button type="button" aria-label="Remover material da ficha técnica" className="outline-btn danger" onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={14}/></button>
    </div>)}
    {!value.length && <p className="field-hint">Sem materiais previstos. Cadastre itens como cobre, isolamento, cabos e conexões para sugerir consumo automático.</p>}
  </section>;
}
