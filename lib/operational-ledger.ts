/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-assign-module-variable */
// Dynamic records retain the fields of the historical ERP snapshots.
export type ErpRecord = Record<string, any>;
export type ErpState = ErpRecord & { customers?: ErpRecord[]; serviceOrders?: ErpRecord[]; moduleRecords?: Record<string, ErpRecord[]> };
export type Actor = { username: string; displayName?: string; can: (permission: string) => boolean };
export class OperationError extends Error {
  status: number;
  constructor(message: string, status = 422) { super(message); this.status = status; }
}
const list = (value: any): ErpRecord[] => Array.isArray(value) ? value : [];
const normalize = (value: any) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const digits = (value: any) => String(value ?? "").replace(/\D/g, "");
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
const same = (a: any, b: any) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const id = (value: any) => String(value ?? "");
const stockLocationKey = (type: unknown, locationId: unknown, name: unknown) => `${String(type || "Estoque central")}::${String(locationId || name || "principal")}`;
function stockBalanceAtLocation(movements: ErpRecord[], productId: string, type: string, locationId = "", name = "") {
  const target=stockLocationKey(type,locationId,name);
  let total=0;
  for(const movement of movements.filter(item=>String(item.productId)===String(productId))){
    if(movement.kind==="Transferência" || movement.movementType==="Transferência"){
      const quantity=Number(movement.transferQuantity ?? movement.quantity ?? 0);
      if(stockLocationKey(movement.sourceType,movement.sourceId,movement.sourceName)===target) total-=quantity;
      if(stockLocationKey(movement.destinationType,movement.destinationId,movement.destinationName)===target) total+=quantity;
    } else if(stockLocationKey(movement.destinationType,movement.destinationId,movement.destinationName)===target) {
      total+=Number(movement.quantity || 0);
    }
  }
  return Math.round(total*1000)/1000;
}
export const cents = (value: any) => {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) throw new OperationError("Valor numérico inválido.");
  return Math.round(number * 100);
};
const cash = (value: number) => value / 100;
const payable = (record: ErpRecord) => record.transactionType === "Pagar" || /pagar|compra|fornecedor/i.test(`${record.name} ${record.category}`);
const canceled = (record: ErpRecord) => /cancelad/i.test(record.status || "");
const permissionFor: Record<string, string> = {
  Financeiro: "financeiro.editar", "Contas financeiras": "financeiro.editar",
  Produtos: "estoque.editar", Estoque: "estoque.editar", Compras: "compras.editar",
  Equipamentos: "equipamentos.editar", "Unidades e setores": "clientes.editar",
  Funcionários: "configuracoes.editar", Certames: "licitacoes.editar", Empenhos: "licitacoes.editar", "Radar Licitações": "licitacoes.editar", "Cofre Licitações": "licitacoes.editar",
  Obras: "obras.editar", Orçamentos: "comercial.editar", Vendas: "comercial.editar", Serviços: "catalogo.editar", Fornecedores: "compras.editar", "Conciliações": "financeiro.conciliar", Lembretes: "os.editar", Aprovações: "aprovacoes.aprovar",
};
export const defaultFinancialAccounts = () => [
  { id: "BANK", name: "Conta bancária", type: "Banco", openingBalance: 0, status: "Ativo" },
  { id: "CASH", name: "Caixa", type: "Caixa", openingBalance: 0, status: "Ativo" },
  { id: "DIGITAL", name: "Conta digital", type: "Pix", openingBalance: 0, status: "Ativo" },
  { id: "CARD", name: "Cartão", type: "Cartão", openingBalance: 0, status: "Ativo" },
];
export function financialAccountBalance(accountId: string, ledger: ErpRecord[]) {
  return cash(ledger.filter(item => item.accountId === accountId).reduce((sum, item) => sum + cents(item.signedValue), 0));
}
function requireAction(actor: Actor, permission: string) {
  if (!actor.can(permission)) throw new OperationError(`Ação não autorizada: ${permission}.`, 403);
}
function assertAppendOnly(previous: ErpRecord[], next: ErpRecord[], label: string) {
  for (const old of previous) {
    const found = next.find(item => item.id === old.id);
    if (!found || !same(old, found)) throw new OperationError(`${label} é imutável. Registre um estorno ou movimento compensatório.`);
  }
  const keys = next.map(item => id(item.id));
  if (keys.some(key => !key) || new Set(keys).size !== keys.length) throw new OperationError(`${label}: identificador vazio ou duplicado.`);
}
function assertUnique(records: ErpRecord[], oldRecords: ErpRecord[], field: string, transform = normalize) {
  for (const record of records) {
    const old = oldRecords.find(item => item.id === record.id);
    const key = transform(record[field]);
    // Existing legacy collisions stay available, but cannot spread to new records.
    if (!key || (old && transform(old[field]) === key)) continue;
    if (records.some(item => item.id !== record.id && transform(item[field]) === key)) throw new OperationError(`${field} já cadastrado: ${record[field]}.`);
  }
}
function validateRecords(previous: ErpRecord[], next: ErpRecord[], module: string, actor: Actor) {
  const ids = next.map(item => id(item.id));
  if (ids.some(key => !key) || new Set(ids).size !== ids.length) throw new OperationError(`Identificador duplicado ou vazio em ${module}.`);
  for (const old of previous) {
    if (!next.some(item => item.id === old.id) && module !== "Lembretes") throw new OperationError(`Não exclua ${module}: ${old.id}. Inative ou cancele com motivo para preservar o histórico.`);
  }
  for (const record of next) {
    const old = previous.find(item => item.id === record.id);
    if (same(old, record)) continue;
    if (module === "Financeiro") {
      const addedSettlements = list(record.settlementHistory).filter(item => !list(old?.settlementHistory).some(before => before.id === item.id));
      const addedReversals = list(record.reversalHistory).filter(item => !list(old?.reversalHistory).some(before => before.id === item.id));
      if (addedSettlements.length) requireAction(actor, "financeiro.baixar");
      if (addedReversals.length) requireAction(actor, "financeiro.estornar");
      const omitSettlement = (item: ErpRecord = {}) => Object.fromEntries(Object.entries(item).filter(([key]) => !["settlementHistory", "reversalHistory", "settledValue", "settlementDate", "settlementMethod", "settlementAccount", "interestValue", "discountValue", "status", "changeReason"].includes(key)));
      if (!old || !same(omitSettlement(old), omitSettlement(record)) || (!addedSettlements.length && !addedReversals.length)) requireAction(actor, "financeiro.editar");
    } else requireAction(actor, permissionFor[module] || "configuracoes.editar");
    if (old && !/cancelad|inativ/i.test(old.status || "") && /cancelad|inativ/i.test(record.status || "") && !String(record.changeReason || record.cancellationReason || "").trim()) throw new OperationError("Informe o motivo do cancelamento ou inativação.");
  }
}
function sourceKey(record: ErpRecord) {
  const origin = record.purchaseId ? `purchase:${record.purchaseId}` : record.serviceOrderId ? `os:${record.serviceOrderId}` : record.saleId ? `sale:${record.saleId}` : record.empenhoId ? `empenho:${record.empenhoId}` : record.sourceId ? `${record.sourceType || "source"}:${record.sourceId}` : "";
  return origin ? `${payable(record) ? "P" : "R"}:${origin}:${Number(record.installmentNumber || 1)}` : "";
}
function auditChanges(before: ErpRecord[], after: ErpRecord[], module: string, actor: Actor, now: string, audit: ErpRecord[]) {
  for (const record of after) {
    const old = before.find(item => item.id === record.id);
    if (same(old, record)) continue;
    const fields: ErpRecord = {};
    for (const key of new Set([...Object.keys(old || {}), ...Object.keys(record)])) {
      if (/password|token|secret|photo|image|signature/i.test(key)) continue;
      if (!same(old?.[key], record[key])) fields[key] = { before: old?.[key] ?? null, after: record[key] ?? null };
    }
    if (!Object.keys(fields).length) continue;
    audit.push({ id: `AUD-${crypto.randomUUID()}`, module, recordId: record.id, action: old ? "Alteração" : "Criação", user: actor.username, displayName: actor.displayName || actor.username, createdAt: now, reason: record.changeReason || record.cancellationReason || "Operação registrada pelo servidor", changes: fields });
  }
}

