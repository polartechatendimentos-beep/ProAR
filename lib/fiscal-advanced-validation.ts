import type { FiscalAddress, FiscalConstruction, FiscalPayment, FiscalRetention, FiscalTransport } from "./fiscal-domain";

export type AdvancedFiscalIssue = {
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

type AdvancedPayload = {
  kind?: string;
  finalConsumer?: boolean;
  destinationIndicator?: string;
  presenceIndicator?: string;
  freightMode?: string;
  totalValue?: number;
  payments?: FiscalPayment[];
  change?: number;
  transport?: FiscalTransport;
  pickupAddress?: FiscalAddress;
  deliveryAddress?: FiscalAddress;
  retentions?: FiscalRetention;
  construction?: FiscalConstruction;
  service?: { value?: number; issWithheld?: boolean };
  customer?: { document?: string; stateRegistrationIndicator?: string; stateRegistration?: string; countryCode?: string; foreignId?: string };
  intermediary?: { document?: string; name?: string };
  acquirer?: { document?: string; name?: string };
  recipient?: { document?: string; name?: string };
  nfsePeopleIndicator?: string;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

function addressIssues(prefix: string, address: FiscalAddress | undefined, required: boolean, out: AdvancedFiscalIssue[]) {
  if (!address) {
    if (required) out.push({ field: prefix, code: "ADDRESS_REQUIRED", message: "Endereço obrigatório para este cenário.", severity: "error" });
    return;
  }
  for (const [key,label] of [["street","logradouro"],["number","número"],["neighborhood","bairro"],["city","município"],["state","UF"]] as const) {
    if (!text(address[key])) out.push({ field: `${prefix}.${key}`, code: "ADDRESS_FIELD_REQUIRED", message: `Informe ${label}.`, severity: "error" });
  }
  if (address.zipCode && digits(address.zipCode).length !== 8) out.push({ field: `${prefix}.zipCode`, code: "ZIP_INVALID", message: "CEP deve possuir 8 dígitos.", severity: "error" });
}

export function validateAdvancedFiscalPayload(payload: AdvancedPayload): AdvancedFiscalIssue[] {
  const issues: AdvancedFiscalIssue[] = [];
  const error = (field: string, code: string, message: string) => issues.push({ field, code, message, severity: "error" });
  const warning = (field: string, code: string, message: string) => issues.push({ field, code, message, severity: "warning" });

  if (payload.kind === "NFE" || payload.kind === "NFCE") {
    if (payload.customer?.stateRegistrationIndicator === "1" && !text(payload.customer.stateRegistration)) {
      error("customer.stateRegistration", "CUSTOMER_IE_REQUIRED", "Destinatário contribuinte exige Inscrição Estadual.");
    }
    if (payload.destinationIndicator === "3") {
      if (!text(payload.customer?.countryCode)) error("customer.countryCode", "COUNTRY_REQUIRED", "Operação com exterior exige código do país.");
      if (!text(payload.customer?.foreignId)) warning("customer.foreignId", "FOREIGN_ID_REVIEW", "Revise a identificação do destinatário no exterior.");
    }
    if (payload.presenceIndicator === "5" && !payload.deliveryAddress) {
      warning("deliveryAddress", "OFFSITE_DELIVERY_REVIEW", "Operação fora do estabelecimento: revise município de consumo e endereço de entrega.");
    }

    if (payload.freightMode && payload.freightMode !== "9") {
      if (!text(payload.transport?.carrierName)) error("transport.carrierName", "CARRIER_NAME_REQUIRED", "Informe a transportadora quando houver frete.");
      if (!text(payload.transport?.carrierDocument)) error("transport.carrierDocument", "CARRIER_DOCUMENT_REQUIRED", "Informe CPF/CNPJ da transportadora.");
    }
    if (payload.transport?.carrierDocument && ![11,14].includes(digits(payload.transport.carrierDocument).length)) {
      error("transport.carrierDocument", "CARRIER_DOCUMENT_INVALID", "CPF/CNPJ da transportadora está inválido.");
    }
    if (payload.transport?.vehiclePlate && !/^[A-Z0-9]{7}$/i.test(text(payload.transport.vehiclePlate).replace(/[^A-Z0-9]/gi,""))) {
      error("transport.vehiclePlate", "VEHICLE_PLATE_INVALID", "Placa do veículo deve possuir 7 caracteres.");
    }
    if (num(payload.transport?.grossWeight) < num(payload.transport?.netWeight)) {
      error("transport.grossWeight", "WEIGHT_INCONSISTENT", "Peso bruto não pode ser menor que o peso líquido.");
    }

    if (payload.pickupAddress) addressIssues("pickupAddress", payload.pickupAddress, true, issues);
    if (payload.deliveryAddress) addressIssues("deliveryAddress", payload.deliveryAddress, true, issues);

    const payments = payload.payments ?? [];
    if (payload.kind === "NFCE" && !payments.length) error("payments", "PAYMENTS_REQUIRED", "NFC-e exige detalhamento do pagamento.");
    if (payments.length) {
      let paid = 0;
      payments.forEach((payment,index) => {
        if (!text(payment.method)) error(`payments.${index}.method`, "PAYMENT_METHOD_REQUIRED", `Pagamento ${index+1}: informe o meio de pagamento.`);
        if (!(num(payment.amount) >= 0)) error(`payments.${index}.amount`, "PAYMENT_AMOUNT_INVALID", `Pagamento ${index+1}: valor inválido.`);
        paid += num(payment.amount);
        if (/03|04|cart/i.test(payment.method) && !text(payment.authorizationCode) && !text(payment.nsu)) {
          warning(`payments.${index}.authorizationCode`, "CARD_AUTH_REVIEW", `Pagamento ${index+1}: registre autorização/NSU quando disponível.`);
        }
      });
      const total = num(payload.totalValue);
      const change = num(payload.change);
      if (total > 0 && Math.abs((paid - change) - total) > 0.01) {
        warning("payments", "PAYMENT_TOTAL_MISMATCH", "A soma dos pagamentos menos o troco difere do total informado da nota.");
      }
    }
  }

  if (payload.kind === "NFSE") {
    const retained = payload.retentions ?? {};
    for (const [key,value] of Object.entries(retained)) {
      if (key === "issResponsible") continue;
      if (num(value) < 0) error(`retentions.${key}`, "RETENTION_NEGATIVE", "Valor de retenção não pode ser negativo.");
    }
    if (payload.service?.issWithheld && !retained.issResponsible) {
      error("retentions.issResponsible", "ISS_RESPONSIBLE_REQUIRED", "ISS retido exige identificação do responsável pela retenção.");
    }
    if (payload.construction?.cno && digits(payload.construction.cno).length !== 12) {
      error("construction.cno", "CNO_INVALID", "CNO deve possuir 12 dígitos.");
    }
    if (payload.construction?.address) addressIssues("construction.address", payload.construction.address, true, issues);

    const people = payload.nfsePeopleIndicator;
    if (people && people !== "0") {
      if ((people === "2" || people === "4") && !text(payload.acquirer?.document)) error("acquirer.document", "ACQUIRER_REQUIRED", "Informe o adquirente distinto do tomador.");
      if ((people === "1" || people === "4") && !text(payload.recipient?.document)) error("recipient.document", "RECIPIENT_REQUIRED", "Informe o destinatário distinto do tomador/adquirente.");
      if (people === "3" && !text(payload.acquirer?.document)) error("acquirer.document", "ACQUIRER_REQUIRED", "Informe o adquirente distinto.");
    }
    if (payload.intermediary && !text(payload.intermediary.document)) {
      error("intermediary.document", "INTERMEDIARY_DOCUMENT_REQUIRED", "Intermediário informado exige CPF/CNPJ.");
    }
  }

  return issues;
}
