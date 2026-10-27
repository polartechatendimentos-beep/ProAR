export type FiscalDocumentKind = "NFSE" | "NFCE" | "NFE";

export type FiscalValidationIssue = {
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

type FiscalValidationPayload = {
  kind: FiscalDocumentKind;
  customer?: { document?: string; address?: string; stateRegistration?: string; municipalRegistration?: string };
  service?: { description?: string; value?: number; serviceCode?: string; issRate?: number | string };
  items?: Array<{ description?: string; quantity?: number; unitValue?: number; ncm?: string; cfop?: string; cst?: string; csosn?: string }>;
  company?: { document?: string; stateRegistration?: string; municipalRegistration?: string; taxRegime?: string };
  config?: { csc?: string; cscId?: string; environment?: string };
};

const digits = (value?: string) => String(value ?? "").replace(/\D/g, "");
const invalidDocument = (value?: string) => {
  const doc = digits(value);
  return ![11,14].includes(doc.length) || /^(\d)\1+$/.test(doc);
};

export function validateFiscalPayload(payload: FiscalValidationPayload) {
  const issues: FiscalValidationIssue[] = [];
  const error = (field:string, code:string, message:string) => issues.push({ field, code, message, severity:"error" as const });
  const warning = (field:string, code:string, message:string) => issues.push({ field, code, message, severity:"warning" as const });

  if (!payload.kind) error("kind","DOCUMENT_TYPE_REQUIRED","Informe o tipo de documento fiscal.");
  if (invalidDocument(payload.customer?.document)) error("customer.document","CUSTOMER_DOCUMENT_INVALID","CPF/CNPJ do destinatário está ausente ou inválido.");
  if (!payload.customer?.address?.trim()) error("customer.address","CUSTOMER_ADDRESS_REQUIRED","Endereço do destinatário não foi informado.");

  if (payload.kind === "NFSE") {
    if (!payload.service?.description?.trim()) error("service.description","SERVICE_DESCRIPTION_REQUIRED","Descrição do serviço é obrigatória.");
    if (!(Number(payload.service?.value) > 0)) error("service.value","SERVICE_VALUE_INVALID","Valor do serviço deve ser maior que zero.");
    if (!payload.service?.serviceCode?.trim()) error("service.serviceCode","SERVICE_CODE_REQUIRED","Código do serviço municipal/nacional não foi informado.");
    if (!payload.company?.municipalRegistration?.trim()) warning("company.municipalRegistration","MUNICIPAL_REGISTRATION_MISSING","Inscrição Municipal do prestador não foi informada.");
  }

  if (payload.kind === "NFCE" || payload.kind === "NFE") {
    if (!payload.items?.length) error("items","ITEMS_REQUIRED","Inclua ao menos um item de mercadoria.");
    payload.items?.forEach((item,index) => {
      const prefix = `items.${index}`;
      if (!item.description?.trim()) error(`${prefix}.description`,"ITEM_DESCRIPTION_REQUIRED",`Item ${index+1}: descrição obrigatória.`);
      if (!(Number(item.quantity) > 0)) error(`${prefix}.quantity`,"ITEM_QUANTITY_INVALID",`Item ${index+1}: quantidade inválida.`);
      if (!(Number(item.unitValue) >= 0)) error(`${prefix}.unitValue`,"ITEM_VALUE_INVALID",`Item ${index+1}: valor unitário inválido.`);
      if (digits(item.ncm).length !== 8) error(`${prefix}.ncm`,"NCM_REQUIRED",`Item ${index+1}: NCM deve possuir 8 dígitos.`);
      if (digits(item.cfop).length !== 4) error(`${prefix}.cfop`,"CFOP_REQUIRED",`Item ${index+1}: CFOP deve possuir 4 dígitos.`);
      if (!item.cst?.trim() && !item.csosn?.trim()) error(`${prefix}.taxSituation`,"CST_CSOSN_REQUIRED",`Item ${index+1}: informe CST ou CSOSN conforme o regime tributário.`);
    });
    if (!payload.company?.stateRegistration?.trim()) warning("company.stateRegistration","STATE_REGISTRATION_MISSING","Inscrição Estadual do emitente não foi informada.");
  }

  if (payload.kind === "NFCE") {
    if (!payload.config?.csc?.trim()) error("config.csc","CSC_REQUIRED","CSC da NFC-e não está configurado.");
    if (!payload.config?.cscId?.trim()) error("config.cscId","CSC_ID_REQUIRED","ID do CSC da NFC-e não está configurado.");
  }

  return {
    valid: !issues.some(issue => issue.severity === "error"),
    issues,
    errors: issues.filter(issue => issue.severity === "error").length,
    warnings: issues.filter(issue => issue.severity === "warning").length,
  };
}