/** Validate a complete request against the persisted version, never trusting client totals or audit actors. */
export function prepareOperationalState(previous: ErpState | null, incoming: ErpState, actor: Actor, now = new Date().toISOString()): ErpState {
  if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.customers) || !Array.isArray(incoming.serviceOrders) || !incoming.moduleRecords || typeof incoming.moduleRecords !== "object" || Array.isArray(incoming.moduleRecords)) throw new OperationError("A base enviada está incompleta.");
  const old: ErpState = previous || { customers: [], serviceOrders: [], moduleRecords: {} };
  const next: ErpState = structuredClone(incoming);
  next._operations = structuredClone(old._operations || {});
  const oldModules = old.moduleRecords || {};
  const modules = next.moduleRecords!;
  for (const [module, records] of Object.entries(modules)) if (!Array.isArray(records)) throw new OperationError(`Lista inválida: ${module}.`);
  validateRecords(list(old.customers), list(next.customers), "Clientes", { ...actor, can: permission => actor.can(permission === "configuracoes.editar" ? "clientes.editar" : permission) });
  validateRecords(list(old.serviceOrders), list(next.serviceOrders), "OS", { ...actor, can: permission => actor.can(permission === "configuracoes.editar" ? "os.editar" : permission) });
  const managed = new Set(["Razão financeiro", "Livro de estoque", "Auditoria operacional"]);
  for (const module of new Set([...Object.keys(oldModules), ...Object.keys(modules)])) {
    if (managed.has(module) || module === "Auditoria") continue;
    validateRecords(list(oldModules[module]), list(modules[module]), module, actor);
  }
  assertUnique(list(next.customers), list(old.customers), "doc", digits);
  assertUnique(list(modules.Fornecedores), list(oldModules.Fornecedores), "doc", digits);
  assertUnique(list(modules.Produtos), list(oldModules.Produtos), "sku");
  assertUnique(list(modules.Produtos), list(oldModules.Produtos), "barcode");
  assertUnique(list(modules.Equipamentos), list(oldModules.Equipamentos), "serialNumber");
  const financial = list(modules.Financeiro);
  modules.Financeiro = financial;
  const approvals = structuredClone(list(modules["Aprovações"]));
  modules["Aprovações"] = approvals;
  const ensureApproval = (sourceModule:string, source:ErpRecord, reason:string, value:number, controlFingerprint:string) => {
    const existing=approvals.find(item=>item.sourceModule===sourceModule && item.sourceId===source.id && item.controlFingerprint===controlFingerprint && !/Rejeitado|Cancelado/i.test(item.status||""));
    if(existing){ source.approvalRequired=true; source.approvalStatus=existing.status; return existing; }
    const approval={ id:`APR-${sourceModule.replace(/\W/g,"").toUpperCase()}-${source.id}-${crypto.randomUUID().slice(0,8)}`, name:`Aprovação • ${source.name || source.id}`, sourceModule, sourceId:source.id, client:source.client, value, reason, controlFingerprint, status:"Pendente", requestedAt:now, requestedBy:actor.username, createdAt:now };
    approvals.push(approval); source.approvalRequired=true; source.approvalStatus="Pendente"; return approval;
  };
  for(const purchase of list(modules.Compras)){
    const before=list(oldModules.Compras).find(item=>item.id===purchase.id);
    const value=Number(purchase.value||0);
    if(!same(before,purchase) && value>=5000) {
      ensureApproval("Compras",purchase,"Compra acima da alçada automática de R$ 5.000,00.",value,`purchase-value:${value.toFixed(2)}`);
    } else if(value<5000 && purchase.approvalRequired) {
      purchase.approvalRequired=false;
      purchase.approvalStatus="Dispensado";
      purchase.approvalDecidedAt=now;
      purchase.approvalDecidedBy="sistema";
      purchase.approvalDecisionReason="Valor atualizado abaixo da alçada automática de R$ 5.000,00.";
      for(const approval of approvals.filter(item=>item.sourceModule==="Compras" && item.sourceId===purchase.id && item.status==="Pendente")){
        approval.status="Cancelado";
        approval.decidedAt=now;
        approval.decidedBy="sistema";
        approval.decisionReason="Solicitação cancelada automaticamente: valor atualizado abaixo da alçada.";
      }
    }
  }
  for(const budget of list(modules.Orçamentos)){
    const before=list(oldModules.Orçamentos).find(item=>item.id===budget.id);
    const discountPercent=Number(budget.discountPercent||0);
    if(!same(before,budget) && discountPercent>10) {
      ensureApproval("Orçamentos",budget,`Desconto comercial de ${discountPercent.toFixed(1)}% acima da alçada de 10%.`,Number(budget.value||0),`budget-discount:${discountPercent.toFixed(4)}:value:${Number(budget.value||0).toFixed(2)}`);
    } else if(discountPercent<=10 && budget.approvalRequired) {
      budget.approvalRequired=false;
      budget.approvalStatus="Dispensado";
      budget.approvalDecidedAt=now;
      budget.approvalDecidedBy="sistema";
      budget.approvalDecisionReason="Desconto atualizado dentro da alçada automática de 10%.";
      for(const approval of approvals.filter(item=>item.sourceModule==="Orçamentos" && item.sourceId===budget.id && item.status==="Pendente")){
        approval.status="Cancelado";
        approval.decidedAt=now;
        approval.decidedBy="sistema";
        approval.decisionReason="Solicitação cancelada automaticamente: desconto atualizado dentro da alçada.";
      }
    }
  }
  // Derived titles use stable origin IDs. They are created once, even after reopening
  // an OS or receiving a second delivery of the same purchase.
  for (const purchase of list(modules.Compras)) {
    const before = list(oldModules.Compras).find(item => item.id === purchase.id);
    const receiving = list(purchase.receiptHistory).length > list(before?.receiptHistory).length || (purchase.status === "Recebida" && before?.status !== "Recebida");
    // Compras parceladas podem já ter títulos FIN-<compra>-NN criados no cadastro.
    // Qualquer título com purchaseId desta compra significa que a obrigação financeira
    // já foi materializada; o recebimento físico não pode criar outro título integral.
    if (receiving && !financial.some(item => item.purchaseId === purchase.id)) financial.push({ id: `FIN-${purchase.id}`, name: `Conta a pagar • ${purchase.name}`, client: purchase.client, purchaseId: purchase.id, transactionType: "Pagar", status: "Em aberto", value: Number(purchase.value || 0), date: purchase.firstDueDate || now.slice(0, 10), createdAt: now });
  }
  for (const order of list(next.serviceOrders)) {
    const before = list(old.serviceOrders).find(item => item.id === order.id);
    if (/conclu[ií]da/i.test(order.status || "") && !/conclu[ií]da/i.test(before?.status || "") && !order.certameId && !financial.some(item => item.serviceOrderId === order.id)) {
      financial.push({ id: `FIN-OS-${order.id}`, name: `Conta a receber • ${order.id}`, client: order.client, serviceOrderId: order.id, transactionType: "Receber", status: "Em aberto", value: Number(order.total || order.nfseValue || 0), date: now.slice(0, 10), createdAt: now });
    }
    if (/conclu[ií]da/i.test(order.status || "") && !/conclu[ií]da/i.test(before?.status || "")) {
      const fiscalQueue = modules["Central Fiscal"] ||= [];
      if (Number(order.total || order.nfseValue || 0) > 0 && !fiscalQueue.some(item=>item.serviceOrderId===order.id)) fiscalQueue.push({ id:`FISC-OS-${order.id}`, name:`Preparar documento fiscal • ${order.id}`, client:order.client, serviceOrderId:order.id, status:"Pendente", category:"NFS-e", value:Number(order.total || order.nfseValue || 0), createdAt:now, automation:"OS concluída → preparar fiscal" });
      const reminders = modules.Lembretes ||= [];
      const reminderDate = String(order.reminderDate || order.nextMaintenanceDate || "").slice(0,10);
      if (reminderDate && !reminders.some(item=>item.serviceOrderId===order.id && item.date===reminderDate)) reminders.push({ id:`REM-OS-${order.id}-${reminderDate}`, name:`Retorno preventivo • ${order.client}`, client:order.client, serviceOrderId:order.id, status:"Pendente", date:reminderDate, description:order.reminderMessage || "Entrar em contato para manutenção preventiva / pós-venda.", createdAt:now, automation:"OS concluída → lembrete futuro" });
    }
  }
  assertAppendOnly(list(oldModules["Conciliações"]), list(modules["Conciliações"]), "Conciliações");
  for (const record of financial) {
    const oldRecord = list(oldModules.Financeiro).find(item => item.id === record.id);
    const key = sourceKey(record);
    if (key && (!oldRecord || sourceKey(oldRecord) !== key) && financial.some(item => item.id !== record.id && sourceKey(item) === key)) throw new OperationError("Título já gerado para esta origem e parcela.");
    if (record.fiscalDocumentKey && financial.some(item => item.id !== record.id && item.fiscalDocumentKey === record.fiscalDocumentKey && payable(item) === payable(record) && Number(item.installmentNumber || 1) === Number(record.installmentNumber || 1))) throw new OperationError("Documento fiscal já lançado nesta parcela.");
  }
  const accounts: ErpRecord[] = list(modules["Contas financeiras"]).length ? list(modules["Contas financeiras"]) : structuredClone(list(oldModules["Contas financeiras"]).length ? oldModules["Contas financeiras"] : defaultFinancialAccounts());
  const ledger = structuredClone(list(oldModules["Razão financeiro"]));
  const stock = structuredClone(list(oldModules["Livro de estoque"]));
  const audit = structuredClone(list(oldModules["Auditoria operacional"]));
  const addMovement = (movement: ErpRecord, collection = ledger) => { if (!collection.some(item => item.id === movement.id)) collection.push(movement); };
  for (const account of accounts) {
    if (!String(account.name || "").trim()) throw new OperationError("Informe o nome da conta financeira.");
    const before = list(oldModules["Contas financeiras"]).find(item => item.id === account.id);
    if (before && cents(before.openingBalance) !== cents(account.openingBalance)) throw new OperationError("Saldo inicial da conta é imutável. Faça um lançamento de ajuste.");
    addMovement({ id: `OPEN-ACCOUNT-${account.id}`, name: "Saldo inicial", accountId: account.id, signedValue: cash(cents(account.openingBalance)), createdAt: now, user: actor.username, kind: "Abertura" });
  }
  const resolveAccount = (entry: ErpRecord, legacy = false) => {
    let account = accounts.find(item => item.id === entry.accountId || item.name === entry.account);
    if (!account && legacy) {
      account = { id: `LEGACY-${normalize(entry.account || "Sem conta informada").replace(/[^a-z0-9]/g, "-")}`, name: entry.account || "Legado sem conta informada", type: "Legado", openingBalance: 0, status: "Ativo" };
      if (!accounts.some(item => item.id === account!.id)) accounts.push(account);
    }
    if (!account || (!legacy && account.status !== "Ativo")) throw new OperationError("Selecione uma conta financeira ativa.");
    return account;
  };
  for (const record of financial) {
    const before = list(oldModules.Financeiro).find(item => item.id === record.id);
    const history = list(record.settlementHistory);
    const reversals = list(record.reversalHistory);
    assertAppendOnly(list(before?.settlementHistory), history, "Histórico de baixas");
    assertAppendOnly(list(before?.reversalHistory), reversals, "Histórico de estornos");
    if (before && list(before.settlementHistory).length && ["value", "transactionType", "purchaseId", "serviceOrderId", "empenhoId"].some(key => !same(before[key], record[key]))) throw new OperationError("Título com baixa não pode alterar valor ou origem. Estorne e lance um novo título.");
    const oldHistory = list(before?.settlementHistory);
    const oldReversals = list(before?.reversalHistory);
    const oldPrincipal = oldHistory.filter(entry => !oldReversals.some(reversal => reversal.settlementId === entry.id)).reduce((sum, entry) => sum + cents(entry.principal ?? entry.value), 0);
    const baseline = before?._settlementOpening !== undefined ? cents(before._settlementOpening) : Math.max(0, cents(before?.settledValue ?? (/^(Paga|Recebida)$/i.test(before?.status || "") ? before?.value : 0)) - oldPrincipal);
    record._settlementOpening = cash(baseline);
    if (baseline) {
      const legacyAccount = resolveAccount({ account: before?.settlementAccount }, true);
      addMovement({ id: `OPEN-TITLE-${record.id}`, name: `Saldo legado • ${record.name}`, titleId: record.id, accountId: legacyAccount.id, signedValue: cash((payable(record) ? -1 : 1) * baseline), createdAt: now, user: actor.username, kind: "Saldo legado", legacy: true });
    }
    const reversalIds = new Set<string>();
    for (const reversal of reversals) {
      if (reversalIds.has(reversal.settlementId)) throw new OperationError("Esta baixa já foi estornada.");
      reversalIds.add(reversal.settlementId);
      const entry = history.find(item => item.id === reversal.settlementId);
      if (!entry && reversal.settlementId === `LEGACY-${record.id}` && baseline > 0) {
        if (!String(reversal.reason || "").trim()) throw new OperationError("Estorno exige motivo.");
        if (!oldReversals.some(item => item.id === reversal.id)) Object.assign(reversal, { createdAt: now, user: actor.username });
        const account = resolveAccount({ account: before?.settlementAccount }, true);
        addMovement({ id: `REV-${record.id}-${reversal.id}`, name: `Estorno de saldo legado • ${record.name}`, titleId: record.id, reversesMovementId: `OPEN-TITLE-${record.id}`, accountId: account.id, signedValue: cash((payable(record) ? 1 : -1) * baseline), createdAt: reversal.createdAt, user: reversal.user || actor.username, reason: reversal.reason, kind: "Estorno", legacy: true });
        continue;
      }
      if (!entry || !String(reversal.reason || "").trim()) throw new OperationError("Estorno exige uma baixa existente e um motivo.");
      if (!oldReversals.some(item => item.id === reversal.id)) Object.assign(reversal, { createdAt: now, user: actor.username });
      const account = resolveAccount(entry, oldHistory.some(item => item.id === entry.id));
      addMovement({ id: `REV-${record.id}-${reversal.id}`, name: `Estorno • ${record.name}`, titleId: record.id, settlementId: entry.id, reversesMovementId: `SET-${record.id}-${entry.id}`, accountId: account.id, signedValue: cash((payable(record) ? 1 : -1) * cents(entry.value)), createdAt: reversal.createdAt, user: reversal.user || actor.username, reason: reversal.reason, kind: "Estorno" });
    }
    let principal = reversalIds.has(`LEGACY-${record.id}`) ? 0 : baseline;
    let interest = 0;
    let discount = 0;
    for (const entry of history) {
      const isNew = !oldHistory.some(item => item.id === entry.id);
      if (isNew) {
        if (canceled(before || record)) throw new OperationError("Título cancelado não aceita baixa.");
        const nominal = cents(entry.principal ?? entry.value);
        if (nominal <= 0 || cents(entry.interest) < 0 || cents(entry.discount) < 0 || cents(entry.discount) > nominal + cents(entry.interest) || cents(entry.value) !== nominal + cents(entry.interest) - cents(entry.discount)) throw new OperationError("Valor da baixa, juros e desconto são inconsistentes.");
        Object.assign(entry, { principal: cash(nominal), createdAt: now, user: actor.username });
      }
      const account = resolveAccount(entry, !isNew);
      addMovement({ id: `SET-${record.id}-${entry.id}`, name: `Baixa • ${record.name}`, titleId: record.id, settlementId: entry.id, accountId: account.id, signedValue: cash((payable(record) ? -1 : 1) * cents(entry.value)), principal: entry.principal ?? entry.value, interest: entry.interest || 0, discount: entry.discount || 0, method: entry.method, paymentDate: entry.paymentDate || entry.createdAt?.slice(0, 10), createdAt: entry.createdAt || now, user: entry.user || actor.username, kind: "Baixa", legacy: !isNew });
      if (!reversalIds.has(entry.id)) { principal += cents(entry.principal ?? entry.value); interest += cents(entry.interest); discount += cents(entry.discount); }
    }
    if (principal > cents(record.value) && history.some(entry => !oldHistory.some(item => item.id === entry.id))) throw new OperationError("A baixa excede o saldo nominal do título.");
    if (canceled(record) && !canceled(before || {}) && principal > 0) throw new OperationError("Estorne as baixas antes de cancelar o título.");
    if (!history.length && !reversals.length && before && cents(record.settledValue) !== cents(before.settledValue)) throw new OperationError("Não edite a baixa diretamente. Use baixa ou estorno formal.");
    if (!before && cents(record.settledValue) > 0 && !history.length) throw new OperationError("Novo título liquidado exige uma baixa formal.");
    record.settledValue = cash(principal);
    record.interestValue = cash(interest);
    record.discountValue = cash(discount);
    record.competenceDate ||= record.date || now.slice(0, 10);
    record.dueDate ||= record.date || record.competenceDate;
    record.originKey = sourceKey(record) || record.originKey || `manual:${record.id}`;
    if (!history.length && !reversals.length && /^(Paga|Recebida)$/i.test(record.status || "") && before?.status !== record.status && principal < cents(record.value)) throw new OperationError("Use uma baixa formal para liquidar o título.");
    if (history.length || reversals.length) {
      record.status = canceled(record) ? record.status : principal >= cents(record.value) ? (payable(record) ? "Paga" : "Recebida") : principal > 0 ? (payable(record) ? "Paga parcialmente" : "Recebida parcialmente") : "Em aberto";
    }
  }
  const products = list(modules.Produtos);
  for (const product of products) {
    const before = list(oldModules.Produtos).find(item => item.id === product.id);
    const openingId = `OPEN-STOCK-${product.id}`;
    if (!stock.some(item => item.id === openingId)) addMovement({ id: openingId, productId: product.id, quantity: Number(before?.stockCurrent ?? product.stockCurrent ?? 0), kind: "Abertura", createdAt: now, user: actor.username, reason: "Saldo existente preservado na implantação do livro" }, stock);
    if (before && Number(product.stockCurrent || 0) !== Number(before.stockCurrent || 0)) {
      requireAction(actor, "estoque.ajustar");
      if (!String(product.stockAdjustmentReason || "").trim()) throw new OperationError("Ajuste de estoque exige motivo.");
      const delta = Number(product.stockCurrent || 0) - Number(before.stockCurrent || 0);
      if (!Number.isFinite(delta)) throw new OperationError("Quantidade inválida.");
      addMovement({ id: `ADJ-${crypto.randomUUID()}`, productId: product.id, quantity: delta, kind: "Ajuste", createdAt: now, user: actor.username, reason: product.stockAdjustmentReason }, stock);
      delete product.stockAdjustmentReason;
    }
  }
  for (const purchase of list(modules.Compras)) {
    const before = list(oldModules.Compras).find(item => item.id === purchase.id);
    const receipts = list(purchase.receiptHistory);
    assertAppendOnly(list(before?.receiptHistory), receipts, "Recebimentos da compra");
    const items = list(purchase.purchaseItems);
    // Historical completed purchases are never received again during bootstrap.
    if (purchase.status === "Recebida" && before?.status !== "Recebida" && !receipts.some(receipt => !list(before?.receiptHistory).some(item => item.id === receipt.id))) {
      const lines = items.filter(item => item.kind !== "Serviço" && item.kind !== "Custo adicional").map(item => ({ itemId: item.id, productId: item.productId, quantity: Math.max(0, Number(item.quantity) - receipts.reduce((sum, receipt) => sum + list(receipt.items).filter(line => line.itemId === item.id).reduce((total, line) => total + Number(line.quantity), 0), 0)) })).filter(line => line.quantity > 0);
      if (lines.length) receipts.push({ id: `REC-${crypto.randomUUID()}`, items: lines, createdAt: now, user: actor.username });
    }
    const totals = new Map<string, number>();
    for (const receipt of receipts) {
      const isNew = !list(before?.receiptHistory).some(item => item.id === receipt.id);
      if (isNew && !list(receipt.items).length) throw new OperationError("Informe os itens recebidos.");
      if (isNew && canceled(purchase)) throw new OperationError("Compra cancelada não pode ser recebida.");
      if (isNew) { requireAction(actor, "compras.receber"); Object.assign(receipt, { createdAt: now, user: actor.username }); }
      for (const line of list(receipt.items)) {
        const item = items.find(item => item.id === line.itemId);
        const productId = line.productId || item?.productId;
        const quantity = Number(line.quantity);
        const total = (totals.get(line.itemId) || 0) + quantity;
        if (!item || !Number.isFinite(quantity) || quantity <= 0 || total > Number(item.quantity) + 0.000001 || !products.some(product => product.id === productId)) throw new OperationError("Recebimento inválido: vincule cada item a um produto e respeite a quantidade pendente.");
        if (isNew && item.productId && productId !== item.productId) throw new OperationError("Produto recebido difere do produto do pedido.");
        totals.set(line.itemId, total);
        addMovement({ id: `PUR-${purchase.id}-${receipt.id}-${line.itemId}`, productId, quantity, purchaseId: purchase.id, itemId: line.itemId, receiptId: receipt.id, kind: "Entrada", createdAt: receipt.createdAt, user: receipt.user || actor.username, reason: "Recebimento de compra" }, stock);
      }
      const receiptKeys = list(receipt.items).map(line => line.itemId);
      if (new Set(receiptKeys).size !== receiptKeys.length) throw new OperationError("Item repetido no recebimento.");
    }
    purchase.receiptHistory = receipts;
    if (receipts.length && !canceled(purchase)) purchase.status = items.filter(item => item.kind !== "Serviço" && item.kind !== "Custo adicional").every(item => (totals.get(item.id) || 0) >= Number(item.quantity)) ? "Recebida" : "Recebida parcialmente";
  }
  for (const entry of list(modules.Estoque)) {
    const before = list(oldModules.Estoque).find(item => item.id === entry.id);
    if (!entry.productId || same(before, entry)) continue;
    if (before) throw new OperationError("Movimento de estoque é imutável. Registre um ajuste compensatório.");
    const quantity = Number(entry.quantity);
    if (!products.some(product => product.id === entry.productId) || !Number.isFinite(quantity) || quantity <= 0 || !["Entrada", "Saída", "Ajuste", "Transferência"].includes(entry.movementType)) throw new OperationError("Movimento exige produto, tipo e quantidade válida.");
    if (!String(entry.changeReason || entry.description || "").trim()) throw new OperationError("Informe o motivo do movimento.");
    addMovement({ id: `MAN-${entry.id}`, productId: entry.productId, quantity: entry.movementType === "Transferência" ? 0 : entry.movementType === "Saída" ? -quantity : quantity, transferQuantity: entry.movementType === "Transferência" ? quantity : undefined, kind: entry.movementType, sourceType: entry.sourceType || "", sourceId: entry.sourceId || "", sourceName: entry.sourceName || "", destinationType: entry.destinationType || "Estoque central", destinationId: entry.destinationId || "", destinationName: entry.destinationName || "", createdAt: now, user: actor.username, reason: entry.changeReason || entry.description }, stock);
  }
  for (const order of list(next.serviceOrders)) {
    const before = list(old.serviceOrders).find(item => item.id === order.id);
    if (!/conclu[ií]da/i.test(order.status || "") || /conclu[ií]da/i.test(before?.status || "")) continue;
    const legacyMovement = list(oldModules.Estoque).some(item => item.serviceOrderId === order.id && /sa[ií]da/i.test(item.category || ""));
    if (legacyMovement) continue;
    for (const item of list(order.catalogItems).filter(item => item.kind === "Produto")) {
      const quantity = Number(item.quantity ?? 1);
      if (!products.some(product => product.id === item.id) || !Number.isFinite(quantity) || quantity <= 0) throw new OperationError("Produto ou quantidade inválida na OS.");
      addMovement({ id: `OS-STOCK-${order.id}-${item.id}`, productId: item.id, serviceOrderId: order.id, quantity: -quantity, kind: "Saída", createdAt: now, user: actor.username, reason: "Conclusão da OS" }, stock);
    }
  }
  for (const product of products) {
    const balance = stock.filter(item => item.productId === product.id).reduce((sum, item) => sum + Math.round(Number(item.quantity) * 1000), 0) / 1000;
    if (!Number.isFinite(balance) || balance < -0.000001) throw new OperationError(`Estoque insuficiente: ${product.name}.`);
    product.stockCurrent = balance;
  }
  for (const order of list(next.serviceOrders)) {
    const before = list(old.serviceOrders).find(item => item.id === order.id);
    if (same(before, order)) continue;
    const equipmentIds = Array.isArray(order.equipmentIds) ? order.equipmentIds : order.equipmentId ? [order.equipmentId] : [];
    if (new Set(equipmentIds).size !== equipmentIds.length) throw new OperationError("Equipamento repetido na OS.");
    for (const equipmentId of equipmentIds) {
      const equipment = list(modules.Equipamentos).find(item => item.id === equipmentId);
      if (!equipment || (equipment.customerId ? equipment.customerId !== order.customerId : equipment.client !== order.client)) throw new OperationError("Equipamento não pertence ao cliente desta OS.");
      const linkedLocation = equipment.roomId || equipment.sectorId || equipment.unitId || equipment.structureId;
      if (linkedLocation && ![order.roomId, order.sectorId, order.unitId, order.structureId].includes(linkedLocation)) throw new OperationError("Equipamento pertence a outra unidade, setor ou ambiente.");
    }
  }
  for (const name of managed) if (modules[name] && !same(modules[name], oldModules[name])) throw new OperationError(`O livro ${name} é mantido exclusivamente pelo servidor.`);
  auditChanges(list(old.customers), list(next.customers), "Clientes", actor, now, audit);
  auditChanges(list(old.serviceOrders), list(next.serviceOrders), "OS", actor, now, audit);
  for (const module of new Set([...Object.keys(oldModules), ...Object.keys(modules)])) if (!managed.has(module) && module !== "Auditoria") auditChanges(list(oldModules[module]), list(modules[module]), module, actor, now, audit);
  modules["Contas financeiras"] = accounts;
  modules["Razão financeiro"] = ledger;
  modules["Livro de estoque"] = stock;
  modules["Auditoria operacional"] = audit;
  // The client audit remains available for compatibility; the operational audit is server-authored.
  next._erpLedgerVersion = 1;
  return next;
}

