import type { FiscalDocumentKind, FiscalValidationPayload } from "./fiscal-validation";

export type FiscalEnvironment = "Homologação" | "Produção";

export type FiscalAuthorityRoute = {
  documentKind: FiscalDocumentKind;
  authority: "PREFEITURA_MIRASSOL" | "SEFAZ_SP";
  provider: "GOVBR_CIDADE360" | "SEFAZ_SP";
  municipalityCode?: string;
  state?: string;
  environment: FiscalEnvironment;
  protocolVersion: string;
  endpoint: string;
  operations: string[];
  notes?: string[];
};

const MIRASSOL_IBGE = "3530300";

const nfeEndpoints = {
  "Homologação": "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
  "Produção": "https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx",
} as const;

const nfceEndpoints = {
  "Homologação": "https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx",
  "Produção": "https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx",
} as const;

const nfseMirassolEndpoints = {
  "Homologação": String(process.env.PROAR_NFSE_MIRASSOL_HOMOLOG_URL || "https://webapp1-mirassol.cidade360.cloud/NFSe.Api/NotaNacional"),
  "Produção": String(process.env.PROAR_NFSE_MIRASSOL_PROD_URL || "https://webapp1-mirassol.cidade360.cloud/NFSe.Api/NotaNacional"),
} as const;

function environment(value: unknown): FiscalEnvironment {
  return /prod/i.test(String(value ?? "")) ? "Produção" : "Homologação";
}

export function resolveFiscalRoute(payload: FiscalValidationPayload): FiscalAuthorityRoute {
  const env = environment(payload.config?.environment);

  if (payload.kind === "NFSE") {
    const municipalityCode = String(payload.service?.municipalityCode || "").replace(/\D/g, "");
    const issuerCity = String(payload.company?.city || "").trim().toLowerCase();
    const issuerState = String(payload.company?.state || "").trim().toUpperCase();

    const isMirassol = municipalityCode === MIRASSOL_IBGE || (issuerCity === "mirassol" && issuerState === "SP");
    if (!isMirassol) {
      throw new Error("NFSE_MUNICIPALITY_NOT_CONFIGURED");
    }

    return {
      documentKind: "NFSE",
      authority: "PREFEITURA_MIRASSOL",
      provider: "GOVBR_CIDADE360",
      municipalityCode: MIRASSOL_IBGE,
      state: "SP",
      environment: env,
      protocolVersion: "NFS-e Padrão Nacional / GOVBR ISS Digital",
      endpoint: nfseMirassolEndpoints[env],
      operations: ["authorize", "consult", "cancel", "replace", "xml", "danfse"],
      notes: [
        "Emissão via ISS Digital/GOVBR Cidade360 da Prefeitura de Mirassol.",
        "O endpoint de homologação pode ser sobrescrito por PROAR_NFSE_MIRASSOL_HOMOLOG_URL.",
      ],
    };
  }

  if (payload.kind === "NFCE") {
    return {
      documentKind: "NFCE",
      authority: "SEFAZ_SP",
      provider: "SEFAZ_SP",
      state: "SP",
      environment: env,
      protocolVersion: "NFC-e modelo 65 / leiaute 4.00",
      endpoint: nfceEndpoints[env],
      operations: ["authorize", "receipt", "consult", "cancel", "inutilization", "events", "xml", "danfce", "contingency"],
    };
  }

  return {
    documentKind: "NFE",
    authority: "SEFAZ_SP",
    provider: "SEFAZ_SP",
    state: "SP",
    environment: env,
    protocolVersion: "NF-e modelo 55 / leiaute 4.00",
    endpoint: nfeEndpoints[env],
    operations: ["authorize", "receipt", "consult", "cancel", "inutilization", "events", "xml", "danfe", "svc-an"],
  };
}

export function publicFiscalRoutes(environmentValue: unknown = "Homologação") {
  const env = environment(environmentValue);
  return [
    {
      documentKind: "NFSE",
      authority: "Prefeitura de Mirassol",
      provider: "GOVBR/Cidade360 - ISS Digital",
      municipalityCode: MIRASSOL_IBGE,
      environment: env,
      protocolVersion: "NFS-e Padrão Nacional",
      endpoint: nfseMirassolEndpoints[env],
      operations: ["Emissão", "Consulta", "Cancelamento", "Substituição", "XML", "DANFSe"],
    },
    {
      documentKind: "NFCE",
      authority: "SEFAZ-SP",
      provider: "SEFAZ-SP",
      model: "65",
      environment: env,
      protocolVersion: "4.00",
      endpoint: nfceEndpoints[env],
      operations: ["Emissão", "Consulta", "Cancelamento", "Inutilização", "Eventos", "XML", "DANFCe", "Contingência"],
    },
    {
      documentKind: "NFE",
      authority: "SEFAZ-SP",
      provider: "SEFAZ-SP",
      model: "55",
      environment: env,
      protocolVersion: "4.00",
      endpoint: nfeEndpoints[env],
      operations: ["Emissão", "Consulta", "Cancelamento", "Inutilização", "Eventos", "XML", "DANFE", "SVC-AN"],
    },
  ];
}
