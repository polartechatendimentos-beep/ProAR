export type FiscalDocumentKind = "NFSE" | "NFCE" | "NFE";

export type FiscalValidationIssue = {
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type FiscalItemPayload = {
  description?: string;
  quantity?: number;
  unitValue?: number;
  unitOfMeasure?: string;
  ncm?: string;
  cfop?: string;
  cest?: string;
  gtin?: string;
  fiscalOrigin?: string;
  icmsCst?: string;
  csosn?: string;
  pisCst?: string;
  cofinsCst?: string;
  fiscalBenefitCode?: string;
  ibsCbsCst?: string;
  ibsCbsClassCode?: string;
  serviceCode?: string;
  nbs?: string;
  issRate?: number | string;
  issWithheld?: boolean;
};

export type FiscalValidationPayload = {
  kind: FiscalDocumentKind;
  issueDate?: string;
  operationNature?: string;
  purpose?: string;
  operationDirection?: "0" | "1";
  destinationIndicator?: "1" | "2" | "3";
  finalConsumer?: boolean;
  presenceIndicator?: string;
  freightMode?: string;
  paymentMethod?: string;
  debitNoteType?: string;
  creditNoteType?: string;
  referencedDocuments?: Array<{
    type?: "NFE" | "NFCE" | "CTE" | "ECF" | "OTHER";
    accessKey?: string;
    number?: string;
    series?: string;
    issueDate?: string;
  }>;
  nfsePurpose?: "0" | "1" | "2";
  nfseFinalConsumer?: boolean;
  nfseOperationIndicator?: string;
  nfsePeopleIndicator?: "0" | "1" | "2" | "3" | "4";
  customer?: {
    document?: string;
    name?: string;
    address?: string;
    zipCode?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    stateRegistration?: string;
    stateRegistrationIndicator?: "1" | "2" | "9";
    municipalRegistration?: string;
  };
  service?: {
    description?: string;
    value?: number;
    serviceCode?: string;
    nbs?: string;
    issRate?: number | string;
    municipalityCode?: string;
    taxationLocation?: string;
  };
  items?: FiscalItemPayload[];
  company?: {
    document?: string;
    name?: string;
    city?: string;
    state?: string;
    stateRegistration?: string;
    municipalRegistration?: string;
    taxRegime?: string;
  };
  config?: {
    environment?: string;
    certificateConfigured?: boolean;
    certificateValidTo?: string;
    nfeSeries?: string;
    nfceSeries?: string;
    cscConfigured?: boolean;
    cscId?: string;
    nfseSeries?: string;
    nfseServiceCode?: string;
    nfseIssRate?: number | string;
  };
};

const clean = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => clean(value).replace(/\D/g, "");
const alphaNum = (value: unknown) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const numeric = (value: unknown) => Number(clean(value).replace(",", "."));
const isSimple = (value: unknown) => /simples/i.test(clean(value));
const issueDate = (payload: FiscalValidationPayload) => clean(payload.issueDate) || new Date().toISOString().slice(0, 10);
const usesRtcNfeFields = (payload: FiscalValidationPayload) =>
  (payload.kind === "NFE" || payload.kind === "NFCE") && issueDate(payload) >= "2026-08-03";

function validCompanyDocument(value: unknown) {
  return /^[A-Z0-9]{12}[0-9]{2}$/.test(alphaNum(value));
}

function validCustomerDocument(value: unknown) {
  const doc = alphaNum(value);
  return /^\d{11}$/.test(doc) || /^[A-Z0-9]{12}[0-9]{2}$/.test(doc);
}

export function validateFiscalPayload(payload: FiscalValidationPayload) {
  const issues: FiscalValidationIssue[] = [];
  const push = (severity: "error" | "warning", field: string, code: string, message: string) =>
    issues.push({ field, code, message, severity });
  const error = (field: string, code: string, message: string) => push("error", field, code, message);
  const warning = (field: string, code: string, message: string) => push("warning", field, code, message);

  if (!payload.kind) error("kind", "DOCUMENT_TYPE_REQUIRED", "Informe o tipo de documento fiscal.");
  if (!payload.issueDate) error("issueDate", "ISSUE_DATE_REQUIRED", "Data de emissão é obrigatória.");
  if (!payload.operationNature?.trim()) error("operationNature", "OPERATION_NATURE_REQUIRED", "Natureza da operação é obrigatória.");

  if (!validCompanyDocument(payload.company?.document)) error("company.document", "ISSUER_DOCUMENT_INVALID", "CNPJ do emitente deve possuir 14 posições válidas para o leiaute atual.");
  if (!payload.company?.name?.trim()) error("company.name", "ISSUER_NAME_REQUIRED", "Razão social do emitente é obrigatória.");
  if (!payload.company?.city?.trim()) error("company.city", "ISSUER_CITY_REQUIRED", "Município do emitente é obrigatório.");
  if (!payload.company?.state?.trim()) error("company.state", "ISSUER_STATE_REQUIRED", "UF do emitente é obrigatória.");
  if (!payload.company?.taxRegime?.trim()) error("company.taxRegime", "TAX_REGIME_REQUIRED", "Regime tributário/CRT da empresa não está configurado.");
  if (!payload.config?.environment?.trim()) error("config.environment", "ENVIRONMENT_REQUIRED", "Ambiente fiscal não está configurado.");

  if (payload.kind !== "NFSE") {
    if (!payload.config?.certificateConfigured) error("config.certificate", "CERTIFICATE_REQUIRED", "Certificado digital A1 não está configurado.");
    if (payload.config?.certificateValidTo && new Date(payload.config.certificateValidTo).getTime() <= Date.now()) {
      error("config.certificateValidTo", "CERTIFICATE_EXPIRED", "Certificado digital A1 está vencido.");
    }
    if (!payload.company?.stateRegistration?.trim()) warning("company.stateRegistration", "STATE_REGISTRATION_MISSING", "Inscrição Estadual do emitente não foi informada.");
    if (!payload.items?.length) error("items", "ITEMS_REQUIRED", "Inclua ao menos um item de mercadoria.");
  }

  if (payload.kind === "NFE") {
    if (!payload.config?.nfeSeries?.trim()) error("config.nfeSeries", "NFE_SERIES_REQUIRED", "Série da NF-e não está configurada.");
    if (!payload.customer) error("customer", "CUSTOMER_REQUIRED", "Destinatário é obrigatório para NF-e.");
    if (!payload.freightMode?.trim()) error("freightMode", "FREIGHT_MODE_REQUIRED", "Modalidade do frete deve ser informada na NF-e.");
    if (!/^[1-6]$/.test(clean(payload.purpose))) error("purpose", "NFE_PURPOSE_REQUIRED", "Finalidade da NF-e deve ser Normal, Complementar, Ajuste, Devolução/Retorno, Nota de Crédito ou Nota de Débito.");
    if (!/^[01]$/.test(clean(payload.operationDirection))) error("operationDirection", "NFE_DIRECTION_REQUIRED", "Informe se a NF-e é de entrada ou saída.");
    if (!/^[123]$/.test(clean(payload.destinationIndicator))) error("destinationIndicator", "NFE_DESTINATION_REQUIRED", "Informe se a operação é interna, interestadual ou com exterior.");
    if (typeof payload.finalConsumer !== "boolean") error("finalConsumer", "FINAL_CONSUMER_REQUIRED", "Informe se o destinatário é consumidor final.");

    const purpose = clean(payload.purpose);
    const refs = payload.referencedDocuments ?? [];
    if ((purpose === "2" || purpose === "4") && !refs.length) {
      error("referencedDocuments", "REFERENCED_DOCUMENT_REQUIRED", "NF-e complementar ou de devolução/retorno deve informar o documento fiscal de origem/referência.");
    }
    if ((purpose === "3" || purpose === "5" || purpose === "6") && !refs.length) {
      warning("referencedDocuments", "REFERENCED_DOCUMENT_REVIEW", "Revise a necessidade de documento fiscal referenciado para esta finalidade.");
    }
    if (purpose === "6" && !payload.debitNoteType?.trim()) error("debitNoteType", "DEBIT_NOTE_TYPE_REQUIRED", "Informe o tipo da Nota de Débito.");
    if (purpose === "5" && !payload.creditNoteType?.trim()) warning("creditNoteType", "CREDIT_NOTE_TYPE_REVIEW", "Revise o tipo/motivo da Nota de Crédito conforme o leiaute vigente.");

    refs.forEach((ref, index) => {
      if ((ref.type === "NFE" || ref.type === "NFCE") && digits(ref.accessKey).length !== 44) {
        error(`referencedDocuments.${index}.accessKey`, "REFERENCED_KEY_INVALID", `Documento referenciado ${index + 1}: chave de acesso deve possuir 44 dígitos.`);
      }
    });
  }

  if (payload.kind === "NFCE") {
    if (!payload.config?.nfceSeries?.trim()) error("config.nfceSeries", "NFCE_SERIES_REQUIRED", "Série da NFC-e não está configurada.");
    if (!payload.config?.cscConfigured) error("config.csc", "CSC_REQUIRED", "CSC da NFC-e não está configurado.");
    if (!payload.config?.cscId?.trim()) error("config.cscId", "CSC_ID_REQUIRED", "ID do CSC da NFC-e não está configurado.");
    if (!payload.paymentMethod?.trim()) error("paymentMethod", "PAYMENT_METHOD_REQUIRED", "Forma de pagamento é obrigatória na NFC-e.");
    if (!payload.presenceIndicator?.trim()) error("presenceIndicator", "PRESENCE_REQUIRED", "Indicador de presença do comprador é obrigatório na NFC-e.");
    if (payload.finalConsumer !== true) error("finalConsumer", "NFCE_FINAL_CONSUMER_REQUIRED", "NFC-e deve representar operação com consumidor final.");
    if (payload.destinationIndicator && payload.destinationIndicator !== "1") error("destinationIndicator", "NFCE_INTERNAL_OPERATION_REQUIRED", "NFC-e deve ser usada em operação interna.");
    if (payload.operationDirection && payload.operationDirection !== "1") error("operationDirection", "NFCE_OUTPUT_REQUIRED", "NFC-e deve ser emitida como operação de saída.");
  }

  if (payload.customer) {
    if (payload.customer.document && !validCustomerDocument(payload.customer.document)) {
      error("customer.document", "CUSTOMER_DOCUMENT_INVALID", "CPF/CNPJ do destinatário está inválido ou incompleto.");
    }
    if (payload.kind === "NFE") {
      if (!payload.customer.name?.trim()) error("customer.name", "CUSTOMER_NAME_REQUIRED", "Nome/razão social do destinatário é obrigatório.");
      if (!payload.customer.zipCode?.trim()) error("customer.zipCode", "CUSTOMER_ZIP_REQUIRED", "CEP do destinatário é obrigatório.");
      if (!payload.customer.street?.trim()) error("customer.street", "CUSTOMER_STREET_REQUIRED", "Logradouro do destinatário é obrigatório.");
      if (!payload.customer.number?.trim()) error("customer.number", "CUSTOMER_NUMBER_REQUIRED", "Número do endereço do destinatário é obrigatório.");
      if (!payload.customer.neighborhood?.trim()) error("customer.neighborhood", "CUSTOMER_NEIGHBORHOOD_REQUIRED", "Bairro do destinatário é obrigatório.");
      if (!payload.customer.city?.trim()) error("customer.city", "CUSTOMER_CITY_REQUIRED", "Município do destinatário é obrigatório.");
      if (!payload.customer.state?.trim()) error("customer.state", "CUSTOMER_STATE_REQUIRED", "UF do destinatário é obrigatória.");
      if (!payload.customer.stateRegistrationIndicator) error("customer.stateRegistrationIndicator", "IE_INDICATOR_REQUIRED", "Indicador de IE do destinatário deve ser informado.");
      if (payload.customer.stateRegistrationIndicator === "1" && !payload.customer.stateRegistration?.trim()) {
        error("customer.stateRegistration", "CUSTOMER_IE_REQUIRED", "IE do destinatário contribuinte é obrigatória.");
      }
    }
  }

  payload.items?.forEach((item, index) => {
    const prefix = `items.${index}`;
    if (!item.description?.trim()) error(`${prefix}.description`, "ITEM_DESCRIPTION_REQUIRED", `Item ${index + 1}: descrição obrigatória.`);
    if (!(Number(item.quantity) > 0)) error(`${prefix}.quantity`, "ITEM_QUANTITY_INVALID", `Item ${index + 1}: quantidade inválida.`);
    if (!(Number(item.unitValue) >= 0)) error(`${prefix}.unitValue`, "ITEM_VALUE_INVALID", `Item ${index + 1}: valor unitário inválido.`);
    if (digits(item.ncm).length !== 8) error(`${prefix}.ncm`, "NCM_REQUIRED", `Item ${index + 1}: NCM deve possuir 8 dígitos.`);
    if (digits(item.cfop).length !== 4) error(`${prefix}.cfop`, "CFOP_REQUIRED", `Item ${index + 1}: CFOP deve possuir 4 dígitos.`);
    if (!item.unitOfMeasure?.trim()) error(`${prefix}.unitOfMeasure`, "UNIT_REQUIRED", `Item ${index + 1}: unidade comercial/tributável é obrigatória.`);
    if (!/^[0-8]$/.test(clean(item.fiscalOrigin))) error(`${prefix}.fiscalOrigin`, "ORIGIN_REQUIRED", `Item ${index + 1}: origem da mercadoria deve estar entre 0 e 8.`);

    if (isSimple(payload.company?.taxRegime)) {
      if (!/^\d{3}$/.test(digits(item.csosn))) error(`${prefix}.csosn`, "CSOSN_REQUIRED", `Item ${index + 1}: CSOSN deve ser informado para o Simples Nacional.`);
    } else if (!/^\d{2}$/.test(digits(item.icmsCst))) {
      error(`${prefix}.icmsCst`, "ICMS_CST_REQUIRED", `Item ${index + 1}: CST do ICMS deve ser informado.`);
    }

    if (!/^\d{2}$/.test(digits(item.pisCst))) error(`${prefix}.pisCst`, "PIS_CST_REQUIRED", `Item ${index + 1}: CST do PIS deve ser informado.`);
    if (!/^\d{2}$/.test(digits(item.cofinsCst))) error(`${prefix}.cofinsCst`, "COFINS_CST_REQUIRED", `Item ${index + 1}: CST da COFINS deve ser informado.`);

    const stCode = digits(item.csosn || item.icmsCst);
    if (/^(10|30|60|70|201|202|203|500)$/.test(stCode) && digits(item.cest).length !== 7) {
      warning(`${prefix}.cest`, "CEST_REVIEW", `Item ${index + 1}: operação com ST; informe/revise CEST quando aplicável.`);
    }
    if (item.gtin && clean(item.gtin).toUpperCase() !== "SEM GTIN" && !/^\d{8,14}$/.test(digits(item.gtin))) {
      error(`${prefix}.gtin`, "GTIN_INVALID", `Item ${index + 1}: GTIN/EAN deve ter 8 a 14 dígitos ou SEM GTIN.`);
    }
    if (usesRtcNfeFields(payload)) {
      if (!item.ibsCbsCst?.trim()) error(`${prefix}.ibsCbsCst`, "IBSCBS_CST_REQUIRED", `Item ${index + 1}: CST de IBS/CBS é obrigatório no leiaute RTC vigente.`);
      if (!item.ibsCbsClassCode?.trim()) error(`${prefix}.ibsCbsClassCode`, "IBSCBS_CLASS_REQUIRED", `Item ${index + 1}: classificação tributária IBS/CBS é obrigatória no leiaute RTC vigente.`);
    }
  });

  if (payload.kind === "NFSE") {
    if (!payload.company?.municipalRegistration?.trim()) error("company.municipalRegistration", "MUNICIPAL_REGISTRATION_REQUIRED", "Inscrição Municipal do prestador não foi informada.");
    if (!/^[012]$/.test(clean(payload.nfsePurpose))) error("nfsePurpose", "NFSE_PURPOSE_REQUIRED", "Informe a finalidade da NFS-e: Regular, Crédito ou Débito.");
    if (typeof payload.nfseFinalConsumer !== "boolean") error("nfseFinalConsumer", "NFSE_FINAL_CONSUMER_REQUIRED", "Informe se a operação da NFS-e é de uso ou consumo pessoal.");
    if (!/^\d{6}$/.test(digits(payload.nfseOperationIndicator))) error("nfseOperationIndicator", "NFSE_OPERATION_INDICATOR_REQUIRED", "Informe o cIndOp de 6 dígitos conforme a tabela vigente do padrão nacional.");
    if (!/^[0-4]$/.test(clean(payload.nfsePeopleIndicator))) error("nfsePeopleIndicator", "NFSE_PEOPLE_INDICATOR_REQUIRED", "Informe a relação entre tomador, adquirente e destinatário (indPessoas).");
    if (!payload.config?.nfseSeries?.trim()) error("config.nfseSeries", "NFSE_SERIES_REQUIRED", "Série RPS/DPS da NFS-e não está configurada.");
    if (!payload.service?.description?.trim()) error("service.description", "SERVICE_DESCRIPTION_REQUIRED", "Descrição do serviço é obrigatória.");
    if (!(Number(payload.service?.value) > 0)) error("service.value", "SERVICE_VALUE_INVALID", "Valor do serviço deve ser maior que zero.");
    if (!(payload.service?.serviceCode || payload.config?.nfseServiceCode)?.trim()) error("service.serviceCode", "SERVICE_CODE_REQUIRED", "Código do serviço municipal/nacional não foi informado.");
    if (!payload.service?.municipalityCode?.trim()) error("service.municipalityCode", "SERVICE_CITY_CODE_REQUIRED", "Código IBGE do município de incidência/prestação é obrigatório.");
    if (!payload.service?.taxationLocation?.trim()) error("service.taxationLocation", "SERVICE_TAXATION_LOCATION_REQUIRED", "Local de incidência tributária do serviço deve ser informado.");
    const rate = numeric(payload.service?.issRate ?? payload.config?.nfseIssRate);
    if (!(rate >= 0)) error("service.issRate", "ISS_RATE_INVALID", "Alíquota de ISS inválida.");
    if (isSimple(payload.company?.taxRegime) && issueDate(payload) >= "2026-11-01") {
      warning("config.nfseNational", "NFSE_NATIONAL_REQUIRED", "Para ME/EPP do Simples Nacional, a emissão deve usar o padrão nacional a partir de 01/11/2026.");
    }
  }

  return {
    valid: !issues.some(issue => issue.severity === "error"),
    checkedAt: new Date().toISOString(),
    ruleset: "ProAR Fiscal 2026.10 / NF-e-NFC-e RTC / NFS-e Nacional NT009 v1.01",
    issues,
    errors: issues.filter(issue => issue.severity === "error").length,
    warnings: issues.filter(issue => issue.severity === "warning").length,
  };
}
