export type QuantityPriceRule = { minimumQuantity: number; unitPrice: number };

/** Resolves the price applicable to the current line and always returns a frozen transaction value. */
export function quantityPrice(basePrice: number, quantity: number, rules: QuantityPriceRule[] = []) {
  if (!Number.isFinite(basePrice) || basePrice < 0 || !Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Preço ou quantidade inválidos.");
  }
  const valid = rules
    .filter(rule => Number.isFinite(rule.minimumQuantity) && rule.minimumQuantity > 0 && Number.isFinite(rule.unitPrice) && rule.unitPrice >= 0)
    .sort((a, b) => a.minimumQuantity - b.minimumQuantity);
  const applicable = valid.filter(rule => quantity >= rule.minimumQuantity).at(-1);
  return { unitPrice: applicable?.unitPrice ?? basePrice, minimumQuantity: applicable?.minimumQuantity ?? null };
}

export type TechnicalSheetLine = { productId: string; quantityPerUnit: number };
export type ConsumptionLine = { productId: string; quantity: number };

/** Expands service/product composition for OS and sales, combining repeated component rows. */
export function expandTechnicalSheet(
  items: Array<{ id: string; quantity?: number; kind?: string; actualMaterials?: ConsumptionLine[]; materialsConfirmed?: boolean }>,
  catalog: Array<{ id: string; kind?: string; technicalSheet?: TechnicalSheetLine[] }>,
): ConsumptionLine[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantidade de item inválida.");
    const product = catalog.find(row => row.id === item.id);
    const lines = item.materialsConfirmed
      ? item.actualMaterials ?? []
      : product?.technicalSheet?.length
        ? product.technicalSheet.map(line => ({ productId: line.productId, quantity: line.quantityPerUnit * quantity }))
        : item.kind === "Produto" || product?.kind === "Produto"
          ? [{ productId: item.id, quantity }]
          : [];
    for (const line of lines) {
      const amount = Number(line.quantity);
      if (!line.productId || !Number.isFinite(amount) || amount < 0) throw new Error("Ficha técnica contém produto ou quantidade inválida.");
      if (amount > 0) totals.set(line.productId, (totals.get(line.productId) ?? 0) + amount);
    }
  }
  return [...totals].map(([productId, quantity]) => ({ productId, quantity: Math.round(quantity * 1000) / 1000 }));
}
