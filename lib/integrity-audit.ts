export type IntegritySeverity = "Crítico" | "Atenção";
export type IntegrityFinding = { check: string; severity: IntegritySeverity; recordId: string; title: string; detail: string };
export type IntegrityResult = {
  checkedAt: string;
  revision: number;
  updatedAt: string | null;
  source: "snapshot operacional";
  totals: { critical: number; attention: number; ok: number };
  findings: IntegrityFinding[];
  checks: { name: string; status: "Crítico" | "Atenção" | "OK"; count: number; summary: string }[];
};
type RecordData = Record<string, unknown>;
type StateData = Record<string, unknown> & { customers?: RecordData[]; serviceOrders?: RecordData[]; moduleRecords?: Record<string, RecordData[]> };
const rows = (value: unknown): RecordData[] => Array.isArray(value) ? value.filter((item): item is RecordData => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
const modulesOf = (state: StateData) => state.moduleRecords && typeof state.moduleRecords === "object" ? state.moduleRecords : {};
const text = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => text(value).replace(/\D/g, "");
const number = (value: unknown) => { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; };
const normalized = (value: unknown) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const isPayable = (record: RecordData) => record.transactionType === "Pagar" || /pagar|compra|fornecedor/i.test(`${text(record.name)} ${text(record.category)}`);
const origin = (record: RecordData) => {
  for (const key of ["purchaseId", "serviceOrderId", "saleId", "empenhoId", "sourceId"]) if (text(record[key])) return `${key}:${text(record[key])}`;
  const key = text(record.originKey);
  return key && !key.startsWith("manual:") ? key : "";
};
const push = (findings: IntegrityFinding[], check: string, severity: IntegritySeverity, record: RecordData, title: string, detail: string) => findings.push({ check, severity, recordId: text(record.id) || "(sem ID)", title, detail });
const resultOf = (name: string, findings: IntegrityFinding[]) => {
  const matches = findings.filter(item => item.check === name);
  const status = matches.some(item => item.severity === "Crítico") ? "Crítico" : matches.length ? "Atenção" : "OK";
  return { name, status, count: matches.length, summary: matches.length ? `${matches.length} ocorrência(s) precisam de conferência.` : "Nenhuma divergência encontrada nesta verificação." } as const;
};

/** Read-only consistency checks over the persisted canonical ERP state. */
export function auditOperationalIntegrity(state: StateData, checkedAt = new Date().toISOString()): IntegrityResult {
  const modules = modulesOf(state);
  const customers = rows(state.customers);
  const orders = rows(state.serviceOrders);
  const finance = rows(modules.Financeiro);
  const purchases = rows(modules.Compras);
  const products = rows(modules.Produtos);
  const stockBook = rows(modules["Livro de estoque"]);
  const financialBook = rows(modules["Razão financeiro"]);
  const equipment = rows(modules.Equipamentos);
  const structures = rows(modules["Unidades e setores"]);
  const budgets = rows(modules.Orçamentos);
  const findings: IntegrityFinding[] = [];

  const origins = new Map<string, RecordData[]>();
  for (const title of finance) {
    const key = origin(title);
    if (key) {
      const uniqueKey = `${isPayable(title) ? "P" : "R"}:${key}:${number(title.installmentNumber) || 1}`;
      origins.set(uniqueKey, [...(origins.get(uniqueKey) || []), title]);
    } else push(findings, "Títulos sem origem", "Atenção", title, text(title.name) || "Título financeiro sem origem", "Não há vínculo com compra, OS, venda, empenho ou documento de origem.");
  }
  for (const duplicates of origins.values()) if (duplicates.length > 1) for (const title of duplicates) push(findings, "Títulos financeiros duplicados", "Crítico", title, text(title.name) || "Título duplicado", `Mais de um título usa a mesma origem, direção e parcela (${origin(title)}).`);

  for (const purchase of purchases) {
    const installments = rows(purchase.paymentInstallments);
    const deferred = normalized(purchase.paymentType) === "a prazo" || number(purchase.installments) > 1 || installments.length > 0;
    if (deferred && !finance.some(title => text(title.purchaseId) === text(purchase.id))) push(findings, "Compras a prazo sem título", "Crítico", purchase, text(purchase.name) || "Compra sem título", "Compra marcada a prazo sem conta a pagar vinculada por purchaseId.");
  }

  const ledgerByProduct = new Map<string, number>();
  for (const movement of stockBook) {
    const productId = text(movement.productId);
    if (productId) ledgerByProduct.set(productId, (ledgerByProduct.get(productId) || 0) + number(movement.quantity));
  }
  for (const product of products) {
    const productId = text(product.id);
    const balance = number(product.stockCurrent);
    if (balance < -0.000001) push(findings, "Produtos com saldo negativo", "Crítico", product, text(product.name) || "Produto com saldo negativo", `Saldo informado: ${balance}.`);
    if (!stockBook.some(movement => text(movement.productId) === productId)) {
      if (Math.abs(balance) > 0.000001) push(findings, "Produtos sem livro de movimentos", "Atenção", product, text(product.name) || "Produto sem livro", `Saldo atual ${balance}; nenhum movimento deste produto foi encontrado no livro.`);
      continue;
    }
    const bookBalance = ledgerByProduct.get(productId) || 0;
    if (Math.abs(balance - bookBalance) > 0.001) push(findings, "Estoque divergente do livro", "Crítico", product, text(product.name) || "Saldo divergente", `Cadastro: ${balance}; livro de movimentos: ${bookBalance}.`);
  }

  for (const order of orders) {
    if (!/conclu[ií]da/i.test(text(order.status))) continue;
    const productLines = rows(order.catalogItems).filter(item => item.kind === "Produto");
    for (const item of productLines) {
      const productId = text(item.id || item.productId);
      const expectedId = `OS-STOCK-${text(order.id)}-${productId}`;
      const currentBookEntry = stockBook.some(movement => text(movement.id) === expectedId);
      const legacyMovement = rows(modules.Estoque).some(movement => text(movement.serviceOrderId) === text(order.id) && /sa[ií]da/i.test(`${text(movement.category)} ${text(movement.movementType)}`) && (!productId || text(movement.productId) === productId));
      if (!currentBookEntry && !legacyMovement) push(findings, "OS concluídas sem saída de estoque", "Atenção", order, `OS ${text(order.id)} sem movimento`, `O item ${text(item.name) || productId || "(sem produto)"} não possui uma saída de estoque localizada.`);
    }
  }

  const customerIds = new Set(customers.map(item => text(item.id)).filter(Boolean));
  const customerNames = new Set(customers.map(item => normalized(item.name)).filter(Boolean));
  const structureIds = new Set(structures.map(item => text(item.id)).filter(Boolean));
  const structureById = new Map(structures.map(item => [text(item.id), item]));
  for (const item of equipment) {
    const ownerId = text(item.customerId || item.clientId);
    const ownerName = normalized(item.client || item.customer || item.customerName);
    if ((ownerId && !customerIds.has(ownerId)) || (!ownerId && ownerName && !customerNames.has(ownerName))) push(findings, "Equipamentos sem cliente válido", "Crítico", item, text(item.name) || text(item.model) || `Equipamento ${text(item.id)}`, "O cliente vinculado não consta no cadastro carregado.");
    for (const field of ["structureId", "unitId", "sectorId", "roomId"]) {
      const linkedId = text(item[field]);
      if (linkedId && !structureIds.has(linkedId)) push(findings, "Equipamentos com estrutura inválida", "Atenção", item, text(item.name) || text(item.model) || `Equipamento ${text(item.id)}`, `O vínculo ${field}=${linkedId} não existe no cadastro de estruturas.`);
      const location = linkedId ? structureById.get(linkedId) : undefined;
      const locationOwnerId = text(location?.customerId || location?.clientId);
      const locationOwnerName = normalized(location?.client || location?.customer || location?.customerName);
      if (location && ((ownerId && locationOwnerId && ownerId !== locationOwnerId) || (ownerName && locationOwnerName && ownerName !== locationOwnerName))) push(findings, "Equipamentos em estrutura de outro cliente", "Crítico", item, text(item.name) || text(item.model) || `Equipamento ${text(item.id)}`, `O equipamento aponta para uma estrutura cujo cliente difere do cliente do equipamento (${field}=${linkedId}).`);
    }
  }
  for (const structure of structures) {
    const parentId = text(structure.parentId || structure.customerId);
    if (parentId && !customerIds.has(parentId) && !structureIds.has(parentId)) push(findings, "Estruturas órfãs", "Atenção", structure, text(structure.name) || `Estrutura ${text(structure.id)}`, `O vínculo superior ${parentId} não foi encontrado.`);
  }

  for (const [label, records] of [["Cliente", customers], ["Fornecedor", rows(modules.Fornecedores)]] as const) {
    const documentOwners = new Map<string, RecordData[]>();
    for (const record of records) {
      const doc = digits(record.doc || record.cnpj || record.cpf);
      if (doc) documentOwners.set(doc, [...(documentOwners.get(doc) || []), record]);
    }
    for (const duplicates of documentOwners.values()) if (duplicates.length > 1) for (const record of duplicates) push(findings, "CPF/CNPJ duplicados", "Crítico", record, text(record.name) || "Cadastro duplicado", `${label}: documento repetido entre ${duplicates.map(item => text(item.name) || text(item.id)).join("; ")}.`);
  }

  for (const budget of budgets) {
    const status = normalized(budget.status);
    const converted = Boolean(text(budget.serviceOrderId || budget.convertedOrderId || budget.convertedAt)) || /convertid|os gerada|ordem de servico criada/.test(status);
    if (converted && !orders.some(order => text(order.id) === text(budget.serviceOrderId || budget.convertedOrderId) || text(order.sourceBudgetId) === text(budget.id))) push(findings, "Orçamentos convertidos sem OS", "Atenção", budget, text(budget.name) || `Orçamento ${text(budget.id)}`, "O orçamento está marcado como convertido, mas não foi localizada uma OS vinculada.");
  }

  for (const title of finance) {
    const history = rows(title.settlementHistory);
    const reversals = rows(title.reversalHistory);
    if (!history.length && !reversals.length) {
      if (number(title.settledValue) > 0 || /^(Paga|Recebida)$/i.test(text(title.status))) push(findings, "Saldo legado sem baixas detalhadas", "Atenção", title, text(title.name) || `Título ${text(title.id)}`, "Há saldo liquidado sem histórico detalhado de baixas para reconciliar automaticamente.");
      continue;
    }
    const reversed = new Set(reversals.map(item => text(item.settlementId)));
    const opening = number(title._settlementOpening);
    const reversedLegacyOpening = reversed.has(`LEGACY-${text(title.id)}`) ? opening : 0;
    const computed = Math.max(0, opening - reversedLegacyOpening + history.filter(item => !reversed.has(text(item.id))).reduce((sum, item) => sum + number(item.principal ?? item.value), 0));
    if (Math.abs(number(title.settledValue) - computed) > 0.011) push(findings, "Saldo financeiro divergente das baixas", "Crítico", title, text(title.name) || `Título ${text(title.id)}`, `Saldo marcado: ${number(title.settledValue)}; saldo reconstituído das baixas e estornos: ${computed}.`);
    for (const entry of history) if (!financialBook.some(movement => text(movement.settlementId) === text(entry.id) && text(movement.kind) === "Baixa")) push(findings, "Baixas sem movimento no razão", "Crítico", title, text(title.name) || `Título ${text(title.id)}`, `A baixa ${text(entry.id)} não tem movimento correspondente no razão financeiro.`);
    for (const reversal of reversals) if (!financialBook.some(movement => text(movement.id) === `REV-${text(title.id)}-${text(reversal.id)}`)) push(findings, "Estornos sem compensação no razão", "Crítico", title, text(title.name) || `Título ${text(title.id)}`, `O estorno ${text(reversal.id)} não tem movimento compensatório no razão financeiro.`);
  }

  const names = ["Títulos financeiros duplicados", "Compras a prazo sem título", "Títulos sem origem", "Estoque divergente do livro", "Produtos sem livro de movimentos", "Produtos com saldo negativo", "OS concluídas sem saída de estoque", "Equipamentos sem cliente válido", "Equipamentos com estrutura inválida", "Equipamentos em estrutura de outro cliente", "Estruturas órfãs", "CPF/CNPJ duplicados", "Orçamentos convertidos sem OS", "Saldo legado sem baixas detalhadas", "Saldo financeiro divergente das baixas", "Baixas sem movimento no razão", "Estornos sem compensação no razão"];
  const checks = names.map(name => resultOf(name, findings));
  const critical = findings.filter(item => item.severity === "Crítico").length;
  const attention = findings.filter(item => item.severity === "Atenção").length;
  return { checkedAt, revision: number(state._revision), updatedAt: text(state._updatedAt) || null, source: "snapshot operacional", totals: { critical, attention, ok: checks.filter(item => item.status === "OK").length }, findings, checks };
}
