export type BudgetTarget = "Pedido" | "Ordem de serviço";
export type CommercialLineKind = "Produto" | "Serviço" | "Custo adicional";
export type CommercialLine = {
  id: string; productId?: string; description: string; kind: CommercialLineKind;
  quantity: number; unitOfMeasure: string; unitValue: number; discountPercent: number; priceRule?: string;
};
export type CommercialSnapshot = {
  sourceBudgetId: string; lines: CommercialLine[];
  subtotal: number; discount: number; surcharge: number; total: number;
  productsTotal: number; servicesTotal: number; additionalCostsTotal: number;
};
type Row = Record<string, unknown>;
type Catalog = { Produtos?: Row[]; Serviços?: Row[] };
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const norm = (value: unknown) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const maxAmount = 999_999_999.99;
const toCents = (value: number) => Math.round((value + 1e-10) * 100);
const rounded = (value: number) => toCents(value) / 100;
const unitAliases: Record<string, string> = {
  unidade: "un", unidades: "un", und: "un", unid: "un", un: "un",
  pc: "pc", pca: "pc", peca: "pc", pecas: "pc",
  m: "m", metro: "m", metros: "m", kg: "kg", quilo: "kg", quilos: "kg",
  sv: "sv", serv: "sv", servico: "sv", servicos: "sv",
};
const unitKind = (value: string) => unitAliases[norm(value)] ?? norm(value);

export class CommercialConversionError extends Error {
  readonly status: number;
  constructor(message: string, status = 422) { super(message); this.name = "CommercialConversionError"; this.status = status; }
}
const fail = (message: string, status?: number): never => { throw new CommercialConversionError(message, status); };
function numeric(value: unknown, field: string, max = maxAmount): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) return fail(`${field}: informe um valor válido.`);
  return value;
}
function money(value: unknown, field: string, defaultValue?: number) {
  const amount = numeric(value ?? defaultValue, field);
  if (Math.abs(amount - rounded(amount)) > 1e-7) fail(`${field}: use até duas casas decimais.`);
  return rounded(amount);
}
function lineKind(value: unknown): CommercialLineKind {
  if (value === "Produto" || value === "Serviço" || value === "Custo adicional") return value;
  return fail("Classifique a linha como produto, serviço ou custo adicional antes de converter.");
}