export type OperationalCommand = { idempotencyKey: string; action: string; recordId?: string; expectedRecord?: ErpRecord; data: ErpRecord };
export function applyOperationalCommand(state: ErpState, command: OperationalCommand, actor: Actor, now = new Date().toISOString()) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(command.idempotencyKey || "")) throw new OperationError("Identificador idempotente inválido.");
  const fingerprint = JSON.stringify({ action: command.action, recordId: command.recordId, data: command.data });
  const existing = state._operations?.[command.idempotencyKey];
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new OperationError("Identificador já usado para outra operação.", 409);
    return { state, replay: true };
  }
  const next = structuredClone(state);
  const modules = next.moduleRecords ||= {};
  const module = ["settle", "reverse", "cancel", "dates"].includes(command.action) ? "Financeiro" : command.action === "receive" ? "Compras" : command.action === "account" ? "Contas financeiras" : ["stock","stock-transfer"].includes(command.action) ? "Estoque" : command.action === "reconcile" ? "Conciliações" : command.action === "approval-decide" ? "Aprovações" : command.action === "tender-status" ? "Radar Licitações" : command.action === "tender-vault" ? "Cofre Licitações" : "";
  if (!module) throw new OperationError("Operação desconhecida.");
  const records = modules[module] ||= [];
  const record = records.find(item => item.id === command.recordId);
  if (command.expectedRecord && !same(record, command.expectedRecord)) throw new OperationError("Registro alterado por outro usuário. Atualize antes de continuar.", 409);
  const data = command.data || {};
  if (["settle", "reverse", "cancel", "dates", "receive", "approval-decide"].includes(command.action) && !record) throw new OperationError("Registro não encontrado.", 404);
  const operationId = `OP-${command.idempotencyKey}`;
  switch (command.action) {
    case "settle": {
      requireAction(actor, "financeiro.baixar");
      const principal = cents(data.principal);
      record!.settlementHistory = [...list(record!.settlementHistory), { id: operationId, principal: cash(principal), value: cash(principal + cents(data.interest) - cents(data.discount)), interest: cash(cents(data.interest)), discount: cash(cents(data.discount)), accountId: data.accountId, method: data.method, paymentDate: data.paymentDate || now.slice(0, 10), createdAt: now }];
      break;
    }
    case "reverse":
      requireAction(actor, "financeiro.estornar");
      record!.reversalHistory = [...list(record!.reversalHistory), { id: operationId, settlementId: data.settlementId, reason: data.reason, createdAt: now }];
      break;
    case "cancel":
      requireAction(actor, "financeiro.editar");
      record!.status = "Cancelada"; record!.changeReason = data.reason;
      break;
    case "dates":
      requireAction(actor, "financeiro.editar");
      if (![data.competenceDate, data.dueDate].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") && !Number.isNaN(Date.parse(value)))) throw new OperationError("Informe competência e vencimento válidos.");
      record!.competenceDate = data.competenceDate; record!.dueDate = data.dueDate; record!.date = data.dueDate; record!.changeReason = data.reason || "Datas do título atualizadas";
      break;
    case "receive":
      requireAction(actor, "compras.receber");
      if (record!.approvalRequired && record!.approvalStatus !== "Aprovado") throw new OperationError("Esta compra depende de aprovação por alçada antes do recebimento.",409);
      record!.receiptHistory = [...list(record!.receiptHistory), { id: operationId, items: data.items, createdAt: now }];
      break;
    case "account":
      requireAction(actor, "financeiro.editar");
      if (!records.length) records.push(...defaultFinancialAccounts());
      records.push({ id: operationId, name: String(data.name || "").trim(), type: data.type || "Banco", openingBalance: cash(cents(data.openingBalance)), status: "Ativo", createdAt: now });
      break;
    case "stock":
      requireAction(actor, data.movementType === "Ajuste" ? "estoque.ajustar" : "estoque.editar");
      records.push({ id: operationId, name: `${data.movementType} de estoque`, productId: data.productId, quantity: data.quantity, movementType: data.movementType, destinationType: data.destinationType || "Estoque central", destinationId: data.destinationId || "", destinationName: data.destinationName || "", changeReason: data.reason, description: data.reason, createdAt: now });
      break;
    case "stock-transfer":
      requireAction(actor, "estoque.editar");
      if (!(Number(data.quantity) > 0) || !String(data.sourceType || "").trim() || !String(data.destinationType || "").trim()) throw new OperationError("Transferência exige quantidade, origem e destino.");
      if (stockLocationKey(data.sourceType,data.sourceId,data.sourceName) === stockLocationKey(data.destinationType,data.destinationId,data.destinationName)) throw new OperationError("Origem e destino da transferência devem ser diferentes.");
      {
        const book=list(modules["Livro de estoque"]);
        const productMovements=book.filter(item=>String(item.productId)===String(data.productId));
        const calculated=stockBalanceAtLocation(book,String(data.productId),String(data.sourceType),String(data.sourceId||""),String(data.sourceName||""));
        const sourceBalance=!productMovements.length && String(data.sourceType)==="Estoque central" ? Number(list(modules.Produtos).find(item=>item.id===data.productId)?.stockCurrent||0) : calculated;
        if(sourceBalance + 1e-9 < Number(data.quantity)) throw new OperationError(`Saldo insuficiente na origem: disponível ${sourceBalance}.`);
      }
      records.push({ id: operationId, name: "Transferência de estoque", productId: data.productId, quantity: data.quantity, movementType: "Transferência", sourceType: data.sourceType, sourceId: data.sourceId || "", sourceName: data.sourceName || "", destinationType: data.destinationType, destinationId: data.destinationId || "", destinationName: data.destinationName || "", changeReason: data.reason || "Transferência interna", description: data.reason || "Transferência interna", createdAt: now });
      break;
    case "approval-decide": {
      requireAction(actor, "aprovacoes.aprovar");
      const decision = data.decision === "Aprovado" ? "Aprovado" : data.decision === "Rejeitado" ? "Rejeitado" : "";
      if (!decision || !String(data.reason || "").trim()) throw new OperationError("Aprovação exige decisão e justificativa.");
      record!.status=decision; record!.decidedAt=now; record!.decidedBy=actor.username; record!.decisionReason=String(data.reason).trim();
      const sourceModule=String(record!.sourceModule||""); const sourceId=String(record!.sourceId||"");
      const source=list(modules[sourceModule]).find(item=>item.id===sourceId);
      if(source){ source.approvalStatus=decision; source.approvalDecidedAt=now; source.approvalDecidedBy=actor.username; source.approvalDecisionReason=record!.decisionReason; }
      break;
    }
    case "reconcile": {
      requireAction(actor, "financeiro.conciliar");
      const movement = list(modules["Razão financeiro"]).find(item => item.id === data.movementId);
      if (!movement || movement.accountId !== data.accountId || !String(data.reference || "").trim()) throw new OperationError("Selecione movimento, conta e referência bancária.");
      if (records.some(item => item.movementId === movement.id)) throw new OperationError("Movimento já conciliado.");
      records.push({ id: operationId, name: "Conciliação bancária", movementId: movement.id, accountId: data.accountId, reference: data.reference, date: data.date || now.slice(0, 10), createdAt: now, user: actor.username });
      break;
    }
  }
  const effectiveActor: Actor = command.action === "approval-decide"
    ? { ...actor, can: permission => actor.can(permission) || ["compras.editar","comercial.editar"].includes(permission) }
    : actor;
  const prepared = prepareOperationalState(state, next, effectiveActor, now);
  prepared._operations[command.idempotencyKey] = { fingerprint, createdAt: now, user: actor.username };
  return { state: prepared, replay: false };
}

/** Rows are independent records; all are written atomically with the compatibility snapshot. */
export function independentOperationalRows(companyId: string, state: ErpState, previous?: ErpState | null) {
  const result: { id: string; payload: ErpRecord }[] = [];
  const append = (module: string, records: ErpRecord[]) => records.forEach(record => {
    const oldRecords = module === "Clientes" ? list(previous?.customers) : module === "OS" ? list(previous?.serviceOrders) : list(previous?.moduleRecords?.[module]);
    if (previous?._erpLedgerVersion && same(oldRecords.find(item => item.id === record.id),record)) return;
    result.push({ id: `erp:${companyId}:${module}:${record.id}`, payload: { _erpEntity: true, companyId, module, record } });
  });
  append("Clientes", list(state.customers));
  append("OS", list(state.serviceOrders));
  for (const module of ["Financeiro", "Contas financeiras", "Razão financeiro", "Livro de estoque", "Produtos", "Compras", "Equipamentos", "Auditoria operacional", "Aprovações", "Central Fiscal", "Lembretes"]) append(module, list(state.moduleRecords?.[module]));
  return result;
}
