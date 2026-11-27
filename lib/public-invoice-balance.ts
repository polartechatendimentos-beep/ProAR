import { validateEmpenhoAllocations, type EmpenhoAllocation } from "./public-contracts.ts";

type Data = Record<string,unknown>;
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const rows = (value: unknown): Data[] => Array.isArray(value) ? value.filter((row): row is Data => Boolean(row && typeof row==="object" && !Array.isArray(row))) : [];
const cents = (value: unknown) => typeof value === "number" && Number.isSafeInteger(Math.round(value * 100)) ? Math.round(value * 100) : NaN;
const inactive = (value: unknown) => /cancelad|estornad/.test(str(value).toLowerCase());
const unique = (records: Data[], id: string) => {
  const found=records.filter(row=>row.id===id);
  return id&&found.length===1 ? found[0] : undefined;
};

export function inspectPublicInvoiceBalance(commitment:Data, commitments:Data[], contracts:Data[], orders:Data[], customers:Data[]) {
  const fail = (reason:string) => ({ok:false as const,reason,invoiceableValue:0,remainingValue:0});
  const id=str(commitment.id), contractId=str(commitment.certameId);
  if (!unique(commitments,id)||inactive(commitment.status)) return fail("Empenho inexistente, cancelado ou ambíguo.");
  const contract=unique(contracts,contractId);
  if (!contract||inactive(contract.status)||/suspens/i.test(str(contract.status))) return fail("Certame indisponível, suspenso ou sem vínculo confirmado.");
  const customerId=str(contract.certameCustomerId)||str(contract.customerId);
  if (!unique(customers,customerId) || (str(contract.customerId)&&str(contract.certameCustomerId)&&contract.customerId!==contract.certameCustomerId)) return fail("Certame sem cliente canônico. Regularize o cadastro antes de faturar.");
  const allocations=rows(commitment.empenhoAllocations);
  if (!allocations.length || allocations.length !== (commitment.empenhoAllocations as unknown[]).length) return fail("Empenho sem itens de execução vinculados.");
  try { validateEmpenhoAllocations(Number(commitment.value), allocations as EmpenhoAllocation[]); }
  catch (error) { return fail(error instanceof Error?error.message:"Valores de vínculo inválidos."); }
  const seen=new Set<string>();
  let invoiceable=0;
  for (const allocation of allocations) {
    const orderId=str(allocation.serviceOrderId), itemId=str(allocation.certameItemId);
    const key=JSON.stringify([orderId,itemId]);
    if (seen.has(key)||allocation.empenhoId!==id) return fail("Empenho com item/OS duplicado ou vínculo de outro registro.");
    seen.add(key);
    const order=unique(orders,orderId);
    const item=unique(rows(contract.certameItems),itemId);
    if (!order||order.certameId!==contractId||order.customerId!==customerId||!/^conclu[ií]d[ao]$/i.test(str(order.status))||!item||item.certameId!==contractId) return fail("OS, cliente ou item não possui vínculo canônico com este Certame.");
    const relevant=rows(order.contractItems).filter(row=>row.certameItemId===itemId);
    const relatedMovements=rows(item.movements).filter(row=>row.certameId===contractId&&row.itemId===itemId&&row.serviceOrderId===orderId);
    if (!relevant.length || !relevant.every(row=>{const move=unique(relatedMovements,str(row.executionMovementId)); return move?.type==="Execução"&&typeof move.executedDelta==="number"&&Number.isFinite(move.executedDelta)&&move.executedDelta>0;})) {
      return fail("Não há execução contratual comprovada para todos os itens da OS.");
    }
    if (relatedMovements.some(row=>typeof row.executedDelta!=="number"||!Number.isFinite(row.executedDelta))) return fail("Histórico de execução inválido.");
    // Execution and reversal movements are authoritative, not duplicated line snapshots.
    const netQty=relatedMovements.reduce((sum,row)=>sum+Number(row.executedDelta),0);
    const unitValue=Number(item.unitValue);
    const executed=cents(netQty*unitValue);
    let used=0;
    for (const other of commitments) {
      if (inactive(other.status)) continue;
      for (const claimed of rows(other.empenhoAllocations)) {
        if (claimed.serviceOrderId!==orderId) continue;
        if (!str(claimed.certameItemId)) return fail("Existe vínculo legado sem item para esta OS. Revise os Empenhos antes de faturar.");
        if (claimed.certameItemId!==itemId) continue;
        if (other.certameId!==contractId || claimed.empenhoId!==other.id) return fail("Existe vínculo conflitante para a mesma execução.");
        const amount=cents(claimed.amount);
        if (!Number.isSafeInteger(amount)||amount<=0) return fail("Existe vínculo de valor inválido para esta execução.");
        used+=amount;
      }
    }
    if (!Number.isSafeInteger(executed)||!Number.isSafeInteger(used)||used>executed) return fail("Os Empenhos vinculados ultrapassam o saldo executado da OS.");
    invoiceable+=cents(allocation.amount);
  }
  const nominal=cents(commitment.value);
  if (!Number.isSafeInteger(nominal)||!Number.isSafeInteger(invoiceable)||invoiceable<=0||invoiceable>nominal) return fail("Valor disponível para faturar inválido.");
  return {ok:true as const,reason:"",invoiceableValue:invoiceable/100,remainingValue:(nominal-invoiceable)/100};
}
