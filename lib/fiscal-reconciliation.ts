export type ReconciliationIssue = {
  documentId: string;
  severity: "error" | "warning";
  code: string;
  message: string;
};

type ReconciliationRecord = {
  id?: string;
  fiscalSourceType?: string;
  fiscalSourceId?: string;
  fiscalKey?: string;
  fiscalNumber?: string;
  status?: string;
  value?: number;
  total?: number;
  settledValue?: number;
  fiscalXmlUrl?: string;
  fiscalDocumentKey?: string;
  invoiceNumber?: string;
  serviceOrderId?: string;
  saleId?: string;
  [key: string]: unknown;
};

const n = (value: unknown) => Number(value || 0);

export function reconcileFiscalDocuments(input: {
  documents: ReconciliationRecord[];
  sales: ReconciliationRecord[];
  serviceOrders: ReconciliationRecord[];
  financeRecords: ReconciliationRecord[];
}) {
  const issues: ReconciliationIssue[] = [];
  for (const doc of input.documents) {
    const documentId = String(doc.id || "Documento");
    const source = doc.fiscalSourceType === "Venda"
      ? input.sales.find(item=>item.id===doc.fiscalSourceId)
      : doc.fiscalSourceType === "Ordem de Serviço"
        ? input.serviceOrders.find(item=>item.id===doc.fiscalSourceId)
        : undefined;

    if (doc.fiscalSourceId && !source && ["Venda","Ordem de Serviço"].includes(String(doc.fiscalSourceType || ""))) {
      issues.push({ documentId,severity:"error",code:"SOURCE_NOT_FOUND",message:"Documento fiscal referencia uma origem que não foi localizada." });
    }
    if (source && Math.abs(n(doc.value) - n(source.value ?? source.total)) > 0.01) {
      issues.push({ documentId,severity:"warning",code:"SOURCE_VALUE_MISMATCH",message:"Valor fiscal difere do valor da origem comercial/operacional." });
    }

    const finance = input.financeRecords.filter(item =>
      item.fiscalDocumentKey === doc.fiscalKey ||
      item.invoiceNumber === doc.fiscalNumber ||
      item.serviceOrderId === doc.fiscalSourceId ||
      item.saleId === doc.fiscalSourceId
    );
    if (doc.status === "Autorizada" && !finance.length) {
      issues.push({ documentId,severity:"warning",code:"FINANCE_NOT_LINKED",message:"Documento autorizado ainda não possui título financeiro vinculado." });
    }
    if (doc.status === "Autorizada" && finance.length) {
      const financeTotal = finance.reduce((sum,item)=>sum+n(item.value),0);
      if (Math.abs(financeTotal - n(doc.value)) > 0.01) {
        issues.push({ documentId,severity:"warning",code:"FINANCE_VALUE_MISMATCH",message:"Soma dos títulos financeiros difere do valor do documento fiscal." });
      }
    }
    if (doc.status === "Cancelada" && finance.some(item=>!/cancelad/i.test(String(item.status||"")) && n(item.settledValue)>0)) {
      issues.push({ documentId,severity:"error",code:"CANCELLED_WITH_SETTLEMENT",message:"Nota cancelada possui título financeiro com baixa ativa; exige conciliação/estorno." });
    }
    if (doc.status === "Autorizada" && !doc.fiscalXmlUrl) {
      issues.push({ documentId,severity:"error",code:"XML_MISSING",message:"Documento autorizado sem XML armazenado/retornado pelo autorizador." });
    }
  }
  return {
    issues,
    errors: issues.filter(item=>item.severity==="error").length,
    warnings: issues.filter(item=>item.severity==="warning").length,
    ok: !issues.some(item=>item.severity==="error"),
  };
}