/** Validates the approved monetary snapshot; does not reprice using the current catalogue. */
export function makeCommercialSnapshot(source: Row, catalog: Catalog = {}): CommercialSnapshot {
  const sourceBudgetId = text(source.id);
  if (!sourceBudgetId || !Array.isArray(source.purchaseItems) || source.purchaseItems.length === 0 || source.purchaseItems.length > 500) {
    return fail("Inclua ao menos um item e salve o orçamento antes da conversão.");
  }
  const seen = new Set<string>();
  const definitions = new Map<string, { row: Row; kind: CommercialLineKind }>();
  const ambiguous = new Set<string>();
  for (const [matches, kind] of [[catalog.Produtos ?? [], "Produto"], [catalog.Serviços ?? [], "Serviço"]] as const) {
    for (const row of matches) {
      const id = text(row.id);
      if (!id) continue;
      if (definitions.has(id)) ambiguous.add(id);
      else definitions.set(id,{row,kind});
    }
  }
  const sums = { Produto: 0, Serviço: 0, "Custo adicional": 0 };
  const lines = source.purchaseItems.map((raw: unknown, index) => {
    if (!record(raw)) return fail(`Linha ${index + 1} inválida.`);
    const label = `Linha ${index + 1}`;
    const id = text(raw.id), description = text(raw.description), productId = text(raw.productId) || undefined;
    const catalogKey = productId || id;
    const catalogEntry = definitions.get(catalogKey);
    const catalogRow = catalogEntry?.row;
    const catalogKind = catalogRow?.kind ?? catalogEntry?.kind;
    const kind = lineKind(raw.kind ?? catalogKind);
    if (kind !== "Custo adicional" && ambiguous.has(catalogKey)) return fail(`${label}: identificação do catálogo ambígua. Confira o vínculo.`);
    if (!id || seen.has(id) || !description) return fail(`${label}: identificador repetido/vazio ou descrição ausente.`);
    seen.add(id);
    if (kind !== "Custo adicional" && catalogRow && catalogKind !== kind) return fail(`${label}: classificação difere do catálogo.`);
    if ((kind === "Produto" || productId && kind === "Serviço") && !catalogRow) return fail(`${label}: vínculo com o catálogo não localizado.`);
    const unit = text(raw.unitOfMeasure) || text(catalogRow?.unitOfMeasure || catalogRow?.unit);
    if (!unit) return fail(`${label}: informe a unidade no orçamento.`);
    const catalogUnit = text(catalogRow?.unitOfMeasure || catalogRow?.unit);
    if (kind === "Produto" && catalogUnit && unitKind(unit) !== unitKind(catalogUnit)) return fail(`${label}: unidade “${unit}” difere do estoque “${catalogUnit}”. Confira a conversão de medida antes de baixar estoque.`);
    const quantity = numeric(raw.quantity, `${label} • quantidade`, 999_999.999);
    if (quantity <= 0 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 1e-7) return fail(`${label}: quantidade deve ser positiva e ter até três decimais.`);
    if (["un", "pc"].includes(unitKind(unit)) && !Number.isInteger(quantity)) return fail(`${label}: unidade não aceita fração. Use desconto para ajustar o valor.`);
    const unitValue = money(raw.unitValue, `${label} • preço unitário`);
    const discountPercent = numeric(raw.discountPercent ?? 0, `${label} • desconto percentual`, 100);
    sums[kind] += quantity * unitValue * (1 - discountPercent / 100);
    return { id, productId, description, quantity, unitOfMeasure: unit, unitValue, kind, discountPercent, priceRule: text(raw.priceRule) || undefined };
  });
  const subtotalRaw = sums.Produto + sums.Serviço + sums["Custo adicional"];
  numeric(subtotalRaw, "Subtotal");
  const discount = money(source.discount ?? source.discountValue, "Desconto geral", 0);
  const surcharge = money(source.surcharge, "Acréscimo", 0);
  if (toCents(discount) > toCents(subtotalRaw)) fail("O desconto geral excede o subtotal.");
  const totalRaw = numeric(Math.max(0, subtotalRaw - discount + surcharge), "Total");
  if (source.subtotal != null && toCents(numeric(source.subtotal, "Subtotal registrado")) !== toCents(subtotalRaw)) fail("O subtotal registrado não confere com as linhas. Revise o orçamento.");
  if (toCents(numeric(source.value, "Total registrado")) !== toCents(totalRaw)) fail("O total registrado não confere com itens, descontos e acréscimos. Revise o orçamento.");
  return {
    sourceBudgetId, lines, subtotal: rounded(subtotalRaw), discount, surcharge, total: rounded(totalRaw),
    productsTotal: rounded(sums.Produto), servicesTotal: rounded(sums.Serviço), additionalCostsTotal: rounded(sums["Custo adicional"]),
  };
}

type ConversionState = { customers?: Row[]; serviceOrders?: Row[]; moduleRecords?: Record<string, Row[]> };

function resolveParty(state: ConversionState, budget: Row) {
  const customerId = text(budget.customerId), client = text(budget.client);
  const matches = (state.customers || []).filter(row => customerId ? row.id === customerId : norm(row.name) === norm(client));
  if (!client || matches.length !== 1 || norm(matches[0].name) !== norm(client)) return fail("Confira a identidade do cliente vinculado ao orçamento.");
  const customer = matches[0];
  const structures = state.moduleRecords?.["Unidades e setores"] || [];
  const keys = ["structureId", "unitId", "sectorId", "roomId"] as const;
  const references = [...new Set(keys.map(key => text(budget[key])).filter(Boolean))].map(id => {
    const structure = structures.find(row => row.id === id);
    if (!structure || (text(structure.customerId) ? structure.customerId !== customer.id : norm(structure.client) !== norm(client))) return fail("O local indicado deve pertencer ao cliente do orçamento.");
    return structure;
  });
  const deepest = references.find(row => row.id === budget.roomId) || references.find(row => row.id === budget.sectorId) || references.find(row => row.id === budget.structureId) || references.find(row => row.id === budget.unitId);
  return {
    client, customerId: customer.id,
    unit: text(budget.unit) || text(deepest?.name) || "Matriz",
    ...Object.fromEntries(keys.map(key => [key, text(budget[key]) || undefined])),
    sector: text(budget.sector) || undefined,
    room: text(budget.room) || undefined,
    address: text(deepest?.address) || text(budget.address) || text(customer.address),
  };
}

