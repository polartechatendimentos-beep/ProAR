import { NextResponse } from "next/server";
import { readSession } from "@/lib/proar-auth";
import { getEffectiveCompanyId } from "@/lib/company-access";

const text = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
const digits = (value: unknown) => text(value).replace(/\D/g, "");
const objectValue = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};

function parsePncpControlNumber(value: unknown) {
  const normalized = text(value).replace(/\s+/g, "");
  const match = normalized.match(/^(\d{14})-\d-([0-9]+)\/(\d{4})$/);
  if (!match) return null;
  return {
    cnpj: match[1],
    sequencialCompra: match[2],
    anoCompra: match[3],
  };
}

function normalizeDocument(raw: unknown, index: number) {
  const item = objectValue(raw);
  const url = text(
    item.urlArquivo ||
    item.url ||
    item.link ||
    item.uri ||
    item.downloadUrl
  );
  if (!url) return null;
  return {
    id: text(item.idDocumento || item.id || `${index + 1}`),
    tipo: text(item.tipoDocumento || item.tipo || item.categoria) || "Documento",
    titulo: text(item.titulo || item.nomeArquivo || item.nome || item.descricao) || `Documento ${index + 1}`,
    descricao: text(item.descricao || item.observacao) || undefined,
    dataPublicacao: text(item.dataPublicacao || item.dataInclusao || item.dataGeracao) || undefined,
    url,
  };
}

function extractDocuments(payload: unknown) {
  const root = objectValue(payload);
  const collections = [
    root.documentos,
    root.anexos,
    root.arquivos,
    objectValue(root.resultado).documentos,
    objectValue(root.resultado).anexos,
    objectValue(root.resultado).arquivos,
  ];

  return collections.flatMap((collection) => {
    if (!Array.isArray(collection)) return [];
    return collection.map(normalizeDocument).filter(Boolean);
  });
}

function isValidCnpj(value: string) {
  return /^\d{14}$/.test(value);
}

function isValidYear(value: string) {
  return /^\d{4}$/.test(value);
}

function isValidSequence(value: string) {
  return /^\d{1,20}$/.test(value);
}

async function fetchPncpEndpoint(path: string) {
  const url = new URL(path, "https://pncp.gov.br");
  return fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ProAR-Licitacoes/1.0",
    },
    cache: "no-store",
  });
}

async function queryPncpEndpoint(endpoint: string, control?: string | null) {
  const response = await fetchPncpEndpoint(endpoint);

  if (!response.ok) {
    return {
      success: false as const,
      error: `O PNCP respondeu ${response.status} ao consultar os documentos.`,
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      success: false as const,
      error: "O PNCP retornou uma resposta inválida ao consultar os documentos.",
    };
  }

  const data = objectValue(payload);
  return {
    success: true as const,
    documents: extractDocuments(payload),
    detail: {
      numeroControlePncp: text(data.numeroControlePNCP || data.numeroControlePncp || control) || undefined,
      linkSistemaOrigem: text(data.linkSistemaOrigem || data.url) || undefined,
      situacao: text(data.situacaoCompraNome || data.situacaoNome || data.situacao) || undefined,
    },
  };
}

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const requestedCompany = searchParams.get("company_id");
    getEffectiveCompanyId(session, requestedCompany ? Number(requestedCompany) : null);

    const control = searchParams.get("numero_controle_pncp");
    const parsedControl = parsePncpControlNumber(control);
    const cnpj = digits(searchParams.get("cnpj") || parsedControl?.cnpj);
    const anoCompra = text(searchParams.get("ano") || searchParams.get("ano_compra") || parsedControl?.anoCompra);
    const sequencialCompra = text(searchParams.get("sequencial") || searchParams.get("sequencial_compra") || parsedControl?.sequencialCompra);

    if (!cnpj || !anoCompra || !sequencialCompra) {
      return NextResponse.json({
        success: false,
        error: "Dados insuficientes para consultar os documentos do PNCP.",
      }, { status: 400 });
    }

    if (!isValidCnpj(cnpj) || !isValidYear(anoCompra) || !isValidSequence(sequencialCompra)) {
      return NextResponse.json({
        success: false,
        error: "Identificação do processo PNCP inválida.",
      }, { status: 400 });
    }

    const endpoints = [
      `/api/consulta/v1/orgaos/${cnpj}/compras/${anoCompra}/${sequencialCompra}`,
      `/api/consulta/v1/orgaos/${cnpj}/contratacoes/${anoCompra}/${sequencialCompra}`,
    ];

    const results = await Promise.all(endpoints.map((endpoint) => queryPncpEndpoint(endpoint, control)));

    const successWithDocuments = results.find((result) => result.success && result.documents.length > 0);
    if (successWithDocuments && successWithDocuments.success) {
      return NextResponse.json({
        success: true,
        data: successWithDocuments.documents,
        detail: successWithDocuments.detail,
      });
    }

    const successWithoutDocuments = results.find((result) => result.success);
    if (successWithoutDocuments && successWithoutDocuments.success) {
      return NextResponse.json({
        success: true,
        data: successWithoutDocuments.documents,
        detail: successWithoutDocuments.detail,
      });
    }

    const lastError = results.find((result) => !result.success)?.error || "O PNCP não respondeu à consulta de documentos no momento.";
    return NextResponse.json({ success: false, error: lastError }, { status: 502 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível consultar os documentos do PNCP.",
    }, { status: 500 });
  }
}
