/**
 * Read-only integrity diagnostics for an already authenticated, tenant-scoped ERP state.
 * No database reads, writes or cross-tenant aggregation happen in this module.
 * Findings never trigger automatic fixes: historical data requires human review.
 */
export type IntegrityRecord = Record<string, unknown>;
export type IntegrityState = {
  customers?: IntegrityRecord[];
  serviceOrders?: IntegrityRecord[];
  moduleRecords?: Record<string, IntegrityRecord[]>;
};
export type IntegrityFinding = {
  code: "DUPLICATE_RECORD_ID" | "MISSING_RECORD_ID" | "ORPHAN_CUSTOMER" |
    "DUPLICATE_SETTLEMENT_ID" | "INVALID_STOCK_QUANTITY";
  severity: "warning" | "critical";
  module: string;
  recordId: string;
  message: string;
};
const key = (value: unknown): string => String(value ?? "").trim();
const objects = (value: unknown): IntegrityRecord[] =>
  Array.isArray(value) ? value.filter((entry): entry is IntegrityRecord =>
    !!entry && typeof entry === "object" && !Array.isArray(entry)) : [];

export function inspectOperationalIntegrity(state: IntegrityState): IntegrityFinding[] {
  const findings: IntegrityFinding[] = [];
  const collections: [string, IntegrityRecord[]][] = [
    ["Clientes", objects(state.customers)],
    ["Ordens de serviço", objects(state.serviceOrders)],
    ...Object.entries(state.moduleRecords ?? {}).map(([module, rows]): [string, IntegrityRecord[]] => [module, objects(rows)]),
  ];

  for (const [module, records] of collections) {
    const firstIndexById = new Map<string, number>();
    records.forEach((record, index) => {
      const recordId = key(record.id);
      if (!recordId) {
        findings.push({code:"MISSING_RECORD_ID",severity:"critical",module,recordId:"",
          message:`Registro na posição ${index + 1} sem identificador.`});
      } else if (firstIndexById.has(recordId)) {
        findings.push({code:"DUPLICATE_RECORD_ID",severity:"critical",module,recordId,
          message:`Identificador repetido no módulo ${module} (posições ${firstIndexById.get(recordId)! + 1} e ${index + 1}).`});
      } else firstIndexById.set(recordId, index);

      if (module === "Produtos" && record.stockCurrent !== null && record.stockCurrent !== undefined && record.stockCurrent !== "") {
        const quantity = Number(record.stockCurrent);
        if (!Number.isFinite(quantity) || quantity < 0)
          findings.push({code:"INVALID_STOCK_QUANTITY",severity:"warning",module,recordId,
            message:"Quantidade de estoque negativa ou inválida. Conferir movimentos antes de corrigir."});
      }
      if (module === "Financeiro") {
        const seen = new Set<string>();
        for (const entry of objects(record.settlementHistory)) {
          const settlementId = key(entry.id);
          if (!settlementId) continue; // Historical entries without IDs require a separate migration review.
          if (seen.has(settlementId))
            findings.push({code:"DUPLICATE_SETTLEMENT_ID",severity:"critical",module,recordId,
              message:`Identificador de baixa repetido no mesmo título (${settlementId}).`});
          seen.add(settlementId);
        }
      }
    });
  }

  // Only verify a relationship when a customer ID is explicitly recorded.
  // A name-only legacy OS is not automatically considered corrupted.
  const customers = new Set(objects(state.customers).map(item=>key(item.id)).filter(Boolean));
  for (const order of objects(state.serviceOrders)) {
    const customerId = key(order.customerId);
    if (customerId && !customers.has(customerId))
      findings.push({code:"ORPHAN_CUSTOMER",severity:"warning",module:"Ordens de serviço",
        recordId:key(order.id),message:"OS referencia um cliente ausente da base carregada. Verifique carregamento e vínculo antes de alterar."});
  }
  return findings;
}