export function buildBudgetDestination(state: ConversionState, budget: Row, target: unknown, now: string, destinationId: string) {
  if (target !== "Pedido" && target !== "Ordem de serviço") return fail("Escolha Pedido ou Ordem de serviço.");
  const modules = state.moduleRecords || {};
  const sourceId = text(budget.id);
  const orders = state.serviceOrders || [];
  const sales = modules.Vendas || [];
  const toSource = (row: Row) => text(row.sourceBudgetId) === sourceId || text(row.budgetId) === sourceId;
  const previous = [...orders, ...sales].find(toSource);
  if (previous || /convertid/.test(norm(budget.status)) || budget.budgetConversion || budget.convertedOrderId || budget.convertedSaleId || budget.serviceOrderId) {
    return fail(previous ? `Orçamento já convertido em ${String(previous.id)}. Abra o registro existente.` : "Orçamento já convertido. Confira o histórico antes de gerar outro registro.", 409);
  }
  if (/cancelad|inativ|rejeitad/.test(norm(budget.status))) return fail("Orçamento cancelado, inativo ou rejeitado não pode ser convertido.", 409);
  if (budget.approvalRequired && budget.approvalStatus !== "Aprovado") return fail("Este orçamento depende de aprovação por alçada antes da conversão.", 409);
  const party = resolveParty(state, budget);
  const snapshot = makeCommercialSnapshot(budget, modules);
  if (snapshot.subtotal > 0 && snapshot.discount / snapshot.subtotal > 0.1 + 1e-10 && budget.approvalStatus !== "Aprovado") return fail("O desconto geral exige aprovação por alçada.", 409);
  const fiscalReviewRequired = snapshot.lines.some(line => line.kind === "Custo adicional") || new Set(snapshot.lines.map(line => line.kind)).size > 1 || (target === "Ordem de serviço" && snapshot.lines.some(line => line.kind !== "Serviço"));
  const common = {
    id: destinationId, ...party, sourceBudgetId: sourceId, commercialSnapshot: snapshot,
    financeReviewRequired: fiscalReviewRequired, discount: snapshot.discount, surcharge: snapshot.surcharge,
    subtotal: snapshot.subtotal, date: now.slice(0, 10), createdAt: now,
    changeReason: `Conversão do orçamento ${sourceId} em ${target}`,
  };
  const destination = target === "Pedido"
    ? {
      ...common, name: `Pedido • ${text(budget.name) || party.client}`, status: "Pedido confirmado",
      value: snapshot.total, description: text(budget.description), category: "Pedido de orçamento",
      paymentMethod: text(budget.paymentMethod) || undefined,
      reference: text(budget.reference) || undefined, seller: text(budget.seller) || undefined,
      purchaseItems: structuredClone(snapshot.lines),
    }
    : {
      ...common, service: snapshot.lines.map(line => line.description).join(", "), tech: "Não definido", time: "A definir",
      status: "Aberta", tone: "blue", avatar: party.client.split(/\s+/).slice(0, 2).map(part => part[0]).join(""),
      total: snapshot.total, servicesTotal: snapshot.servicesTotal, productsTotal: snapshot.productsTotal,
      catalogItems: snapshot.lines.filter(line => line.kind !== "Custo adicional").map(line => ({
        ...line, id: line.productId || line.id, commercialLineId: line.id, name: line.description,
      })),
    };
  return { target: target as BudgetTarget, destination, snapshot };
}

/** Safe candidate for the existing NFS-e shortcut. Mixed commercial documents require fiscal review. */
export function convertedServiceFiscalValue(snapshot?: CommercialSnapshot): number | undefined {
  if (!snapshot) return undefined;
  if (snapshot.lines.length === 0 || snapshot.lines.some(line => line.kind !== "Serviço")) {
    return fail("Esta conversão inclui produtos ou custos sem classificação fiscal. Revise a separação no Fiscal antes de emitir NFS-e.");
  }
  return money(snapshot.total, "Total dos serviços");
}


/** A converted order can only use its approved services amount and own company customer. */
export function convertedNfseOriginError(
  order: { commercialSnapshot?: CommercialSnapshot; financeReviewRequired?: boolean; customerId?: string },
  customer: { id?: string; doc?: string } | undefined,
  requestedDocument: unknown,
  requestedValue: unknown,
): string | undefined {
  if (order.financeReviewRequired) return "Esta conversão exige revisão de produtos, serviços e custos no Fiscal.";
  if (!order.commercialSnapshot) return undefined;
  if (!customer?.id || customer.id !== order.customerId) return "O cliente desta conversão não está vinculado no cadastro da empresa.";
  const digits = (value: unknown) => text(value).replace(/\D/g, "");
  if (!digits(customer.doc) || digits(customer.doc) !== digits(requestedDocument)) return "O CPF/CNPJ da NFS-e difere do cliente da OS convertida.";
  try {
    const expected = convertedServiceFiscalValue(order.commercialSnapshot);
    const actual = money(Number(requestedValue), "Valor solicitado para a NFS-e");
    if (expected !== actual) return "O valor da NFS-e não confere com o total líquido dos serviços no orçamento convertido.";
  } catch (error) {
    return error instanceof CommercialConversionError ? error.message : "Não foi possível conferir a origem do valor fiscal.";
  }
  return undefined;
}
