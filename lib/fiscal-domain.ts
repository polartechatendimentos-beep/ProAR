export type FiscalPayment = {
  id?: string;
  method: string;
  amount: number;
  receiverDocument?: string;
  institutionDocument?: string;
  authorizationCode?: string;
  nsu?: string;
  cardBrand?: string;
  installments?: number;
  dueDate?: string;
};

export type FiscalAddress = {
  name?: string;
  document?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  cityCode?: string;
  state?: string;
  countryCode?: string;
};

export type FiscalTransport = {
  carrierDocument?: string;
  carrierName?: string;
  carrierStateRegistration?: string;
  rntrc?: string;
  vehiclePlate?: string;
  vehicleState?: string;
  volumeQuantity?: number;
  volumeSpecies?: string;
  volumeBrand?: string;
  volumeNumbering?: string;
  netWeight?: number;
  grossWeight?: number;
};

export type FiscalRetention = {
  iss?: number;
  inss?: number;
  ir?: number;
  csll?: number;
  pis?: number;
  cofins?: number;
  issResponsible?: "prestador" | "tomador" | "intermediario";
};

export type FiscalConstruction = {
  cno?: string;
  workCode?: string;
  artRrt?: string;
  address?: FiscalAddress;
};

export type FiscalParty = {
  document?: string;
  name?: string;
  municipalRegistration?: string;
  email?: string;
  address?: FiscalAddress;
};

export type FiscalTaxDetail = {
  base?: number;
  rate?: number;
  value?: number;
};

export type FiscalItemTax = {
  icms?: FiscalTaxDetail;
  icmsSt?: FiscalTaxDetail;
  fcp?: FiscalTaxDetail;
  difalDestination?: FiscalTaxDetail;
  ipi?: FiscalTaxDetail;
  pis?: FiscalTaxDetail;
  cofins?: FiscalTaxDetail;
  ibs?: FiscalTaxDetail;
  cbs?: FiscalTaxDetail;
};

export type FiscalTotals = {
  products: number;
  services: number;
  gross: number;
  discounts: number;
  freight: number;
  insurance: number;
  otherExpenses: number;
  taxes: Record<string, number>;
  withheld: number;
  payments: number;
  change: number;
  net: number;
};

const num = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateTax(base: unknown, rate: unknown, suppliedValue?: unknown) {
  const explicit = num(suppliedValue);
  if (suppliedValue !== undefined && suppliedValue !== null && suppliedValue !== "") return round2(explicit);
  return round2(num(base) * num(rate) / 100);
}

/**
 * Calcula somente valores matemáticos a partir das bases/alíquotas explicitamente informadas.
 * Não escolhe alíquota, CST, CFOP ou enquadramento tributário.
 */
export function calculateFiscalTotals(input: {
  items?: Array<{ kind?: string; quantity?: number; unitValue?: number; discount?: number; taxes?: FiscalItemTax }>;
  freight?: number;
  insurance?: number;
  otherExpenses?: number;
  retentions?: FiscalRetention;
  payments?: FiscalPayment[];
  change?: number;
}): FiscalTotals {
  let products = 0;
  let services = 0;
  let discounts = 0;
  const taxes: Record<string, number> = {
    icms: 0, icmsSt: 0, fcp: 0, difalDestination: 0, ipi: 0, pis: 0, cofins: 0, ibs: 0, cbs: 0,
  };

  for (const item of input.items ?? []) {
    const line = round2(num(item.quantity) * num(item.unitValue));
    if (/serv/i.test(String(item.kind || ""))) services += line;
    else products += line;
    discounts += num(item.discount);
    for (const name of Object.keys(taxes) as Array<keyof FiscalItemTax>) {
      const detail = item.taxes?.[name];
      if (detail) taxes[name] += calculateTax(detail.base ?? line, detail.rate, detail.value);
    }
  }

  products = round2(products);
  services = round2(services);
  discounts = round2(discounts);
  for (const key of Object.keys(taxes)) taxes[key] = round2(taxes[key]);

  const freight = round2(num(input.freight));
  const insurance = round2(num(input.insurance));
  const otherExpenses = round2(num(input.otherExpenses));
  const gross = round2(products + services);
  const withheld = round2(Object.entries(input.retentions ?? {}).reduce((sum, [key, value]) =>
    key === "issResponsible" ? sum : sum + num(value), 0));
  const payments = round2((input.payments ?? []).reduce((sum, payment) => sum + num(payment.amount), 0));
  const change = round2(num(input.change));
  const taxTotal = Object.values(taxes).reduce((sum, value) => sum + value, 0);
  const net = round2(gross - discounts + freight + insurance + otherExpenses + taxTotal - withheld);

  return { products, services, gross, discounts, freight, insurance, otherExpenses, taxes, withheld, payments, change, net };
}
